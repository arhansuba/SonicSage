// server/services/NotificationServer.ts

import WebSocket from 'ws';
import http from 'http';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

// Types for notification events
enum NotificationEventType {
  // Market events
  PriceAlert = 'PriceAlert',
  VolatilityAlert = 'VolatilityAlert',
  TrendReversalDetected = 'TrendReversalDetected',
  MarketNewsAlert = 'MarketNewsAlert',
  
  // Trade events
  TradeExecuted = 'TradeExecuted',
  TradeCompleted = 'TradeCompleted',
  TradeFailed = 'TradeFailed',
  SlippageExceeded = 'SlippageExceeded',
  
  // Portfolio events
  PortfolioRebalanced = 'PortfolioRebalanced',
  TokenThresholdReached = 'TokenThresholdReached',
  PositionLiquidated = 'PositionLiquidated',
  HighExposureWarning = 'HighExposureWarning',
  
  // System events
  AgentDeployed = 'AgentDeployed',
  StrategyUpdated = 'StrategyUpdated',
  PermissionsChanged = 'PermissionsChanged',
  MaintenanceAlert = 'MaintenanceAlert',
}

enum NotificationPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

interface NotificationEvent {
  user: string;
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  data?: string;
  strategy_id?: number;
  token_address?: string;
  tx_signature?: string;
}

interface TradeNotificationEvent {
  user: string;
  event_type: NotificationEventType;
  from_token: string;
  to_token: string;
  from_amount: number;
  to_amount: number;
  price_impact: number;
  success: boolean;
  timestamp: number;
  tx_signature: string;
  strategy_id?: number;
}

interface PriceAlertEvent {
  user: string;
  token_address: string;
  alert_direction: boolean;
  threshold: number;
  current_price: number;
  timestamp: number;
}

// Map notification event type to frontend notification type
enum ClientNotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

// Map notification event type to frontend notification category
enum ClientNotificationCategory {
  MARKET = 'market',
  TRADE = 'trade',
  PORTFOLIO = 'portfolio',
  SYSTEM = 'system',
}

interface ClientNotification {
  id: string;
  title: string;
  message: string;
  type: ClientNotificationType;
  category: ClientNotificationCategory;
  timestamp: number;
  data?: any;
  read: boolean;
  actionUrl?: string;
  expiry?: number;
}

class NotificationServer {
  private wss: WebSocket.Server;
  private clients: Map<string, Set<WebSocket>> = new Map();
  private connection: Connection;
  private programId: PublicKey;
  private idl: any;
  private program: Program;
  private eventListeners: number[] = [];

  constructor(server: http.Server) {
    // Initialize WebSocket server
    this.wss = new WebSocket.Server({ server });
    
    // Initialize Solana connection
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    
    // Load program IDL
    this.programId = new PublicKey(process.env.PROGRAM_ID || '');
    const idlPath = path.join(__dirname, '../idl/sonic_agent.json');
    this.idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    // Create program instance
    const provider = new AnchorProvider(
      this.connection, 
      {
        publicKey: new PublicKey('11111111111111111111111111111111'),
        signTransaction: async (tx: web3.Transaction) => tx,
        signAllTransactions: async (txs: web3.Transaction[]) => txs,
      },
      { commitment: 'confirmed' }
    );
    this.program = new Program(this.idl, this.programId, provider);
    
    this.setupWebSocketServer();
    this.registerEventListeners();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      // Extract wallet address from URL path
      const pathname = req.url || '';
      const matches = pathname.match(/\/notifications\/([A-Za-z0-9]+)/);
      if (!matches) {
        ws.close(1008, 'Invalid connection path');
        return;
      }

      const walletAddress = matches[1];
      if (!this.clients.has(walletAddress)) {
        this.clients.set(walletAddress, new Set());
      }
      
      this.clients.get(walletAddress)?.add(ws);
      
      console.log(`Client connected: ${walletAddress}`);
      
      // Handle client disconnection
      ws.on('close', () => {
        this.clients.get(walletAddress)?.delete(ws);
        if (this.clients.get(walletAddress)?.size === 0) {
          this.clients.delete(walletAddress);
        }
        console.log(`Client disconnected: ${walletAddress}`);
      });
    });
  }

  private registerEventListeners() {
    // Listen for NotificationEvent
    const notificationListener = this.program.addEventListener(
      'NotificationEvent',
      (event: NotificationEvent) => {
        this.handleNotificationEvent(event);
      }
    );
    this.eventListeners.push(notificationListener);
    
    // Listen for TradeNotificationEvent
    const tradeListener = this.program.addEventListener(
      'TradeNotificationEvent',
      (event: TradeNotificationEvent) => {
        this.handleTradeNotificationEvent(event);
      }
    );
    this.eventListeners.push(tradeListener);
    
    // Listen for PriceAlertEvent
    const priceAlertListener = this.program.addEventListener(
      'PriceAlertEvent',
      (event: PriceAlertEvent) => {
        this.handlePriceAlertEvent(event);
      }
    );
    this.eventListeners.push(priceAlertListener);
  }

  // Map on-chain event type to client notification type
  private mapEventTypeToNotificationType(
    eventType: NotificationEventType, 
    success: boolean = true
  ): ClientNotificationType {
    switch (eventType) {
      case NotificationEventType.TradeExecuted:
      case NotificationEventType.TradeCompleted:
      case NotificationEventType.PortfolioRebalanced:
      case NotificationEventType.AgentDeployed:
      case NotificationEventType.StrategyUpdated:
        return success ? ClientNotificationType.SUCCESS : ClientNotificationType.ERROR;
        
      case NotificationEventType.PriceAlert:
      case NotificationEventType.VolatilityAlert:
      case NotificationEventType.TrendReversalDetected:
      case NotificationEventType.MarketNewsAlert:
        return ClientNotificationType.INFO;
        
      case NotificationEventType.TokenThresholdReached:
      case NotificationEventType.MaintenanceAlert:
      case NotificationEventType.SlippageExceeded:
        return ClientNotificationType.WARNING;
        
      case NotificationEventType.TradeFailed:
      case NotificationEventType.PositionLiquidated:
      case NotificationEventType.HighExposureWarning:
        return ClientNotificationType.ERROR;
        
      default:
        return ClientNotificationType.INFO;
    }
  }

  // Map on-chain event type to client notification category
  private mapEventTypeToCategory(eventType: NotificationEventType): ClientNotificationCategory {
    if (eventType.toString().includes('Alert') || 
        eventType === NotificationEventType.TrendReversalDetected ||
        eventType === NotificationEventType.VolatilityAlert) {
      return ClientNotificationCategory.MARKET;
    }
    
    if (eventType.toString().includes('Trade')) {
      return ClientNotificationCategory.TRADE;
    }
    
    if (eventType.toString().includes('Portfolio') || 
        eventType === NotificationEventType.TokenThresholdReached ||
        eventType === NotificationEventType.PositionLiquidated ||
        eventType === NotificationEventType.HighExposureWarning) {
      return ClientNotificationCategory.PORTFOLIO;
    }
    
    return ClientNotificationCategory.SYSTEM;
  }

  private handleNotificationEvent(event: NotificationEvent) {
    const clientNotification: ClientNotification = {
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: event.title,
      message: event.message,
      type: this.mapEventTypeToNotificationType(event.event_type),
      category: this.mapEventTypeToCategory(event.event_type),
      timestamp: event.timestamp * 1000, // Convert to milliseconds
      data: event.data ? JSON.parse(event.data) : undefined,
      read: false,
      actionUrl: event.tx_signature 
        ? `https://explorer.solana.com/tx/${event.tx_signature}` 
        : undefined,
    };
    
    this.sendNotificationToUser(event.user, clientNotification);
  }

  private handleTradeNotificationEvent(event: TradeNotificationEvent) {
    // Format token amounts for display
    const fromAmount = (event.from_amount / 1_000_000_000).toFixed(4); // Assuming 9 decimals
    const toAmount = (event.to_amount / 1_000_000_000).toFixed(4); // Assuming 9 decimals
    
    // Format price impact
    const priceImpact = (event.price_impact / 100).toFixed(2) + '%';
    
    const clientNotification: ClientNotification = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: event.success ? 'Trade Executed Successfully' : 'Trade Failed',
      message: event.success 
        ? `Swapped ${fromAmount} tokens for ${toAmount} tokens with ${priceImpact} price impact.`
        : `Failed to swap ${fromAmount} tokens. Please check details.`,
      type: event.success ? ClientNotificationType.SUCCESS : ClientNotificationType.ERROR,
      category: ClientNotificationCategory.TRADE,
      timestamp: event.timestamp * 1000, // Convert to milliseconds
      data: {
        fromToken: event.from_token,
        toToken: event.to_token,
        fromAmount: event.from_amount,
        toAmount: event.to_amount,
        priceImpact: event.price_impact,
        txSignature: event.tx_signature,
        strategyId: event.strategy_id
      },
      read: false,
      actionUrl: `https://explorer.solana.com/tx/${event.tx_signature}`,
    };
    
    this.sendNotificationToUser(event.user, clientNotification);
  }

  private handlePriceAlertEvent(event: PriceAlertEvent) {
    const direction = event.alert_direction ? 'above' : 'below';
    const formattedThreshold = (event.threshold / 1_000_000_000).toFixed(4); // Assuming 9 decimals
    const formattedPrice = (event.current_price / 1_000_000_000).toFixed(4); // Assuming 9 decimals
    
    const clientNotification: ClientNotification = {
      id: `price-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Price Alert Triggered`,
      message: `Token price moved ${direction} your threshold of ${formattedThreshold}. Current price: ${formattedPrice}`,
      type: ClientNotificationType.INFO,
      category: ClientNotificationCategory.MARKET,
      timestamp: event.timestamp * 1000, // Convert to milliseconds
      data: {
        tokenAddress: event.token_address,
        threshold: event.threshold,
        currentPrice: event.current_price,
        direction: event.alert_direction
      },
      read: false,
    };
    
    this.sendNotificationToUser(event.user, clientNotification);
  }

  private sendNotificationToUser(userAddress: string, notification: ClientNotification) {
    const clients = this.clients.get(userAddress);
    if (!clients || clients.size === 0) {
      // Store notification for later delivery when user connects
      this.storeOfflineNotification(userAddress, notification);
      return;
    }
    
    const message = JSON.stringify(notification);
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private storeOfflineNotification(userAddress: string, notification: ClientNotification) {
    // In a production environment, this would store notifications in a database
    // For this example, we'll just log that we would store it
    console.log(`Storing offline notification for ${userAddress}:`, notification);
  }

  // Call this when shutting down the server
  public cleanup() {
    // Remove all event listeners
    this.eventListeners.forEach(listener => {
      this.program.removeEventListener(listener);
    });
    
    // Close all WebSocket connections
    this.wss.clients.forEach(client => {
      client.close();
    });
  }
}

export default NotificationServer;