// src/services/AIOptimizationService.ts

import { PublicKey } from '@solana/web3.js';
import { DeFiStrategy, DeFiRiskLevel, ProtocolType, UserDeFiPosition } from './DeFiStrategyService';

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
  currentPosition: UserDeFiPosition;
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

  // Private constructor to enforce singleton pattern
  private constructor() {}

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
    // In production, this would integrate with Pyth, Switchboard, or other Solana oracles
    // For the prototype, we're using placeholder data
    
    // Simulate API calls to DeFi analytics platforms
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return simulated market data
    return {
      solanaPrice: 112.57,
      marketTrend: Math.random() > 0.7 ? 'bull' : Math.random() > 0.5 ? 'bear' : 'neutral',
      volatilityIndex: 5.2 + (Math.random() * 3 - 1.5),
      interestRates: 2.3,
      totalValueLocked: 1372000000
    };
  }
  
  /**
   * Get price predictions for specified assets using ML models
   * @param assets List of asset symbols
   */
  public async getPricePredictions(assets: string[]): Promise<AssetPricePrediction[]> {
    // In production, this would use a trained ML model to predict prices
    // For the prototype, we're using simulated data
    
    return assets.map(asset => {
      const currentPrice = this.getAssetBasePrice(asset);
      const volatility = this.getAssetVolatility(asset);
      const trend = Math.random() > 0.6 ? 1.02 : Math.random() > 0.3 ? 0.98 : 1.0;
      
      return {
        asset,
        currentPrice,
        predictedPrice24h: currentPrice * (1 + (trend - 1) * 0.2) * (1 + (Math.random() * volatility - volatility/2) / 10),
        predictedPrice7d: currentPrice * (1 + (trend - 1) * 0.5) * (1 + (Math.random() * volatility - volatility/2) / 5),
        predictedPrice30d: currentPrice * trend * (1 + (Math.random() * volatility - volatility/2) / 2),
        confidence: 0.65 + Math.random() * 0.2
      };
    });
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
    // Filter strategies based on risk tolerance
    const filteredStrategies = allStrategies.filter(strategy => {
      if (userProfile.riskTolerance === 'low' && strategy.riskLevel !== 'conservative') return false;
      if (userProfile.riskTolerance === 'medium' && strategy.riskLevel === 'experimental') return false;
      return true;
    });
    
    // Score each strategy
    const scoredStrategies = filteredStrategies.map(strategy => {
      // Base score from APY
      let score = strategy.estimatedApy / 100;
      
      // Adjust based on risk profile match
      if (this.mapRiskLevelToProfile(strategy.riskLevel) === userProfile.riskTolerance) {
        score += 20;
      }
      
      // Adjust based on liquidity needs
      if (userProfile.liquidityNeeds === 'high' && strategy.lockupPeriod === 0) {
        score += 15;
      }
      
      // Adjust based on market conditions
      if (marketCondition.marketTrend === 'bull' && strategy.protocolType === 'liquidity_providing') {
        score += 10;
      }
      if (marketCondition.marketTrend === 'bear' && strategy.protocolType === 'lending') {
        score += 15;
      }
      
      // Calculate recommended allocation (more to safer strategies if risk tolerance is low)
      let recommendedAllocation = 0;
      if (score > 70) recommendedAllocation = 30;
      else if (score > 50) recommendedAllocation = 20;
      else if (score > 30) recommendedAllocation = 10;
      else recommendedAllocation = 5;
      
      // Generate reasons
      const reasons = this.generateRecommendationReasons(strategy, userProfile, marketCondition, score);
      
      return {
        strategy,
        matchScore: Math.min(100, Math.round(score)),
        expectedReturns: strategy.estimatedApy / 100,
        riskScore: this.calculateRiskScore(strategy),
        confidenceLevel: 0.7 + Math.random() * 0.2,
        recommendedAllocation,
        reasonsForRecommendation: reasons
      };
    });
    
    // Sort by score and return top recommendations
    return scoredStrategies.sort((a, b) => b.matchScore - a.matchScore);
  }
  
  /**
   * Analyze a user's current positions and recommend rebalancing if needed
   * @param userPositions User's current DeFi positions
   * @param allStrategies All available strategies
   * @param marketCondition Current market conditions
   */
  public async recommendRebalancing(
    userPositions: UserDeFiPosition[],
    allStrategies: DeFiStrategy[],
    marketCondition: MarketCondition
  ): Promise<RebalancingRecommendation[]> {
    if (!userPositions.length) return [];
    
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
        if (marketCondition.marketTrend === 'bear' && strategy.riskLevel !== 'conservative') {
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
        if (marketCondition.marketTrend === 'bull' && strategy.protocolType === 'liquidity_providing') {
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
                        action === 'increase' ? (strategy.riskLevel === 'conservative' ? 1 : 3) : 
                        action === 'decrease' ? (strategy.riskLevel === 'aggressive' ? -3 : -1) : 0;
      
      return {
        currentPosition: position,
        recommendedChanges: {
          action,
          percentage,
          reason
        },
        potentialApyIncrease,
        riskImpact,
        estimatedFees: position.investmentValue * 0.003,
        urgency: action === 'exit' ? 'high' : action === 'increase' ? 'medium' : 'low'
      };
    });
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
    // Define allocation ranges by risk level
    const allocationRanges = {
      low: {
        conservative: [50, 70],
        moderate: [20, 40],
        aggressive: [0, 10],
        experimental: [0, 0]
      },
      medium: {
        conservative: [30, 50],
        moderate: [30, 50],
        aggressive: [10, 20],
        experimental: [0, 5]
      },
      high: {
        conservative: [10, 30],
        moderate: [30, 50],
        aggressive: [20, 40],
        experimental: [5, 15]
      },
      aggressive: {
        conservative: [0, 20],
        moderate: [20, 40],
        aggressive: [30, 50],
        experimental: [10, 30]
      }
    };
    
    // Get user's risk allocation ranges
    const userRanges = allocationRanges[userProfile.riskTolerance];
    
    // Group strategies by risk level
    const strategyGroups: { [key in DeFiRiskLevel]: StrategyRecommendation[] } = {
      conservative: [],
      moderate: [],
      aggressive: [],
      experimental: []
    };
    
    recommendedStrategies.forEach(rec => {
      strategyGroups[rec.strategy.riskLevel].push(rec);
    });
    
    // Sort each group by match score
    Object.keys(strategyGroups).forEach(key => {
      strategyGroups[key as DeFiRiskLevel].sort((a, b) => b.matchScore - a.matchScore);
    });
    
    // Calculate target allocation for each risk level
    const targetAllocations: { [key in DeFiRiskLevel]: number } = {
      conservative: Math.random() * (userRanges.conservative[1] - userRanges.conservative[0]) + userRanges.conservative[0],
      moderate: Math.random() * (userRanges.moderate[1] - userRanges.moderate[0]) + userRanges.moderate[0],
      aggressive: Math.random() * (userRanges.aggressive[1] - userRanges.aggressive[0]) + userRanges.aggressive[0],
      experimental: Math.random() * (userRanges.experimental[1] - userRanges.experimental[0]) + userRanges.experimental[0]
    };
    
    // Normalize target allocations to sum to 100
    const total = Object.values(targetAllocations).reduce((sum, val) => sum + val, 0);
    Object.keys(targetAllocations).forEach(key => {
      targetAllocations[key as DeFiRiskLevel] = (targetAllocations[key as DeFiRiskLevel] / total) * 100;
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
  }
  
  // Helper methods
  
  private calculateRiskScore(strategy: DeFiStrategy): number {
    const baseScore = strategy.riskLevel === 'conservative' ? 2 :
                     strategy.riskLevel === 'moderate' ? 5 :
                     strategy.riskLevel === 'aggressive' ? 7 : 9;
    
    // Adjust based on protocol type and other factors
    let modifier = 0;
    if (strategy.protocolType === 'lending') modifier -= 1;
    if (strategy.protocolType === 'options') modifier += 2;
    if (strategy.estimatedApy > 50) modifier += 1;
    if (strategy.lockupPeriod > 30) modifier += 1;
    
    return Math.min(10, Math.max(1, baseScore + modifier));
  }
  
  private mapRiskLevelToProfile(riskLevel: DeFiRiskLevel): 'low' | 'medium' | 'high' | 'aggressive' {
    switch (riskLevel) {
      case 'conservative': return 'low';
      case 'moderate': return 'medium';
      case 'aggressive': return 'high';
      case 'experimental': return 'aggressive';
      default: return 'medium';
    }
  }
  
  private generateRecommendationReasons(
    strategy: DeFiStrategy,
    profile: RiskProfile,
    market: MarketCondition,
    score: number
  ): string[] {
    const reasons: string[] = [];
    
    // Risk related reasons
    if (this.mapRiskLevelToProfile(strategy.riskLevel) === profile.riskTolerance) {
      reasons.push(`Risk level (${strategy.riskLevel}) aligns well with your risk tolerance`);
    }
    
    // Returns related reasons
    if (strategy.estimatedApy > 30) {
      reasons.push(`High potential returns with estimated APY of ${strategy.estimatedApy/100}%`);
    } else if (strategy.estimatedApy > 15) {
      reasons.push(`Solid potential returns with estimated APY of ${strategy.estimatedApy/100}%`);
    } else {
      reasons.push(`Stable estimated returns of ${strategy.estimatedApy/100}%`);
    }
    
    // Protocol type reasons
    if (strategy.protocolType === 'lending' && market.marketTrend === 'bear') {
      reasons.push('Lending strategies tend to perform well in bearish markets');
    }
    if (strategy.protocolType === 'liquidity_providing' && market.marketTrend === 'bull') {
      reasons.push('Liquidity provision can capture upside in bullish markets');
    }
    if (strategy.protocolType === 'staking' && profile.liquidityNeeds === 'low') {
      reasons.push('Staking provides steady returns for long-term holders');
    }
    
    // Liquidity reasons
    if (profile.liquidityNeeds === 'high' && strategy.lockupPeriod === 0) {
      reasons.push('No lockup period matches your need for high liquidity');
    }
    
    // Time horizon reasons
    if (profile.investmentHorizon === 'long' && strategy.riskLevel !== 'conservative') {
      reasons.push('Higher risk strategy suitable for your long investment horizon');
    }
    if (profile.investmentHorizon === 'short' && strategy.riskLevel === 'conservative') {
      reasons.push('Conservative strategy aligns with your short investment horizon');
    }
    
    return reasons;
  }
  
  private getAssetBasePrice(asset: string): number {
    // Simplified mapping of assets to simulated base prices
    const prices: Record<string, number> = {
      'SOL': 112.57,
      'BTC': 68241.32,
      'ETH': 3582.75,
      'USDC': 1.00,
      'USDT': 1.00,
      'JUP': 1.37,
      'PYTH': 0.67,
      'RAY': 0.44,
      'ORCA': 0.89,
      'BONK': 0.00002834,
      'JTO': 5.41
    };
    
    return prices[asset] || 1.0 + Math.random() * 10;
  }
  
  private getAssetVolatility(asset: string): number {
    // Simplified mapping of assets to simulated volatility (0-10 scale)
    const volatility: Record<string, number> = {
      'SOL': 7.5,
      'BTC': 6.2,
      'ETH': 6.8,
      'USDC': 0.2,
      'USDT': 0.3,
      'JUP': 8.1,
      'PYTH': 7.7,
      'RAY': 8.5,
      'ORCA': 7.9,
      'BONK': 9.2,
      'JTO': 8.7
    };
    
    return volatility[asset] || 5.0 + Math.random() * 5;
  }
}