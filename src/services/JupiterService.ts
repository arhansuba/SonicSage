// src/services/JupiterService.ts

import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { NotificationService } from './NotificationService';
import { NotificationType } from '@/types/notification';
import fetch from 'cross-fetch';
import bs58 from 'bs58';

export interface SwapRoute {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: number;
  routePlan: RoutePlanStep[];
  contextSlot: number;
}

interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, any>;
}

export interface PriceData {
  id: string;
  price: string;
  type: string;
  extraInfo?: PriceExtraInfo;
}

interface PriceExtraInfo {
  lastSwappedPrice?: {
    lastJupiterSellAt: number;
    lastJupiterSellPrice: string;
    lastJupiterBuyAt: number;
    lastJupiterBuyPrice: string;
  };
  quotedPrice?: {
    buyPrice: string;
    buyAt: number;
    sellPrice: string;
    sellAt: number;
  };
  confidenceLevel?: string;
  depth?: {
    buyPriceImpactRatio?: {
      depth: Record<string, number>;
      timestamp: number;
    };
    sellPriceImpactRatio?: {
      depth: Record<string, number>;
      timestamp: number;
    };
  };
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  code?: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
  slot?: string;
  swapEvents?: {
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }[];
}

/**
 * Service for interacting with Jupiter API
 */
export class JupiterService {
  private connection: Connection;
  private apiUrl: string;
  private apiKey?: string;
  private notificationService?: NotificationService;

  /**
   * Constructor
   * 
   * @param connection Solana connection
   * @param apiKey Optional Jupiter API key
   * @param notificationService Optional notification service
   */
  constructor(
    connection: Connection,
    apiKey?: string,
    notificationService?: NotificationService
  ) {
    this.connection = connection;
    this.apiUrl = 'https://api.jup.ag';
    this.apiKey = apiKey;
    this.notificationService = notificationService;
  }

  /**
   * Get headers for API requests
   * @returns Headers object
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Get a quote for a swap between two tokens
   * 
   * @param inputMint Input token mint address
   * @param outputMint Output token mint address
   * @param amount Amount of input token (in base units)
   * @param slippageBps Slippage tolerance in basis points (e.g., 50 = 0.5%)
   * @param swapMode ExactIn or ExactOut
   * @returns Quote information
   */
  public async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<SwapRoute | null> {
    try {
      const url = new URL(`${this.apiUrl}/swap/v1/quote`);
      
      url.searchParams.append('inputMint', inputMint);
      url.searchParams.append('outputMint', outputMint);
      url.searchParams.append('amount', amount);
      url.searchParams.append('slippageBps', slippageBps.toString());
      url.searchParams.append('swapMode', swapMode);
      
      // Add additional params for better results
      url.searchParams.append('restrictIntermediateTokens', 'true');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error getting Jupiter quote:', errorData);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      return null;
    }
  }

  /**
   * Get swap transaction
   * 
   * @param quoteResponse Quote response from getQuote
   * @param userPublicKey User's wallet public key
   * @param options Additional options
   * @returns Swap transaction information
   */
  public async getSwapTransaction(
    quoteResponse: SwapRoute,
    userPublicKey: string,
    options: {
      feeAccount?: string;
      dynamicComputeUnitLimit?: boolean;
      dynamicSlippage?: boolean;
      prioritizationFeeLamports?: number | { priorityLevelWithMaxLamports: { maxLamports: number; priorityLevel: 'medium' | 'high' | 'veryHigh' } };
    } = {}
  ): Promise<{ swapTransaction: string; lastValidBlockHeight: number } | null> {
    try {
      const response = await fetch(`${this.apiUrl}/swap/v1/swap`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          ...options
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error getting swap transaction:', errorData);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      return null;
    }
  }

  /**
   * Execute a swap
   * 
   * @param swapTransaction Serialized swap transaction
   * @param wallet Wallet for signing
   * @returns Result of the swap
   */
  public async executeSwap(
    swapTransaction: string,
    wallet: Wallet
  ): Promise<SwapResult> {
    try {
      // Deserialize transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, 'base64')
      );
      
      // Sign transaction
      transaction.sign([wallet.payer]);
      
      // Serialize transaction
      const serializedTransaction = transaction.serialize();
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        serializedTransaction,
        { maxRetries: 3 }
      );
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      
      // Notify success
      this.notificationService?.addNotification({
        type: NotificationType.SUCCESS,
        title: 'Swap Executed',
        message: 'Your swap has been executed successfully',
        link: {
          url: `https://solscan.io/tx/${signature}`,
          text: 'View on Solscan'
        }
      });
      
      return {
        success: true,
        signature,
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      
      // Notify error
      this.notificationService?.addNotification({
        type: NotificationType.ERROR,
        title: 'Swap Failed',
        message: error instanceof Error ? error.message : 'Unknown error executing swap',
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing swap',
      };
    }
  }

  /**
   * Execute a swap using Jupiter's Ultra API (V1)
   * 
   * @param inputMint Input token mint
   * @param outputMint Output token mint
   * @param amount Amount of input token (in base units)
   * @param wallet Wallet for signing
   * @param slippageBps Slippage tolerance in basis points
   * @returns Result of the swap
   */
  public async executeUltraSwap(
    inputMint: string,
    outputMint: string,
    amount: string,
    wallet: Wallet,
    slippageBps: number = 50
  ): Promise<SwapResult> {
    try {
      // 1. Get order from Ultra API
      const orderUrl = new URL(`${this.apiUrl}/ultra/v1/order`);
      orderUrl.searchParams.append('inputMint', inputMint);
      orderUrl.searchParams.append('outputMint', outputMint);
      orderUrl.searchParams.append('amount', amount);
      orderUrl.searchParams.append('slippageBps', slippageBps.toString());
      orderUrl.searchParams.append('taker', wallet.publicKey.toBase58());
      
      const orderResponse = await fetch(orderUrl.toString(), {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error('Error getting Ultra order:', errorData);
        return {
          success: false,
          error: 'Failed to get swap order',
          code: errorData.code
        };
      }
      
      const orderData = await orderResponse.json();
      
      // 2. Sign the transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(orderData.transaction, 'base64')
      );
      
      transaction.sign([wallet.payer]);
      
      const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
      
      // 3. Execute the order
      const executeResponse = await fetch(`${this.apiUrl}/ultra/v1/execute`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          signedTransaction,
          requestId: orderData.requestId
        })
      });
      
      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('Error executing Ultra swap:', errorData);
        return {
          success: false,
          error: 'Failed to execute swap',
          code: errorData.code
        };
      }
      
      const executeData = await executeResponse.json();
      
      // 4. Check the result
      if (executeData.status === 'Success') {
        // Notify success
        this.notificationService?.addNotification({
          type: NotificationType.SUCCESS,
          title: 'Swap Executed',
          message: 'Your swap has been executed successfully via Jupiter Ultra',
          link: {
            url: `https://solscan.io/tx/${executeData.signature}`,
            text: 'View on Solscan'
          }
        });
        
        return {
          success: true,
          signature: executeData.signature,
          slot: executeData.slot,
          inputAmountResult: executeData.inputAmountResult,
          outputAmountResult: executeData.outputAmountResult,
          swapEvents: executeData.swapEvents
        };
      } else {
        // Notify error
        this.notificationService?.addNotification({
          type: NotificationType.ERROR,
          title: 'Swap Failed',
          message: executeData.error || 'Unknown error executing swap',
        });
        
        return {
          success: false,
          error: executeData.error,
          code: executeData.code,
          signature: executeData.signature,
          slot: executeData.slot
        };
      }
    } catch (error) {
      console.error('Error executing Ultra swap:', error);
      
      // Notify error
      this.notificationService?.addNotification({
        type: NotificationType.ERROR,
        title: 'Swap Failed',
        message: error instanceof Error ? error.message : 'Unknown error executing swap',
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing swap',
      };
    }
  }

  /**
   * Get token information
   * 
   * @param tokenMint Token mint address
   * @returns Token information
   */
  public async getTokenInfo(tokenMint: string): Promise<TokenInfo | null> {
    try {
      const response = await fetch(`${this.apiUrl}/tokens/v1/token/${tokenMint}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        console.error('Error getting token info:', await response.text());
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  /**
   * Get token price
   * 
   * @param tokenMint Token mint address
   * @param vsToken Optional token to price against (defaults to USDC)
   * @param showExtraInfo Whether to show additional pricing info
   * @returns Token price data
   */
  public async getTokenPrice(
    tokenMint: string,
    vsToken?: string,
    showExtraInfo: boolean = false
  ): Promise<PriceData | null> {
    try {
      const url = new URL(`${this.apiUrl}/price/v2`);
      url.searchParams.append('ids', tokenMint);
      
      if (vsToken) {
        url.searchParams.append('vsToken', vsToken);
      }
      
      if (showExtraInfo) {
        url.searchParams.append('showExtraInfo', 'true');
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        console.error('Error getting token price:', await response.text());
        return null;
      }
      
      const data = await response.json();
      return data.data[tokenMint] || null;
    } catch (error) {
      console.error('Error getting token price:', error);
      return null;
    }
  }

  /**
   * Get all tradable tokens
   * 
   * @returns List of tradable token mints
   */
  public async getTradableTokens(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/tokens/v1/mints/tradable`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        console.error('Error getting tradable tokens:', await response.text());
        return [];
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting tradable tokens:', error);
      return [];
    }
  }

  /**
   * Get tokens by tag
   * 
   * @param tag Token tag (e.g., 'verified', 'lst', 'token-2022')
   * @returns List of tokens with the specified tag
   */
  public async getTokensByTag(tag: string): Promise<TokenInfo[]> {
    try {
      const response = await fetch(`${this.apiUrl}/tokens/v1/tagged/${tag}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        console.error('Error getting tokens by tag:', await response.text());
        return [];
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting tokens by tag:', error);
      return [];
    }
  }
}