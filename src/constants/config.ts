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

// Added missing constants
//export const JUPITER_API_KEY = process.env.REACT_APP_JUPITER_API_KEY || '';
export const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || '';
export const ENABLE_NOTIFICATIONS = process.env.REACT_APP_ENABLE_NOTIFICATIONS !== 'false';
export const AUTO_TRADING_ENABLED = process.env.REACT_APP_AUTO_TRADING_ENABLED === 'true';
export const DEBUGGING_ENABLED = process.env.REACT_APP_DEBUGGING_ENABLED === 'true';
export const INITIAL_PORTFOLIO_ALLOCATION = [
  { mint: 'So11111111111111111111111111111111111111112', percentage: 50, maxDeviation: 10 }, // SOL
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', percentage: 30, maxDeviation: 5 }, // USDC
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', percentage: 20, maxDeviation: 5 }  // USDT
];
export const DEFAULT_RISK_LEVEL = 'moderate';
export const AUTO_CONNECT_WALLET = process.env.REACT_APP_AUTO_CONNECT_WALLET === 'true';
export const PORTFOLIO_HISTORY_DAYS = 30;
export const TOKEN_COLORS = {
  'SOL': '#00FFA3',
  'USDC': '#2775CA',
  'USDT': '#26A17B',
  'ETH': '#627EEA',
  'BTC': '#F7931A',
  'MSOL': '#8A76FF',
  'JUP': '#F5A623',
  'RAY': '#576CFE',
  'LUNA': '#172852',
  'ORCA': '#047AFF',
  'AVAX': '#E84142',
  'STSOL': '#9945FF',
  'CSOL': '#9ADEFE',
  'JSOL': '#FA4F00',
  'WIF': '#D08B30',
  'SAMO': '#F4BB0D',
  'BONK': '#FFC700',
  'OTHER': '#808080'
};

// API endpoints for the SonicAgent application

// Base URLs for different environments
export const BASE_URLS = {
  development: 'http://localhost:5000',
  production: 'https://api.sonicagent.app',
  test: 'http://localhost:5000'
};

// Current environment
export const ENV = process.env.NODE_ENV || 'development';

// Current base URL
export const BASE_URL = BASE_URLS[ENV as keyof typeof BASE_URLS];

// API endpoints
export const API = {
  // Server API endpoints
  server: {
    health: `${BASE_URL}/api/health`,
    market: {
      stats: `${BASE_URL}/api/market/stats`,
      prices: `${BASE_URL}/api/market/prices`
    },
    portfolio: {
      get: (walletAddress: string) => `${BASE_URL}/api/portfolio/${walletAddress}`,
      rebalance: `${BASE_URL}/api/portfolio/rebalance`
    },
    recommendations: {
      get: (walletAddress: string) => `${BASE_URL}/api/recommendations/${walletAddress}`
    },
    trade: {
      execute: `${BASE_URL}/api/trade/execute`
    },
    tokens: {
      info: (address: string) => `${BASE_URL}/api/tokens/info/${address}`,
      verified: `${BASE_URL}/api/tokens/verified`
    }
  },
  
  // Jupiter API endpoints
  jupiter: {
    // Jupiter Swap API
    swap: {
      quote: 'https://api.jup.ag/swap/v1/quote',
      swap: 'https://api.jup.ag/swap/v1/swap',
      swapInstructions: 'https://api.jup.ag/swap/v1/swap-instructions'
    },
    
    // Jupiter Ultra API
    ultra: {
      order: 'https://api.jup.ag/ultra/v1/order',
      execute: 'https://api.jup.ag/ultra/v1/execute'
    },
    
    // Jupiter Price API
    price: 'https://price.jup.ag/v1/price',
    
    // Jupiter Token API
    tokens: {
      token: (mint: string) => `https://token.jup.ag/token/${mint}`,
      tagged: (tag: string) => `https://token.jup.ag/tagged/${tag}`,
      tradable: 'https://token.jup.ag/tokens'
    }
  },
  
  // Sonic SVM RPC endpoints
  sonic: {
    mainnet: 'https://api.mainnet-alpha.sonic.game',
    secondaryMainnet: 'https://rpc.mainnet-alpha.sonic.game',
    helius: 'https://sonic.helius-rpc.com/',
    testnet: 'https://api.testnet.sonic.game/'
  },
  
  // Explorer URLs
  explorer: {
    transaction: (signature: string) => `https://explorer.sonic.game/tx/${signature}`,
    address: (address: string) => `https://explorer.sonic.game/address/${address}`,
    token: (address: string) => `https://explorer.sonic.game/address/${address}?tab=tokens`
  }
};

// RPC URL from environment or default
export const RPC_URL = process.env.REACT_APP_RPC_URL || API.sonic.mainnet;

// Jupiter API key from environment
export const JUPITER_API_KEY = process.env.REACT_APP_JUPITER_API_KEY || '';

// Function to create Jupiter headers
export const getJupiterHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Add API key if available
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }
  
  return headers;
};

/**
 * Sonic SVM RPC endpoint
 */
export const ENDPOINT_SONIC_RPC = "https://api.sonic.game/rpc";
export const SONIC_RPC_ENDPOINT = ENDPOINT_SONIC_RPC; // Alias for backward compatibility

/**
 * Jupiter API endpoint
 */
export const ENDPOINT_JUPITER_API = "https://quote-api.jup.ag/v6";

/**
 * Solana Mainnet RPC endpoint
 */
export const ENDPOINT_SOLANA_MAINNET = "https://api.mainnet-beta.solana.com";

/**
 * Sonic Game Explorer
 */
export const EXPLORER_SONIC = "https://explorer.sonic.game";