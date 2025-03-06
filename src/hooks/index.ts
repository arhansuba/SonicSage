/**
 * Custom React hooks for Sonic Agent
 */
import { useEffect, useState } from 'react';
import { MarketDataService } from '../services/MarketDataService';
import { Portfolio, PortfolioPerformance } from '../types/defi';
import { Notification } from '../types/notification';
import NotificationService from '../services/NotificationService';
import { ServiceFactory } from '../services/ServiceFactory';

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
        
        const marketDataService = ServiceFactory.getInstance().getMarketDataService();
        if (!marketDataService) {
          throw new Error("Market data service not initialized");
        }
        
        const priceData = await marketDataService.getPrices(tokenAddresses);
        setPrices(priceData);
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
        
        const services = ServiceFactory.getInstance();
        const portfolioService = services.getPortfolioService();
        
        if (!portfolioService) {
          throw new Error("Portfolio service not initialized");
        }
        
        const portfolioData = await portfolioService.getPortfolio(walletAddress);
        setPortfolio(portfolioData);
        
        const performanceData = await portfolioService.getPerformance(walletAddress);
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
    
    const handleNotificationsChange = (updatedNotifications: Notification[]) => {
      setNotifications(updatedNotifications);
      setUnreadCount(updatedNotifications.filter(n => !n.read).length);
    };
    
    notificationService.addListener(handleNotificationsChange);
    
    // Initial notifications
    handleNotificationsChange(notificationService.getNotifications());
    
    return () => {
      notificationService.removeListener(handleNotificationsChange);
    };
  }, []);
  
  const markAsRead = (id: string) => {
    NotificationService.getInstance().markAsRead(id);
  };
  
  const markAllAsRead = () => {
    NotificationService.getInstance().markAllAsRead();
  };
  
  const clearAll = () => {
    NotificationService.getInstance().clearAll();
  };
  
  const removeNotification = (id: string) => {
    NotificationService.getInstance().removeNotification(id);
  };
  
  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification
  };
};