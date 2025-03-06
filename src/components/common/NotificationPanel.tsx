// src/components/common/NotificationPanel.tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  NotificationService, 
  Notification, 
  NotificationType, 
  NotificationCategory 
} from '../../services/NotificationService';
import { useWallet } from '@solana/wallet-adapter-react';
import { BellIcon, XIcon, CheckIcon, ExclamationIcon, InformationCircleIcon } from '@heroicons/react/outline';
import { format } from 'date-fns';

interface NotificationPanelProps {
  maxHeight?: string;
  showFilters?: boolean;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  maxHeight = '400px',
  showFilters = true 
}) => {
  const { publicKey } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<NotificationCategory[]>(
    Object.values(NotificationCategory)
  );
  const [selectedTypes, setSelectedTypes] = useState<NotificationType[]>(
    Object.values(NotificationType)
  );
  const notificationService = useRef<NotificationService>(NotificationService.getInstance());
  const subscriptionId = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize notification service when wallet changes
  useEffect(() => {
    if (publicKey) {
      notificationService.current.initialize(publicKey);
      loadNotifications();
      
      // Request browser notification permission
      notificationService.current.requestNotificationPermission();
      
      // Subscribe to new notifications
      subscriptionId.current = notificationService.current.subscribe((notification) => {
        setNotifications(prev => [notification, ...prev]);
        updateUnreadCount();
      });
    }
    
    return () => {
      if (subscriptionId.current) {
        notificationService.current.unsubscribe(subscriptionId.current);
      }
    };
  }, [publicKey]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load notifications with current filters
  const loadNotifications = () => {
    if (!publicKey) return;
    
    const filteredNotifications = notificationService.current.getNotifications({
      categories: selectedCategories,
      types: selectedTypes
    });
    
    setNotifications(filteredNotifications);
    updateUnreadCount();
  };

  // Update the unread count
  const updateUnreadCount = () => {
    setUnreadCount(notificationService.current.getUnreadCount());
  };

  // Handle category filter change
  const handleCategoryChange = (category: NotificationCategory) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Handle type filter change
  const handleTypeChange = (type: NotificationType) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Apply filters when they change
  useEffect(() => {
    loadNotifications();
  }, [selectedCategories, selectedTypes]);

  // Mark a notification as read
  const markAsRead = (id: string) => {
    notificationService.current.markAsRead(id);
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    updateUnreadCount();
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    notificationService.current.markAllAsRead();
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
    updateUnreadCount();
  };

  // Delete a notification
  const deleteNotification = (id: string) => {
    notificationService.current.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    updateUnreadCount();
  };

  // Clear all notifications
  const clearNotifications = () => {
    notificationService.current.clearNotifications();
    setNotifications([]);
    updateUnreadCount();
  };

  // Get icon for notification type
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.SUCCESS:
        return <CheckIcon className="h-5 w-5 text-green-500" />;
      case NotificationType.WARNING:
        return <ExclamationIcon className="h-5 w-5 text-yellow-500" />;
      case NotificationType.ERROR:
        return <XIcon className="h-5 w-5 text-red-500" />;
      case NotificationType.INFO:
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  // Get background color class for notification type
  const getNotificationBgClass = (type: NotificationType, read: boolean) => {
    const baseClass = read ? 'bg-opacity-50' : 'bg-opacity-80';
    
    switch (type) {
      case NotificationType.SUCCESS:
        return `bg-green-100 ${baseClass}`;
      case NotificationType.WARNING:
        return `bg-yellow-100 ${baseClass}`;
      case NotificationType.ERROR:
        return `bg-red-100 ${baseClass}`;
      case NotificationType.INFO:
      default:
        return `bg-blue-100 ${baseClass}`;
    }
  };

  // Get category label
  const getCategoryLabel = (category: NotificationCategory) => {
    switch (category) {
      case NotificationCategory.MARKET:
        return 'Market';
      case NotificationCategory.TRADE:
        return 'Trade';
      case NotificationCategory.PORTFOLIO:
        return 'Portfolio';
      case NotificationCategory.SYSTEM:
        return 'System';
      default:
        return category;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-lg font-medium">Notifications</h3>
            <div className="flex space-x-2">
              <button
                className="text-sm text-blue-500 hover:text-blue-700"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
              <button
                className="text-sm text-red-500 hover:text-red-700"
                onClick={clearNotifications}
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-3 border-b">
              <div className="mb-2">
                <span className="text-sm font-medium">Categories:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.values(NotificationCategory).map((category) => (
                    <button
                      key={category}
                      className={`text-xs px-2 py-1 rounded-full ${
                        selectedCategories.includes(category)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                      onClick={() => handleCategoryChange(category)}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">Types:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.values(NotificationType).map((type) => (
                    <button
                      key={type}
                      className={`text-xs px-2 py-1 rounded-full ${
                        selectedTypes.includes(type)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                      onClick={() => handleTypeChange(type)}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div 
            className="overflow-y-auto"
            style={{ maxHeight }}
          >
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <li 
                    key={notification.id}
                    className={`p-3 transition-colors duration-100 ${
                      getNotificationBgClass(notification.type, notification.read)
                    } ${!notification.read ? 'border-l-4' : ''}`}
                    style={{ 
                      borderLeftColor: notification.read 
                        ? 'transparent' 
                        : notification.type === NotificationType.SUCCESS
                          ? '#10B981'
                          : notification.type === NotificationType.WARNING
                            ? '#F59E0B'
                            : notification.type === NotificationType.ERROR
                              ? '#EF4444'
                              : '#3B82F6'
                    }}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex">
                      <div className="mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          <button
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <span className="bg-gray-200 rounded-full px-2 py-0.5 mr-2">
                            {getCategoryLabel(notification.category)}
                          </span>
                          <span>
                            {format(notification.timestamp, 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {notification.actionUrl && (
                          <div className="mt-2">
                            <a
                              href={notification.actionUrl}
                              className="text-sm text-blue-500 hover:text-blue-700"
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View details
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;