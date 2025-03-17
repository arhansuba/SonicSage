import { 
    Connection, 
    PublicKey, 
    Transaction, 
    SystemProgram,
    SendOptions,
    Commitment,
    ConfirmOptions,
    Keypair,
    Signer
  } from '@solana/web3.js';
  import { 
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getMint,
    getAccount
  } from '@solana/spl-token';
  import { HermesClient } from '@pythnetwork/hermes-client';
  import { PythSolanaReceiver } from '@pythnetwork/pyth-solana-receiver';
import { ENDPOINT_SONIC_RPC } from '@/constants/endpoints';

  
  /**
   * Service class for interacting with Sonic SVM blockchain
   */
  export class SonicSVMService {
    private connection: Connection;
    private hermesClient: HermesClient;
    private pythReceiver: PythSolanaReceiver | null = null;
    
    constructor(endpoint: string = ENDPOINT_SONIC_RPC) {
      this.connection = new Connection(endpoint, 'confirmed');
      this.hermesClient = new HermesClient('https://hermes.pyth.network', {});
    }
    
    /**
     * Initialize PythSolanaReceiver with a wallet
     * @param wallet Wallet instance
     */
    initializePythReceiver(wallet: any): void {
      this.pythReceiver = new PythSolanaReceiver({ connection: this.connection, wallet });
    }
    
    /**
     * Get balance of native SOL for a wallet address
     * @param walletAddress Wallet public key
     * @returns Balance in SOL (not lamports)
     */
    async getSolBalance(walletAddress: string): Promise<number> {
      try {
        const publicKey = new PublicKey(walletAddress);
        const balance = await this.connection.getBalance(publicKey);
        return balance / 1e9; // Convert lamports to SOL
      } catch (error) {
        console.error('Error fetching SOL balance:', error);
        throw new Error('Failed to fetch SOL balance');
      }
    }
    
    /**
     * Get token balance for a specific token in a wallet
     * @param walletAddress Wallet public key
     * @param tokenAddress Token mint address
     * @returns Token balance and decimal info
     */
    async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<{
      amount: number;
      decimals: number;
      uiAmount: number;
    }> {
      try {
        const walletPublicKey = new PublicKey(walletAddress);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        // Get associated token account address
        const tokenAccountAddress = await getAssociatedTokenAddress(
          tokenPublicKey,
          walletPublicKey
        );
        
        // Get token account info
        try {
          const tokenAccount = await getAccount(this.connection, tokenAccountAddress);
          
          // Get mint info for decimals
          const mintInfo = await getMint(this.connection, tokenPublicKey);
          
          const amount = Number(tokenAccount.amount);
          const decimals = mintInfo.decimals;
          const uiAmount = amount / Math.pow(10, decimals);
          
          return {
            amount,
            decimals,
            uiAmount
          };
        } catch (error) {
          // Token account doesn't exist or other error
          return {
            amount: 0,
            decimals: 0,
            uiAmount: 0
          };
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
        throw new Error('Failed to fetch token balance');
      }
    }
    
    /**
     * Get all token balances for a wallet
     * @param walletAddress Wallet public key
     * @returns Array of token account info
     */
    async getAllTokenBalances(walletAddress: string): Promise<any[]> {
      try {
        const walletPublicKey = new PublicKey(walletAddress);
        
        // Get all token accounts owned by the wallet
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          walletPublicKey,
          { programId: TOKEN_PROGRAM_ID }
        );
        
        // Format the response
        return tokenAccounts.value.map(account => {
          const { mint, tokenAmount } = account.account.data.parsed.info;
          return {
            mint,
            amount: tokenAmount.amount,
            decimals: tokenAmount.decimals,
            uiAmount: tokenAmount.uiAmount,
          };
        });
      } catch (error) {
        console.error('Error fetching all token balances:', error);
        throw new Error('Failed to fetch token balances');
      }
    }
    
    /**
     * Create and send a transaction to transfer native SOL
     * @param fromWallet Sender wallet with secretKey
     * @param toAddress Recipient address
     * @param amount Amount to send in SOL
     * @returns Transaction signature
     */
    async transferSol(
      fromWallet: Keypair,
      toAddress: string,
      amount: number
    ): Promise<string> {
      try {
        const toPublicKey = new PublicKey(toAddress);
        const lamports = amount * 1e9; // Convert SOL to lamports
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromWallet.publicKey,
            toPubkey: toPublicKey,
            lamports
          })
        );
        
        // Set recent blockhash and fee payer
        transaction.recentBlockhash = (
          await this.connection.getLatestBlockhash()
        ).blockhash;
        transaction.feePayer = fromWallet.publicKey;
        
        // Sign and send transaction
        transaction.sign(fromWallet);
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize()
        );
        
        // Confirm transaction
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        return signature;
      } catch (error) {
        console.error('Error transferring SOL:', error);
        throw new Error('Failed to transfer SOL');
      }
    }
    
    /**
     * Create and send a transaction to transfer SPL tokens
     * @param fromWallet Sender wallet with secretKey
     * @param toAddress Recipient address
     * @param tokenAddress Token mint address
     * @param amount Amount to send (in token units, not accounting for decimals)
     * @returns Transaction signature
     */
    async transferToken(
      fromWallet: Keypair,
      toAddress: string,
      tokenAddress: string,
      amount: number
    ): Promise<string> {
      try {
        const toPublicKey = new PublicKey(toAddress);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        // Get source token account
        const sourceTokenAccount = await getAssociatedTokenAddress(
          tokenPublicKey,
          fromWallet.publicKey
        );
        
        // Get destination token account
        const destinationTokenAccount = await getAssociatedTokenAddress(
          tokenPublicKey,
          toPublicKey
        );
        
        // Check if destination token account exists
        const transaction = new Transaction();
        
        try {
          await getAccount(this.connection, destinationTokenAccount);
        } catch (error) {
          // If destination token account doesn't exist, create it
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromWallet.publicKey,
              destinationTokenAccount,
              toPublicKey,
              tokenPublicKey
            )
          );
        }
        
        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            sourceTokenAccount,
            destinationTokenAccount,
            fromWallet.publicKey,
            amount
          )
        );
        
        // Set recent blockhash and fee payer
        transaction.recentBlockhash = (
          await this.connection.getLatestBlockhash()
        ).blockhash;
        transaction.feePayer = fromWallet.publicKey;
        
        // Sign and send transaction
        transaction.sign(fromWallet);
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize()
        );
        
        // Confirm transaction
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        return signature;
      } catch (error) {
        console.error('Error transferring token:', error);
        throw new Error('Failed to transfer token');
      }
    }
    
    /**
     * Get transaction details
     * @param signature Transaction signature
     * @returns Transaction details
     */
    async getTransaction(signature: string): Promise<any> {
      try {
        const transaction = await this.connection.getParsedTransaction(
          signature,
          'confirmed'
        );
        
        return transaction;
      } catch (error) {
        console.error('Error fetching transaction:', error);
        throw new Error('Failed to fetch transaction details');
      }
    }
    
    /**
     * Get transaction history for a wallet address
     * @param walletAddress Wallet public key
     * @param limit Number of transactions to retrieve
     * @param before Before signature for pagination
     * @returns Array of transactions
     */
    async getTransactionHistory(
      walletAddress: string,
      limit: number = 10,
      before?: string
    ): Promise<any[]> {
      try {
        const walletPublicKey = new PublicKey(walletAddress);
        
        // Get signatures for transactions
        const signatures = await this.connection.getSignaturesForAddress(
          walletPublicKey,
          { limit, before }
        );
        
        // Get transaction details for each signature
        const transactions = await Promise.all(
          signatures.map(async (sig) => {
            const tx = await this.connection.getParsedTransaction(
              sig.signature,
              'confirmed'
            );
            
            return {
              signature: sig.signature,
              blockTime: sig.blockTime,
              confirmationStatus: sig.confirmationStatus,
              err: sig.err,
              memo: sig.memo,
              transaction: tx
            };
          })
        );
        
        return transactions;
      } catch (error) {
        console.error('Error fetching transaction history:', error);
        throw new Error('Failed to fetch transaction history');
      }
    }
    
    /**
     * Get current price from Pyth Oracle
     * @param priceFeedId Price feed ID
     * @returns Price data
     */
    async getPythPrice(priceFeedId: string): Promise<any> {
      try {
        const priceData = await this.hermesClient.getLatestPriceUpdates([priceFeedId]);
        
        if (!priceData.parsed || priceData.parsed.length === 0) {
          throw new Error('No price data found for the given price feed ID');
        }
        
        const parsedPrice = priceData.parsed[0];
        
        return {
          price: Number(parsedPrice.price.price) * Math.pow(10, parsedPrice.price.expo),
          confidence: Number(parsedPrice.price.conf) * Math.pow(10, parsedPrice.price.expo),
          publishTime: new Date(parsedPrice.price.publish_time * 1000).toISOString()
        };
      } catch (error) {
        console.error('Error fetching Pyth price:', error);
        throw new Error('Failed to fetch price from Pyth Oracle');
      }
    }
    
    /**
     * Post price updates to Solana chain using Pyth Oracle
     * @param wallet Wallet instance
     * @param priceFeedIds Array of price feed IDs
     * @returns Transaction signature
     */
    async postPythPriceUpdates(wallet: any, priceFeedIds: string[]): Promise<string> {
      if (!this.pythReceiver) {
        throw new Error('PythSolanaReceiver not initialized. Call initializePythReceiver first.');
      }
      
      try {
        // Fetch price updates from Hermes
        const priceUpdates = await this.hermesClient.getLatestPriceUpdates(priceFeedIds);
        
        // Create transaction builder
        const transactionBuilder = this.pythReceiver.newTransactionBuilder({
          closeUpdateAccounts: false,
        });
        
        // Add price updates to transaction
        await transactionBuilder.addPostPriceUpdates(priceUpdates.binary.data);
        
        // Build and send transaction
        const transactions = await transactionBuilder.buildVersionedTransactions({
          computeUnitPriceMicroLamports: 50000,
        });
        
        // Send transaction
        const result = await this.pythReceiver.provider.sendAll(transactions, { skipPreflight: true });
        
        return result[0];
      } catch (error) {
        console.error('Error posting Pyth price updates:', error);
        throw new Error('Failed to post price updates to Solana');
      }
    }
    
    /**
     * Send a raw transaction
     * @param transaction Signed transaction
     * @param options Send options
     * @returns Transaction signature
     */
    async sendTransaction(
      transaction: Transaction,
      signers: Signer[],
      options?: SendOptions
    ): Promise<string> {
      try {
        // Set recent blockhash if not already set
        if (!transaction.recentBlockhash) {
          transaction.recentBlockhash = (
            await this.connection.getLatestBlockhash()
          ).blockhash;
        }
        
        // Sign transaction if signers provided
        if (signers.length > 0) {
          transaction.sign(...signers);
        }
        
        // Send transaction
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
          options
        );
        
        // Confirm transaction
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        return signature;
      } catch (error) {
        console.error('Error sending transaction:', error);
        throw new Error('Failed to send transaction');
      }
    }
    
    /**
     * Get connection instance
     * @returns Connection instance
     */
    getConnection(): Connection {
      return this.connection;
    }
  }