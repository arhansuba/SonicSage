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
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  estimatedOutputAmount: number;
  confidence: number;
  rationale: string;
  timestamp: number;
  expiresAt: number;
  status: 'pending' | 'executed' | 'expired' | 'rejected';
  priceImpact: number;
  slippage: number;
  fee: number;
  route?: string[];
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
