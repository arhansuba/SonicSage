/**
 * DeFi and AI strategy related type definitions for Sonic Agent
 */

/**
 * Risk levels for DeFi strategies
 */
export enum DeFiRiskLevel {
    CONSERVATIVE = "conservative",
    MODERATE = "moderate",
    AGGRESSIVE = "aggressive",
    EXPERIMENTAL = "experimental"
  }
  
  /**
   * Protocol types for DeFi strategies
   */
  export enum ProtocolType {
    LENDING = "lending",
    LIQUIDITY_PROVIDING = "liquidity_providing",
    YIELD_FARMING = "yield_farming",
    STAKING = "staking",
    OPTIONS = "options",
    DERIVATIVES = "derivatives",
    INSURANCE = "insurance"
  }
  
  /**
   * Risk levels for trading strategies
   */
  export enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
  }
  
  /**
   * Time horizons for trading strategies
   */
  export enum TimeHorizon {
    SHORT_TERM = "short_term",
    MEDIUM_TERM = "medium_term",
    LONG_TERM = "long_term"
  }
  
  /**
   * AI model types used in trading strategies
   */
  export enum AIModelType {
    MOMENTUM = "momentum",
    SENTIMENT = "sentiment",
    MULTI_FACTOR = "multi_factor",
    MARKET_REGIME = "market_regime",
    PATTERN_RECOGNITION = "pattern_recognition"
  }
  
  /**
   * Token support types for strategies
   */
  export enum TokenSupportType {
    MAJOR_ONLY = "major_only",
    MAJOR_AND_MEDIUM = "major_and_medium",
    ALL_TOKENS = "all_tokens"
  }
  
  /**
   * Market conditions for AI analysis
   */
  export enum MarketCondition {
    BULLISH = "bullish",
    BEARISH = "bearish",
    SIDEWAYS = "sideways",
    VOLATILE = "volatile"
  }
  
  /**
   * DeFi Strategy interface
   */
  export interface DeFiStrategy {
    id: string;
    name: string;
    description: string;
    protocolType: ProtocolType;
    riskLevel: DeFiRiskLevel;
    estimatedApy: number;  // APY in basis points (e.g., 800 = 8.00%)
    expectedApr?: number;  // APR in basis points
    tags: string[];
    tvl: number;
    userCount: number;
    creatorAddress: string;
    lockupPeriod: number;
    minInvestment: number;
    feePercentage: number;
    tokens: StrategyToken[];
    verified: boolean;
    protocols: ProtocolAllocation;
    protocolConfig: any; // Specific protocol configuration
    platforms?: string[];  // Additional platforms the strategy may use
    createdAt?: string;    // ISO date string
    updatedAt?: string;    // ISO date string
  }
  
  /**
   * DeFi Position interface
   */
  export interface DeFiPosition {
    id: string;
    strategyId: string;
    userAddress: string;
    amount: number;
    entryTimestamp: number;
    exitTimestamp?: number;
    currentValue: number;
    profitLoss: number;
    isActive: boolean;
  }
  
  /**
   * Asset allocation for strategies
   */
  export interface AssetAllocation {
    tokenSymbol: string;
    tokenAddress: string;
    percentage: number;
  }
  
  /**
   * Portfolio asset interface
   */
  export interface PortfolioAsset {
    tokenAddress: string;
    symbol: string;
    name: string;
    amount: number;
    value: number;
    percentage: number;
    priceChange24h: number;
  }
  
  /**
   * Performance data point for charts
   */
  export interface PerformanceDataPoint {
    timestamp: number;
    value: number;
    profitLoss: number;
  }
  
  /**
   * Portfolio performance metrics
   */
  export interface PortfolioPerformance {
    totalValue: number;
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
    dataPoints: PerformanceDataPoint[];
  }
  
  /**
   * Complete portfolio with assets and performance
   */
  export interface Portfolio {
    walletAddress: string;
    assets: PortfolioAsset[];
    totalValue: number;
    performance: PortfolioPerformance;
  }

  /**
   * Token structure in a strategy
   */
  export interface StrategyToken {
    symbol: string;
    mint: string;
    allocation: number;
  }
  
  /**
   * Protocol allocation in a strategy
   */
  export interface ProtocolAllocation {
    [protocol: string]: number;
  }
  
  /**
   * Strategy performance metrics
   */
  export interface StrategyPerformance {
    id: string;
    strategyId: string;
    timeframe: '1d' | '7d' | '30d' | '90d' | 'all';
    returns: number;
    volatility: number;
    sharpeRatio: number;
    drawdown: number;
    dataPoints: {
      timestamp: number;
      value: number;
    }[];
  }
  
  /**
   * User strategy investment
   */
  export interface StrategyInvestment {
    id: string;
    userId: string;
    strategyId: string;
    investmentAmount: number;
    investmentDate: string;
    currentValue: number;
    returns: number;
    status: 'active' | 'pending' | 'withdrawn';
  }
  
  /**
   * Strategy creation parameters
   */
  export interface StrategyCreationParams {
    name: string;
    description: string;
    protocolType: ProtocolType;
    riskLevel: DeFiRiskLevel;
    tokens: StrategyToken[];
    lockupPeriod: number;
    minInvestment: number;
    feePercentage: number;
    protocols: ProtocolAllocation;
    protocolConfig?: any;
  }