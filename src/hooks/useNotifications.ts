// src/hooks/useNotifications.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  NotificationService, 
  Notification, 
  NotificationType, 
  NotificationCategory,
  NotificationFilter
} from '../services/NotificationService';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  addNotification: (
    title: string, 
    message: string, 
    type: NotificationType, 
    category: NotificationCategory,
    options?: Partial<Omit<Notification, 'id' | 'title' | 'message' | 'type' | 'category' | 'timestamp' | 'read'>>
  ) => Notification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => boolean;
  clearNotifications: () => void;
  getNotifications: (filter?: NotificationFilter) => Notification[];
  notifyMarketEvent: (title: string, message: string, type: NotificationType, data?: any) => Notification;
  notifyTrade: (title: string, message: string, type: NotificationType, data?: any) => Notification;
  notifyPortfolio: (title: string, message: string, type: NotificationType, data?: any) => Notification;
  requestNotificationPermission: () => Promise<boolean>;
}

export const useNotifications = (filter?: NotificationFilter): UseNotificationsResult => {
  const { publicKey } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const notificationService = useRef<NotificationService>(NotificationService.getInstance());
  const subscriptionId = useRef<string | null>(null);
  
  const fetchNotifications = useCallback(() => {
    try {
      setIsLoading(true);
      if (publicKey) {
        const fetchedNotifications = notificationService.current.getNotifications(filter);
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
  }, [publicKey, filter]);

  // Initialize notification service
  useEffect(() => {
    if (publicKey) {
      notificationService.current.initialize(publicKey);
      fetchNotifications();
      
      // Subscribe to notification events
      subscriptionId.current = notificationService.current.subscribe(() => {
        fetchNotifications();
      });
    }
    
    return () => {
      if (subscriptionId.current) {
        notificationService.current.unsubscribe(subscriptionId.current);
        subscriptionId.current = null;
      }
    };
  }, [publicKey, fetchNotifications]);

  // Refetch when filter changes
  useEffect(() => {
    fetchNotifications();
  }, [filter, fetchNotifications]);

  const addNotification = useCallback(
    (
      title: string, 
      message: string, 
      type: NotificationType, 
      category: NotificationCategory,
      options?: Partial<Omit<Notification, 'id' | 'title' | 'message' | 'type' | 'category' | 'timestamp' | 'read'>>
    ): Notification => {
      const notification = notificationService.current.addNotification({
        title,
        message,
        type,
        category,
        ...options
      });
      
      fetchNotifications();
      return notification;
    },
    [fetchNotifications]
  );

  const markAsRead = useCallback(
    (id: string): void => {
      notificationService.current.markAsRead(id);
      fetchNotifications();
    },
    [fetchNotifications]
  );

  const markAllAsRead = useCallback(
    (): void => {
      notificationService.current.markAllAsRead();
      fetchNotifications();
    },
    [fetchNotifications]
  );

  const deleteNotification = useCallback(
    (id: string): boolean => {
      const result = notificationService.current.deleteNotification(id);
      fetchNotifications();
      return result;
    },
    [fetchNotifications]
  );

  const clearNotifications = useCallback(
    (): void => {
      notificationService.current.clearNotifications();
      fetchNotifications();
    },
    [fetchNotifications]
  );

  const getNotifications = useCallback(
    (customFilter?: NotificationFilter): Notification[] => {
      return notificationService.current.getNotifications(customFilter);
    },
    []
  );

  const notifyMarketEvent = useCallback(
    (title: string, message: string, type: NotificationType, data?: any): Notification => {
      const notification = notificationService.current.notifyMarketEvent(title, message, type, data);
      fetchNotifications();
      return notification;
    },
    [fetchNotifications]
  );

  const notifyTrade = useCallback(
    (title: string, message: string, type: NotificationType, data?: any): Notification => {
      const notification = notificationService.current.notifyTrade(title, message, type, data);
      fetchNotifications();
      return notification;
    },
    [fetchNotifications]
  );

  const notifyPortfolio = useCallback(
    (title: string, message: string, type: NotificationType, data?: any): Notification => {
      const notification = notificationService.current.notifyPortfolio(title, message, type, data);
      fetchNotifications();
      return notification;
    },
    [fetchNotifications]
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
    deleteNotification,
    clearNotifications,
    getNotifications,
    notifyMarketEvent,
    notifyTrade,
    notifyPortfolio,
    requestNotificationPermission
  };