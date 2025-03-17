import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { MarketDataService } from '../services/MarketDataService';
import { JupiterService } from '../services/JupiterService';
import { TokenInfo, PriceHistoryPoint } from '../types';

/**
 * Custom hook for fetching and managing market data
 * Provides price data, 24h changes, and market trends for tokens
 */
export const useMarketData = (tokenMints: string[] = []) => {
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryPoint[]>>({});
  const [tokenInfos, setTokenInfos] = useState<Record<string, TokenInfo>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Initialize services - use JupiterService directly
  const [jupiterService] = useState(() => new JupiterService(connection));
  const [marketDataService] = useState<MarketDataService>(() => {
    return new MarketDataService(connection, jupiterService);
  });

  /**
   * Fetches token prices from Jupiter Price API
   */
  const fetchPrices = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      setIsLoading(true);
      // Get prices from Jupiter API
      const priceMap = await marketDataService.getMultipleTokenPrices(tokenMints);
      
      setPrices(priceMap);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching token prices:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch price data'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches token metadata and historical price data
   */
  const fetchTokenInfo = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      // Access JupiterService directly since MarketDataService doesn't expose getTokenInfo
      const jupiterService = new JupiterService(connection);
      
      const tokenInfoPromises = tokenMints.map(async (mint) => {
        try {
          const info = await jupiterService.getTokenInfo(mint);
          return { mint, info };
        } catch (e) {
          console.error(`Error fetching token info for ${mint}:`, e);
          return { mint, info: null };
        }
      });
      
      const results = await Promise.all(tokenInfoPromises);
      const newTokenInfos: Record<string, TokenInfo> = {};
      
      results.forEach(({ mint, info }) => {
        if (info) {
          newTokenInfos[mint] = info;
        }
      });
      
      setTokenInfos(newTokenInfos);
    } catch (err) {
      console.error('Error fetching token info:', err);
      // Don't set the main error state for token info failures
    }
  };

  /**
   * Fetches historical price data for each token
   */
  const fetchPriceHistory = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      const historyPromises = tokenMints.map(async (mint) => {
        try {
          const history = await marketDataService.getHistoricalPriceData(mint, '24h');
          return { mint, history };
        } catch (e) {
          console.error(`Error fetching price history for ${mint}:`, e);
          return { mint, history: [] };
        }
      });
      
      const results = await Promise.all(historyPromises);
      const newPriceHistory: Record<string, PriceHistoryPoint[]> = {};
      
      results.forEach(({ mint, history }) => {
        newPriceHistory[mint] = history;
      });
      
      setPriceHistory(newPriceHistory);
    } catch (err) {
      console.error('Error fetching price history:', err);
      // Don't set the main error state for price history failures
    }
  };

  // Fetch all data when token mints change
  useEffect(() => {
    if (tokenMints.length > 0) {
      const fetchAllData = async () => {
        setIsLoading(true);
        await Promise.all([
          fetchPrices(),
          fetchTokenInfo(),
          fetchPriceHistory()
        ]);
        setIsLoading(false);
      };
      
      fetchAllData();
      
      // Set up interval for regular price updates (every 30 seconds)
      const intervalId = setInterval(() => {
        fetchPrices();
        fetchPriceHistory();
      }, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [JSON.stringify(tokenMints)]);

  /**
   * Manually trigger a refresh of all market data
   */
  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchPrices(),
      fetchTokenInfo(),
      fetchPriceHistory()
    ]);
    setIsLoading(false);
  };

  /**
   * Get the price of a specific token
   */
  const getTokenPrice = (mint: string): number | undefined => {
    return prices.get(mint);
  };

  /**
   * Calculate the USD value of a token amount
   */
  const calculateUsdValue = (mint: string, amount: number): number => {
    const price = prices.get(mint);
    if (!price) return 0;
    
    const tokenInfo = tokenInfos[mint];
    if (!tokenInfo) return price * amount;
    
    // Apply decimals for correct calculation
    return price * (amount / Math.pow(10, tokenInfo.decimals));
  };

  /**
   * Check if a token is a stablecoin
   */
  const isStablecoin = async (mint: string): Promise<boolean> => {
    return await marketDataService.isStablecoin(mint);
  };

  /**
   * Get 24h price change for a token in percentage
   */
  const get24hPriceChange = (mint: string): number | undefined => {
    const history = priceHistory[mint];
    if (!history || history.length < 2) return undefined;
    
    const firstPrice = history[0].price;
    const lastPrice = history[history.length - 1].price;
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  };

  return {
    isLoading,
    error,
    prices: Object.fromEntries(prices), // Convert Map to Record for easier use in components
    priceHistory, 
    tokenInfos,
    lastUpdated,
    refreshData,
    getTokenPrice,
    calculateUsdValue,
    isStablecoin,
    get24hPriceChange
  };
};

export default useMarketData;