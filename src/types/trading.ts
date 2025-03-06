/**
 * Trading strategy related type definitions for Sonic Agent
 */
import { AIModelType, RiskLevel, TimeHorizon, TokenSupportType } from './defi';

/**
 * Trading strategy interface
 */
export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  aiModels: AIModelType[];
  tokenSupport: TokenSupportType;
  backtestResults: BacktestResult;
  active: boolean;
  creator: string;
  verified: boolean;
  userCount: number;
  performance: StrategyPerformance;
}

/**
 * Backtest result for trading strategies
 */
export interface BacktestResult {
  startDate: string;
  endDate: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

/**
 * Performance metrics for trading strategies
 */
export interface StrategyPerformance {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  allTime: number;
}

/**
 * Trade recommendation from AI trading strategy
 */
export interface TradeRecommendation {
  id: string;
  type: 'buy' | 'sell' | 'swap';
  inputToken: {
    address: string;
    symbol: string;
    logo?: string;
  };
  outputToken: {
    address: string;
    symbol: string;
    logo?: string;
  };
  inputAmount: number;
  outputAmount: number;
  confidence: number;
  reason: string;
  timestamp: number;
  expiresAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'expired';
  priceImpact: number;
  estimatedFee: number;
  estimatedGas: number;
}

/**
 * Gas settings for transactions
 */
export interface GasSettings {
  priorityFee: number | 'auto';
  computeUnits: number | 'auto';
  retryOnFail: boolean;
  maxRetries: number;
}

/**
 * Agent configuration settings
 */
export interface AgentConfig {
  gasSettings: GasSettings;
  slippageTolerance: number;
  tradingEnabled: boolean;
  notifications: {
    trades: boolean;
    marketAlerts: boolean;
    securityAlerts: boolean;
    portfolioUpdates: boolean;
  };
  defaultStrategy: string | null;
  activeStrategies: string[];
  tradingLimits: {
    maxTxValue: number;
    dailyLimit: number;
    tokenAllowlist: string[];
    tokenBlocklist: string[];
  };
}

/**
 * Price alert settings
 */
export interface PriceAlert {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  condition: 'above' | 'below';
  price: number;
  recurring: boolean;
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
}
