// src/hooks/useTradingNotifications.ts

import { useEffect, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useNotifications } from './useNotifications';
import { NotificationType } from '@/types/notification';

interface TradeDetails {
  signature: string;
  fromToken: string;
  fromTokenSymbol: string;
  toToken: string; 
  toTokenSymbol: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  timestamp: number;
}

interface MarketEvent {
  type: 'priceMove' | 'volatilityAlert' | 'trendReversal' | 'news';
  token: string;
  tokenSymbol: string;
  message: string;
  data?: any;
}

interface UseTradingNotificationsProps {
  onTradeExecuted?: (details: TradeDetails) => void;
  onTradeConfirmed?: (signature: string) => void;
  onTradeFailed?: (signature: string, error: string) => void;
  onMarketEvent?: (event: MarketEvent) => void;
}

export const useTradingNotifications = ({
  onTradeExecuted,
  onTradeConfirmed,
  onTradeFailed,
  onMarketEvent
}: UseTradingNotificationsProps = {}) => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { addNotification } = useNotifications();
  
  const pendingTransactions = useRef<Set<string>>(new Set());
  const subscriptions = useRef<Map<string, number>>(new Map());
  
  // Clean up subscriptions when component unmounts
  useEffect(() => {
    return () => {
      // Unsubscribe from all transaction confirmations
      subscriptions.current.forEach((id, _) => {
        connection.removeSignatureListener(id);
      });
      subscriptions.current.clear();
    };
  }, [connection]);
  
  // Function to track transaction confirmation
  const trackTransaction = (
    signature: string, 
    details: Omit<TradeDetails, 'signature' | 'timestamp'>
  ) => {
    if (pendingTransactions.current.has(signature)) return;
    
    pendingTransactions.current.add(signature);
    
    // Notify that trade is executed but not confirmed
    addNotification({
      type: NotificationType.INFO,
      title: 'Trade Submitted',
      message: `Swapping ${details.fromAmount} ${details.fromTokenSymbol} for ${details.toTokenSymbol}...`,
      data: {
        ...details,
        signature,
        status: 'pending'
      }
    });
    
    if (onTradeExecuted) {
      onTradeExecuted({
        ...details,
        signature,
        timestamp: Date.now()
      });
    }
    
    // Subscribe to transaction confirmation
    const id = connection.onSignature(
      signature,
      (result, context) => {
        pendingTransactions.current.delete(signature);
        subscriptions.current.delete(signature);
        
        if (result.err) {
          // Trade failed
          addNotification({
            type: NotificationType.ERROR,
            title: 'Trade Failed',
            message: `Failed to swap ${details.fromAmount} ${details.fromTokenSymbol} for ${details.toTokenSymbol}`,
            data: {
              ...details,
              signature,
              error: result.err,
              status: 'failed'
            }
          });
          
          if (onTradeFailed) {
            onTradeFailed(signature, JSON.stringify(result.err));
          }
        } else {
          // Trade confirmed
          addNotification({
            type: NotificationType.SUCCESS,
            title: 'Trade Confirmed',
            message: `Successfully swapped ${details.fromAmount} ${details.fromTokenSymbol} for ${details.toAmount} ${details.toTokenSymbol}`,
            data: {
              ...details,
              signature,
              status: 'confirmed'
            }
          });
          
          if (onTradeConfirmed) {
            onTradeConfirmed(signature);
          }
        }
      },
      'confirmed'
    );
    
    subscriptions.current.set(signature, id);
  };
  
  // Function to notify about market events
  const reportMarketEvent = (event: MarketEvent) => {
    let title: string;
    let type: NotificationType;
    
    switch (event.type) {
      case 'priceMove':
        title = `${event.tokenSymbol} Price Movement`;
        type = NotificationType.INFO;
        break;
      case 'volatilityAlert':
        title = `${event.tokenSymbol} Volatility Alert`;
        type = NotificationType.WARNING;
        break;
      case 'trendReversal':
        title = `${event.tokenSymbol} Trend Reversal`;
        type = NotificationType.WARNING;
        break;
      case 'news':
        title = `${event.tokenSymbol} Market News`;
        type = NotificationType.INFO;
        break;
      default:
        title = `${event.tokenSymbol} Market Update`;
        type = NotificationType.INFO;
    }
    
    addNotification({
      type,
      title,
      message: event.message,
      data: {
        ...event,
        timestamp: Date.now()
      }
    });
    
    if (onMarketEvent) {
      onMarketEvent(event);
    }
  };
  
  return {
    trackTransaction,
    reportMarketEvent
  };
};