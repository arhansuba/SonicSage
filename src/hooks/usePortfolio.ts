import { useEffect, useState, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import useMarketData from './useMarketData';
import { SonicAgent } from '../services/SonicAgent';
import { PortfolioRebalancer } from '../services/PortfolioRebalancer';
import { NotificationService } from '../services/NotificationService';

// Interfaces for portfolio data
export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number; // Raw balance (with decimals)
  decimals: number;
  usdValue: number;
  logoURI?: string;
  priceChange24h?: number;
  tags?: string[];
}

export interface PortfolioAsset extends TokenBalance {
  allocation: number; // Percentage of total portfolio
  targetAllocation?: number; // Target allocation for rebalancing
  needsRebalancing?: boolean;
}

export interface PortfolioAnalytics {
  totalValue: number;
  totalValueChange24h: number;
  changePercentage24h: number;
  assets: PortfolioAsset[];
  solPrice: number;
}

/**
 * Custom hook for managing user portfolio data
 * Tracks token balances, calculates portfolio value, and provides analytics
 */
export const usePortfolio = () => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRebalancing, setIsRebalancing] = useState<boolean>(false);

  // Initialize services
  const sonicAgent = useMemo(() => new SonicAgent(connection), [connection]);
  const portfolioRebalancer = useMemo(() => new PortfolioRebalancer(connection), [connection]);
  const notificationService = useMemo(() => new NotificationService(), []);
  
  // Extract token mints from assets for market data
  const tokenMints = useMemo(() => {
    const mints = assets.map(asset => asset.mint);
    // Always include SOL in the token mints
    if (!mints.includes('So11111111111111111111111111111111111111112')) {
      mints.push('So11111111111111111111111111111111111111112');
    }
    return mints;
  }, [assets]);

  // Use the market data hook to get price information
  const { 
    prices, 
    priceChanges, 
    tokenInfos, 
    isLoading: isPriceLoading, 
    error: priceError,
    calculateUsdValue
  } = useMarketData(tokenMints);

  /**
   * Fetches native SOL balance for the connected wallet
   */
  const fetchNativeSolBalance = async () => {
    if (!publicKey) return 0;
    
    try {
      const balance = await connection.getBalance(publicKey);
      setNativeBalance(balance);
      return balance;
    } catch (err) {
      console.error('Error fetching SOL balance:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch SOL balance'));
      return 0;
    }
  };

  /**
   * Fetches all token accounts for the connected wallet
   */
  const fetchTokenAccounts = async () => {
    if (!publicKey) return [];
    
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      return tokenAccounts.value.map(account => {
        const accountData = account.account.data.parsed.info;
        return {
          mint: accountData.mint,
          balance: Number(accountData.tokenAmount.amount),
          decimals: accountData.tokenAmount.decimals,
        };
      }).filter(account => account.balance > 0);
    } catch (err) {
      console.error('Error fetching token accounts:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch token accounts'));
      return [];
    }
  };

  /**
   * Enriches token data with token info and price data
   */
  const enrichTokenData = (tokenAccounts: any[], solBalance: number) => {
    // Create portfolio assets from token accounts
    const portfolioAssets: PortfolioAsset[] = tokenAccounts.map(account => {
      const tokenInfo = tokenInfos[account.mint] || {
        symbol: 'Unknown',
        name: 'Unknown Token',
        address: account.mint,
        decimals: account.decimals,
      };

      const usdValue = calculateUsdValue(account.mint, account.balance);
      
      return {
        mint: account.mint,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        balance: account.balance,
        decimals: account.decimals,
        usdValue,
        allocation: 0, // Will be calculated later
        logoURI: tokenInfo.logoURI,
        priceChange24h: priceChanges[account.mint] || 0,
        tags: tokenInfo.tags || [],
      };
    });

    // Add native SOL to portfolio assets
    if (solBalance > 0) {
      const solMint = 'So11111111111111111111111111111111111111112';
      const solInfo = tokenInfos[solMint] || {
        symbol: 'SOL',
        name: 'Solana',
        address: solMint,
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      };

      const usdValue = calculateUsdValue(solMint, solBalance);

      portfolioAssets.push({
        mint: solMint,
        symbol: 'SOL',
        name: 'Solana',
        balance: solBalance,
        decimals: 9,
        usdValue,
        allocation: 0, // Will be calculated later
        logoURI: solInfo.logoURI,
        priceChange24h: priceChanges[solMint] || 0,
        tags: solInfo.tags || ['native'],
      });
    }

    // Calculate total value
    const totalValue = portfolioAssets.reduce((sum, asset) => sum + asset.usdValue, 0);

    // Calculate allocation percentages
    return portfolioAssets.map(asset => ({
      ...asset,
      allocation: totalValue > 0 ? (asset.usdValue / totalValue) * 100 : 0,
    })).sort((a, b) => b.usdValue - a.usdValue); // Sort by USD value descending
  };

  /**
   * Fetches all portfolio data
   */
  const fetchPortfolioData = async () => {
    if (!publicKey || !connected) {
      setAssets([]);
      setNativeBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch native SOL balance and token accounts in parallel
      const [solBalance, tokenAccounts] = await Promise.all([
        fetchNativeSolBalance(),
        fetchTokenAccounts(),
      ]);

      // Enrich token data with prices and info
      const enrichedAssets = enrichTokenData(tokenAccounts, solBalance);
      
      setAssets(enrichedAssets);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch portfolio data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate portfolio analytics
  const analytics: PortfolioAnalytics = useMemo(() => {
    const totalValue = assets.reduce((sum, asset) => sum + asset.usdValue, 0);
    
    // Calculate 24h change in portfolio value
    const totalValueChange24h = assets.reduce((sum, asset) => {
      if (asset.usdValue > 0 && asset.priceChange24h) {
        // Calculate previous value based on price change percentage
        const previousValue = asset.usdValue / (1 + asset.priceChange24h / 100);
        return sum + (asset.usdValue - previousValue);
      }
      return sum;
    }, 0);
    
    const changePercentage24h = totalValue > 0 
      ? (totalValueChange24h / (totalValue - totalValueChange24h)) * 100 
      : 0;
    
    // Get SOL price for reference
    const solPrice = prices['So11111111111111111111111111111111111111112'] || 0;
    
    return {
      totalValue,
      totalValueChange24h,
      changePercentage24h,
      assets,
      solPrice
    };
  }, [assets, prices]);

  /**
   * Generates rebalancing recommendations based on current portfolio
   */
  const generateRebalancingRecommendations = async () => {
    try {
      const rebalancingPlan = await portfolioRebalancer.generateRebalancingPlan(
        assets,
        analytics.totalValue
      );
      
      // Update assets with target allocations and rebalancing flags
      const updatedAssets = assets.map(asset => {
        const rebalanceInfo = rebalancingPlan.assetAllocations.find(
          a => a.mint === asset.mint
        );
        
        if (rebalanceInfo) {
          return {
            ...asset,
            targetAllocation: rebalanceInfo.targetAllocation,
            needsRebalancing: rebalanceInfo.needsRebalancing,
          };
        }
        
        return asset;
      });
      
      setAssets(updatedAssets);
      return rebalancingPlan;
    } catch (err) {
      console.error('Error generating rebalancing recommendations:', err);
      throw err;
    }
  };

  /**
   * Executes portfolio rebalancing based on the rebalancing plan
   */
  const executeRebalancing = async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }
    
    try {
      setIsRebalancing(true);
      
      // Generate rebalancing plan
      const rebalancingPlan = await generateRebalancingRecommendations();
      
      // Execute rebalancing through SonicAgent service
      const result = await sonicAgent.executePortfolioRebalancing(
        publicKey,
        rebalancingPlan
      );
      
      // Refresh portfolio data after rebalancing
      await fetchPortfolioData();
      
      // Notify user of successful rebalancing
      notificationService.notify({
        type: 'success',
        title: 'Portfolio Rebalanced',
        message: 'Your portfolio has been successfully rebalanced.',
        data: result
      });
      
      return result;
    } catch (err) {
      console.error('Error executing portfolio rebalancing:', err);
      
      // Notify user of rebalancing failure
      notificationService.notify({
        type: 'error',
        title: 'Rebalancing Failed',
        message: err instanceof Error ? err.message : 'Failed to rebalance portfolio'
      });
      
      throw err;
    } finally {
      setIsRebalancing(false);
    }
  };

  // Fetch portfolio data when wallet connection changes
  useEffect(() => {
    fetchPortfolioData();
  }, [publicKey, connected]);

  // Refresh portfolio data when prices are updated
  useEffect(() => {
    if (!isLoading && !isPriceLoading && publicKey) {
      // Just update the USD values and allocations without fetching balances again
      const updatedAssets = assets.map(asset => {
        const usdValue = calculateUsdValue(asset.mint, asset.balance);
        return {
          ...asset,
          usdValue,
          priceChange24h: priceChanges[asset.mint] || 0,
        };
      });
      
      // Recalculate allocations
      const totalValue = updatedAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
      const assetsWithAllocations = updatedAssets.map(asset => ({
        ...asset,
        allocation: totalValue > 0 ? (asset.usdValue / totalValue) * 100 : 0,
      }));
      
      setAssets(assetsWithAllocations);
    }
  }, [prices, priceChanges]);

  // Set up polling interval for regular updates
  useEffect(() => {
    if (connected) {
      const intervalId = setInterval(() => {
        fetchPortfolioData();
      }, 60000); // Update every minute
      
      return () => clearInterval(intervalId);
    }
  }, [connected]);

  return {
    isLoading: isLoading || isPriceLoading,
    error: error || priceError,
    assets,
    analytics,
    lastUpdated,
    isRebalancing,
    refreshPortfolio: fetchPortfolioData,
    generateRebalancingRecommendations,
    executeRebalancing
  };
};

export default usePortfolio;