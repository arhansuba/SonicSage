/**
 * Notification related type definitions for Sonic Agent
 */

/**
 * Types of notifications
 */
export enum NotificationType {
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error",
  TRADE = "trade",
  MARKET = "market",
  PORTFOLIO = "portfolio",
  SYSTEM = "system"
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

/**
 * Notification categories
 */
export enum NotificationCategory {
  GENERAL = "general",
  TRADE = "trade",
  MARKET = "market",
  PORTFOLIO = "portfolio",
  SECURITY = "security",
  SYSTEM = "system"
}

/**
 * Notification options for creating notifications
 */
export interface NotificationOptions {
  id?: string;
  type?: NotificationType;
  category?: NotificationCategory;
  title?: string;
  persistent?: boolean;
  autoClose?: boolean;
  timeout?: number;
  data?: any;
}

/**
 * Action that can be performed from a notification
 */
export interface NotificationAction {
  label: string;
  action: () => void;
}

/**
 * Notification object
 */
export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number | string | Date;
  read: boolean;
  persistent: boolean;
  data?: any;
  autoClose: boolean;
  duration: number;
  actions?: NotificationAction[];
}

/**
 * Trade notification payload
 */
export interface TradeNotificationPayload {
  tradeType: "buy" | "sell" | "swap";
  tokenSymbol: string;
  amount: number;
  price?: number;
  value?: number;
  success: boolean;
  txHash?: string;
}

/**
 * Market event notification payload
 */
export interface MarketEventPayload {
  eventType: "price_alert" | "volatility" | "trend_change" | "opportunity";
  tokenSymbol?: string;
  details: string;
  urgency: NotificationPriority;
}

/**
 * Notification filter options
 */
export interface NotificationFilter {
  type?: NotificationType[];
  category?: NotificationCategory[];
  readStatus?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Performance data point interface
 */
export interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  profitLoss: number;
}

/**
 * Asset interface for portfolio
 */
export interface Asset {
  name: string;
  symbol: string;
  address: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
  logo?: string;
}

/**
 * Portfolio interface
 */
export interface Portfolio {
  totalValue: number;
  assets: Asset[];
  lastUpdated: number;
}

/**
 * Portfolio performance interface
 */
export interface PortfolioPerformance {
  period: string;
  totalChange: number;
  percentChange: number;
  dataPoints: PerformanceDataPoint[];
}
