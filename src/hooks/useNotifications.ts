// src/hooks/useNotifications.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  NotificationService, 
  Notification, 
  NotificationOptions
} from '../services/NotificationService';
import { NotificationType } from '@/types/notification';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  addNotification: (options: NotificationOptions) => Notification;
  markAsRead: (id: string) => Notification | undefined;
  markAllAsRead: () => void;
  removeNotification: (id: string) => boolean;
  clearNotifications: () => void;
  getNotifications: () => Notification[];
  notifyMarketEvent: (title: string, message: string, type: NotificationType, data?: any) => void;
  notifyTrade: (message: string, options: { 
    title: string; 
    type: NotificationType; 
    strategyId: string; 
    amount: number; 
    txid: string; 
  }) => void;
  requestNotificationPermission: () => Promise<boolean>;
}

export const useNotifications = (): UseNotificationsResult => {
  const { publicKey } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const notificationService = useRef<NotificationService>(NotificationService.getInstance());
  const removeListener = useRef<(() => void) | null>(null);
  
  const fetchNotifications = useCallback(() => {
    try {
      setIsLoading(true);
      if (publicKey) {
        const fetchedNotifications = notificationService.current.getNotifications();
        setNotifications(fetchedNotifications);
        setUnreadCount(notificationService.current.getUnreadCount());
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  // Initialize notification service and subscribe to updates
  useEffect(() => {
    if (publicKey) {
      fetchNotifications();
      
      // Subscribe to notification events
      if (removeListener.current) {
        removeListener.current();
      }
      
      removeListener.current = notificationService.current.addListener((updatedNotifications) => {
        setNotifications(updatedNotifications);
        setUnreadCount(notificationService.current.getUnreadCount());
      });
    }
    
    return () => {
      if (removeListener.current) {
        removeListener.current();
        removeListener.current = null;
      }
    };
  }, [publicKey, fetchNotifications]);

  const addNotification = useCallback(
    (options: NotificationOptions): Notification => {
      return notificationService.current.addNotification(options);
    },
    []
  );

  const markAsRead = useCallback(
    (id: string): Notification | undefined => {
      return notificationService.current.markAsRead(id);
    },
    []
  );

  const markAllAsRead = useCallback(
    (): void => {
      notificationService.current.markAllAsRead();
    },
    []
  );

  const removeNotification = useCallback(
    (id: string): boolean => {
      return notificationService.current.removeNotification(id);
    },
    []
  );

  const clearNotifications = useCallback(
    (): void => {
      notificationService.current.clearNotifications();
    },
    []
  );

  const getNotifications = useCallback(
    (): Notification[] => {
      return notificationService.current.getNotifications();
    },
    []
  );

  const notifyMarketEvent = useCallback(
    (title: string, message: string, type: NotificationType, data?: any): void => {
      notificationService.current.notifyMarketEvent(title, message, type, data);
    },
    []
  );

  const notifyTrade = useCallback(
    (message: string, options: { 
      title: string; 
      type: NotificationType; 
      strategyId: string; 
      amount: number; 
      txid: string; 
    }): void => {
      notificationService.current.notifyTrade(message, options);
    },
    []
  );

  const requestNotificationPermission = useCallback( 
    async (): Promise<boolean> => {
      return await notificationService.current.requestNotificationPermission();
    },
    []
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    getNotifications,
    notifyMarketEvent,
    notifyTrade,
    requestNotificationPermission
  };
};