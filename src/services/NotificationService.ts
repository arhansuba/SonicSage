// src/services/NotificationService.ts

import { NOTIFICATION_SETTINGS } from '../constants/config';

export interface NotificationOptions {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read?: boolean;
  timestamp?: number;
  link?: {
    url: string;
    text: string;
  };
  data?: any;
}

export interface Notification extends NotificationOptions {
  id: string;
  read: boolean;
  timestamp: number;
}

type NotificationListener = (notifications: Notification[]) => void;

/**
 * Service for managing in-app notifications
 */
export class NotificationService {
  private static instance: NotificationService | null = null;
  private notifications: Notification[] = [];
  private listeners: NotificationListener[] = [];

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize notifications from localStorage if available
    this.loadNotifications();
  }

  /**
   * Get the singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Add notification listener
   * @param listener Function to call when notifications change
   * @returns Function to remove the listener
   */
  public addListener(listener: NotificationListener): () => void {
    this.listeners.push(listener);
    
    // Initial notification
    listener([...this.notifications]);
    
    // Return function to remove listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Add a new notification
   * @param options Notification options
   * @returns The created notification
   */
  public addNotification(options: NotificationOptions): Notification {
    const notification: Notification = {
      id: this.generateId(),
      read: options.read ?? false,
      timestamp: options.timestamp ?? Date.now(),
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
      data: options.data
    };
    
    // Add to beginning of array
    this.notifications.unshift(notification);
    
    // Limit the number of stored notifications
    if (this.notifications.length > NOTIFICATION_SETTINGS.MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(0, NOTIFICATION_SETTINGS.MAX_NOTIFICATIONS);
    }
    
    // Save to localStorage
    this.saveNotifications();
    
    // Notify listeners
    this.notifyListeners();
    
    // Try to show browser notification if available
    this.showBrowserNotification(notification);
    
    return notification;
  }

  /**
   * Mark notification as read
   * @param id Notification ID
   * @returns Updated notification or undefined if not found
   */
  public markAsRead(id: string): Notification | undefined {
    const notification = this.notifications.find(n => n.id === id);
    
    if (notification) {
      notification.read = true;
      this.saveNotifications();
      this.notifyListeners();
    }
    
    return notification;
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    
    this.saveNotifications();
    this.notifyListeners();
  }

  /**
   * Remove a notification
   * @param id Notification ID
   * @returns True if notification was removed
   */
  public removeNotification(id: string): boolean {
    const initialLength = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.id !== id);
    
    if (this.notifications.length !== initialLength) {
      this.saveNotifications();
      this.notifyListeners();
      return true;
    }
    
    return false;
  }

  /**
   * Clear all notifications
   */
  public clearNotifications(): void {
    this.notifications = [];
    this.saveNotifications();
    this.notifyListeners();
  }

  /**
   * Get all notifications
   * @returns Copy of notifications array
   */
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get unread notification count
   * @returns Number of unread notifications
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Generate a unique ID for notifications
   * @returns Unique ID string
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Load notifications from localStorage
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('sonicagent_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading notifications from localStorage:', error);
    }
  }

  /**
   * Save notifications to localStorage
   */
  private saveNotifications(): void {
    try {
      localStorage.setItem('sonicagent_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error saving notifications to localStorage:', error);
    }
  }

  /**
   * Notify all listeners of notification changes
   */
  private notifyListeners(): void {
    const notificationsCopy = [...this.notifications];
    this.listeners.forEach(listener => {
      try {
        listener(notificationsCopy);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Show browser notification if supported and permitted
   * @param notification Notification to show
   */
  private showBrowserNotification(notification: Notification): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/assets/icons/notification-icon.png'
        });
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }
  }

  /**
   * Request browser notification permission
   * @returns Promise resolving to true if permission granted
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return true;
      }
      
      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
    }
    
    return false;
  }
}