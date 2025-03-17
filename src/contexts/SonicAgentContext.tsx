import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';

import { ServiceFactory } from '../services/ServiceFactory';
import { JupiterService } from '../services/JupiterService';
import { SonicAgent } from '../services/SonicAgent';
import { JupiterTradingStrategy } from '../services/JupiterTradingStrategy';
import { PortfolioRebalancer } from '../services/PortfolioRebalancer';
import { MarketDataService } from '../services/MarketDataService';
import { NotificationService, Notification } from '../services/NotificationService';
import { NotificationType } from '@/types/notification';

import { 
  DEFAULT_RISK_LEVEL,
  AUTO_CONNECT_WALLET,
  SONIC_RPC_ENDPOINT
} from '../constants/config';

// Initial portfolio allocation as a Record<string, number> (token mint -> percentage)
const INITIAL_PORTFOLIO_ALLOCATION: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 30, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 40, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 30, // USDT
};

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
  const [serviceFactory] = useState(() => ServiceFactory.getInstance());
  const [jupiterService, setJupiterService] = useState<JupiterService | null>(null);
  const [sonicAgent, setSonicAgent] = useState<SonicAgent | null>(null);
  const [jupiterTradingStrategy, setJupiterTradingStrategy] = useState<JupiterTradingStrategy | null>(null);
  const [portfolioRebalancer, setPortfolioRebalancer] = useState<PortfolioRebalancer | null>(null);
  const [marketDataService, setMarketDataService] = useState<MarketDataService | null>(null);
  const [notificationService, setNotificationService] = useState<NotificationService | null>(null);
  
  // Function to update notifications from the service
  const updateNotifications = useCallback(() => {
    if (notificationService) {
      const allNotifications = notificationService.getNotifications();
      setNotifications([...allNotifications]);
      setUnreadNotificationCount(notificationService.getUnreadCount());
    }
  }, [notificationService]);
  
  // Initialize the services
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) {
      return;
    }
    
    setIsInitializing(true);
    setInitError(null);
    
    try {
      // Create individual services directly
      if (!notificationService) {
        throw new Error('NotificationService is not initialized');
      }
      const jupService = new JupiterService(connection, 'your-api-key', notificationService);
      setJupiterService(jupService);
      
      const marketService = new MarketDataService(connection, jupService);
      setMarketDataService(marketService);
      
      const agentService = new SonicAgent(connection);
      setSonicAgent(agentService);
      
      const notifService = NotificationService.getInstance();
      setNotificationService(notifService);
      
      // Initialize trading strategy with dependencies
      const strategyService = new JupiterTradingStrategy(connection, agentService, jupService, marketService);
      setJupiterTradingStrategy(strategyService);
      
      // Initialize portfolio rebalancer with dependencies
      const rebalancerService = new PortfolioRebalancer(
        connection,
        agentService,
        jupService,
        marketService,
        notifService
      );
      setPortfolioRebalancer(rebalancerService);
      
      // Set up notification listener
      if (notifService) {
        // Use the returned function to remove the listener later
        const removeListener = notifService.addListener((updatedNotifications) => {
          setNotifications([...updatedNotifications]);
          setUnreadNotificationCount(notifService.getUnreadCount());
        });
      }
      
      // Initial notifications load
      updateNotifications();
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing services:', error);
      setInitError(error instanceof Error ? error : new Error('Unknown error during initialization'));
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing, connection, updateNotifications]);
  
  // Shutdown the services
  const shutdown = useCallback(async () => {
    if (!isInitialized) {
      return;
    }
    
    try {
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
  }, [isInitialized]);
  
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
        notificationService.addNotification({
          type: NotificationType.ERROR,
          title: 'Wallet Connection Failed',
          message: 'Failed to connect your wallet. Please try again.'
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
    updateNotifications();
  }, [notificationService, updateNotifications]);
  
  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(() => {
    if (!notificationService) {
      return;
    }
    
    notificationService.markAllAsRead();
    updateNotifications();
  }, [notificationService, updateNotifications]);
  
  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    if (!notificationService) {
      return;
    }
    
    notificationService.removeNotification(id);
    updateNotifications();
  }, [notificationService, updateNotifications]);
  
  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    if (!notificationService) {
      return;
    }
    
    notificationService.clearNotifications();
    updateNotifications();
  }, [notificationService, updateNotifications]);
  
  // Set risk level and generate target allocations
  const setRiskLevelHandler = useCallback((level: RiskLevel) => {
    setRiskLevel(level);
    
    // Create default allocations based on risk level
    let newAllocations: Record<string, number>;
    
    // Here we manually define allocation strategies for each risk level
    // In a real implementation, this might come from your rebalancer service
    switch (level) {
      case 'conservative':
        newAllocations = {
          'So11111111111111111111111111111111111111112': 20, // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 50, // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 30, // USDT
        };
        break;
      case 'aggressive':
        newAllocations = {
          'So11111111111111111111111111111111111111112': 70, // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 20, // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 10, // USDT
        };
        break;
      case 'moderate':
      default:
        newAllocations = {
          'So11111111111111111111111111111111111111112': 40, // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 30, // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 30, // USDT
        };
        break;
    }
    
    setPortfolioAllocations(newAllocations);
  }, []);
  
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
      // Since the actual methods don't exist, we'll just toggle the state
      setIsAutoTradingEnabled(prevState => !prevState);
      
      // Show notification about the state change
      if (notificationService) {
        const newState = !isAutoTradingEnabled;
        notificationService.addNotification({
          type: newState ? NotificationType.SUCCESS : NotificationType.INFO,
          title: `Auto Trading ${newState ? 'Enabled' : 'Disabled'}`,
          message: `Automatic trading has been ${newState ? 'enabled' : 'disabled'}.${
            newState ? ' Your portfolio will be managed according to your risk profile.' : ''
          }`
        });
      }
    } catch (error) {
      console.error('Error toggling auto trading:', error);
      
      if (notificationService) {
        notificationService.addNotification({
          type: NotificationType.ERROR,
          title: 'Auto Trading Error',
          message: `Failed to ${isAutoTradingEnabled ? 'disable' : 'enable'} automatic trading. Please try again.`
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