import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver, InstructionWithEphemeralSigners } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from '@coral-xyz/anchor';

/**
 * PythDataProvider - A service for fetching and using Pyth price feeds on Sonic SVM
 * This class offers methods to:
 * 1. Fetch real-time price data from Pyth's Hermes service
 * 2. Post these price updates to Sonic SVM chain
 * 3. Stream price updates for continuous monitoring
 */
export class PythDataProvider {
  private connection: Connection;
  private keypair: Keypair;
  private pythReceiver: PythSolanaReceiver;
  private hermesClient: HermesClient;
  
  // Common price feed IDs for reference
  public static readonly PRICE_FEED_IDS = {
    BTC_USD: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    SOL_USD: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    USDC_USD: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    USDT_USD: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    JUP_USD: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    BONK_USD: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419"
  };

  /**
   * Initialize the PythDataProvider
   * @param connection Solana connection instance
   * @param keypair Solana wallet keypair
   */
  constructor(connection: Connection, keypair: Keypair) {
    this.connection = connection;
    this.keypair = keypair;
    
    // Initialize Pyth Hermes client
    this.hermesClient = new HermesClient("https://hermes.pyth.network/", {});
    
    // Create a proper wallet implementation that implements the Anchor Wallet interface
    const wallet: Wallet = {
      publicKey: keypair.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof Transaction) {
          tx.partialSign(keypair);
        } else if (tx instanceof VersionedTransaction) {
          tx.sign([keypair]);
        }
        return tx;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return Promise.all(txs.map(async (tx) => {
          if (tx instanceof Transaction) {
            tx.partialSign(keypair);
          } else if (tx instanceof VersionedTransaction) {
            tx.sign([keypair]);
          }
          return tx;
        }));
      },
      payer: keypair
    };
    
    // Initialize Pyth Solana receiver for on-chain interactions
    this.pythReceiver = new PythSolanaReceiver({ connection, wallet });
  }

  /**
   * Get latest price for a specific asset
   * @param priceId Pyth price feed ID
   * @returns Parsed price data
   */
  public async getLatestPrice(priceId: string): Promise<{
    price: number;
    confidence: number;
    timestamp: number;
  }> {
    try {
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates([priceId]);
      
      if (!priceUpdates.parsed || priceUpdates.parsed.length === 0) {
        throw new Error(`No price data available for ID: ${priceId}`);
      }
      
      const update = priceUpdates.parsed[0];
      // Ensure price and conf are numbers before performing arithmetic
      const priceValue = Number(update.price.price);
      const confValue = Number(update.price.conf);
      const expoValue = Number(update.price.expo);
      
      const price = priceValue * Math.pow(10, expoValue);
      const confidence = confValue * Math.pow(10, expoValue);
      
      return {
        price,
        confidence,
        timestamp: update.price.publish_time
      };
    } catch (error) {
      console.error(`Error fetching price for ${priceId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest prices for multiple assets
   * @param priceIds Array of Pyth price feed IDs
   * @returns Map of price feed ID to price data
   */
  public async getLatestPrices(priceIds: string[]): Promise<Map<string, {
    price: number;
    confidence: number;
    timestamp: number;
  }>> {
    try {
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates(priceIds);
      const resultMap = new Map();
      
      if (!priceUpdates.parsed || priceUpdates.parsed.length === 0) {
        throw new Error('No price data available');
      }
      
      priceUpdates.parsed.forEach(update => {
        const id = update.id;
        // Ensure price and conf are numbers before performing arithmetic
        const priceValue = Number(update.price.price);
        const confValue = Number(update.price.conf);
        const expoValue = Number(update.price.expo);
        
        const price = priceValue * Math.pow(10, expoValue);
        const confidence = confValue * Math.pow(10, expoValue);
        
        resultMap.set(id, {
          price,
          confidence,
          timestamp: update.price.publish_time
        });
      });
      
      return resultMap;
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
      throw error;
    }
  }

  /**
   * Start streaming price updates
   * @param priceIds Array of Pyth price feed IDs
   * @param callback Function to call with each update
   * @returns EventSource that can be closed to stop streaming
   */
  public async streamPrices(
    priceIds: string[],
    callback: (id: string, price: number, confidence: number, timestamp: number) => void
  ): Promise<EventSource> {
    try {
      // Use the correct method for streaming price updates
      const eventSource = await this.hermesClient.getPriceUpdatesStream(priceIds);
      
      eventSource.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        
        if (data.parsed && data.parsed.length > 0) {
          data.parsed.forEach((update: any) => {
            const id = update.id;
            // Ensure price and conf are numbers before performing arithmetic
            const priceValue = Number(update.price.price);
            const confValue = Number(update.price.conf);
            const expoValue = Number(update.price.expo);
            
            const price = priceValue * Math.pow(10, expoValue);
            const confidence = confValue * Math.pow(10, expoValue);
            const timestamp = update.price.publish_time;
            
            callback(id, price, confidence, timestamp);
          });
        }
      };
      
      eventSource.onerror = (error: Event) => {
        console.error('Error in price stream:', error);
      };
      
      return eventSource;
    } catch (error) {
      console.error('Error setting up price stream:', error);
      throw error;
    }
  }

  /**
   * Post price updates to Sonic SVM chain and execute application logic
   * @param priceIds Array of Pyth price feed IDs to post
   * @param consumerCallback Function to add your application instructions that use the price feeds
   * @returns Transaction signatures
   */
  public async postPriceUpdatesAndExecute(
    priceIds: string[],
    consumerCallback: (
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey
    ) => Promise<InstructionWithEphemeralSigners[]>
  ): Promise<string[]> {
    try {
      // Fetch price updates from Hermes
      const priceUpdateData = (
        await this.hermesClient.getLatestPriceUpdates(
          priceIds,
          { encoding: "base64" }
        )
      ).binary.data;
      
      // Create transaction builder for posting price updates
      const transactionBuilder = this.pythReceiver.newTransactionBuilder({
        closeUpdateAccounts: true, // Close accounts after use to reclaim rent
      });
      
      // Add price updates to the transaction
      await transactionBuilder.addPostPriceUpdates(priceUpdateData);
      
      // Add consumer instructions
      await transactionBuilder.addPriceConsumerInstructions(consumerCallback);
      
      // Build and send transactions
      const transactions = await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      });
      
      // Send transactions and get results
      const results = await this.pythReceiver.provider.sendAll(transactions, {
        skipPreflight: true
      });
      
      // Extract signatures from results
      return results;
    } catch (error) {
      console.error('Error posting price updates and executing logic:', error);
      throw error;
    }
  }

  /**
   * Get a price feed account address for a specific shard
   * @param priceFeedId Pyth price feed ID
   * @param shardId Shard ID (default: 0)
   * @returns Price feed account public key
   */
  public getPriceFeedAccountAddress(priceFeedId: string, shardId: number = 0): PublicKey {
    return this.pythReceiver.getPriceFeedAccountAddress(shardId, priceFeedId);
  }

  /**
   * Get all price feeds for a specific market (like crypto)
   * @param assetType Asset type (e.g., "crypto", "fx", "equity")
   * @returns Array of price feed information
   */
  public async getAllPriceFeeds(assetType: "crypto" | "fx" | "equity" | "metal" | "rates" | "crypto_redemption_rate"): Promise<any[]> {
    try {
      // Use proper assetType parameter for getPriceFeeds
      const priceFeeds = await this.hermesClient.getPriceFeeds({ assetType });
      return priceFeeds;
    } catch (error) {
      console.error(`Error fetching ${assetType} price feeds:`, error);
      throw error;
    }
  }
}