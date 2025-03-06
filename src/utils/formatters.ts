/**
 * Formatting utility functions
 */

import { UI } from '../constants/config';
import { TOKEN_DECIMALS } from '../constants/tokens';

/**
 * Format currency value
 * @param value Value to format
 * @param currency Currency symbol
 * @param decimals Number of decimal places
 */
export function formatCurrency(
  value: number, 
  currency = 'USD', 
  decimals = UI.DEFAULT_DECIMALS
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Format percentage value
 * @param value Value to format
 * @param decimals Number of decimal places
 * @param includeSymbol Whether to include % symbol
 */
export function formatPercentage(
  value: number, 
  decimals = UI.PERCENTAGE_DECIMALS, 
  includeSymbol = true
): string {
  const formatted = value.toFixed(decimals);
  return includeSymbol ? `${formatted}%` : formatted;
}

/**
 * Format token amount based on token decimals
 * @param amount Raw token amount (in lamports/atomic units)
 * @param tokenMint Token mint address
 * @param displayDecimals Number of decimals to display
 */
export function formatTokenAmount(
  amount: string | number, 
  tokenMint: string,
  displayDecimals = UI.TOKEN_BALANCE_DECIMALS
): string {
  // Convert amount to number if it's a string
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Get token decimals
  const tokenDecimals = TOKEN_DECIMALS[tokenMint] || 9;
  
  // Calculate decimal amount
  const decimalAmount = numericAmount / Math.pow(10, tokenDecimals);
  
  // Format with the specified number of display decimals
  return decimalAmount.toFixed(displayDecimals);
}

/**
 * Convert token amount to lamports/atomic units
 * @param amount Decimal amount
 * @param tokenMint Token mint address
 */
export function toAtomicUnits(amount: number, tokenMint: string): string {
  const tokenDecimals = TOKEN_DECIMALS[tokenMint] || 9;
  const atomicAmount = Math.floor(amount * Math.pow(10, tokenDecimals));
  return atomicAmount.toString();
}

/**
 * Format wallet address for display
 * @param address Full wallet address
 * @param startChars Number of starting characters to show
 * @param endChars Number of ending characters to show
 */
export function formatAddress(
  address: string,
  startChars = 4,
  endChars = 4
): string {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format date to standard format
 * @param date Date to format
 * @param includeTime Whether to include time
 */
export function formatDate(date: Date | string, includeTime = false): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (includeTime) {
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Format time ago from date
 * @param date Date to calculate time from
 */
export function timeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
  
  let interval = seconds / 31536000; // years
  
  if (interval > 1) {
    return Math.floor(interval) + " years ago";
  }
  
  interval = seconds / 2592000; // months
  if (interval > 1) {
    return Math.floor(interval) + " months ago";
  }
  
  interval = seconds / 86400; // days
  if (interval > 1) {
    return Math.floor(interval) + " days ago";
  }
  
  interval = seconds / 3600; // hours
  if (interval > 1) {
    return Math.floor(interval) + " hours ago";
  }
  
  interval = seconds / 60; // minutes
  if (interval > 1) {
    return Math.floor(interval) + " minutes ago";
  }
  
  return Math.floor(seconds) + " seconds ago";
}