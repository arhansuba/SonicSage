import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { HermesClient } from '@pythnetwork/hermes-client';
import { 
  DeFiStrategy, 
  DeFiRiskLevel, 
  ProtocolType, 
  UserPosition,
  TokenPrice
} from './DeFiStrategyService';
import { DeFiStrategyService } from './DeFiStrategyService';

/**
 * Risk profile representing a user's investment preferences
 */
export interface RiskProfile {
  riskTolerance: 'low' | 'medium' | 'high' | 'aggressive';
  investmentHorizon: 'short' | 'medium' | 'long'; // short: <1yr, medium: 1-3yrs, long: >3yrs
  liquidityNeeds: 'low' | 'medium' | 'high';
  volatilityTolerance: number; // 1-10 scale
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Market condition data
 */
export interface MarketCondition {
  solanaPrice: number;
  marketTrend: 'bull' | 'bear' | 'neutral';
  volatilityIndex: number;
  interestRates: number;
  totalValueLocked: number;
}

/**
 * Asset price prediction
 */
export interface AssetPricePrediction {
  asset: string;
  currentPrice: number;
  predictedPrice24h: number;
  predictedPrice7d: number;
  predictedPrice30d: number;
  confidence: number;
}

/**
 * Strategy recommendation
 */
export interface StrategyRecommendation {
  strategy: DeFiStrategy;
  matchScore: number; // 0-100 - how well this matches the user's profile
  expectedReturns: number;
  riskScore: number; // 1-10
  confidenceLevel: number; // 0-1
  recommendedAllocation: number; // Percentage of portfolio
  reasonsForRecommendation: string[];
}

/**
 * Rebalancing recommendation
 */
export interface RebalancingRecommendation {
  currentPosition: UserPosition;
  recommendedChanges: {
    action: 'increase' | 'decrease' | 'maintain' | 'exit';
    percentage: number;
    reason: string;
  };
  potentialApyIncrease: number;
  riskImpact: number; // -10 to 10, negative means less risk
  estimatedFees: number;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * AI Optimization Service for DeFi strategies
 */
export class AIOptimizationService {
  private static instance: AIOptimizationService;
  private defiStrategyService: DeFiStrategyService;
  private hermesClient: HermesClient;

  // Private constructor to enforce singleton pattern
  private constructor() {
    this.hermesClient = new HermesClient("https://hermes.pyth.network/", {});
    this.defiStrategyService = DeFiStrategyService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AIOptimizationService {
    if (!AIOptimizationService.instance) {
      AIOptimizationService.instance = new AIOptimizationService();
    }
    return AIOptimizationService.instance;
  }

  /**
   * Generate a risk profile based on user's answers to questionnaire
   * @param questionnaireResponses User's answers to risk assessment questions
   */
  public generateRiskProfile(questionnaireResponses: any): RiskProfile {
    // In a real-world scenario, this would use a sophisticated algorithm
    // Here we're using a simplified approach for the prototype
    const { ageGroup, investmentExperience, riskAttitude, liquidityNeeds, timeHorizon } = questionnaireResponses;
    
    // Calculate risk tolerance based on demographics and responses
    let riskTolerance: 'low' | 'medium' | 'high' | 'aggressive';
    if (ageGroup === '60+' || riskAttitude === 'conservative') {
      riskTolerance = 'low';
    } else if ((ageGroup === '45-60' && riskAttitude !== 'aggressive') || riskAttitude === 'moderate') {
      riskTolerance = 'medium';
    } else if ((ageGroup === '30-45' && riskAttitude === 'aggressive') || riskAttitude === 'growth-oriented') {
      riskTolerance = 'high';
    } else {
      riskTolerance = 'aggressive';
    }
    
    // Map investment horizon
    const investmentHorizon = timeHorizon === 'less_than_1_year' ? 'short' : 
                              timeHorizon === '1_to_3_years' ? 'medium' : 'long';
    
    // Determine experience level
    const experienceLevel = investmentExperience === 'none' || investmentExperience === 'beginner' ? 'beginner' :
                           investmentExperience === 'intermediate' ? 'intermediate' : 'advanced';
    
    // Calculate volatility tolerance (1-10 scale)
    let volatilityTolerance = 5; // Default medium
    if (riskTolerance === 'low') volatilityTolerance = 3;
    if (riskTolerance === 'medium') volatilityTolerance = 5;
    if (riskTolerance === 'high') volatilityTolerance = 7;
    if (riskTolerance === 'aggressive') volatilityTolerance = 9;
    
    // Adjust based on experience
    if (experienceLevel === 'beginner') volatilityTolerance = Math.min(volatilityTolerance, 6);
    if (experienceLevel === 'advanced') volatilityTolerance = Math.max(volatilityTolerance, 4);
    
    return {
      riskTolerance,
      investmentHorizon,
      liquidityNeeds: liquidityNeeds,
      volatilityTolerance,
      experienceLevel
    };
  }
  
  /**
   * Analyze current market conditions by fetching data from oracles and APIs
   */
  public async analyzeMarketConditions(): Promise<MarketCondition> {
    try {
      // Get SOL price from Pyth
      const tokenPrices = await this.defiStrategyService.getTokenPrices(['SOL']);
      const solanaPrice = tokenPrices.find(tp => tp.symbol === 'SOL')?.price || 0;

      // Get market data from API
      const marketData = await this.defiStrategyService.getMarketData();
      
      // Calculate TVL
      let totalValueLocked = 0;
      
      // Aggregate TVL from all liquidity pools
      Object.values(marketData.liquidityPools).forEach(platform => {
        Object.values(platform).forEach(pool => {
          totalValueLocked += pool.tvl;
        });
      });
      
      // Calculate market trend based on recent price movements
      // For a real implementation, we would analyze price trends over time
      // Here we're using lending rates as a proxy
      let marketTrend: 'bull' | 'bear' | 'neutral' = 'neutral';
      const avgLendingRates: number[] = [];
      
      Object.values(marketData.lendingRates).forEach(platform => {
        Object.values(platform).forEach(rates => {
          avgLendingRates.push(rates.supply);
        });
      });
      
      const avgRate = avgLendingRates.reduce((sum, rate) => sum + rate, 0) / Math.max(1, avgLendingRates.length);
      
      if (avgRate > 5) {
        marketTrend = 'bull'; // Higher lending rates often correlate with bull markets
      } else if (avgRate < 2) {
        marketTrend = 'bear'; // Lower lending rates might indicate bear markets
      }
      
      // Calculate volatility index based on price confidence intervals
      const priceConfidences = tokenPrices.map(tp => tp.confidence / tp.price);
      const volatilityIndex = priceConfidences.reduce((sum, conf) => sum + conf, 0) / 
        Math.max(1, priceConfidences.length) * 10;
      
      return {
        solanaPrice,
        marketTrend,
        volatilityIndex,
        interestRates: avgRate,
        totalValueLocked
      };
    } catch (error) {
      console.error("Error analyzing market conditions:", error);
      throw error;
    }
  }
  
  /**
   * Get price predictions for specified assets using AI/ML techniques
   * @param assets List of asset symbols
   */
  public async getPricePredictions(assets: string[]): Promise<AssetPricePrediction[]> {
    try {
      // Get current prices from DeFiStrategyService
      const tokenPrices = await this.defiStrategyService.getTokenPrices(assets);
      
      // For each asset, generate price predictions based on historical trends
      // In a real implementation, this would use ML models trained on historical data
      const predictions: AssetPricePrediction[] = [];
      
      for (const asset of assets) {
        const tokenPrice = tokenPrices.find(tp => tp.symbol === asset);
        
        if (!tokenPrice) continue;
        
        // Calculate volatility metric based on confidence
        const volatilityFactor = tokenPrice.confidence / tokenPrice.price;
        
        // Generate predictions using a simple model
        // This would be replaced with actual ML model predictions in production
        const trendFactor = this.calculateTrendFactor(asset, tokenPrice);
        
        predictions.push({
          asset,
          currentPrice: tokenPrice.price,
          predictedPrice24h: tokenPrice.price * (1 + trendFactor * 0.02),
          predictedPrice7d: tokenPrice.price * (1 + trendFactor * 0.05),
          predictedPrice30d: tokenPrice.price * (1 + trendFactor * 0.12),
          confidence: 0.7 - volatilityFactor // Lower confidence for higher volatility
        });
      }
      
      return predictions;
    } catch (error) {
      console.error("Error generating price predictions:", error);
      throw error;
    }
  }
  
  /**
   * Recommend optimal DeFi strategies based on user's risk profile and market conditions
   * @param allStrategies All available strategies
   * @param userProfile User's risk profile
   * @param marketCondition Current market conditions
   */
  public async recommendStrategies(
    allStrategies: DeFiStrategy[],
    userProfile: RiskProfile,
    marketCondition: MarketCondition
  ): Promise<StrategyRecommendation[]> {
    try {
      // Filter strategies based on risk tolerance
      const filteredStrategies = allStrategies.filter(strategy => {
        if (userProfile.riskTolerance === 'low' && strategy.riskLevel !== DeFiRiskLevel.CONSERVATIVE) return false;
        if (userProfile.riskTolerance === 'medium' && strategy.riskLevel === DeFiRiskLevel.AGGRESSIVE) return false;
        return true;
      });
      
      // Score each strategy
      const scoredStrategies = await Promise.all(filteredStrategies.map(async strategy => {
        // Base score from APY
        let score = strategy.estimatedApy;
        
        // Adjust based on risk profile match
        if (this.mapRiskLevelToProfile(strategy.riskLevel) === userProfile.riskTolerance) {
          score += 20;
        }
        
        // Adjust based on liquidity needs
        // For high liquidity needs, favor protocols with no lockup
        if (userProfile.liquidityNeeds === 'high') {
          if (strategy.protocolType === ProtocolType.STAKING) {
            score -= 10; // Staking typically has lockup periods
          } else if (strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING) {
            score += 10; // LP positions can be exited quickly
          }
        }
        
        // Adjust based on market conditions
        if (marketCondition.marketTrend === 'bull' && strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING) {
          score += 10;
        }
        if (marketCondition.marketTrend === 'bear' && strategy.protocolType === ProtocolType.LENDING) {
          score += 15;
        }
        
        // Adjust based on APY relative to market average
        const avgApy = allStrategies.reduce((sum, s) => sum + s.estimatedApy, 0) / allStrategies.length;
        if (strategy.estimatedApy > avgApy * 1.2) {
          score += 10;
        }
        
        // Calculate recommended allocation (more to safer strategies if risk tolerance is low)
        let recommendedAllocation = 0;
        if (score > 70) recommendedAllocation = 30;
        else if (score > 50) recommendedAllocation = 20;
        else if (score > 30) recommendedAllocation = 10;
        else recommendedAllocation = 5;
        
        // Generate reasons
        const reasons = await this.generateRecommendationReasons(strategy, userProfile, marketCondition, score);
        
        return {
          strategy,
          matchScore: Math.min(100, Math.round(score)),
          expectedReturns: strategy.estimatedApy / 100,
          riskScore: this.calculateRiskScore(strategy),
          confidenceLevel: 0.7 + (strategy.tvl / 1000000000) * 0.2, // Higher TVL = higher confidence
          recommendedAllocation,
          reasonsForRecommendation: reasons
        };
      })); 
      
      // Sort by score and return top recommendations
      return scoredStrategies.sort((a, b) => b.matchScore - a.matchScore);
    } catch (error) {
      console.error("Error recommending strategies:", error);
      throw error;
    }
  }
  
  /**
   * Analyze a user's current positions and recommend rebalancing if needed
   * @param userPositions User's current DeFi positions
   * @param allStrategies All available strategies
   * @param marketCondition Current market conditions
   */
  public async recommendRebalancing(
    userPositions: UserPosition[],
    allStrategies: DeFiStrategy[],
    marketCondition: MarketCondition
  ): Promise<RebalancingRecommendation[]> {
    if (!userPositions.length) return [];
    
    try {
      // Get current strategies for positions
      const positionStrategies = userPositions.map(position => {
        const strategy = allStrategies.find(s => s.id === position.strategyId);
        return { position, strategy };
      }).filter(item => item.strategy !== undefined);
      
      // Calculate current portfolio stats
      const totalValue = userPositions.reduce((sum, pos) => sum + pos.investmentValue, 0);
      
      // Generate recommendations
      return positionStrategies.map(({ position, strategy }) => {
        if (!strategy) {
          throw new Error(`Strategy not found for position ${position.strategyId}`);
        }
        
        // Calculate position metrics
        const positionRatio = position.investmentValue / totalValue;
        const positionReturn = (position.investmentValue - position.initialInvestment) / position.initialInvestment;
        
        // Determine recommendation based on performance and market conditions
        let action: 'increase' | 'decrease' | 'maintain' | 'exit' = 'maintain';
        let percentage = 0;
        let reason = '';
        
        // Poor performing position
        if (position.apy < strategy.estimatedApy * 0.7) {
          if (marketCondition.marketTrend === 'bear' && strategy.riskLevel !== DeFiRiskLevel.CONSERVATIVE) {
            action = 'decrease';
            percentage = 50;
            reason = 'Underperforming in bear market, reduce exposure';
          } else if (position.investmentValue < position.initialInvestment * 0.9) {
            action = 'exit';
            percentage = 100;
            reason = 'Significant underperformance, exit position';
          } else {
            action = 'decrease';
            percentage = 30;
            reason = 'Underperforming expected APY';
          }
        }
        // Good performing position
        else if (position.apy > strategy.estimatedApy * 1.2) {
          if (marketCondition.marketTrend === 'bull' && strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING) {
            action = 'increase';
            percentage = 30;
            reason = 'Outperforming in bull market, increase exposure';
          } else {
            action = 'maintain';
            percentage = 0;
            reason = 'Position performing well, maintain allocation';
          }
        }
        // Overexposed position
        else if (positionRatio > 0.4) {
          action = 'decrease';
          percentage = 20;
          reason = 'Portfolio overexposed to this strategy';
        }
        
        // Calculate metrics for recommendation
        const potentialApyIncrease = action === 'exit' ? 0 : 
                                    action === 'increase' ? position.apy * 0.1 : 
                                    action === 'decrease' ? -position.apy * 0.05 : 0;
                                    
        const riskImpact = action === 'exit' ? -5 : 
                          action === 'increase' ? (strategy.riskLevel === DeFiRiskLevel.CONSERVATIVE ? 1 : 3) : 
                          action === 'decrease' ? (strategy.riskLevel === DeFiRiskLevel.AGGRESSIVE ? -3 : -1) : 0;
        
        // Estimate fees based on protocol fee structure
        const estimatedFees = position.investmentValue * (strategy.feePercentage / 100);
        
        return {
          currentPosition: position,
          recommendedChanges: {
            action,
            percentage,
            reason
          },
          potentialApyIncrease,
          riskImpact,
          estimatedFees,
          urgency: action === 'exit' ? 'high' : action === 'increase' ? 'medium' : 'low'
        };
      });
    } catch (error) {
      console.error("Error recommending rebalancing:", error);
      throw error;
    }
  }
  
  /**
   * Get a portfolio allocation recommendation based on user's risk profile
   * @param userProfile User's risk profile
   * @param recommendedStrategies Recommended strategies
   */
  public generatePortfolioAllocation(
    userProfile: RiskProfile,
    recommendedStrategies: StrategyRecommendation[]
  ): { [strategyId: string]: number } {
    try {
      // Define allocation ranges by risk level
      const allocationRanges = {
        low: {
          [DeFiRiskLevel.CONSERVATIVE]: [50, 70],
          [DeFiRiskLevel.MODERATE]: [20, 40],
          [DeFiRiskLevel.AGGRESSIVE]: [0, 10]
        },
        medium: {
          [DeFiRiskLevel.CONSERVATIVE]: [30, 50],
          [DeFiRiskLevel.MODERATE]: [30, 50],
          [DeFiRiskLevel.AGGRESSIVE]: [10, 20]
        },
        high: {
          [DeFiRiskLevel.CONSERVATIVE]: [10, 30],
          [DeFiRiskLevel.MODERATE]: [30, 50],
          [DeFiRiskLevel.AGGRESSIVE]: [20, 40]
        },
        aggressive: {
          [DeFiRiskLevel.CONSERVATIVE]: [0, 20],
          [DeFiRiskLevel.MODERATE]: [20, 40],
          [DeFiRiskLevel.AGGRESSIVE]: [30, 50]
        }
      };
      
      // Get user's risk allocation ranges
      const userRanges = allocationRanges[userProfile.riskTolerance];
      
      // Group strategies by risk level
      const strategyGroups: Record<DeFiRiskLevel, StrategyRecommendation[]> = {
        [DeFiRiskLevel.CONSERVATIVE]: [],
        [DeFiRiskLevel.MODERATE]: [],
        [DeFiRiskLevel.AGGRESSIVE]: []
      };
      
      recommendedStrategies.forEach(rec => {
        strategyGroups[rec.strategy.riskLevel].push(rec);
      });
      
      // Sort each group by match score
      Object.keys(strategyGroups).forEach(key => {
        const riskLevel = key as DeFiRiskLevel;
        strategyGroups[riskLevel].sort((a, b) => b.matchScore - a.matchScore);
      });
      
      // Calculate target allocation for each risk level
      const targetAllocations: Record<DeFiRiskLevel, number> = {
        [DeFiRiskLevel.CONSERVATIVE]: Math.random() * 
          (userRanges[DeFiRiskLevel.CONSERVATIVE][1] - userRanges[DeFiRiskLevel.CONSERVATIVE][0]) + 
          userRanges[DeFiRiskLevel.CONSERVATIVE][0],
        [DeFiRiskLevel.MODERATE]: Math.random() * 
          (userRanges[DeFiRiskLevel.MODERATE][1] - userRanges[DeFiRiskLevel.MODERATE][0]) + 
          userRanges[DeFiRiskLevel.MODERATE][0],
        [DeFiRiskLevel.AGGRESSIVE]: Math.random() * 
          (userRanges[DeFiRiskLevel.AGGRESSIVE][1] - userRanges[DeFiRiskLevel.AGGRESSIVE][0]) + 
          userRanges[DeFiRiskLevel.AGGRESSIVE][0]
      };
      
      // Normalize target allocations to sum to 100
      const total = Object.values(targetAllocations).reduce((sum, val) => sum + val, 0);
      Object.keys(targetAllocations).forEach(key => {
        const riskLevel = key as DeFiRiskLevel;
        targetAllocations[riskLevel] = (targetAllocations[riskLevel] / total) * 100;
      });
      
      // Distribute allocation within each risk level
      const allocation: { [strategyId: string]: number } = {};
      
      Object.keys(strategyGroups).forEach(riskKey => {
        const riskLevel = riskKey as DeFiRiskLevel;
        const strategies = strategyGroups[riskLevel];
        const riskAllocation = targetAllocations[riskLevel];
        
        if (strategies.length === 0) return;
        
        // Distribute based on match score
        const totalScore = strategies.reduce((sum, s) => sum + s.matchScore, 0);
        
        strategies.forEach(rec => {
          const weight = totalScore > 0 ? rec.matchScore / totalScore : 1 / strategies.length;
          const strategyAllocation = riskAllocation * weight;
          allocation[rec.strategy.id] = parseFloat(strategyAllocation.toFixed(1));
        });
      });
      
      return allocation;
    } catch (error) {
      console.error("Error generating portfolio allocation:", error);
      throw error;
    }
  }
  
  // Helper methods
  
  private calculateRiskScore(strategy: DeFiStrategy): number {
    const baseScore = strategy.riskLevel === DeFiRiskLevel.CONSERVATIVE ? 2 :
                    strategy.riskLevel === DeFiRiskLevel.MODERATE ? 5 : 7;
    
    // Adjust based on protocol type and other factors
    let modifier = 0;
    if (strategy.protocolType === ProtocolType.LENDING) modifier -= 1;
    if (strategy.protocolType === ProtocolType.YIELD_FARMING) modifier += 1;
    if (strategy.estimatedApy > 50) modifier += 1;
    
    return Math.min(10, Math.max(1, baseScore + modifier));
  }
  
  private mapRiskLevelToProfile(riskLevel: DeFiRiskLevel): 'low' | 'medium' | 'high' | 'aggressive' {
    switch (riskLevel) {
      case DeFiRiskLevel.CONSERVATIVE: return 'low';
      case DeFiRiskLevel.MODERATE: return 'medium';
      case DeFiRiskLevel.AGGRESSIVE: return 'high';
      default: return 'medium';
    }
  }
  
  private async generateRecommendationReasons(
    strategy: DeFiStrategy,
    profile: RiskProfile,
    market: MarketCondition,
    score: number
  ): Promise<string[]> {
    const reasons: string[] = [];
    
    // Risk related reasons
    if (this.mapRiskLevelToProfile(strategy.riskLevel) === profile.riskTolerance) {
      reasons.push(`Risk level (${strategy.riskLevel}) aligns well with your risk tolerance`);
    }
    
    // Returns related reasons
    if (strategy.estimatedApy > 30) {
      reasons.push(`High potential returns with estimated APY of ${strategy.estimatedApy.toFixed(2)}%`);
    } else if (strategy.estimatedApy > 15) {
      reasons.push(`Solid potential returns with estimated APY of ${strategy.estimatedApy.toFixed(2)}%`);
    } else {
      reasons.push(`Stable estimated returns of ${strategy.estimatedApy.toFixed(2)}%`);
    }
    
    // Protocol type reasons
    if (strategy.protocolType === ProtocolType.LENDING && market.marketTrend === 'bear') {
      reasons.push('Lending strategies tend to perform well in bearish markets');
    }
    if (strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING && market.marketTrend === 'bull') {
      reasons.push('Liquidity provision can capture upside in bullish markets');
    }
    if (strategy.protocolType === ProtocolType.STAKING && profile.liquidityNeeds === 'low') {
      reasons.push('Staking provides steady returns for long-term holders');
    }
    
    // Liquidity reasons
    if (profile.liquidityNeeds === 'high' && strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING) {
      reasons.push('Liquidity providing positions can be exited quickly which matches your need for high liquidity');
    }
    
    // Time horizon reasons
    if (profile.investmentHorizon === 'long' && strategy.riskLevel !== DeFiRiskLevel.CONSERVATIVE) {
      reasons.push('Higher risk strategy suitable for your long investment horizon');
    }
    if (profile.investmentHorizon === 'short' && strategy.riskLevel === DeFiRiskLevel.CONSERVATIVE) {
      reasons.push('Conservative strategy aligns with your short investment horizon');
    }
    
    // Get current token prices to provide more context
    try {
      const tokenSymbols = strategy.tokens.map(t => t.symbol);
      const tokenPrices = await this.defiStrategyService.getTokenPrices(tokenSymbols);
      
      if (tokenPrices.length > 0) {
        const mainToken = strategy.tokens[0];
        const tokenPrice = tokenPrices.find(tp => tp.symbol === mainToken.symbol);
        
        if (tokenPrice) {
          reasons.push(`Current ${mainToken.symbol} price is $${tokenPrice.price.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error("Error fetching token prices for recommendation reasons:", error);
    }
    
    return reasons;
  }
  
  /**
   * Calculate trend factor for price prediction based on token metrics
   */
  private calculateTrendFactor(asset: string, tokenPrice: TokenPrice): number {
    // A positive number indicates upward trend, negative indicates downward
    // In a real implementation, this would use historical data analysis
    
    // For demonstration, we're using token metadata to generate trend
    // This would be replaced with actual trend analysis in production
    const timestamp = tokenPrice.timestamp || Math.floor(Date.now() / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    const freshness = 1 - Math.min(1, (currentTime - timestamp) / 3600); // Newer data = higher freshness
    
    // Generate trend factor based on token type
    // This is simplified logic - real implementation would use actual trend detection
    let baseTrend = 0;
    
    // Stablecoins have near-zero trend
    if (['USDC', 'USDT', 'DAI'].includes(asset)) {
      baseTrend = 0;
    } 
    // Large cap tokens like SOL, BTC, ETH have lower volatility trends
    else if (['SOL', 'BTC', 'ETH'].includes(asset)) {
      baseTrend = (Math.random() * 2 - 1) * 0.05;
    }
    // Medium tokens have higher volatility
    else if (['JUP', 'RAY', 'ORCA', 'MSOL'].includes(asset)) {
      baseTrend = (Math.random() * 2 - 1) * 0.1;
    }
    // Small caps and meme tokens have highest volatility
    else if (['BONK'].includes(asset)) {
      baseTrend = (Math.random() * 2 - 1) * 0.2;
    }
    // Default trend for unknown tokens
    else {
      baseTrend = (Math.random() * 2 - 1) * 0.15;
    }
    
    // Adjust trend based on confidence
    const confidenceImpact = tokenPrice.confidence / tokenPrice.price;
    const adjustedTrend = baseTrend * (1 - confidenceImpact);
    
    return adjustedTrend * freshness;
  }
}