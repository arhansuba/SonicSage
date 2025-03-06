// src/components/PriceAlertsList.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { formatDistanceToNow } from 'date-fns';
import { TrashIcon, BellIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/NotificationService';

interface Token {
  symbol: string;
  name: string;
  address: string;
  logoURI: string;
  decimals: number;
  currentPrice?: number;
}

interface PriceAlert {
  id: string;
  token: string;
  threshold: string;
  direction: boolean;
  createdAt: number;
  triggered: boolean;
  notifyEmail: boolean;
  notifyBrowser: boolean;
}

interface PriceAlertsListProps {
  tokens: Token[];
  onAlertDeleted?: () => void;
}

// Finish the component implementation
const PriceAlertsList: React.FC<PriceAlertsListProps> = ({ 
  tokens,
  onAlertDeleted
}) => {
  const { publicKey } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Find token info by address
  const getTokenInfo = (address: string): Token | undefined => {
    return tokens.find(token => token.address === address);
  };

  // Fetch price alerts
  useEffect(() => {
    if (publicKey) {
      fetchAlerts();
    } else {
      setAlerts([]);
      setIsLoading(false);
    }
  }, [publicKey]);

  // Fetch alerts from the API
  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would call your API
      // For demo purposes, we'll use mock data
      const response = await fetch('/api/price-alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch price alerts');
      }
      
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch price alerts');
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err.message || 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Your Price Alerts</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get notified when token prices reach your target thresholds.
        </p>
      </div>
      
      {isLoading ? (
        <div className="p-6 text-center">
          <div className="animate-pulse flex justify-center">
            <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
          </div>
          <p className="mt-2 text-sm text-gray-500">Loading your alerts...</p>
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading alerts</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : alerts.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {alerts.map((alert) => {
              const token = getTokenInfo(alert.token);
              return (
                <li key={alert.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {token && (
                        <img 
                          src={token.logoURI} 
                          alt={token.symbol} 
                          className="h-8 w-8 rounded-full mr-3"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/icons/default-token.png';
                          }}
                        />
                      )}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {token ? token.symbol : 'Unknown Token'}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {token ? token.name : alert.token.substring(0, 8) + '...'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Delete alert"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <span className="mr-1">Alert when price is</span>
                        <span className="font-medium text-gray-900">
                          {alert.direction ? 'above' : 'below'}
                        </span>
                        <span className="mx-1">$</span>
                        <span className="font-medium text-gray-900">
                          {formatPrice(alert.threshold, token?.decimals || 6)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(alert.triggered)}`}>
                        {alert.triggered ? 'Triggered' : 'Active'}
                      </span>
                      <span className="ml-2">
                        Created {formatDistanceToNow(alert.createdAt * 1000, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  {token && token.currentPrice && (
                    <div className="mt-2 text-sm">
                      {getPriceIndicator(token, alert.threshold, alert.direction)}
                    </div>
                  )}
                  
                  <div className="mt-2 flex text-xs text-gray-500">
                    <div className="flex items-center mr-3">
                      <BellIcon className="h-4 w-4 mr-1" />
                      <span>
                        {alert.notifyBrowser ? 'Browser alerts enabled' : 'Browser alerts disabled'}
                      </span>
                    </div>
                    {alert.notifyEmail && (
                      <div className="flex items-center">
                        <span>Email alerts enabled</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
  
  // Render the empty state
  const renderEmptyState = () => {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <BellIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No price alerts</h3>
        <p className="text-gray-500 mb-4">
          You haven't set up any price alerts yet.
        </p>
      </div>
    );
  };

  // Delete a price alert
  // Format price with proper decimal places
  const formatPrice = (price: string, decimals: number = 6): string => {
    return parseFloat(price).toFixed(decimals);
  };
  
  // Get status badge class based on alert status
  const getStatusBadgeClass = (triggered: boolean): string => {
    return triggered
      ? 'bg-green-100 text-green-800'
      : 'bg-blue-100 text-blue-800';
  };
  
  // Get current price indicator based on threshold comparison
  const getPriceIndicator = (token: Token, threshold: string, direction: boolean): JSX.Element | null => {
    if (!token.currentPrice) return null;
    
    const thresholdNum = parseFloat(threshold);
    const isAboveThreshold = token.currentPrice > thresholdNum;
    
    // For "above" alerts, green if price is below threshold (hasn't triggered)
    // For "below" alerts, green if price is above threshold (hasn't triggered)
    const isHealthy = direction ? !isAboveThreshold : isAboveThreshold;
    
    return (
      <div className={`flex items-center ${isHealthy ? 'text-green-600' : 'text-red-600'}`}>
        <span className="mr-1">Current: ${token.currentPrice.toFixed(6)}</span>
        <span className={`inline-block w-2 h-2 rounded-full ${isHealthy ? 'bg-green-600' : 'bg-red-600'}`}></span>
      </div>
    );
  };

  const deleteAlert = async (alertId: string) => {
    if (!publicKey) return;
    
    try {
      // In a real implementation, this would call your API
      const response = await fetch(`/api/price-alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete price alert');
      }
      
      const data = await response.json();
      if (data.success) {
        // Remove the alert from state
        setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
        
        // Notify user
        notifyMarketEvent( 
          'Price Alert Deleted',
          'Your price alert has been successfully deleted',
          NotificationType.SUCCESS,
          { alertId }
        );
        
        // Callback
        if (onAlertDeleted) {
          onAlertDeleted();
        }
      } else {
        throw new Error(data.message || 'Failed to delete price alert');
      }
    } catch (err) {
      console.error('Error deleting alert:', err);
      
      notifyMarketEvent(
        'Failed to Delete Alert',
        err.message || 'An error occurred while deleting the alert',
        NotificationType.ERROR
      );
    }
  };
  
  export default PriceAlertsList;