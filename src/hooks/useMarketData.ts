import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { MarketDataService } from '../services/MarketDataService';
import { TokenInfo } from '../types';

/**
 * Custom hook for fetching and managing market data using Jupiter's API
 * Provides price data, 24h changes, and market trends for tokens
 */
export const useMarketData = (tokenMints: string[] = []) => {
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceChanges, setPriceChanges] = useState<Record<string, number>>({});
  const [tokenInfos, setTokenInfos] = useState<Record<string, TokenInfo>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initialize market data service
  const marketDataService = new MarketDataService(connection);

  /**
   * Fetches token prices from Jupiter Price API
   */
  const fetchPrices = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      setIsLoading(true);
      // Get prices from Jupiter API
      const priceData = await marketDataService.getPrices(tokenMints);
      
      // Process the response and update state
      const newPrices: Record<string, number> = {};
      
      Object.entries(priceData.data).forEach(([mint, data]) => {
        if (data.price) {
          newPrices[mint] = parseFloat(data.price);
        }
      });
      
      setPrices(newPrices);
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
   * Fetches token metadata from Jupiter Token API
   */
  const fetchTokenInfo = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      const tokenData = await marketDataService.getTokenInfo(tokenMints);
      const newTokenInfos: Record<string, TokenInfo> = {};
      
      tokenData.forEach((token) => {
        if (token.address) {
          newTokenInfos[token.address] = token;
        }
      });
      
      setTokenInfos(newTokenInfos);
    } catch (err) {
      console.error('Error fetching token info:', err);
      // Don't set the main error state for token info failures
    }
  };

  /**
   * Fetches 24h price changes for tokens
   */
  const fetchPriceChanges = async () => {
    try {
      if (tokenMints.length === 0) return;
      
      const changes = await marketDataService.get24hPriceChanges(tokenMints);
      setPriceChanges(changes);
    } catch (err) {
      console.error('Error fetching price changes:', err);
      // Don't set the main error state for price change failures
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
          fetchPriceChanges()
        ]);
        setIsLoading(false);
      };
      
      fetchAllData();
      
      // Set up interval for regular price updates (every 30 seconds)
      const intervalId = setInterval(() => {
        fetchPrices();
        fetchPriceChanges();
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
      fetchPriceChanges()
    ]);
    setIsLoading(false);
  };

  /**
   * Get the price of a specific token
   */
  const getTokenPrice = (mint: string): number | undefined => {
    return prices[mint];
  };

  /**
   * Calculate the USD value of a token amount
   */
  const calculateUsdValue = (mint: string, amount: number): number => {
    const price = prices[mint];
    if (!price) return 0;
    
    const tokenInfo = tokenInfos[mint];
    if (!tokenInfo) return price * amount;
    
    // Apply decimals for correct calculation
    return price * (amount / Math.pow(10, tokenInfo.decimals));
  };

  return {
    isLoading,
    error,
    prices,
    priceChanges,
    tokenInfos,
    lastUpdated,
    refreshData,
    getTokenPrice,
    calculateUsdValue
  };
};

export default useMarketData;