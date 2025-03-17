/**
 * Custom React hooks for Sonic Agent
 */
import { useEffect, useState } from 'react';

// Extend the Window interface to include sonicAgent
declare global {
  interface Window {
    sonicAgent: any;
  }
}
import { MarketDataService } from '../services/MarketDataService';
import { Portfolio, PortfolioPerformance } from '../types/defi';
// Use the Notification interface from the service instead of from types
import { NotificationService, Notification } from '../services/NotificationService';
import { ServiceFactory } from '../services/ServiceFactory';
import { JupiterService } from '../services/JupiterService';
 
/**
 * Hook to get market data
 */
export const useMarketData = (tokenAddresses: string[]) => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setLoading(true);
        
        // Create a new instance instead of using ServiceFactory
        const connection = window.solana?.connection;
        const jupiterService = new JupiterService(connection);
        const marketDataService = new MarketDataService(connection, jupiterService);
        if (!marketDataService) {
          throw new Error("Market data service not initialized");
        }
        
        const priceData = await marketDataService.getMultipleTokenPrices(tokenAddresses);
        // Convert from Map to Record for easier component usage
        const priceRecord: Record<string, number> = {};
        priceData.forEach((price, mint) => {
          priceRecord[mint] = price;
        });
        
        setPrices(priceRecord);
        setError(null);
      } catch (err) {
        console.error("Error fetching market data:", err);
        setError(err instanceof Error ? err : new Error("Unknown error fetching market data"));
      } finally {
        setLoading(false);
      }
    };

    if (tokenAddresses.length > 0) {
      fetchPrices();
      
      // Polling for updates
      const interval = setInterval(fetchPrices, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [tokenAddresses.join(',')]);
  
  return { prices, loading, error };
};

/**
 * Hook to get portfolio data
 */
export const usePortfolio = (walletAddress?: string) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!walletAddress) {
      setPortfolio(null);
      setPerformance(null);
      setLoading(false);
      return;
    }
    
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        
        // Direct implementation instead of using ServiceFactory
        // This is a temporary solution - you'll need to implement direct calls to your actual services
        const sonicAgent = window.sonicAgent; // Assumes a global sonicAgent is available
        
        if (!sonicAgent) {
          throw new Error("Sonic Agent not initialized");
        }
        
        // Directly call methods on sonicAgent
        const portfolioData = await sonicAgent.getPortfolio(walletAddress);
        setPortfolio(portfolioData);
        
        // Assuming getPerformance is available on sonicAgent
        const performanceData = await sonicAgent.getPerformance(walletAddress);
        setPerformance(performanceData);
        
        setError(null);
      } catch (err) {
        console.error("Error fetching portfolio:", err);
        setError(err instanceof Error ? err : new Error("Unknown error fetching portfolio"));
      } finally {
        setLoading(false);
      }
    };
    
    fetchPortfolio();
    
    // Polling for updates
    const interval = setInterval(fetchPortfolio, 5 * 60 * 1000); // Update every 5 minutes
    
    return () => clearInterval(interval);
  }, [walletAddress]);
  
  return { portfolio, performance, loading, error };
};

/**
 * Hook to use notifications
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  useEffect(() => {
    const notificationService = NotificationService.getInstance();
    
    // Cast the type to match the expected interface
    const handleNotificationsChange = (updatedNotifications: Notification[]) => {
      setNotifications(updatedNotifications);
      setUnreadCount(updatedNotifications.filter(n => !n.read).length);
    };
    
    // Use the correct method signature based on your implementation
    const removeListener = notificationService.addListener(handleNotificationsChange);
    
    // Initial notifications
    setNotifications(notificationService.getNotifications());
    setUnreadCount(notificationService.getUnreadCount());
    
    return () => {
      if (removeListener) removeListener();
    };
  }, []);
  
  const markAsRead = (id: string) => {
    NotificationService.getInstance().markAsRead(id);
  };
  
  const markAllAsRead = () => {
    NotificationService.getInstance().markAllAsRead();
  };
  
  const clearAll = () => {
    NotificationService.getInstance().clearNotifications(); // Use the correct method name
  };
  
  const removeNotification = (id: string) => {
    NotificationService.getInstance().removeNotification(id);
  };
  
  // Add function to create a new notification
  const addNotification = (options: { 
    type: any; 
    title: string; 
    message: string; 
    data?: any;
    read?: boolean;
    link?: { url: string; text: string };
  }) => {
    return NotificationService.getInstance().addNotification(options);
  };
  
  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
    addNotification // Export the new function
  };
};