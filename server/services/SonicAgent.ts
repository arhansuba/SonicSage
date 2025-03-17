import axios from 'axios';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { ENDPOINT_SONIC_RPC } from '@/constants/config';
import { decode as bs58Decode } from 'bs58';

/**
 * Shyft API response interface
 */
interface ShyftResponse<T> {
  success: boolean;
  result: T;
  message?: string;
}

/**
 * Wallet balance response
 */
interface WalletBalanceResult {
  balance: number;
}

/**
 * Token balance response
 */
interface TokenBalancesResult {
  tokens: any[];
}

/**
 * Transaction history response
 */
interface TransactionHistoryResult {
  [key: string]: any;
}

/**
 * Portfolio response
 */
interface PortfolioResult {
  sol_balance: number;
  tokens?: any[];
  nfts?: any[];
}

/**
 * Callback response
 */
interface CallbackResult {
  id: string;
}

/**
 * DeFi pool response 
 */
interface PoolResponse {
  pool?: any;
  pools?: any[];
  liquidity_details?: any;
}

/**
 * SonicAgent service that integrates with Shyft APIs for DeFi and wallet operations
 * on the Sonic SVM blockchain
 */
export class SonicAgent {
  private apiKey: string;
  private connection: Connection;
  private baseWalletUrl: string = 'https://api.shyft.to/sol/v1/wallet';
  private baseDefiUrl: string = 'https://defi.shyft.to/v0';
  private baseTransactionUrl: string = 'https://api.shyft.to/sol/v1/transaction';
  
  constructor(apiKey: string, rpcUrl: string = ENDPOINT_SONIC_RPC) {
    this.apiKey = apiKey;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }
  
  /**
   * Get wallet balance in SOL
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Wallet balance in SOL
   */
  async getWalletBalance(walletAddress: string, network: string = 'mainnet-beta'): Promise<number> {
    try {
      const response = await axios.get<ShyftResponse<WalletBalanceResult>>(`${this.baseWalletUrl}/balance`, {
        params: {
          network,
          wallet: walletAddress
        },
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result.balance;
      } else {
        throw new Error(response.data.message || 'Failed to get wallet balance');
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      throw error;
    }
  }
  
  /**
   * Get all token balances for a wallet
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Array of token balances
   */
  async getAllTokens(walletAddress: string, network: string = 'mainnet-beta'): Promise<any[]> {
    try {
      const response = await axios.get<ShyftResponse<TokenBalancesResult>>(`${this.baseWalletUrl}/all_tokens`, {
        params: {
          network,
          wallet: walletAddress
        },
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result.tokens || [];
      } else {
        throw new Error(response.data.message || 'Failed to get token balances');
      }
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw error;
    }
  }
  
  /**
   * Get full portfolio for a wallet (tokens and NFTs)
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Portfolio data
   */
  async getPortfolio(walletAddress: string, network: string = 'mainnet-beta'): Promise<PortfolioResult> {
    try {
      const response = await axios.get<ShyftResponse<PortfolioResult>>(`${this.baseWalletUrl}/get_portfolio`, {
        params: {
          network,
          wallet: walletAddress
        },
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.message || 'Failed to get portfolio');
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      throw error;
    }
  }
  
  /**
   * Get transaction history for a wallet
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @param txNum Number of transactions to fetch
   * @param beforeTxSignature Transaction signature to start from
   * @returns Transaction history
   */
  async getTransactionHistory(
    walletAddress: string, 
    network: string = 'mainnet-beta',
    txNum: number = 10,
    beforeTxSignature?: string
  ): Promise<any[]> {
    try {
      const params: any = {
        network,
        account: walletAddress,
        tx_num: txNum,
        enable_raw: true
      };
      
      if (beforeTxSignature) {
        params.before_tx_signature = beforeTxSignature;
      }
      
      const response = await axios.get<ShyftResponse<TransactionHistoryResult[]>>(`${this.baseTransactionUrl}/history`, {
        params,
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result || [];
      } else {
        throw new Error(response.data.message || 'Failed to get transaction history');
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }
  
  /**
   * Get details of a specific transaction
   * @param txSignature Transaction signature
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Transaction details
   */
  async getTransactionDetails(txSignature: string, network: string = 'mainnet-beta'): Promise<any> {
    try {
      const params: any = {
        network,
        txn_signature: txSignature
      };
      
      const response = await axios.get<ShyftResponse<any>>(`${this.baseTransactionUrl}/details`, {
        params,
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.message || 'Failed to get transaction details');
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      throw error;
    }
  }
  
  /**
   * Send SOL from one wallet to another
   * @param fromPrivateKey Private key of the sender as base58 string or Uint8Array
   * @param toAddress Recipient address
   * @param amount Amount to send in SOL
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Transaction signature
   */
  async sendSol(
    fromPrivateKey: string | Uint8Array, 
    toAddress: string, 
    amount: number,
    network: string = 'mainnet-beta'
  ): Promise<string> {
    try {
      let secretKey: Uint8Array;
      
      if (typeof fromPrivateKey === 'string') {
        // Convert from base58 to Uint8Array if needed
        secretKey = bs58Decode(fromPrivateKey);
      } else {
        secretKey = fromPrivateKey;
      }
      
      const fromKeypair = Keypair.fromSecretKey(secretKey);
      
      const requestData = {
        network,
        from_address: fromKeypair.publicKey.toString(),
        to_address: toAddress,
        amount
      };
      
      const response = await axios.post<ShyftResponse<{ txn_signature: string }>>(
        `${this.baseWalletUrl}/send_sol`,
        requestData,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.result.txn_signature;
      } else {
        throw new Error(response.data.message || 'Failed to send SOL');
      }
    } catch (error) {
      console.error('Error sending SOL:', error);
      throw error;
    }
  }
  
  /**
   * Send a transaction to the blockchain
   * @param encodedTransaction Base64 encoded transaction
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Transaction signature
   */
  async sendTransaction(
    encodedTransaction: string,
    network: string = 'mainnet-beta'
  ): Promise<string> {
    try {
      const requestData = {
        network,
        encoded_transaction: encodedTransaction
      };
      
      const response = await axios.post<ShyftResponse<{ txn_signature: string }>>(
        `${this.baseTransactionUrl}/send_txn`,
        requestData,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.result.txn_signature;
      } else {
        throw new Error(response.data.message || 'Failed to send transaction');
      }
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }
  
  /**
   * Get pool information by address
   * @param poolAddress Pool address
   * @returns Pool details
   */
  async getPoolByAddress(poolAddress: string): Promise<PoolResponse> {
    try {
      const response = await axios.get<PoolResponse>(`${this.baseDefiUrl}/pools/get_by_address`, {
        params: {
          address: poolAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching pool by address:', error);
      throw error;
    }
  }
  
  /**
   * Get pools by token pair
   * @param tokenA First token address
   * @param tokenB Second token address
   * @param dex Optional array of DEX names
   * @param page Page number
   * @param limit Results per page
   * @returns List of pools
   */
  async getPoolsByPair(
    tokenA: string,
    tokenB: string,
    dex?: string[],
    page: number = 1,
    limit: number = 10
  ): Promise<PoolResponse> {
    try {
      const params: any = {
        tokenA,
        tokenB,
        page,
        limit
      };
      
      if (dex && dex.length > 0) {
        params.dex = dex;
      }
      
      const response = await axios.get<PoolResponse>(`${this.baseDefiUrl}/pools/get_by_pair`, {
        params,
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching pools by pair:', error);
      throw error;
    }
  }
  
  /**
   * Get all pools for a token
   * @param token Token address
   * @param page Page number
   * @param limit Results per page
   * @returns List of pools
   */
  async getPoolsByToken(
    token: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PoolResponse> {
    try {
      const response = await axios.get<PoolResponse>(`${this.baseDefiUrl}/pools/get_by_token`, {
        params: {
          token,
          page,
          limit
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching pools by token:', error);
      throw error;
    }
  }
  
  /**
   * Get liquidity details for a pool
   * @param poolAddress Pool address
   * @returns Liquidity details
   */
  async getLiquidityDetails(poolAddress: string): Promise<PoolResponse> {
    try {
      const response = await axios.get<PoolResponse>(`${this.baseDefiUrl}/pools/get_liquidity_details`, {
        params: {
          address: poolAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching liquidity details:', error);
      throw error;
    }
  }
  
  /**
   * Get stake accounts for a wallet
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @param page Page number
   * @param size Results per page
   * @returns Stake accounts
   */
  async getStakeAccounts(
    walletAddress: string,
    network: string = 'mainnet-beta',
    page: number = 1,
    size: number = 10
  ): Promise<any> {
    try {
      const response = await axios.get<ShyftResponse<any>>(`${this.baseWalletUrl}/stake_accounts`, {
        params: {
          network,
          wallet_address: walletAddress,
          page,
          size
        },
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.message || 'Failed to get stake accounts');
      }
    } catch (error) {
      console.error('Error fetching stake accounts:', error);
      throw error;
    }
  }
  
  /**
   * Get connection instance
   * @returns Connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }
  
  /**
   * Analyze a wallet's portfolio and provide recommendations
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Portfolio analysis and recommendations
   */
  async analyzePortfolio(walletAddress: string, network: string = 'mainnet-beta'): Promise<any> {
    try {
      // Get portfolio data
      const portfolio = await this.getPortfolio(walletAddress, network);
      
      // Basic metrics
      const totalValue = portfolio.sol_balance + (portfolio.tokens?.reduce((sum: number, token: any) => sum + (token.value_usd || 0), 0) || 0);
      const tokenCount = portfolio.tokens?.length || 0;
      const nftCount = portfolio.nfts?.length || 0;
      
      // Token allocation analysis
      const tokenAllocations = portfolio.tokens?.map((token: any) => ({
        symbol: token.symbol || 'Unknown',
        mint: token.address,
        percentage: ((token.value_usd || 0) / totalValue) * 100,
        value_usd: token.value_usd || 0
      })) || [];
      
      // Add SOL to allocations
      tokenAllocations.push({
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        percentage: (portfolio.sol_balance / totalValue) * 100,
        value_usd: portfolio.sol_balance
      });
      
      // Sort by percentage
      tokenAllocations.sort((a: any, b: any) => b.percentage - a.percentage);
      
      // Generate recommendations
      const recommendations = [];
      
      // Check if portfolio is too concentrated
      const topTokenPercentage = tokenAllocations[0]?.percentage || 0;
      if (topTokenPercentage > 50) {
        recommendations.push({
          type: 'DIVERSIFICATION',
          title: 'Consider diversifying your portfolio',
          description: `Your portfolio is heavily concentrated in ${tokenAllocations[0]?.symbol} (${topTokenPercentage.toFixed(2)}%). Consider diversifying.`,
          priority: 'HIGH'
        });
      }
      
      // Check if portfolio has stable coins
      const stableCoins = tokenAllocations.filter((token: any) => 
        ['USDC', 'USDT', 'BUSD', 'DAI', 'TUSD', 'USDD'].includes(token.symbol)
      );
      
      const stableCoinPercentage = stableCoins.reduce((sum: number, token: any) => sum + token.percentage, 0);
      
      if (stableCoinPercentage < 10) {
        recommendations.push({
          type: 'RISK_MANAGEMENT',
          title: 'Increase stablecoin allocation',
          description: `Your portfolio has only ${stableCoinPercentage.toFixed(2)}% in stablecoins. Consider increasing this allocation for better risk management.`,
          priority: 'MEDIUM'
        });
      }
      
      // Check if SOL percentage is too low
      const solPercentage = tokenAllocations.find((token: any) => token.symbol === 'SOL')?.percentage || 0;
      if (solPercentage < 5) {
        recommendations.push({
          type: 'NETWORK_TOKEN',
          title: 'Increase SOL holdings',
          description: `Your SOL allocation is only ${solPercentage.toFixed(2)}%. Consider holding more SOL for transaction fees and network participation.`,
          priority: 'LOW'
        });
      }
      
      return {
        totalValue,
        tokenCount,
        nftCount,
        tokenAllocations,
        recommendations
      };
    } catch (error) {
      console.error('Error analyzing portfolio:', error);
      throw error;
    }
  }
  
  /**
   * Find yield farming opportunities based on user's portfolio
   * @param walletAddress Wallet address
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Yield farming opportunities
   */
  async findYieldOpportunities(walletAddress: string, network: string = 'mainnet-beta'): Promise<any> {
    try {
      // Get portfolio data
      const portfolio = await this.getPortfolio(walletAddress, network);
      
      // Get token balances
      const tokenBalances = portfolio.tokens || [];
      
      // Find yield opportunities for each token
      const opportunities = [];
      
      for (const token of tokenBalances) {
        if (!token.address || !token.balance || token.balance === 0) continue;
        
        // Get pools for this token
        const poolsData = await this.getPoolsByToken(token.address);
        const pools = poolsData.pools || [];
        
        if (pools.length === 0) continue;
        
        // Find best pools based on liquidity and other factors
        const bestPools = await Promise.all(pools.slice(0, 3).map(async (pool: any) => {
          try {
            // Get liquidity details
            const liquidityDetails = await this.getLiquidityDetails(pool.address);
            
            return {
              pool: pool.address,
              dex: pool.dex,
              pair: `${pool.tokenA.symbol || 'Unknown'}/${pool.tokenB.symbol || 'Unknown'}`,
              tvl: liquidityDetails.liquidity_details?.tvl || 0,
              apy: liquidityDetails.liquidity_details?.apy || 0,
              volume24h: liquidityDetails.liquidity_details?.volume24h || 0
            };
          } catch (error) {
            console.error(`Error getting liquidity details for pool ${pool.address}:`, error);
            return null;
          }
        }));
        
        // Filter out nulls and sort by APY
        const validPools = bestPools.filter((pool: any) => pool !== null)
          .sort((a: any, b: any) => b.apy - a.apy);
        
        if (validPools.length > 0) {
          opportunities.push({
            token: token.symbol || 'Unknown',
            tokenAddress: token.address,
            balance: token.balance,
            balanceUsd: token.value_usd || 0,
            opportunities: validPools
          });
        }
      }
      
      return {
        walletAddress,
        opportunities
      };
    } catch (error) {
      console.error('Error finding yield opportunities:', error);
      throw error;
    }
  }
  
  /**
   * Create callbacks for price alerts
   * @param walletAddress Wallet address to monitor
   * @param callbackUrl URL to send callbacks to
   * @param network Solana network (devnet/mainnet-beta)
   * @returns Callback ID
   */
  async createPriceAlerts(
    walletAddress: string,
    callbackUrl: string,
    network: string = 'mainnet-beta'
  ): Promise<string> {
    try {
      const requestData = {
        network,
        addresses: [walletAddress],
        callback_url: callbackUrl,
        events: ["TOKEN_TRANSFER", "SOL_TRANSFER"],
        type: "CALLBACK"
      };
      
      const response = await axios.post<ShyftResponse<CallbackResult>>(
        'https://api.shyft.to/sol/v1/callback/create',
        requestData,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.result.id;
      } else {
        throw new Error(response.data.message || 'Failed to create callback');
      }
    } catch (error) {
      console.error('Error creating price alerts:', error);
      throw error;
    }
  }
  
  /**
   * List all callbacks for the API key
   * @returns List of callbacks
   */
  async listCallbacks(): Promise<any[]> {
    try {
      const response = await axios.get<ShyftResponse<any[]>>(
        'https://api.shyft.to/sol/v1/callback/list',
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );
      
      if (response.data.success) {
        return response.data.result || [];
      } else {
        throw new Error(response.data.message || 'Failed to list callbacks');
      }
    } catch (error) {
      console.error('Error listing callbacks:', error);
      throw error;
    }
  }
  
  /**
   * Remove a callback
   * @param callbackId Callback ID to remove
   * @returns Success status
   */
  async removeCallback(callbackId: string): Promise<boolean> {
    try {
      const requestData = {
        id: callbackId
      };
      
      // Use the correct type parameter for the response, not the request data
      const response = await axios.request<ShyftResponse<{ success: boolean }>>({
        method: 'DELETE',
        url: 'https://api.shyft.to/sol/v1/callback/remove',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        //data: requestData // This is just the request payload, not a ShyftResponse
      });
      
      // The response.data will be a ShyftResponse object
      if (response.data.success) {
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to remove callback');
      }
    } catch (error) {
      console.error('Error removing callback:', error);
      throw error;
    }
  }
}