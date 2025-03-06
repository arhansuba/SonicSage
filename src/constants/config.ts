/**
 * Application configuration constants
 */

// Feature flags
export const FEATURES = {
    AI_RECOMMENDATIONS: process.env.REACT_APP_ENABLE_AI_RECOMMENDATIONS !== 'false',
    PORTFOLIO_REBALANCING: process.env.REACT_APP_ENABLE_PORTFOLIO_REBALANCING !== 'false',
    JUPITER_TERMINAL: true,
    NOTIFICATIONS: true,
    MARKET_DATA: true
  };
  
  // Risk profile settings
  export const RISK_PROFILES = {
    DEFAULT: (process.env.REACT_APP_DEFAULT_RISK_PROFILE || 'moderate') as 'conservative' | 'moderate' | 'aggressive',
    THRESHOLD_PERCENTAGE: 5 // Threshold for rebalancing (percentage points)
  };
  
  // Chart time periods
  export const TIME_PERIODS = {
    ONE_WEEK: '1W',
    ONE_MONTH: '1M',
    THREE_MONTHS: '3M',
    SIX_MONTHS: '6M',
    ONE_YEAR: '1Y'
  };
  
  // Default chart period
  export const DEFAULT_TIME_PERIOD = TIME_PERIODS.ONE_MONTH;
  
  // Jupiter swap settings
  export const JUPITER_SETTINGS = {
    PLATFORM_FEE_BPS: Number(process.env.REACT_APP_JUPITER_PLATFORM_FEE_BPS || '0'),
    FEE_ACCOUNT: process.env.REACT_APP_JUPITER_FEE_ACCOUNT || '',
    SLIPPAGE_BPS: 50, // 0.5% default slippage
    PRIORITY_LEVEL: 'high' as 'medium' | 'high' | 'veryHigh',
    MAX_PRIORITY_FEE_LAMPORTS: 1000000
  };
  
  // Notification settings
  export const NOTIFICATION_SETTINGS = {
    MAX_NOTIFICATIONS: 50,
    CHECK_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
  };
  
  // Market data polling interval
  export const MARKET_DATA_POLLING_INTERVAL_MS = 60 * 1000; // 1 minute
  
  // API request timeout
  export const API_TIMEOUT_MS = 30000; // 30 seconds
  
  // Cache TTL settings
  export const CACHE_TTL = {
    TOKEN_INFO_MS: 24 * 60 * 60 * 1000, // 24 hours
    MARKET_DATA_MS: 5 * 60 * 1000,      // 5 minutes
    PORTFOLIO_DATA_MS: 5 * 60 * 1000    // 5 minutes
  };
  
  // Authentication settings
  export const AUTH = {
    TOKEN_STORAGE_KEY: 'sonicagent_auth_token',
    REFRESH_TOKEN_STORAGE_KEY: 'sonicagent_refresh_token',
    SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000 // 24 hours
  };
  
  // UI settings
  export const UI = {
    THEME: 'dark',
    DEFAULT_DECIMALS: 2,
    PRICE_DECIMALS: 6,
    TOKEN_BALANCE_DECIMALS: 6,
    PERCENTAGE_DECIMALS: 2,
    MAX_MOBILE_WIDTH: 768,
    SIDEBAR_WIDTH: 240
  };