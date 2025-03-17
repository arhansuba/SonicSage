// src/components/PriceAlertComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from './common/NotificationPanel';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@radix-ui/react-select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from '@headlessui/react';

interface Token {
  symbol: string;
  name: string;
  address: string;
  logoURI: string;
  decimals: number;
  currentPrice?: number;
}

interface PriceAlertComponentProps {
  tokens: Token[];
  onAlertCreated?: () => void;
}

const PriceAlertComponent: React.FC<PriceAlertComponentProps> = ({ 
  tokens, 
  onAlertCreated 
}) => {
  const { publicKey } = useWallet();
  const { notifyMarketEvent, requestNotificationPermission } = useNotifications();
  
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [priceThreshold, setPriceThreshold] = useState<string>('');
  const [percentageMode, setPercentageMode] = useState<boolean>(false);
  const [percentageValue, setPercentageValue] = useState<string>('5');
  const [enableNotification, setEnableNotification] = useState<boolean>(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Check notification permission on load
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  // Calculate threshold price when percentage changes
  useEffect(() => {
    if (percentageMode && selectedToken?.currentPrice) {
      const percentage = parseFloat(percentageValue);
      if (!isNaN(percentage)) {
        const multiplier = alertType === 'above' ? (1 + percentage / 100) : (1 - percentage / 100);
        const newThreshold = (selectedToken.currentPrice * multiplier).toFixed(6);
        setPriceThreshold(newThreshold);
      }
    }
  }, [percentageMode, percentageValue, alertType, selectedToken]);

  // Check if browser notification permission is granted
  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  };

  // Request browser notification permission
  const requestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  };

  // Handle token selection
  const handleTokenSelect = (address: string) => {
    const token = tokens.find(t => t.address === address) || null;
    setSelectedToken(token);
    
    if (token && percentageMode) {
      const percentage = parseFloat(percentageValue);
      if (!isNaN(percentage) && token.currentPrice) {
        const multiplier = alertType === 'above' ? (1 + percentage / 100) : (1 - percentage / 100);
        const newThreshold = (token.currentPrice * multiplier).toFixed(6);
        setPriceThreshold(newThreshold);
      }
    }
    
    setErrors(prev => ({ ...prev, token: '' }));
  };

  // Handle threshold input change
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPriceThreshold(value);
      setErrors(prev => ({ ...prev, threshold: '' }));
    }
  };

  // Handle percentage input change
  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPercentageValue(value);
      setErrors(prev => ({ ...prev, percentage: '' }));
      
      // Update threshold based on percentage
      if (value && selectedToken?.currentPrice) {
        const percentage = parseFloat(value);
        if (!isNaN(percentage)) {
          const multiplier = alertType === 'above' ? (1 + percentage / 100) : (1 - percentage / 100);
          const newThreshold = (selectedToken.currentPrice * multiplier).toFixed(6);
          setPriceThreshold(newThreshold);
        }
      }
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!selectedToken) {
      newErrors.token = 'Please select a token';
    }
    
    if (percentageMode) {
      const percentage = parseFloat(percentageValue);
      if (!percentageValue || isNaN(percentage)) {
        newErrors.percentage = 'Please enter a valid percentage';
      } else if (percentage <= 0) {
        newErrors.percentage = 'Percentage must be greater than 0';
      } else if (percentage > 100) {
        newErrors.percentage = 'Percentage cannot exceed 100%';
      }
    } else {
      const threshold = parseFloat(priceThreshold);
      if (!priceThreshold || isNaN(threshold)) {
        newErrors.threshold = 'Please enter a valid price';
      } else if (threshold <= 0) {
        newErrors.threshold = 'Price must be greater than 0';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create price alert
  const createPriceAlert = async () => {
    if (!validateForm() || !selectedToken || !publicKey) return;
    
    try {
      // If notification is enabled, check permission
      if (enableNotification && !permissionGranted) {
        const granted = await requestPermission();
        if (!granted) {
          setEnableNotification(false);
        }
      }
      
      // Calculate threshold in native token units (e.g., lamports)
      const threshold = parseFloat(priceThreshold);
      const thresholdInSmallestUnit = Math.floor(threshold * Math.pow(10, selectedToken.decimals));
      
      // In a real implementation, this would call the smart contract
      // Here we're just simulating it
      console.log('Creating price alert:', {
        token: selectedToken.address,
        direction: alertType === 'above',
        threshold: thresholdInSmallestUnit,
        notify: enableNotification
      });
      
      // Create a notification for the alert setup
      const priceDisplay = threshold.toFixed(6);
      const message = `Alert will trigger when ${selectedToken.symbol} price moves ${alertType} $${priceDisplay}`;
      
      notifyMarketEvent(
        `Price Alert Set: ${selectedToken.symbol}`,
        message,
        NotificationType.INFO,
        {
          token: selectedToken,
          threshold,
          direction: alertType
        }
      );
      
      // Reset form
      setSelectedToken(null);
      setPriceThreshold('');
      setPercentageValue('5');
      
      // Callback
      if (onAlertCreated) {
        onAlertCreated();
      }
    } catch (error) {
      console.error('Error creating price alert:', error);
      setErrors({ form: 'Failed to create price alert. Please try again.' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-4">Create Price Alert</h3>
      
      <div className="space-y-4">
        {/* Token Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Token
          </label>
          <Select value={selectedToken?.address || ''} onValueChange={(value: string) => handleTokenSelect(value)}>
            <SelectTrigger className={`w-full ${errors.token ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="Select a token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select a token</SelectItem>
              {tokens.map((token) => (
                <SelectItem key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.token && (
            <p className="mt-1 text-sm text-red-600">{errors.token}</p>
          )}
          
          {selectedToken && selectedToken.currentPrice && (
            <p className="mt-1 text-sm text-gray-500">
              Current price: ${selectedToken.currentPrice.toFixed(6)}
            </p>
          )}
        </div>
        
        {/* Alert Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert Type
          </label>
          <div className="flex space-x-2">
            <Button
              type="button"
              className={`flex-1 py-2 ${alertType === 'above' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setAlertType('above')}
            >
              Price Above
            </Button>
            <Button
              type="button"
              className={`flex-1 py-2 ${alertType === 'below' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setAlertType('below')}
            >
              Price Below
            </Button>
          </div>
        </div>
        
        {/* Percentage Mode Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Set by percentage
          </label>
          <Switch
            checked={percentageMode}
            onChange={() => setPercentageMode(!percentageMode)}
          />
        </div>
        
        {/* Price Threshold or Percentage */}
        {percentageMode ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {alertType === 'above' ? 'Price increase by %' : 'Price decrease by %'}
            </label>
            <div className="relative">
              <Input
                type="text"
                value={percentageValue}
                onChange={handlePercentageChange}
                className={`pr-8 ${errors.percentage ? 'border-red-500' : ''}`}
                placeholder="Enter percentage"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
            {errors.percentage && (
              <p className="mt-1 text-sm text-red-600">{errors.percentage}</p>
            )}
            
            {selectedToken && selectedToken.currentPrice && percentageValue && !isNaN(parseFloat(percentageValue)) && (
              <p className="mt-1 text-sm text-gray-500">
                Target price: ${priceThreshold}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Threshold
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <Input
                type="text"
                value={priceThreshold}
                onChange={handleThresholdChange}
                className={`pl-8 ${errors.threshold ? 'border-red-500' : ''}`}
                placeholder="Enter price"
              />
            </div>
            {errors.threshold && (
              <p className="mt-1 text-sm text-red-600">{errors.threshold}</p>
            )}
          </div>
        )}
        
        {/* Enable Browser Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Enable browser notifications
            </label>
            <p className="text-xs text-gray-500">
              Get notified even when you're not on this page
            </p>
          </div>
          <Switch
            checked={enableNotification}
            onChange={() => setEnableNotification(!enableNotification)}
            disabled={!('Notification' in window)}
          />
        </div>
        
        {/* Form Error */}
        {errors.form && (
          <div className="bg-red-50 p-3 rounded-md">
            <p className="text-sm text-red-600">{errors.form}</p>
          </div>
        )} 
        
        {/* Submit Button */}
        <Button
          type="button"
          className="w-full py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          onClick={createPriceAlert}
          disabled={!publicKey}
        >
          {publicKey ? 'Create Price Alert' : 'Connect Wallet to Create Alert'}
        </Button>
      </div>
    </div>
  );
};

export default PriceAlertComponent;