import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';

import { ServiceFactory } from '../services/ServiceFactory';
import { JupiterService } from '../services/JupiterService';
import { SonicAgent } from '../services/SonicAgent';
import { JupiterTradingStrategy } from '../services/JupiterTradingStrategy';
import { PortfolioRebalancer } from '../services/PortfolioRebalancer';
import { MarketDataService } from '../services/MarketDataService';
import { NotificationService } from '../services/NotificationService';
import { Notification } from '../types';
import { SONIC_RPC_ENDPOINT } from '../constants/endpoints';
import { 
  INITIAL_PORTFOLIO_ALLOCATION,
  DEFAULT_RISK_LEVEL,
  AUTO_CONNECT_WALLET
} from '../constants/config';

// Risk level options for the user
export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

// Application state interface
interface SonicAgentState {
  isInitialized: boolean;
  isInitializing: boolean;
  initError: Error | null;
  walletConnected: boolean;
  walletPublicKey: string | null;
  userSOLBalance: number;
  riskLevel: RiskLevel;
  portfolioAllocations: Record<string, number>;
  notifications: Notification[];
  unreadNotificationCount: number;
  isAutoTradingEnabled: boolean;
}

// Context value interface
interface SonicAgentContextValue extends SonicAgentState {
  // Services
  jupiterService: JupiterService | null;
  sonicAgent: SonicAgent | null;
  jupiterTradingStrategy: JupiterTradingStrategy | null;
  portfolioRebalancer: PortfolioRebalancer | null;
  marketDataService: MarketDataService | null;
  notificationService: NotificationService | null;
  
  // Methods
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  setRiskLevel: (level: RiskLevel) => void;
  updatePortfolioAllocation: (tokenMint: string, allocation: number) => void;
  resetPortfolioAllocation: () => void;
  toggleAutoTrading: () => Promise<void>;
}

// Create the context with a default value
const SonicAgentContext = createContext<SonicAgentContextValue>({
  // Initial state
  isInitialized: false,
  isInitializing: false,
  initError: null,
  walletConnected: false,
  walletPublicKey: null,
  userSOLBalance: 0,
  riskLevel: DEFAULT_RISK_LEVEL as RiskLevel,
  portfolioAllocations: INITIAL_PORTFOLIO_ALLOCATION,
  notifications: [],
  unreadNotificationCount: 0,
  isAutoTradingEnabled: false,
  
  // Services (null until initialized)
  jupiterService: null,
  sonicAgent: null,
  jupiterTradingStrategy: null,
  portfolioRebalancer: null,
  marketDataService: null,
  notificationService: null,
  
  // Methods (empty implementations to be overridden by provider)
  initialize: async () => {},
  shutdown: async () => {},
  connectWallet: async () => {},
  disconnectWallet: () => {},
  refreshBalances: async () => {},
  markNotificationAsRead: () => {},
  markAllNotificationsAsRead: () => {},
  dismissNotification: () => {},
  clearAllNotifications: () => {},
  setRiskLevel: () => {},
  updatePortfolioAllocation: () => {},
  resetPortfolioAllocation: () => {},
  toggleAutoTrading: async () => {},
});

// Props for the provider component
interface SonicAgentProviderProps {
  children: ReactNode;
}

// Provider component
export const SonicAgentProvider: React.FC<SonicAgentProviderProps> = ({ children }) => {
  // Get wallet from the wallet adapter context
  const wallet = useWallet();
  
  // Initialize connection
  const [connection] = useState(new Connection(SONIC_RPC_ENDPOINT));
  
  // Initialize state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [userSOLBalance, setUserSOLBalance] = useState(0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(DEFAULT_RISK_LEVEL as RiskLevel);
  const [portfolioAllocations, setPortfolioAllocations] = useState<Record<string, number>>(INITIAL_PORTFOLIO_ALLOCATION);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isAutoTradingEnabled, setIsAutoTradingEnabled] = useState(false);
  
  // Service references
  const [serviceFactory] = useState(ServiceFactory.getInstance());
  const [jupiterService, setJupiterService] = useState<JupiterService | null>(null);
  const [sonicAgent, setSonicAgent] = useState<SonicAgent | null>(null);
  const [jupiterTradingStrategy, setJupiterTradingStrategy] = useState<JupiterTradingStrategy | null>(null);
  const [portfolioRebalancer, setPortfolioRebalancer] = useState<PortfolioRebalancer | null>(null);
  const [marketDataService, setMarketDataService] = useState<MarketDataService | null>(null);
  const [notificationService, setNotificationService] = useState<NotificationService | null>(null);
  
  // Initialize the services
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) {
      return;
    }
    
    setIsInitializing(true);
    setInitError(null);
    
    try {
      await serviceFactory.initialize();
      
      // Set service references
      setJupiterService(serviceFactory.getJupiterService());
      setSonicAgent(serviceFactory.getSonicAgent());
      setJupiterTradingStrategy(serviceFactory.getJupiterTradingStrategy());
      setPortfolioRebalancer(serviceFactory.getPortfolioRebalancer());
      setMarketDataService(serviceFactory.getMarketDataService());
      setNotificationService(serviceFactory.getNotificationService());
      
      // Check if auto trading is enabled
      if (jupiterTradingStrategy) {
        setIsAutoTradingEnabled(jupiterTradingStrategy.isAutoTradingEnabled());
      }
      
      // Subscribe to notifications if notification service is available
      if (notificationService) {
        const notificationSubscription = notificationService.onNotification((notification) => {
          setNotifications(prevNotifications => [notification, ...prevNotifications]);
        });
        
        const unreadCountSubscription = notificationService.onUnreadCountChange((count) => {
          setUnreadNotificationCount(count);
        });
        
        // Initialize with current notifications
        setNotifications(notificationService.getNotifications());
        setUnreadNotificationCount(notificationService.getUnreadNotifications().length);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing services:', error);
      setInitError(error instanceof Error ? error : new Error('Unknown error during initialization'));
      
      // Try to clean up on failure
      try {
        await serviceFactory.shutdown();
      } catch (shutdownError) {
        console.error('Error during shutdown after failed initialization:', shutdownError);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing, serviceFactory, jupiterTradingStrategy, notificationService]);
  
  // Shutdown the services
  const shutdown = useCallback(async () => {
    if (!isInitialized) {
      return;
    }
    
    try {
      await serviceFactory.shutdown();
      
      // Reset service references
      setJupiterService(null);
      setSonicAgent(null);
      setJupiterTradingStrategy(null);
      setPortfolioRebalancer(null);
      setMarketDataService(null);
      setNotificationService(null);
      
      setIsInitialized(false);
      setIsAutoTradingEnabled(false);
    } catch (error) {
      console.error('Error shutting down services:', error);
      // Even on error, reset the state
      setIsInitialized(false);
      setJupiterService(null);
      setSonicAgent(null);
      setJupiterTradingStrategy(null);
      setPortfolioRebalancer(null);
      setMarketDataService(null);
      setNotificationService(null);
      setIsAutoTradingEnabled(false);
    }
  }, [isInitialized, serviceFactory]);
  
  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!wallet.wallet || wallet.connecting) {
      return;
    }
    
    try {
      await wallet.connect();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      if (notificationService) {
        notificationService.sendNotification({
          type: 'error',
          title: 'Wallet Connection Failed',
          message: 'Failed to connect your wallet. Please try again.',
        });
      }
    }
  }, [wallet, notificationService]);
  
  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    if (!wallet.wallet || !wallet.connected) {
      return;
    }
    
    try {
      wallet.disconnect();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [wallet]);
  
  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (!wallet.publicKey || !connection) {
      setUserSOLBalance(0);
      return;
    }
    
    try {
      const balance = await connection.getBalance(wallet.publicKey);
      setUserSOLBalance(balance / 1e9); // Convert lamports to SOL
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      setUserSOLBalance(0);
    }
  }, [wallet.publicKey, connection]);
  
  // Mark notification as read
  const markNotificationAsRead = useCallback((id: string) => {
    if (!notificationService) {
      return;
    }
    
    notificationService.markAsRead(id);
  }, [notificationService]);
  
  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(() => {
    if (!notificationService) {
      return;
    }
    
    notificationService.markAllAsRead();
  }, [notificationService]);
  
  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    if (!notificationService) {
      return;
    }
    
    notificationService.removeNotification(id);
  }, [notificationService]);
  
  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    if (!notificationService) {
      return;
    }
    
    notificationService.clearNotifications();
  }, [notificationService]);
  
  // Set risk level
  const setRiskLevelHandler = useCallback((level: RiskLevel) => {
    setRiskLevel(level);
    
    // Update portfolio allocations based on risk level
    if (portfolioRebalancer) {
      const allocations = portfolioRebalancer.generateTargetAllocation(level);
      setPortfolioAllocations(allocations);
    }
  }, [portfolioRebalancer]);
  
  // Update portfolio allocation
  const updatePortfolioAllocation = useCallback((tokenMint: string, allocation: number) => {
    setPortfolioAllocations(prevAllocations => ({
      ...prevAllocations,
      [tokenMint]: allocation,
    }));
  }, []);
  
  // Reset portfolio allocation
  const resetPortfolioAllocation = useCallback(() => {
    setPortfolioAllocations(INITIAL_PORTFOLIO_ALLOCATION);
  }, []);
  
  // Toggle auto trading
  const toggleAutoTrading = useCallback(async () => {
    if (!jupiterTradingStrategy) {
      return;
    }
    
    try {
      if (isAutoTradingEnabled) {
        await jupiterTradingStrategy.stopAutoTrading();
        setIsAutoTradingEnabled(false);
        
        if (notificationService) {
          notificationService.sendNotification({
            type: 'info',
            title: 'Auto Trading Disabled',
            message: 'Automatic trading has been disabled.',
          });
        }
      } else {
        await jupiterTradingStrategy.startAutoTrading();
        setIsAutoTradingEnabled(true);
        
        if (notificationService) {
          notificationService.sendNotification({
            type: 'success',
            title: 'Auto Trading Enabled',
            message: 'Automatic trading has been enabled. Your portfolio will be managed according to your risk profile.',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling auto trading:', error);
      
      if (notificationService) {
        notificationService.sendNotification({
          type: 'error',
          title: 'Auto Trading Error',
          message: `Failed to ${isAutoTradingEnabled ? 'disable' : 'enable'} automatic trading. Please try again.`,
        });
      }
    }
  }, [jupiterTradingStrategy, isAutoTradingEnabled, notificationService]);
  
  // Watch wallet connection status
  useEffect(() => {
    setWalletConnected(wallet.connected);
    setWalletPublicKey(wallet.publicKey ? wallet.publicKey.toString() : null);
    
    // Refresh balances when wallet connection status changes
    refreshBalances();
  }, [wallet.connected, wallet.publicKey, refreshBalances]);
  
  // Initialize services when component mounts
  useEffect(() => {
    // Auto-initialize when component mounts
    initialize();
    
    // Cleanup on unmount
    return () => {
      shutdown();
    };
  }, [initialize, shutdown]);
  
  // Auto-connect wallet if enabled
  useEffect(() => {
    if (AUTO_CONNECT_WALLET && !wallet.connected && !wallet.connecting && wallet.wallet) {
      connectWallet();
    }
  }, [AUTO_CONNECT_WALLET, wallet.connected, wallet.connecting, wallet.wallet, connectWallet]);
  
  // Regularly refresh balances
  useEffect(() => {
    if (wallet.connected) {
      // Initial refresh
      refreshBalances();
      
      // Set up interval for regular updates
      const intervalId = setInterval(refreshBalances, 30000); // Every 30 seconds
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [wallet.connected, refreshBalances]);
  
  // Provide the context value
  const contextValue: SonicAgentContextValue = {
    // State
    isInitialized,
    isInitializing,
    initError,
    walletConnected,
    walletPublicKey,
    userSOLBalance,
    riskLevel,
    portfolioAllocations,
    notifications,
    unreadNotificationCount,
    isAutoTradingEnabled,
    
    // Services
    jupiterService,
    sonicAgent,
    jupiterTradingStrategy,
    portfolioRebalancer,
    marketDataService,
    notificationService,
    
    // Methods
    initialize,
    shutdown,
    connectWallet,
    disconnectWallet, 
    refreshBalances,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    dismissNotification,
    clearAllNotifications,
    setRiskLevel: setRiskLevelHandler,
    updatePortfolioAllocation,
    resetPortfolioAllocation,
    toggleAutoTrading,
  };
  
  return (
    <SonicAgentContext.Provider value={contextValue}>
      {children}
    </SonicAgentContext.Provider>
  );
};

// Custom hook to use the context
export const useSonicAgent = (): SonicAgentContextValue => {
  const context = useContext(SonicAgentContext);
  
  if (!context) {
    throw new Error('useSonicAgent must be used within a SonicAgentProvider');
  }
  
  return context;
};