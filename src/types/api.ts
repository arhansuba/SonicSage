/**
 * API related type definitions
 */

// API Response structure
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
      message: string;
      code: string;
    };
  }
  
  // Market trends
  export type MarketTrend = 'bullish' | 'bearish' | 'neutral' | 'volatile';
  
  // Token price confidence
  export type PriceConfidence = 'high' | 'medium' | 'low';
  
  // Risk profiles
  export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
  
  // Token price data
  export interface TokenPrice {
    address: string;
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    confidence: PriceConfidence;
    lastUpdated: Date | string;
  }
  
  // Token information
  export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    tags?: string[];
    totalSupply?: string;
    marketCap?: number;
    dailyVolume?: number;
  }
  
  // Market statistics
  export interface MarketStats {
    totalVolume24h: number;
    topGainers: TokenPrice[];
    topLosers: TokenPrice[];
    trend: MarketTrend;
    lastUpdated: Date | string;
  }
  
  // Portfolio asset
  export interface PortfolioAsset {
    mint: string;      // Token mint address
    token?: string;    // For backward compatibility
    symbol: string;    // Token symbol
    name?: string;     // Token name
    balance: number;   // Token balance
    value: number;     // USD value of balance
    decimals?: number; // Token decimals
    usdValue?: number; // For backward compatibility
    currentPercentage: number; // Percentage of total portfolio
    targetPercentage: number;  // Target percentage in allocation
    deviation: number;         // Difference between current and target
  }
  
  // Portfolio data
  export interface Portfolio {
    assets: PortfolioAsset[];
    totalValue: number;
    historicalPerformance?: HistoricalData[];
  }
  
  // Historical data point
  export interface HistoricalData {
    date: string;
    value: number;
  }
  
  // Asset allocation
  export interface AssetAllocation {
    token: string;
    targetPercentage: number;
  }
  
  // Rebalance action
  export interface RebalanceAction {
    fromToken: string;
    toToken: string;
    amount: string;
    reason: string;
  }
  
  // Rebalance result
  export interface RebalanceResult {
    portfolio: Portfolio;
    actions: RebalanceAction[];
    signatures: string[];
  }
  
  // Trade recommendation
  export interface TradeRecommendation {
    id?: string;
    type: 'swap';
    inputToken: string;
    inputSymbol: string;
    outputToken: string;
    outputSymbol: string;
    amount: string;
    expectedOutput: string;
    confidence: number;
    reasoning: string;
    marketCondition: MarketTrend;
    timestamp: Date | string;
    priceImpact: number;
  }
  
  // Trade execution request
  export interface TradeExecutionRequest {
    inputToken: string;
    outputToken: string;
    amount: string;
    walletAddress: string;
    slippageBps?: number;
  }
  
  // Trade execution result
  export interface TradeExecutionResult {
    success: boolean;
    signature: string;
    inputAmount?: string;
    outputAmount?: string;
    error?: string;
  }
  
  // Notification type
  export type NotificationType = 'info' | 'success' | 'warning' | 'error';
  
  // Notification
  export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date | string;
    read: boolean;
    action?: {
      label: string;
      url?: string;
      callback?: () => void;
    };
    data?: Record<string, any>;
  }

/**
 * Trade result interface
 */
export interface TradeResult {
  success: boolean;
  signature?: string; // Add this field
  error?: string;
  timestamp: string;
  inputAmount?: number;
  outputAmount?: number;
}

/**
 * Price history point interface
 */
export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
  volume: number;
}

/**
 * Technical indicator interface
 */
export interface TechnicalIndicator {
  value: number;
  interpretation: string;
  ma50?: number;
  ma200?: number;
}

/**
 * Market overview interface
 */
export interface MarketOverview {
  marketSentiment: 'bullish' | 'bearish' | 'sideways';
  volatilityIndex: number;
  topPerformers: string[];
  bottomPerformers: string[];
  timestamp: number;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  id: string;
  owner: string;
  name: string;
  description: string;
  riskProfile: RiskProfile;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  autoRebalance: boolean;
  rebalanceThreshold: number; // Percentage (0-100)
  autoTrade: boolean;
  tradingBudget: number;
  strategies: Strategy[];
  maxTradesPerDay: number;
  maxAmountPerTrade: number;
  maxSlippageBps: number;
  preferredTokens: string[];
  excludedTokens: string[];
  targetAllocations: TokenAllocation[];
  gasSettings: GasSettings;
  totalExecutedTrades: number;
  totalTradeVolume: number;
}

/**
 * Agent status types
 */
export type AgentStatus = 'active' | 'paused' | 'inactive';

/**
 * Trading strategy interface
 */
export interface Strategy {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  parameters: any;
  lastExecuted: string | null;
  executionCount: number;
}

/**
 * Token allocation interface
 */
export interface TokenAllocation {
  mint: string;
  percentage: number; // Percentage (0-100)
  maxDeviation: number; // Percentage (0-100)
}

/**
 * Gas settings interface
 */
export interface GasSettings {
  priorityFee: number | 'auto';
  computeUnits: number;
  retryOnFail: boolean;
  maxRetries: number;
}

/**
 * Trading rule interface
 */
export interface TradingRule {
  maxAmountPerTrade: number;
  maxTradesPerDay: number;
  preferredTokens: string[];
  excludedTokens: string[];
  maxSlippageBps: number;
}

/**
 * Agent action interface
 */
export interface AgentAction {
  id: string;
  type: string;
  strategyId: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  success: boolean;
  timestamp: number;
  reason: string;
  signature: string;
}

/**
 * Portfolio performance interface
 */
export interface PortfolioPerformance {
  owner: string;
  totalProfitLoss: number;
  percentageChange: number;
  timeframe: string;
  dataPoints: {
    timestamp: string;
    value: number;
    profitLoss: number;
  }[];
  lastUpdated: string;
}

/**
 * Portfolio allocation interface
 */
export interface PortfolioAllocation {
  owner: string;
  currentAllocations: {
    mint: string;
    symbol: string;
    name: string;
    currentPercentage: number;
    targetPercentage: number;
    difference: number;
  }[];
  targetAllocations: TokenAllocation[];
  needsRebalancing: boolean;
  lastUpdated: string;
}