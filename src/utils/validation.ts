/**
 * Validation utility functions
 */

import { PublicKey } from '@solana/web3.js';
import { TOKEN_DECIMALS } from '../constants/tokens';

/**
 * Validate wallet address (Solana public key)
 * @param address Address to validate
 * @returns True if address is valid, false otherwise
 */
export function isValidAddress(address: string): boolean {
  try {
    if (!address) return false;
    
    // Check if the address is a valid Solana public key
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate token amount
 * @param amount Amount to validate (can be string or number)
 * @param tokenMint Token mint address to determine decimals
 * @returns True if amount is valid, false otherwise
 */
export function isValidTokenAmount(amount: string | number, tokenMint: string): boolean {
  try {
    // Convert to number if it's a string
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check if it's a positive number
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return false;
    }
    
    // Get token decimals
    const tokenDecimals = TOKEN_DECIMALS[tokenMint] || 9;
    
    // Check if it has a valid number of decimal places
    const amountString = numericAmount.toString();
    const decimalParts = amountString.split('.');
    
    if (decimalParts.length > 1) {
      const decimalPlaces = decimalParts[1].length;
      if (decimalPlaces > tokenDecimals) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate slippage tolerance
 * @param slippageBps Slippage in basis points (e.g. 50 = 0.5%)
 * @returns True if slippage is valid, false otherwise
 */
export function isValidSlippage(slippageBps: number): boolean {
  // Slippage should be between 0 and 10000 (0% to 100%)
  return slippageBps >= 0 && slippageBps <= 10000 && Number.isInteger(slippageBps);
}

/**
 * Validate risk profile
 * @param riskProfile Risk profile to validate
 * @returns True if risk profile is valid, false otherwise
 */
export function isValidRiskProfile(riskProfile: string): boolean {
  return ['conservative', 'moderate', 'aggressive'].includes(riskProfile);
}

/**
 * Validate email address
 * @param email Email to validate
 * @returns True if email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 * @param url URL to validate
 * @returns True if URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Validate JSON string
 * @param jsonString JSON string to validate
 * @returns True if JSON string is valid, false otherwise
 */
export function isValidJson(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate transaction signature format
 * @param signature Transaction signature to validate
 * @returns True if signature format is valid, false otherwise
 */
export function isValidTransactionSignature(signature: string): boolean {
  // Check if signature is a valid base58 string of the correct length
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

/**
 * Validate percentage value
 * @param percentage Percentage to validate (0-100)
 * @returns True if percentage is valid, false otherwise
 */
export function isValidPercentage(percentage: number): boolean {
  return percentage >= 0 && percentage <= 100;
}

/**
 * Validate input/output token pair
 * @param inputMint Input token mint address
 * @param outputMint Output token mint address
 * @returns True if token pair is valid, false otherwise
 */
export function isValidTokenPair(inputMint: string, outputMint: string): boolean {
  // Check if both addresses are valid
  if (!isValidAddress(inputMint) || !isValidAddress(outputMint)) {
    return false;
  }
  
  // Check if they are different tokens
  return inputMint !== outputMint;
}

/**
 * Validate all portfolio allocation percentages sum to 100%
 * @param allocations Array of allocations with targetPercentage field
 * @returns True if allocations sum to 100%, false otherwise
 */
export function isValidPortfolioAllocation(allocations: { targetPercentage: number }[]): boolean {
  if (!allocations || allocations.length === 0) {
    return false;
  }
  
  const sum = allocations.reduce((total, allocation) => total + allocation.targetPercentage, 0);
  return Math.abs(sum - 100) < 0.01; // Allow for small floating point errors
}