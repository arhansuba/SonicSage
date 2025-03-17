import { 
  Connection, 
  PublicKey, 
  Transaction, 
  Keypair, 
  sendAndConfirmTransaction, 
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';

// Type definition for price update data
interface PriceUpdate {
  id: string;
  price: {
    price: number | string;  // Accept both number and string
    conf: number | string;   // Accept both number and string
    expo: number | string;   // Accept both number and string
    publish_time: number;
  };
  ema_price?: {
    price: number | string;
    conf: number | string;
    expo: number | string;
    publish_time: number;
  };
  metadata?: {
    slot: number;
    proof_available_time: number;
    prev_publish_time: number;
  };
}

// Interface for streaming event data
interface StreamingPriceEvent {
  data: string;
}

// Interface for stream event source
interface PriceEventSource {
  onmessage: (event: StreamingPriceEvent) => void;
  onerror: (error: Event) => void;
  close: () => void;
}

/**
 * SonicAITrader - An AI-powered trading bot for the Sonic Mobius Hackathon
 * This bot leverages real-time price data from Pyth and implements AI-based
 * trading strategies on Sonic SVM.
 */
export class SonicAITrader {
  private connection: Connection;
  private wallet: Keypair;
  private pythReceiver: PythSolanaReceiver;
  private hermesClient: HermesClient;
  private model: tf.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private tradingActive: boolean = false;
  private tradingInterval: NodeJS.Timeout | null = null;
  private priceFeeds: Map<string, PriceUpdate> = new Map();
  private eventSource: any = null; // Will hold the event source for price updates
  
  // Configuration constants
  private readonly RPC_URL: string = 'https://api.mainnet-alpha.sonic.game';
  private readonly HERMES_URL: string = 'https://hermes.pyth.network/';
  private readonly TRADING_INTERVAL_MS: number = 60000; // 1 minute
  private readonly PRICE_FEED_IDS: string[] = [
    // BTC/USD price feed
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    // ETH/USD price feed
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    // SOL/USD price feed
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
  ];
  
  // Store historical prices for model prediction
  private priceHistory: Map<string, number[]> = new Map();
  
  /**
   * Initialize the SonicAITrader
   * @param keystorePath Path to a Solana keystore file
   */
  constructor(keystorePath: string) {
    // Initialize Solana connection
    this.connection = new Connection(this.RPC_URL, 'confirmed');
    
    // Load wallet from keystore
    const secretKey = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    this.wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log('Wallet loaded with address:', this.wallet.publicKey.toString());
    
    // Initialize Pyth client for price feeds
    this.hermesClient = new HermesClient(this.HERMES_URL, {});
    
    // Initialize Pyth Solana receiver for on-chain interactions
    // Fixed: Use a proper generic function signature for signTransaction
    this.pythReceiver = new PythSolanaReceiver({ 
      connection: this.connection, 
      wallet: {
        publicKey: this.wallet.publicKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
          if (tx instanceof VersionedTransaction) {
            tx.sign([this.wallet]);
          } else {
            tx.partialSign(this.wallet);
          }
          return tx;
        },
        payer: new Keypair,
        signAllTransactions: function <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
          throw new Error('Function not implemented.');
        }
      }
    });
    
    // Initialize price history for each asset
    this.PRICE_FEED_IDS.forEach(id => {
      this.priceHistory.set(id, []);
    });
  }

  /**
   * Load the AI prediction model
   * @param modelPath Path to the TensorFlow.js model
   */
  public async loadModel(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      this.isModelLoaded = true;
      console.log('AI trading model loaded successfully');
    } catch (error) {
      console.error('Failed to load AI model:', error);
      throw error;
    }
  }

  /**
   * Train a new AI model based on historical price data
   * @param trainingData Historical price data for training
   * @param savePath Path to save the trained model
   */
  public async trainModel(trainingData: any[], savePath: string): Promise<void> {
    // Create a simple LSTM model for price prediction
    const model = tf.sequential();
    
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true,
      inputShape: [30, 1], // 30 days of price data, 1 feature (price)
    }));
    
    // Fixed: Use proper DropoutLayerArgs object
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.lstm({ units: 50, returnSequences: false }));
    model.add(tf.layers.dense({ units: 1 }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });
    
    // Prepare the training data
    // This is a simplified version - in a real implementation, you would
    // properly process and normalize your historical price data
    
    // Create a properly shaped tensor input
    const inputData: number[][][] = [];
    trainingData.forEach(d => {
      const sequence: number[][] = [];
      for (let i = 0; i < 30; i++) {
        sequence.push([d.prices[i]]);
      }
      inputData.push(sequence);
    });
    
    const xs = tf.tensor3d(inputData);
    const ys = tf.tensor2d(trainingData.map(d => [d.prices[30]]), [trainingData.length, 1]);
    
    // Train the model
    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1} - loss: ${logs?.loss?.toFixed(6)}`);
        }
      }
    });
    
    // Save the model
    await model.save(`file://${savePath}`);
    this.model = model;
    this.isModelLoaded = true;
    console.log('Model trained and saved successfully');
    
    // Clean up tensors
    xs.dispose();
    ys.dispose();
  }

  /**
   * Start fetching real-time price data from Pyth
   */
  public async startPriceFeed(): Promise<void> {
    try {
      // Get initial price updates
      await this.updatePrices();
      
      // Set up EventSource for streaming price updates
      // Note: The HermesClient doesn't directly expose streaming methods, 
      // but we can use server-sent events (SSE) to get streaming updates
      const streamUrl = new URL('/v2/updates/price/stream', this.HERMES_URL);
      this.PRICE_FEED_IDS.forEach(id => {
        streamUrl.searchParams.append('ids[]', id);
      });
      
      // Using the native EventSource or a polyfill
      const EventSource = require('eventsource');
      this.eventSource = new EventSource(streamUrl.toString());
      
      this.eventSource.onmessage = async (event: StreamingPriceEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.parsed && data.parsed.length > 0) {
            data.parsed.forEach((update: PriceUpdate) => {
              const id = update.id;
              
              // Convert price.price and price.conf to numbers if they are strings
              const priceValue = typeof update.price.price === 'string' 
                ? parseFloat(update.price.price) 
                : update.price.price;
                
              const expoValue = typeof update.price.expo === 'string'
                ? parseFloat(update.price.expo)
                : update.price.expo;
              
              // Calculate the actual price 
              const price = priceValue * Math.pow(10, expoValue);
              
              // Store the price
              this.priceFeeds.set(id, update);
              
              // Update price history for the model
              const history = this.priceHistory.get(id) || [];
              history.push(price);
              // Limit history size to 1000 data points
              if (history.length > 1000) {
                history.shift();
              }
              this.priceHistory.set(id, history);
              
              console.log(`Updated price feed ${id}: $${price.toFixed(2)}`);
            });
            
            // Run trading strategy if active
            if (this.tradingActive) {
              await this.executeTrading();
            }
          }
        } catch (err) {
          console.error('Error processing price update:', err);
        }
      };
      
      this.eventSource.onerror = (error: Event) => {
        console.error('Error in price feed stream:', error);
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Try to reconnect after a delay
        setTimeout(() => this.startPriceFeed(), 5000);
      };
      
      console.log('Started real-time price feed');
    } catch (error) {
      console.error('Failed to start price feed:', error);
      throw error;
    }
  }

  /**
   * Update prices manually (used for initial load and fallback)
   */
  private async updatePrices(): Promise<void> {
    try {
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates(this.PRICE_FEED_IDS);
      
      if (priceUpdates.parsed && priceUpdates.parsed.length > 0) {
        priceUpdates.parsed.forEach((update: PriceUpdate) => {
          const id = update.id;
          
          // Convert price.price and price.expo to numbers if they are strings
          const priceValue = typeof update.price.price === 'string' 
            ? parseFloat(update.price.price) 
            : update.price.price;
            
          const expoValue = typeof update.price.expo === 'string'
            ? parseFloat(update.price.expo)
            : update.price.expo;
          
          // Calculate the actual price
          const price = priceValue * Math.pow(10, expoValue);
          
          // Store the price
          this.priceFeeds.set(id, update);
          
          // Update price history
          const history = this.priceHistory.get(id) || [];
          history.push(price);
          if (history.length > 1000) {
            history.shift();
          }
          this.priceHistory.set(id, history);
          
          console.log(`Fetched price feed ${id}: $${price.toFixed(2)}`);
        });
      }
    } catch (error) {
      console.error('Failed to update prices:', error);
      throw error;
    }
  }

  /**
   * Start automated trading
   */
  public startTrading(): void {
    if (!this.isModelLoaded) {
      console.error('Cannot start trading: AI model not loaded');
      return;
    }
    
    this.tradingActive = true;
    console.log('Automated trading started');
    
    // Set up a regular interval for trading decisions
    this.tradingInterval = setInterval(async () => {
      await this.executeTrading();
    }, this.TRADING_INTERVAL_MS);
  }

  /**
   * Stop automated trading
   */
  public stopTrading(): void {
    this.tradingActive = false;
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
    }
    console.log('Automated trading stopped');
  }

  /**
   * Execute trading strategy based on price predictions
   */
  private async executeTrading(): Promise<void> {
    if (!this.isModelLoaded || !this.model) {
      console.error('Cannot execute trading: AI model not loaded');
      return;
    }
    
    try {
      // For each asset we're tracking
      for (const feedId of this.PRICE_FEED_IDS) {
        const history = this.priceHistory.get(feedId);
        
        if (!history || history.length < 30) {
          console.log(`Not enough price history for ${feedId} to make predictions`);
          continue;
        }
        
        // Prepare data for prediction
        const recentPrices = history.slice(-30);
        const normalizedPrices = this.normalizePrices(recentPrices);
        
        // Fixed: Create a properly shaped tensor for the LSTM input
        const inputData: number[][] = [];
        for (let i = 0; i < normalizedPrices.length; i++) {
          inputData.push([normalizedPrices[i]]);
        }
        const input = tf.tensor3d([inputData], [1, 30, 1]);
        
        // Make prediction
        const prediction = this.model.predict(input) as tf.Tensor;
        const predictedValue = prediction.dataSync()[0];
        
        // Denormalize prediction
        const min = Math.min(...recentPrices);
        const max = Math.max(...recentPrices);
        const denormalizedPrediction = predictedValue * (max - min) + min;
        
        // Current price
        const currentPrice = recentPrices[recentPrices.length - 1];
        
        // Calculate percentage change prediction
        const percentageChange = ((denormalizedPrediction - currentPrice) / currentPrice) * 100;
        
        console.log(`Asset ${feedId} - Current price: $${currentPrice.toFixed(2)}, Predicted: $${denormalizedPrediction.toFixed(2)}, Change: ${percentageChange.toFixed(2)}%`);
        
        // Trading decision logic
        if (percentageChange > 2.0) {
          // Predicted price is more than 2% higher - consider buying
          console.log(`🔼 Buy signal for asset ${feedId}`);
          await this.executeTrade(feedId, 'buy', currentPrice);
        } else if (percentageChange < -2.0) {
          // Predicted price is more than 2% lower - consider selling
          console.log(`🔽 Sell signal for asset ${feedId}`);
          await this.executeTrade(feedId, 'sell', currentPrice);
        } else {
          // No significant change predicted - hold
          console.log(`⏹️ Hold position for asset ${feedId}`);
        }
        
        // Clean up tensors
        input.dispose();
        prediction.dispose();
      }
    } catch (error) {
      console.error('Error executing trading strategy:', error);
    }
  }

  /**
   * Execute a trade
   * @param feedId Price feed ID for the asset
   * @param action 'buy' or 'sell'
   * @param price Current price
   */
  private async executeTrade(feedId: string, action: 'buy' | 'sell', price: number): Promise<void> {
    try {
      // Get price update binary data for on-chain submission
      const priceUpdateData = (
        await this.hermesClient.getLatestPriceUpdates(
          [feedId],
          { encoding: "base64" }
        )
      ).binary.data;
      
      // Create transaction builder for posting price updates
      const transactionBuilder = this.pythReceiver.newTransactionBuilder({
        closeUpdateAccounts: true, // Close the account after use to reclaim rent
      });
      
      // Add the price update to the transaction
      await transactionBuilder.addPostPriceUpdates(priceUpdateData);
      
      // Add your trade instructions
      await transactionBuilder.addPriceConsumerInstructions(
        async (getPriceUpdateAccount) => {
          // Get the price update account
          const priceUpdateAccount = getPriceUpdateAccount(feedId);
          
          // Here you would implement your actual trading logic
          // This is simplified for the example:
          console.log(`Simulating ${action} trade at price $${price.toFixed(2)}`);
          console.log(`Using price update account: ${priceUpdateAccount.toString()}`);
          
          // Return empty array as this is a simulation
          return [];
        }
      );
      
      // Build and send transactions
      const transactions = await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      });
      
      // Send transactions
      const results = await this.pythReceiver.provider.sendAll(transactions, { 
        skipPreflight: true 
      });
      
      console.log(`Trade execution completed with results:`, results);
    } catch (error) {
      console.error(`Failed to execute ${action} trade:`, error);
    }
  }

  /**
   * Normalize price data for the model
   * @param prices Array of price data
   * @returns Normalized prices (between 0 and 1)
   */
  private normalizePrices(prices: number[]): number[] {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    if (range === 0) return prices.map(() => 0.5);
    
    return prices.map(price => (price - min) / range);
  }

  /**
   * Get account balance
   */
  public async getBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopTrading();
    
    // Close the event source if it exists
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Clean up tensors
    if (this.model) {
      // Note: In a production app, you might want to dispose of all tensors
      // tf.disposeVariables();
    }
    
    console.log('Resources cleaned up');
  }
}

/**
 * Example usage
 */
async function main() {
  try {
    // Create the SonicAITrader instance
    const trader = new SonicAITrader('path/to/keypair.json');
    
    // Load a pre-trained model or train a new one
    await trader.loadModel('path/to/model');
    
    // Get account balance
    const balance = await trader.getBalance();
    console.log(`Account balance: ${balance} SOL`);
    
    // Start fetching price data
    await trader.startPriceFeed();
    
    // Start automated trading
    trader.startTrading();
    
    // Keep the process running
    console.log('AI Trading bot is now running...');
    
    // Example of stopping trading after 1 hour
    setTimeout(() => {
      trader.stopTrading();
      console.log('Trading stopped after 1 hour');
      
      // Clean up resources
      trader.cleanup();
    }, 60 * 60 * 1000);
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Uncomment to run the example
// main();