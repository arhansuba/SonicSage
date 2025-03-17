// src/services/PortfolioRebalancer.ts

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { SonicAgent } from './SonicAgent';
import { JupiterService } from './JupiterService';
import { MarketDataService } from './MarketDataService';
import { NotificationService } from './NotificationService';
import { NotificationType } from '@/types/notification';
import { AgentConfig, Portfolio, PortfolioAllocation, PortfolioAsset, TradeResult } from '../types/api';

/**
 * Rebalance operation type
 */
export type RebalanceOperation = 'buy' | 'sell';

/**
 * Rebalance action interface
 */
export interface RebalanceAction {
  operation: RebalanceOperation;
  fromMint: string;
  fromSymbol: string;
  toMint: string;
  toSymbol: string;
  amount: number;
  currentPercentage: number;
  targetPercentage: number;
  deviation: number;
  estimatedOutputAmount?: number;
  priceImpact?: number;
  quoteResponse?: any;
}

/**
 * Rebalance result interface
 */
export interface RebalanceResult {
  success: boolean;
  actions: RebalanceAction[];
  executedActions: number;
  failedActions: number;
  totalActionsNeeded: number;
  isComplete: boolean;
  errors: string[];
}

/**
 * Portfolio Rebalancer service
 */
export class PortfolioRebalancer {
  private connection: Connection;
  private sonicAgent: SonicAgent;
  private jupiterService: JupiterService;
  private marketDataService: MarketDataService;
  private notificationService?: NotificationService;
  
  /**
   * Constructor
   * 
   * @param connection Solana connection
   * @param sonicAgent SonicAgent service
   * @param jupiterService Jupiter service
   * @param marketDataService Market data service
   * @param notificationService Optional notification service
   */
  constructor(
    connection: Connection,
    sonicAgent: SonicAgent,
    jupiterService: JupiterService,
    marketDataService: MarketDataService,
    notificationService?: NotificationService
  ) {
    this.connection = connection;
    this.sonicAgent = sonicAgent;
    this.jupiterService = jupiterService;
    this.marketDataService = marketDataService;
    this.notificationService = notificationService;
  }
  
  /**
   * Check if portfolio needs rebalancing
   * 
   * @param walletPublicKey Wallet public key
   * @returns True if rebalancing is needed
   */
  public async checkRebalanceNeeded(walletPublicKey: string): Promise<boolean> {
    try {
      const allocation = await this.sonicAgent.getPortfolioAllocation(walletPublicKey);
      return allocation?.needsRebalancing || false;
    } catch (error) {
      console.error('Error checking rebalance need:', error);
      return false;
    }
  }
  
  /**
   * Get rebalance actions needed
   * 
   * @param walletPublicKey Wallet public key
   * @returns List of rebalance actions needed
   */
  public async getRebalanceActions(walletPublicKey: string): Promise<RebalanceAction[]> {
    try {
      // Get portfolio allocation
      const allocation = await this.sonicAgent.getPortfolioAllocation(walletPublicKey);
      if (!allocation) {
        throw new Error('Portfolio allocation not found');
      }
      
      // Get agent config for rebalance threshold
      const agentConfig = await this.sonicAgent.getAgentConfig(walletPublicKey);
      if (!agentConfig) {
        throw new Error('Agent config not found');
      }
      
      const rebalanceThreshold = agentConfig.rebalanceThreshold || 5; // Default to 5%
      
      // Get portfolio
      const portfolio = await this.sonicAgent.getPortfolio(walletPublicKey);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      // Determine tokens to rebalance
      const actions: RebalanceAction[] = [];
      
      // Find tokens that are significantly below their target allocations
      const underallocatedTokens = allocation.currentAllocations
        .filter(alloc => alloc.difference < -rebalanceThreshold)
        .sort((a, b) => a.difference - b.difference); // Most underallocated first
      
      // Find tokens that are significantly above their target allocations
      const overallocatedTokens = allocation.currentAllocations
        .filter(alloc => alloc.difference > rebalanceThreshold)
        .sort((a, b) => b.difference - a.difference); // Most overallocated first
        
      // Find stablecoins to use as intermediaries if necessary
      const stablecoins = portfolio.assets.filter(asset => 
        this.marketDataService.isStablecoin(asset.mint)
      );
      
      // If no stablecoins, use SOL as intermediary
      const intermediaryAsset = stablecoins.length > 0 ? 
        stablecoins[0] : 
        portfolio.assets.find(asset => asset.symbol === 'SOL');
      
      if (!intermediaryAsset) {
        throw new Error('No suitable intermediary asset found');
      }
      
      // For each overallocated token, create sell actions
      for (const overToken of overallocatedTokens) {
        // Skip if it's the intermediary asset
        if (overToken.mint === intermediaryAsset.mint) continue;
        
        // Find the asset in portfolio
        const asset = portfolio.assets.find(a => a.mint === overToken.mint);
        if (!asset) continue;
        
        // Calculate amount to sell (in token units)
        const excessAllocationPercent = overToken.difference;
        const excessAmount = asset.balance * (excessAllocationPercent / overToken.currentPercentage);
        
        // Create sell action
        actions.push({
          operation: 'sell',
          fromMint: overToken.mint,
          fromSymbol: overToken.symbol,
          toMint: intermediaryAsset.mint,
          toSymbol: intermediaryAsset.symbol,
          amount: excessAmount,
          currentPercentage: overToken.currentPercentage,
          targetPercentage: overToken.targetPercentage,
          deviation: overToken.difference
        });
      }
      
      // For each underallocated token, create buy actions
      for (const underToken of underallocatedTokens) {
        // Skip if it's the intermediary asset
        if (underToken.mint === intermediaryAsset.mint) continue;
        
        // Calculate deficit in USD
        const totalValue = portfolio.assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);
        const deficitAllocationPercent = -underToken.difference;
        const deficitUsd = totalValue * (deficitAllocationPercent / 100);
        
        // Create buy action
        actions.push({
          operation: 'buy',
          fromMint: intermediaryAsset.mint,
          fromSymbol: intermediaryAsset.symbol,
          toMint: underToken.mint,
          toSymbol: underToken.symbol,
          amount: intermediaryAsset.usdValue ? deficitUsd / (intermediaryAsset.usdValue / intermediaryAsset.balance) : 0, // Convert USD to intermediary token units
          currentPercentage: underToken.currentPercentage,
          targetPercentage: underToken.targetPercentage,
          deviation: underToken.difference
        });
      }
      
      // Get quotes from Jupiter for each action
      for (const action of actions) {
        try {
          // Calculate raw amount
          const fromAsset = portfolio.assets.find(a => a.mint === action.fromMint);
          if (!fromAsset) continue;
          
          const fromDecimals = fromAsset.decimals || 9;
          const rawAmount = Math.floor(action.amount * Math.pow(10, fromDecimals)).toString();
          
          // Get quote
          const quoteResponse = await this.jupiterService.getQuote(
            action.fromMint,
            action.toMint,
            rawAmount,
            50, // 0.5% slippage
            'ExactIn'
          );
          
          if (quoteResponse) {
            // Get token info for output
            const toAsset = portfolio.assets.find(a => a.mint === action.toMint) || 
              { decimals: await this.jupiterService.getTokenInfo(action.toMint).then(info => info?.decimals || 9) };
            
            const toDecimals = toAsset.decimals || 9;
            
            // Update action with quote details
            action.estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, toDecimals);
            action.priceImpact = parseFloat(quoteResponse.priceImpactPct.toString()) || 0;
            action.quoteResponse = quoteResponse;
          }
        } catch (error) {
          console.error(`Error getting quote for rebalance action:`, error);
        }
      }
      
      return actions;
    } catch (error) {
      console.error('Error getting rebalance actions:', error);
      return [];
    }
  }
  
  /**
   * Execute portfolio rebalance
   * 
   * @param walletPublicKey Wallet public key
   * @param wallet Wallet for signing
   * @param actions Rebalance actions to execute
   * @returns Rebalance result
   */
  public async executeRebalance(
    walletPublicKey: string,
    wallet: Wallet,
    actions: RebalanceAction[]
  ): Promise<RebalanceResult> {
    const result: RebalanceResult = {
      success: true,
      actions: [],
      executedActions: 0,
      failedActions: 0,
      totalActionsNeeded: actions.length,
      isComplete: false,
      errors: []
    };
    
    try {
      // Notify start of rebalancing
      this.notificationService?.addNotification({
        type: NotificationType.INFO,
        title: 'Portfolio Rebalancing',
        message: `Starting rebalance with ${actions.length} actions`,
      });
      
      // Execute each action in sequence
      for (const action of actions) {
        try {
          // Skip actions without quotes
          if (!action.quoteResponse) {
            result.failedActions++;
            result.errors.push(`No quote available for ${action.operation} ${action.fromSymbol} to ${action.toSymbol}`);
            continue;
          }
          
          // Get swap transaction
          const swapTx = await this.jupiterService.getSwapTransaction(
            action.quoteResponse,
            walletPublicKey,
            {
              dynamicComputeUnitLimit: true,
              dynamicSlippage: true,
              prioritizationFeeLamports: {
                priorityLevelWithMaxLamports: {
                  maxLamports: 1000000,
                  priorityLevel: 'high'
                }
              }
            }
          );
          
          if (!swapTx) {
            result.failedActions++;
            result.errors.push(`Failed to get swap transaction for ${action.operation} ${action.fromSymbol} to ${action.toSymbol}`);
            continue;
          }
          
          // Execute the swap
          const swapResult = await this.jupiterService.executeSwap(
            swapTx.swapTransaction,
            wallet
          );
          
          if (swapResult.success) {
            // Record successful action
            result.executedActions++;
            action.estimatedOutputAmount = action.estimatedOutputAmount || 0;
            result.actions.push(action);
            
            // Record the trade in SonicAgent (on-chain)
            await this.sonicAgent.executeTrade(
              walletPublicKey,
              'rebalance', // Use 'rebalance' as the strategy ID
              action.fromMint,
              action.toMint,
              action.amount,
              action.estimatedOutputAmount,
              50, // 0.5% slippage
              `Portfolio rebalance: ${action.operation} ${action.fromSymbol} to ${action.toSymbol}`,
              undefined // No private key, we've already executed the transaction
            );
            
            // Notify success
            this.notificationService?.addNotification({
              type: NotificationType.SUCCESS,
              title: 'Rebalance Action Completed',
              message: `Successfully ${action.operation === 'buy' ? 'bought' : 'sold'} ${action.fromSymbol} for ${action.toSymbol}`,
              link: {
                url: `https://solscan.io/tx/${swapResult.signature}`,
                text: 'View on Solscan'
              }
            });
          } else {
            // Record failed action
            result.failedActions++;
            result.errors.push(`Failed to execute ${action.operation} ${action.fromSymbol} to ${action.toSymbol}: ${swapResult.error}`);
            
            // Notify failure
            this.notificationService?.addNotification({
              type: NotificationType.ERROR,
              title: 'Rebalance Action Failed',
              message: `Failed to ${action.operation} ${action.fromSymbol} for ${action.toSymbol}: ${swapResult.error}`,
            });
          }
          
          // Wait a bit between actions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          // Record failed action
          result.failedActions++;
          result.errors.push(`Error during ${action.operation} ${action.fromSymbol} to ${action.toSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Notify failure
          this.notificationService?.addNotification({
            type: NotificationType.ERROR,
            title: 'Rebalance Action Error',
            message: `Error during ${action.operation} ${action.fromSymbol} to ${action.toSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
      
      // Check if all actions were executed
      result.isComplete = result.executedActions === actions.length;
      
      // Update overall result success status
      result.success = result.failedActions === 0;
      
      // Notify completion
      this.notificationService?.addNotification({
        type: result.success ? NotificationType.SUCCESS : NotificationType.WARNING,
        title: 'Portfolio Rebalancing Complete',
        message: `Completed ${result.executedActions} of ${actions.length} rebalance actions${result.failedActions > 0 ? ` (${result.failedActions} failed)` : ''}`,
      });
      
      return result;
    } catch (error) {
      console.error('Error executing rebalance:', error);
      
      // Notify error
      this.notificationService?.addNotification({
        type: NotificationType.ERROR,
        title: 'Portfolio Rebalancing Failed',
        message: `Failed to complete portfolio rebalancing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      return {
        success: false,
        actions: result.actions,
        executedActions: result.executedActions,
        failedActions: result.failedActions + (actions.length - result.executedActions - result.failedActions),
        totalActionsNeeded: actions.length,
        isComplete: false,
        errors: [...result.errors, error instanceof Error ? error.message : 'Unknown error executing rebalance']
      };
    }
  }
  
  /**
   * Calculate optimal rebalance path
   * 
   * @param portfolio Portfolio data
   * @param targetAllocations Target allocations
   * @returns Optimal rebalance actions
   */
  private calculateOptimalRebalancePath(
    portfolio: Portfolio,
    targetAllocations: { mint: string; percentage: number }[]
  ): RebalanceAction[] {
    // This would use an algorithm to determine the most efficient path to rebalance
    // For now, we'll use a simple approach (implemented in getRebalanceActions)
    return [];
  }
}