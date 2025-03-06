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
  ERROR = "error"
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
  SYSTEM = "system",
  TRADE = "trade",
  MARKET = "market",
  SECURITY = "security",
  ACCOUNT = "account"
}

/**
 * Notification options for creating notifications
 */
export interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  autoClose?: boolean;
  duration?: number;
  actions?: NotificationAction[];
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
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  timestamp: number;
  read: boolean;
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
