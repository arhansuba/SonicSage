// src/services/JupiterTradingStrategy.ts

import { Connection, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { SonicAgent } from './SonicAgent';
import { JupiterService } from './JupiterService';
import { MarketDataService } from './MarketDataService';
import { NotificationService } from './NotificationService';
import { AgentConfig, RiskProfile, TradeResult, PortfolioAsset } from '../types/api';
import { NotificationType } from './DeFiStrategyService';

/**
 * Trade recommendation interface
 */
export interface TradeRecommendation {
  strategyId: string;
  strategyName: string;
  inputMint: string;
  inputSymbol: string;
  inputAmount: number;
  outputMint: string;
  outputSymbol: string;
  estimatedOutputAmount: number;
  priceImpact: number;
  confidence: number; // 0-100 representing AI confidence
  reason: string;
  signals: SignalData[];
  quoteResponse?: any; // The full Jupiter quote response
}

/**
 * Signal data interface for AI strategy insights
 */
export interface SignalData {
  name: string;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

/**
 * Market trend types
 */
export type MarketTrend = 'bullish' | 'bearish' | 'sideways';

/**
 * Enriched asset with USD value
 */
interface EnrichedAsset extends PortfolioAsset {
  usdValue: number;
}

/**
 * Jupiter Trading Strategy service - AI-powered trading recommendations
 */
export class JupiterTradingStrategy {
  private connection: Connection;
  private sonicAgent: SonicAgent;
  private jupiterService: JupiterService;
  private marketDataService: MarketDataService;
  private notificationService?: NotificationService;

  /**
   * Constructor
   * 
   * @param connection Solana connection
   * @param sonicAgent SonicAgent instance
   * @param jupiterService JupiterService instance
   * @param marketDataService MarketDataService instance
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
   * Get trading recommendations for a wallet
   * 
   * @param walletPublicKey Wallet public key
   * @returns Trade recommendations
   */
  public async getRecommendations(walletPublicKey: string): Promise<TradeRecommendation[]> {
    try {
      // Get agent config
      const agentConfig = await this.sonicAgent.getAgentConfig(walletPublicKey);
      if (!agentConfig) {
        throw new Error('Agent not configured');
      }

      // Get portfolio data
      const portfolio = await this.sonicAgent.getPortfolio(walletPublicKey);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Get token prices
      const tokenMints = portfolio.assets.map(asset => asset.mint);
      const prices = await this.marketDataService.getMultipleTokenPrices(tokenMints);
      
      // Enrich portfolio assets with USD values
      const enrichedAssets = portfolio.assets.map(asset => ({
        ...asset,
        usdValue: asset.balance * (prices.get(asset.mint) || 0)
      }));

      // Get market overview to determine trend
      const marketOverview = await this.marketDataService.getMarketOverview();
      const marketTrend = marketOverview?.marketSentiment || 'sideways';
      
      // Generate recommendations based on agent strategies
      const recommendations: TradeRecommendation[] = [];
      
      for (const strategy of agentConfig.strategies) {
        if (!strategy.isActive) continue;
        
        switch (strategy.type) {
          case 'dollarCostAverage':
            recommendations.push(
              ...(await this.generateDCARecommendations(strategy.id, strategy.name, enrichedAssets, agentConfig))
            );
            break;
          case 'momentumTrading':
            recommendations.push(
              ...(await this.generateMomentumRecommendations(strategy.id, strategy.name, enrichedAssets, agentConfig, marketTrend))
            );
            break;
          case 'meanReversion':
            recommendations.push(
              ...(await this.generateMeanReversionRecommendations(strategy.id, strategy.name, enrichedAssets, agentConfig))
            );
            break;
          case 'trendFollowing':
            recommendations.push(
              ...(await this.generateTrendFollowingRecommendations(strategy.id, strategy.name, enrichedAssets, agentConfig, marketTrend))
            );
            break;
          default:
            // Skip unknown strategies
            continue;
        }
      }
      
      // Add AI confidence scores and signals
      const enhancedRecommendations = await Promise.all(
        recommendations.map(rec => this.addAIInsights(rec, marketTrend, agentConfig.riskProfile))
      );
      
      // Sort by confidence (highest first)
      return enhancedRecommendations.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Execute a recommended trade
   * 
   * @param walletPublicKey Wallet public key 
   * @param wallet Wallet for signing
   * @param recommendation Trade recommendation
   * @returns Trade result
   */
  public async executeTrade(
    walletPublicKey: string,
    wallet: Wallet,
    recommendation: TradeRecommendation
  ): Promise<TradeResult> {
    try {
      // If we already have a quote response, use it
      if (recommendation.quoteResponse) {
        // Get swap transaction
        const swapTx = await this.jupiterService.getSwapTransaction(
          recommendation.quoteResponse,
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
          throw new Error('Failed to get swap transaction');
        }

        // Execute the swap
        const result = await this.jupiterService.executeSwap(
          swapTx.swapTransaction,
          wallet
        );

        // Record the trade in SonicAgent (on-chain)
        if (result.success && result.signature) {
          await this.sonicAgent.executeTrade(
            walletPublicKey,
            recommendation.strategyId,
            recommendation.inputMint,
            recommendation.outputMint,
            recommendation.inputAmount,
            recommendation.estimatedOutputAmount,
            50, // 0.5% slippage
            recommendation.reason,
            undefined // No private key, we've already executed the transaction
          );
        }

        return {
          success: result.success,
          signature: result.signature,
          error: result.error,
          timestamp: new Date().toISOString(),
        };
      } else {
        // Get a fresh quote from Jupiter
        const inputDecimals = (await this.jupiterService.getTokenInfo(recommendation.inputMint))?.decimals || 9;
        const rawAmount = Math.floor(recommendation.inputAmount * Math.pow(10, inputDecimals)).toString();
        
        const quote = await this.jupiterService.getQuote(
          recommendation.inputMint,
          recommendation.outputMint,
          rawAmount,
          50, // 0.5% slippage
          'ExactIn'
        );

        if (!quote) {
          throw new Error('Failed to get quote');
        }

        // Execute the swap via Ultra API for best price and UX
        const result = await this.jupiterService.executeUltraSwap(
          recommendation.inputMint,
          recommendation.outputMint,
          rawAmount,
          wallet,
          50 // 0.5% slippage
        );

        // Record the trade in SonicAgent (on-chain)
        if (result.success && result.signature) {
          // Calculate actual output amount
          const outputAmount = result.outputAmountResult 
            ? parseInt(result.outputAmountResult) / Math.pow(10, (await this.jupiterService.getTokenInfo(recommendation.outputMint))?.decimals || 9)
            : recommendation.estimatedOutputAmount;
            
          await this.sonicAgent.executeTrade(
            walletPublicKey,
            recommendation.strategyId,
            recommendation.inputMint,
            recommendation.outputMint,
            recommendation.inputAmount,
            outputAmount,
            50, // 0.5% slippage
            recommendation.reason,
            undefined // No private key, we've already executed the transaction
          );
        }

        return {
          success: result.success,
          signature: result.signature,
          error: result.error,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      
      // Notify error
      this.notificationService?.addNotification({
        //type: 'error',
        title: 'Trade Failed',
        message: error instanceof Error ? error.message : 'Unknown error executing trade',
        type: NotificationType.INFO
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing trade',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate dollar-cost averaging recommendations
   * 
   * @param strategyId Strategy ID
   * @param strategyName Strategy name
   * @param assets Portfolio assets
   * @param config Agent config
   * @returns Trade recommendations
   */
  private async generateDCARecommendations(
    strategyId: string,
    strategyName: string,
    assets: EnrichedAsset[],
    config: AgentConfig
  ): Promise<TradeRecommendation[]> {
    // Find stablecoin assets
    const stablecoins: EnrichedAsset[] = [];
    
    for (const asset of assets) {
      if (await this.marketDataService.isStablecoin(asset.mint)) {
        stablecoins.push(asset);
      }
    }
    
    if (stablecoins.length === 0) {
      return [];
    }
    
    // Get target assets from agent config (preferredTokens)
    const targetAssets = config.preferredTokens;
    if (!targetAssets || targetAssets.length === 0) {
      return [];
    }
    
    // For each stablecoin, generate recommendations to purchase target assets
    const recommendations: TradeRecommendation[] = [];
    
    for (const stablecoin of stablecoins) {
      // Skip if balance is too low
      if (stablecoin.balance < 10) continue;
      
      // Determine amount to use (10% of balance or max per trade, whichever is lower)
      const amount = Math.min(
        stablecoin.balance * 0.1,
        config.maxAmountPerTrade ? config.maxAmountPerTrade / stablecoin.usdValue : stablecoin.balance * 0.1
      );
      
      // For each target asset, get price and generate recommendation
      for (const targetMint of targetAssets) {
        // Get token info
        const tokenInfo = await this.jupiterService.getTokenInfo(targetMint);
        if (!tokenInfo) continue;
        
        // Skip stablecoins as targets
        if (await this.marketDataService.isStablecoin(targetMint)) continue;
        
        // Get quote from Jupiter
        const inputDecimals = stablecoin.decimals || 6;
        const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
        
        const quoteResponse = await this.jupiterService.getQuote(
          stablecoin.mint,
          targetMint,
          rawAmount,
          50,
          'ExactIn'
        );
        
        if (!quoteResponse) continue;
        
        const outputDecimals = tokenInfo.decimals || 9;
        const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, outputDecimals);
        
        recommendations.push({
          strategyId,
          strategyName,
          inputMint: stablecoin.mint,
          inputSymbol: stablecoin.symbol,
          inputAmount: amount,
          outputMint: targetMint,
          outputSymbol: tokenInfo.symbol,
          estimatedOutputAmount,
          priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
          confidence: 85, // Will be updated with AI model
          reason: `Regular DCA purchase of ${tokenInfo.symbol}`,
          signals: [], // Will be filled by addAIInsights
          quoteResponse
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Generate momentum trading recommendations
   * 
   * @param strategyId Strategy ID
   * @param strategyName Strategy name
   * @param assets Portfolio assets
   * @param config Agent config
   * @param marketTrend Current market trend
   * @returns Trade recommendations
   */
  private async generateMomentumRecommendations(
    strategyId: string,
    strategyName: string,
    assets: EnrichedAsset[],
    config: AgentConfig,
    marketTrend: MarketTrend
  ): Promise<TradeRecommendation[]> {
    // Momentum strategy focuses on buying assets that are trending up in a bullish market
    // and selling assets that are trending down in a bearish market
    
    const recommendations: TradeRecommendation[] = [];
    
    // Skip if market isn't clearly bullish or bearish
    if (marketTrend === 'sideways') {
      return recommendations;
    }
    
    // Get momentum by analyzing price changes over different timeframes
    const momentumTokens = await this.analyzeMomentumTokens();
    
    if (marketTrend === 'bullish') {
      // In bullish market, find stablecoins to buy high-momentum tokens
      const stablecoins: EnrichedAsset[] = [];
      
      for (const asset of assets) {
        if (await this.marketDataService.isStablecoin(asset.mint)) {
          stablecoins.push(asset);
        }
      }
      
      if (stablecoins.length === 0) {
        return recommendations;
      }
      
      // Get top momentum tokens
      const topMomentumTokens = momentumTokens
        .filter(t => t.score > 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      if (topMomentumTokens.length === 0) {
        return recommendations;
      }
      
      // Generate buy recommendations
      for (const stablecoin of stablecoins) {
        // Skip if balance is too low
        if (stablecoin.balance < 10) continue;
        
        // Determine amount to use (15% of balance or max per trade, whichever is lower)
        const amount = Math.min(
          stablecoin.balance * 0.15,
          config.maxAmountPerTrade ? config.maxAmountPerTrade / stablecoin.usdValue : stablecoin.balance * 0.15
        );
        
        for (const token of topMomentumTokens) {
          // Get token info
          const tokenInfo = await this.jupiterService.getTokenInfo(token.mint);
          if (!tokenInfo) continue;
          
          // Get quote from Jupiter
          const inputDecimals = stablecoin.decimals || 6;
          const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
          
          const quoteResponse = await this.jupiterService.getQuote(
            stablecoin.mint,
            token.mint,
            rawAmount,
            50,
            'ExactIn'
          );
          
          if (!quoteResponse) continue;
          
          const outputDecimals = tokenInfo.decimals || 9;
          const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, outputDecimals);
          
          recommendations.push({
            strategyId,
            strategyName,
            inputMint: stablecoin.mint,
            inputSymbol: stablecoin.symbol,
            inputAmount: amount,
            outputMint: token.mint,
            outputSymbol: tokenInfo.symbol,
            estimatedOutputAmount,
            priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
            confidence: token.score, // Use momentum score as confidence
            reason: `Buy ${tokenInfo.symbol} based on strong upward momentum`,
            signals: [], // Will be filled by addAIInsights
            quoteResponse
          });
        }
      }
    } else if (marketTrend === 'bearish') {
      // In bearish market, find low-momentum tokens to sell for stablecoins
      const lowMomentumAssets = assets.filter(asset => {
        const momentumData = momentumTokens.find(t => t.mint === asset.mint);
        return momentumData && momentumData.score < 30 && asset.balance > 0;
      });
      
      if (lowMomentumAssets.length === 0) {
        return recommendations;
      }
      
      // Get a stablecoin mint (USDC preferably)
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint on Solana
      
      // Generate sell recommendations
      for (const asset of lowMomentumAssets) {
        // Skip if asset is a stablecoin
        if (await this.marketDataService.isStablecoin(asset.mint)) continue;
        
        // Get token info for output (USDC)
        const tokenInfo = await this.jupiterService.getTokenInfo(usdcMint);
        if (!tokenInfo) continue;
        
        // Determine amount to sell (50% of balance)
        const amount = asset.balance * 0.5;
        
        // Get quote from Jupiter
        const inputDecimals = asset.decimals || 9;
        const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
        
        const quoteResponse = await this.jupiterService.getQuote(
          asset.mint,
          usdcMint,
          rawAmount,
          50,
          'ExactIn'
        );
        
        if (!quoteResponse) continue;
        
        const outputDecimals = tokenInfo.decimals || 6;
        const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, outputDecimals);
        
        const momentumData = momentumTokens.find(t => t.mint === asset.mint);
        const confidence = momentumData ? (80 - momentumData.score) : 60; // Invert score for sell recommendation
        
        recommendations.push({
          strategyId,
          strategyName,
          inputMint: asset.mint,
          inputSymbol: asset.symbol,
          inputAmount: amount,
          outputMint: usdcMint,
          outputSymbol: 'USDC',
          estimatedOutputAmount,
          priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
          confidence, 
          reason: `Sell ${asset.symbol} due to downward momentum in bearish market`,
          signals: [], // Will be filled by addAIInsights
          quoteResponse
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Generate mean reversion recommendations
   * 
   * @param strategyId Strategy ID
   * @param strategyName Strategy name
   * @param assets Portfolio assets
   * @param config Agent config
   * @returns Trade recommendations
   */
  private async generateMeanReversionRecommendations(
    strategyId: string,
    strategyName: string,
    assets: EnrichedAsset[],
    config: AgentConfig
  ): Promise<TradeRecommendation[]> {
    // Mean reversion strategy looks for assets that have deviated significantly from their historical averages
    
    const recommendations: TradeRecommendation[] = [];
    
    // Get technical indicators for tokens to identify oversold conditions
    const oversoldTokens = await this.identifyOversoldTokens();
    
    if (oversoldTokens.length === 0) {
      return recommendations;
    }
    
    // Find stablecoins to buy oversold tokens
    const stablecoins: EnrichedAsset[] = [];
    
    for (const asset of assets) {
      if (await this.marketDataService.isStablecoin(asset.mint)) {
        stablecoins.push(asset);
      }
    }
    
    if (stablecoins.length === 0) {
      return recommendations;
    }
    
    // Generate buy recommendations for oversold tokens
    for (const stablecoin of stablecoins) {
      // Skip if balance is too low
      if (stablecoin.balance < 10) continue;
      
      // Use primary stablecoin for simplicity
      if (stablecoins.length > 1 && stablecoin.symbol !== 'USDC') continue;
      
      // Determine amount to use (20% of balance or max per trade, whichever is lower)
      const amount = Math.min(
        stablecoin.balance * 0.2,
        config.maxAmountPerTrade ? config.maxAmountPerTrade / stablecoin.usdValue : stablecoin.balance * 0.2
      );
      
      for (const token of oversoldTokens) {
        // Get token info
        const tokenInfo = await this.jupiterService.getTokenInfo(token.mint);
        if (!tokenInfo) continue;
        
        // Skip stablecoins
        if (await this.marketDataService.isStablecoin(token.mint)) continue;
        
        // Get quote from Jupiter
        const inputDecimals = stablecoin.decimals || 6;
        const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
        
        const quoteResponse = await this.jupiterService.getQuote(
          stablecoin.mint,
          token.mint,
          rawAmount,
          50,
          'ExactIn'
        );
        
        if (!quoteResponse) continue;
        
        const outputDecimals = tokenInfo.decimals || 9;
        const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, outputDecimals);
        
        recommendations.push({
          strategyId,
          strategyName,
          inputMint: stablecoin.mint,
          inputSymbol: stablecoin.symbol,
          inputAmount: amount,
          outputMint: token.mint,
          outputSymbol: tokenInfo.symbol,
          estimatedOutputAmount,
          priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
          confidence: token.rsiBounceScore, // Use RSI bounce probability score
          reason: `Buy ${tokenInfo.symbol} based on oversold conditions, expecting mean reversion`,
          signals: [], // Will be filled by addAIInsights
          quoteResponse
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Generate trend following recommendations
   * 
   * @param strategyId Strategy ID
   * @param strategyName Strategy name
   * @param assets Portfolio assets
   * @param config Agent config
   * @param marketTrend Current market trend
   * @returns Trade recommendations
   */
  private async generateTrendFollowingRecommendations(
    strategyId: string,
    strategyName: string,
    assets: EnrichedAsset[],
    config: AgentConfig,
    marketTrend: MarketTrend
  ): Promise<TradeRecommendation[]> {
    // Trend following strategy looks at the overall market trend and allocates accordingly
    
    const recommendations: TradeRecommendation[] = [];
    
    if (marketTrend === 'bullish') {
      // In bullish market, move from stablecoins to high-beta assets
      const stablecoins: EnrichedAsset[] = [];
      
      for (const asset of assets) {
        if (await this.marketDataService.isStablecoin(asset.mint)) {
          stablecoins.push(asset);
        }
      }
      
      if (stablecoins.length === 0) {
        return recommendations;
      }
      
      // Get high-beta assets
      const highBetaAssets = await this.identifyHighBetaAssets();
      
      if (highBetaAssets.length === 0) {
        return recommendations;
      }
      
      // Generate buy recommendations
      for (const stablecoin of stablecoins) {
        // Skip if balance is too low
        if (stablecoin.balance < 10) continue;
        
        // Determine amount to use (25% of balance or max per trade, whichever is lower)
        const amount = Math.min(
          stablecoin.balance * 0.25,
          config.maxAmountPerTrade ? config.maxAmountPerTrade / stablecoin.usdValue : stablecoin.balance * 0.25
        );
        
        // Choose top high-beta asset
        const topAsset = highBetaAssets[0];
        
        // Get token info
        const tokenInfo = await this.jupiterService.getTokenInfo(topAsset.mint);
        if (!tokenInfo) continue;
        
        // Get quote from Jupiter
        const inputDecimals = stablecoin.decimals || 6;
        const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
        
        const quoteResponse = await this.jupiterService.getQuote(
          stablecoin.mint,
          topAsset.mint,
          rawAmount,
          50,
          'ExactIn'
        );
        
        if (!quoteResponse) continue;
        
        const outputDecimals = tokenInfo.decimals || 9;
        const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, outputDecimals);
        
        recommendations.push({
          strategyId,
          strategyName,
          inputMint: stablecoin.mint,
          inputSymbol: stablecoin.symbol,
          inputAmount: amount,
          outputMint: topAsset.mint,
          outputSymbol: tokenInfo.symbol,
          estimatedOutputAmount,
          priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
          confidence: 80, // Will be updated with AI model
          reason: `Buy high-beta ${tokenInfo.symbol} to follow bullish market trend`,
          signals: [], // Will be filled by addAIInsights
          quoteResponse
        });
      }
    } else if (marketTrend === 'bearish') {
      // In bearish market, move from volatile assets to stablecoins
      const volatileAssets = assets.filter(asset => 
        !this.marketDataService.isStablecoin(asset.mint) &&
        asset.symbol !== 'SOL' && // Keep some SOL for gas
        asset.balance > 0
      );
      
      if (volatileAssets.length === 0) {
        return recommendations;
      }
      
      // Get USDC mint for selling to
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint on Solana
      
      // Generate sell recommendations
      for (const asset of volatileAssets) {
        // Determine amount to sell (50% of balance)
        const amount = asset.balance * 0.5;
        
        // Skip if amount too small
        if (asset.usdValue * 0.5 < 10) continue;
        
        // Get quote from Jupiter
        const inputDecimals = asset.decimals || 9;
        const rawAmount = Math.floor(amount * Math.pow(10, inputDecimals)).toString();
        
        const quoteResponse = await this.jupiterService.getQuote(
          asset.mint,
          usdcMint,
          rawAmount,
          50,
          'ExactIn'
        );
        
        if (!quoteResponse) continue;
        
        // USDC has 6 decimals
        const estimatedOutputAmount = parseInt(quoteResponse.outAmount) / Math.pow(10, 6);
        
        recommendations.push({
          strategyId,
          strategyName,
          inputMint: asset.mint,
          inputSymbol: asset.symbol,
          inputAmount: amount,
          outputMint: usdcMint,
          outputSymbol: 'USDC',
          estimatedOutputAmount,
          priceImpact: parseFloat(quoteResponse.priceImpactPct.toString()) || 0,
          confidence: 85, // Will be updated with AI model
          reason: `Sell ${asset.symbol} to move to stablecoins in bearish market trend`,
          signals: [], // Will be filled by addAIInsights
          quoteResponse
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Add AI-generated insights to a recommendation
   * 
   * @param recommendation Trade recommendation
   * @param marketTrend Current market trend
   * @param riskProfile Agent risk profile
   * @returns Enhanced recommendation
   */
  private async addAIInsights(
    recommendation: TradeRecommendation,
    marketTrend: MarketTrend,
    riskProfile: RiskProfile
  ): Promise<TradeRecommendation> {
    // Generate signals based on technical indicators and market data
    const signals: SignalData[] = [];
    
    // Market trend signal
    signals.push({
      name: 'Market Trend',
      value: marketTrend === 'bullish' ? 0.8 : marketTrend === 'bearish' ? 0.2 : 0.5,
      impact: marketTrend === 'bullish' ? 'positive' : marketTrend === 'bearish' ? 'negative' : 'neutral',
      weight: 0.2,
      description: `Overall market is currently ${marketTrend}`
    });
    
    // Technical indicators
    const technicalIndicators = await this.marketDataService.getTechnicalIndicators(recommendation.outputMint);
    
    // RSI signal
    const rsi = technicalIndicators.get('rsi');
    if (rsi) {
      const rsiScore = rsi.value / 100;
      const rsiImpact = rsi.value < 30 ? 'positive' : (rsi.value > 70 ? 'negative' : 'neutral');
      signals.push({
        name: 'RSI (Relative Strength Index)',
        value: rsiScore,
        impact: rsiImpact,
        weight: 0.2,
        description: `RSI is ${rsi.value}, indicating ${rsi.interpretation} conditions`
      });
    }
    
    // Moving averages signal
    const ma = technicalIndicators.get('movingAverages');
    if (ma) {
      const maScore = ma.interpretation === 'bullish' ? 0.8 : 0.2;
      signals.push({
        name: 'Moving Averages',
        value: maScore,
        impact: ma.interpretation === 'bullish' ? 'positive' : 'negative',
        weight: 0.3,
        description: `50-day MA ${ma.ma50 && ma.ma200 && ma.ma50 > ma.ma200 ? 'above' : 'below'} 200-day MA, indicating ${ma.interpretation} trend`
      });
    }
    
    // Price impact signal
    signals.push({
      name: 'Price Impact',
      value: 1 - (recommendation.priceImpact / 5), // Convert to 0-1 scale (lower impact is better)
      impact: recommendation.priceImpact > 1 ? 'negative' : recommendation.priceImpact < 0.1 ? 'positive' : 'neutral',
      weight: 0.2,
      description: `Swap has ${recommendation.priceImpact > 1 ? 'high' : recommendation.priceImpact < 0.1 ? 'low' : 'moderate'} price impact of ${recommendation.priceImpact.toFixed(2)}%`
    });

    // Risk adjustment based on profile
    const riskMultiplier = riskProfile === 'conservative' ? 0.7 : riskProfile === 'aggressive' ? 1.3 : 1.0;
    
    // Calculate overall confidence score
    const weightedSum = signals.reduce((sum, signal) => {
      return sum + (signal.value * signal.weight);
    }, 0);
    
    // Adjust confidence based on risk profile
    let confidence = Math.round(weightedSum * 100 * riskMultiplier);
    
    // Keep within 0-100 range
    confidence = Math.max(0, Math.min(100, confidence));
    
    // Update recommendation with AI insights
    recommendation.confidence = confidence;
    recommendation.signals = signals;
    
    return recommendation;
  }

  /**
   * Analyze momentum of tokens by getting price data
   * 
   * @returns Token momentum scores
   */
  private async analyzeMomentumTokens(): Promise<{ mint: string; symbol: string; score: number }[]> {
    try {
      // Get a list of popular tokens
      const tokens = await this.jupiterService.getTokensByTag('verified');
      
      const results: { mint: string; symbol: string; score: number }[] = [];
      
      // For each token, analyze price movement over different timeframes
      for (const token of tokens.slice(0, 20)) { // Limit to 20 tokens for performance
        // Skip stablecoins
        if (await this.marketDataService.isStablecoin(token.address)) {
          continue;
        }
        
        // Get price data for different timeframes
        const data24h = await this.marketDataService.getHistoricalPriceData(token.address, '24h');
        const data7d = await this.marketDataService.getHistoricalPriceData(token.address, '7d');
        
        if (data24h.length === 0 || data7d.length === 0) {
          continue;
        }
        
        // Calculate price changes
        const priceChange24h = (data24h[data24h.length - 1].price / data24h[0].price - 1) * 100;
        const priceChange7d = (data7d[data7d.length - 1].price / data7d[0].price - 1) * 100;
        
        // Calculate volume growth
        const volumeChange24h = (data24h[data24h.length - 1].volume / data24h[0].volume - 1) * 100;
        
        // Calculate momentum score (weighted average of price and volume changes)
        const momentumScore = Math.min(100, Math.max(0,
          (priceChange24h * 0.4) + (priceChange7d * 0.3) + (volumeChange24h * 0.3) + 50
        ));
        
        results.push({
          mint: token.address,
          symbol: token.symbol,
          score: momentumScore
        });
      }
      
      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error analyzing momentum tokens:', error);
      return [];
    }
  }

  /**
   * Identify oversold tokens based on technical indicators
   * 
   * @returns Oversold tokens with their RSI bounce scores
   */
  private async identifyOversoldTokens(): Promise<{ mint: string; symbol: string; rsiBounceScore: number }[]> {
    try {
      // Get a list of popular tokens
      const tokens = await this.jupiterService.getTokensByTag('verified');
      
      const results: { mint: string; symbol: string; rsiBounceScore: number }[] = [];
      
      // For each token, check technical indicators
      for (const token of tokens.slice(0, 20)) { // Limit to 20 tokens for performance
        // Skip stablecoins
        if (await this.marketDataService.isStablecoin(token.address)) {
          continue;
        }
        
        // Get technical indicators
        const indicators = await this.marketDataService.getTechnicalIndicators(token.address);
        
        // Check RSI for oversold conditions
        const rsi = indicators.get('rsi');
        if (rsi && rsi.value < 30) {
          // RSI below 30 is considered oversold
          // Calculate a "bounce score" based on how oversold and historical tendency to revert
          const rsiBounceScore = Math.min(100, Math.max(0, (30 - rsi.value) * 3 + 30));
          
          results.push({
            mint: token.address,
            symbol: token.symbol,
            rsiBounceScore
          });
        }
      }
      
      return results.sort((a, b) => b.rsiBounceScore - a.rsiBounceScore);
    } catch (error) {
      console.error('Error identifying oversold tokens:', error);
      return [];
    }
  }

  /**
   * Identify high-beta assets for trend following
   * 
   * @returns High-beta assets
   */
  private async identifyHighBetaAssets(): Promise<{ mint: string; symbol: string; beta: number }[]> {
    try {
      // In a real implementation, we would calculate beta based on correlation with market
      // For now, we'll get popular tokens and assign synthetic beta values
      
      // Get popular tokens
      const tokens = await this.jupiterService.getTokensByTag('verified');
      
      // Known high-beta tokens on Solana
      const highBetaMap: Record<string, number> = {
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 2.5, // BONK
        'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3': 1.8, // FTM
        'So11111111111111111111111111111111111111112': 1.5, // SOL
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 1.7, // JUP
      };
      
      const results: { mint: string; symbol: string; beta: number }[] = [];
      
      for (const token of tokens) {
        // Skip stablecoins
        if (await this.marketDataService.isStablecoin(token.address)) {
          continue;
        }
        
        // Use known beta if available, or calculate a synthetic beta
        const beta = highBetaMap[token.address] || Math.random() * 1.5 + 0.5; // Random beta between 0.5 and 2.0
        
        if (beta > 1.2) { // Only include tokens with significant beta
          results.push({
            mint: token.address,
            symbol: token.symbol,
            beta
          });
        }
      }
      
      return results.sort((a, b) => b.beta - a.beta);
    } catch (error) {
      console.error('Error identifying high-beta assets:', error);
      return [];
    }
  }
}