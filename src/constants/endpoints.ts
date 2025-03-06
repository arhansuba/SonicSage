/**
 * API endpoints for the SonicAgent application
 */

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
      price: 'https://api.jup.ag/price/v2',
      
      // Jupiter Token API
      tokens: {
        token: (mint: string) => `https://api.jup.ag/tokens/v1/token/${mint}`,
        tagged: (tag: string) => `https://api.jup.ag/tokens/v1/tagged/${tag}`,
        tradable: 'https://api.jup.ag/tokens/v1/mints/tradable'
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