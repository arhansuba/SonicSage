/**
 * Common type definitions
 */

export * from './api';
export * from './jupiter.d';

/**
 * Common function types
 */
export type VoidFunction = () => void;
export type AsyncVoidFunction = () => Promise<void>;

/**
 * Service status
 */
export enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * Theme type
 */
export type Theme = 'light' | 'dark';

/**
 * Chart time periods
 */
export type TimePeriod = '1W' | '1M' | '3M' | '6M' | '1Y';

/**
 * Service initialization options
 */
export interface ServiceInitOptions {
  privateKey?: string;
  rpcUrl?: string;
  openAiApiKey?: string;
  jupiterApiKey?: string;
}

/**
 * Common token pair
 */
export interface TokenPair {
  inputMint: string;
  outputMint: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: Theme;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  autoRebalance: boolean;
  notifications: boolean;
  defaultInputMint: string;
  defaultOutputMint: string;
}

/**
 * Observable value and setter
 */
export interface Observable<T> {
  value: T;
  set: (value: T) => void;
}

// Export ServiceResponse
export type ServiceResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: number; // Add timestamp property
};

// Export Nullable
export type Nullable<T> = T | null;