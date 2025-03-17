import React, { useState, useEffect, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { useSonicAgent } from '../contexts/SonicAgentContext';

import { formatCurrency, formatPercentage } from '../utils/formatters';
import { PORTFOLIO_HISTORY_DAYS, TOKEN_COLORS } from '../constants/config';
import TokenIcon from './TokenIcon';

// Token asset information in portfolio
interface TokenAsset {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
  allocation: number; // percentage of portfolio
  change24h: number; // 24h price change percentage
  valueChange24h: number; // 24h value change in USD
}

// Portfolio summary information
interface PortfolioSummary {
  totalValue: number;
  change24h: number;
  change24hValue: number;
  change7d: number;
  change30d: number;
  tokenCount: number;
  highestAllocation: { symbol: string; allocation: number };
  lowestAllocation: { symbol: string; allocation: number };
  bestPerformer: { symbol: string; change: number };
  worstPerformer: { symbol: string; change: number };
}

// Portfolio history data point
interface PortfolioHistoryPoint {
  timestamp: string;
  value: number;
}

// TokenIcon props interface
interface TokenIconProps {
  mint: string;
  size: number;
  className?: string;
}

/**
 * Format rate change to 2 decimal places
 */
const formatRateChange = (value: number): string => {
  return value.toFixed(2);
};

/**
 * Portfolio analytics component that displays detailed portfolio information
 */
const PortfolioAnalytics: React.FC = () => {
  // Get context data
  const { 
    walletPublicKey, 
    portfolioAllocations,
    riskLevel,
    jupiterService,
    sonicAgent,
    marketDataService
  } = useSonicAgent();

  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<TokenAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<TokenAsset[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    change24h: 0,
    change24hValue: 0,
    change7d: 0,
    change30d: 0,
    tokenCount: 0,
    highestAllocation: { symbol: '', allocation: 0 },
    lowestAllocation: { symbol: '', allocation: 0 },
    bestPerformer: { symbol: '', change: 0 },
    worstPerformer: { symbol: '', change: 0 }
  });
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'change24h' | 'allocation'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | 'all'>('7d');
  const [portfolioView, setPortfolioView] = useState<'overview' | 'assets' | 'history'>('overview');

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!walletPublicKey || !jupiterService || !marketDataService || !sonicAgent) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Get wallet's token accounts
        const walletAddress = new PublicKey(walletPublicKey);
        const tokenAccounts = await sonicAgent.getTokenAccounts(walletAddress);
        
        // Initialize token asset array
        const tokenAssets: TokenAsset[] = [];
        let totalPortfolioValue = 0;
        
        // Process each token account
        for (const tokenAccount of tokenAccounts) {
          try {
            const { mint, balance } = tokenAccount;
            
            // Skip tokens with zero balance
            if (balance <= 0) continue;
            
            // Get token info and price
            const tokenInfo = await jupiterService.getTokenInfo(mint);
            const tokenPrice = await jupiterService.getTokenPrice(mint);
            
            if (tokenInfo && tokenPrice) {
              // Get 24h price change
              // Changed to use getTokenPriceChanges method which should be available in MarketDataService
              const changes = await marketDataService.getTokenPriceChanges([mint]);
              const change24h = changes.get(mint)?.change24h || 0;
              
              // Calculate token value
              // Ensure tokenPrice is treated as a number
              const price = Number(tokenPrice);
              const value = (balance / Math.pow(10, tokenInfo.decimals)) * price;
              
              // Add to total portfolio value
              totalPortfolioValue += value;
              
              // Add to token assets array
              tokenAssets.push({
                mint,
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                balance: balance / Math.pow(10, tokenInfo.decimals),
                price: price,
                value,
                allocation: 0, // Will be calculated after all tokens are processed
                change24h,
                valueChange24h: value * (change24h / 100)
              });
            }
          } catch (error) {
            console.error(`Error processing token ${tokenAccount.mint}:`, error);
          }
        }
        
        // Calculate allocation percentages for each token
        tokenAssets.forEach(token => {
          token.allocation = (token.value / totalPortfolioValue) * 100;
        });
        
        // Sort tokens by value (descending)
        tokenAssets.sort((a, b) => b.value - a.value);
        
        // Filter out tokens with very small values (dust)
        const significantAssets = tokenAssets.filter(token => token.value > 0.01);
        
        // Calculate portfolio summary
        const portfolioSummary: PortfolioSummary = {
          totalValue: totalPortfolioValue,
          change24h: calculateWeightedChange(significantAssets),
          change24hValue: significantAssets.reduce((sum, token) => sum + token.valueChange24h, 0),
          change7d: 0, // Would need historical data
          change30d: 0, // Would need historical data
          tokenCount: significantAssets.length,
          highestAllocation: significantAssets.length > 0 
            ? { symbol: significantAssets[0].symbol, allocation: significantAssets[0].allocation }
            : { symbol: '', allocation: 0 },
          lowestAllocation: significantAssets.length > 0
            ? { symbol: significantAssets[significantAssets.length - 1].symbol, allocation: significantAssets[significantAssets.length - 1].allocation }
            : { symbol: '', allocation: 0 },
          bestPerformer: { 
            symbol: findExtreme(significantAssets, 'change24h', 'max').symbol, 
            change: findExtreme(significantAssets, 'change24h', 'max').change24h 
          },
          worstPerformer: { 
            symbol: findExtreme(significantAssets, 'change24h', 'min').symbol, 
            change: findExtreme(significantAssets, 'change24h', 'min').change24h 
          }
        };
        
        // Generate simulated portfolio history for now (in a real app, we'd fetch this from backend)
        const history = generatePortfolioHistory(totalPortfolioValue, portfolioSummary.change7d);
        
        // Update state
        setAssets(significantAssets);
        setFilteredAssets(significantAssets);
        setSummary(portfolioSummary);
        setPortfolioHistory(history);
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolioData();
    
    // Set up interval to refresh data
    const intervalId = setInterval(fetchPortfolioData, 60000); // Refresh every minute
    
    return () => {
      clearInterval(intervalId);
    };
  }, [walletPublicKey, jupiterService, marketDataService, sonicAgent]);

  // Handle searching and filtering
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAssets(assets);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = assets.filter(
        asset => 
          asset.symbol.toLowerCase().includes(query) || 
          asset.name.toLowerCase().includes(query)
      );
      setFilteredAssets(filtered);
    }
  }, [assets, searchQuery]);

  // Handle sorting
  useEffect(() => {
    const sorted = [...filteredAssets].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'change24h':
          comparison = a.change24h - b.change24h;
          break;
        case 'allocation':
          comparison = a.allocation - b.allocation;
          break;
        default:
          comparison = a.value - b.value;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredAssets(sorted);
  }, [sortBy, sortDirection]);

  // Get filtered portfolio history based on selected timeframe
  const filteredHistory = useMemo(() => {
    if (timeframe === 'all') return portfolioHistory;
    
    const now = new Date();
    let daysToFilter = 7;
    
    switch (timeframe) {
      case '1d':
        daysToFilter = 1;
        break;
      case '7d':
        daysToFilter = 7;
        break;
      case '30d':
        daysToFilter = 30;
        break;
    }
    
    const filterDate = new Date(now);
    filterDate.setDate(filterDate.getDate() - daysToFilter);
    
    return portfolioHistory.filter(point => new Date(point.timestamp) >= filterDate);
  }, [portfolioHistory, timeframe]);

  // Helper function to calculate portfolio-weighted change
  function calculateWeightedChange(assets: TokenAsset[]): number {
    if (assets.length === 0) return 0;
    
    const totalValue = assets.reduce((sum, token) => sum + token.value, 0);
    const weightedChangeSum = assets.reduce(
      (sum, token) => sum + (token.change24h * (token.value / totalValue)), 
      0
    );
    
    return weightedChangeSum;
  }

  // Helper function to find token with extreme value (min/max)
  function findExtreme(
    assets: TokenAsset[], 
    property: 'change24h' | 'value' | 'allocation', 
    type: 'min' | 'max'
  ): TokenAsset {
    if (assets.length === 0) 
      return { symbol: '', change24h: 0 } as TokenAsset;
    
    return assets.reduce((extreme, current) => {
      if (type === 'max' && current[property] > extreme[property]) return current;
      if (type === 'min' && current[property] < extreme[property]) return current;
      return extreme;
    }, assets[0]);
  }

  // Helper function to generate simulated portfolio history
  function generatePortfolioHistory(currentValue: number, change7d: number): PortfolioHistoryPoint[] {
    const history: PortfolioHistoryPoint[] = [];
    const now = new Date();
    const startValue = currentValue / (1 + change7d / 100);
    
    // Generate 30 days of history
    for (let i = PORTFOLIO_HISTORY_DAYS; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Create some random fluctuations but trending toward the current value
      const progress = 1 - i / PORTFOLIO_HISTORY_DAYS; // 0 to 1 indicating how close to present day
      const randomFactor = 1 + (Math.random() - 0.5) * 0.02; // Random factor between 0.99 and 1.01
      const value = startValue + (currentValue - startValue) * progress * randomFactor;
      
      history.push({
        timestamp: date.toISOString(),
        value: value
      });
    }
    
    return history;
  }

  // Handle sort column click
  const handleSortColumn = (column: 'value' | 'name' | 'change24h' | 'allocation') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // If data is loading, show a loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="text-gray-400">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  // If no assets found, show an empty state
  if (assets.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800 p-8 text-center">
        <svg className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium">No assets found</h3>
        <p className="mt-2 text-gray-400">
          Your wallet doesn't have any token balances yet. Use the Swap tab to get some tokens.
        </p>
        <button
          onClick={() => {}}
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Swap Tokens
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-gray-800 p-6">
          <p className="text-sm font-medium text-gray-400">Total Value</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(summary.totalValue)}</p>
          <div className={`mt-2 flex items-center text-sm ${summary.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {summary.change24h >= 0 ? (
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            <span>{formatRateChange(summary.change24h)}% (24h)</span>
            <span className="ml-2">{formatCurrency(summary.change24hValue)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-gray-800 p-6">
          <p className="text-sm font-medium text-gray-400">Portfolio Assets</p>
          <p className="mt-2 text-3xl font-semibold">{summary.tokenCount}</p>
          <div className="mt-2 text-sm text-gray-400">
            <span className="font-medium">Largest: </span>
            <span className="text-white">{summary.highestAllocation.symbol} ({formatPercentage(summary.highestAllocation.allocation)})</span>
          </div>
        </div>

        <div className="rounded-lg bg-gray-800 p-6">
          <p className="text-sm font-medium text-gray-400">Risk Profile</p>
          <p className="mt-2 text-3xl font-semibold capitalize">{riskLevel}</p>
          <div className="mt-2 text-sm text-gray-400">
            Based on your selected risk tolerance
          </div>
        </div>

        <div className="rounded-lg bg-gray-800 p-6">
          <p className="text-sm font-medium text-gray-400">Performance</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary.bestPerformer.symbol ? (
              <span className={summary.bestPerformer.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatRateChange(summary.bestPerformer.change)}%
              </span>
            ) : (
              '--'
            )}
          </p>
          <div className="mt-2 text-sm text-gray-400">
            <span className="font-medium">Best: </span>
            <span className="text-white">{summary.bestPerformer.symbol || '--'}</span>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setPortfolioView('overview')}
            className={`pb-3 text-sm font-medium ${
              portfolioView === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setPortfolioView('assets')}
            className={`pb-3 text-sm font-medium ${
              portfolioView === 'assets'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
            }`}
          >
            Assets ({summary.tokenCount})
          </button>
          <button
            onClick={() => setPortfolioView('history')}
            className={`pb-3 text-sm font-medium ${
              portfolioView === 'history'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
            }`}
          >
            Historical Performance
          </button>
        </nav>
      </div>

      {/* Portfolio overview */}
      {portfolioView === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Allocation pie chart */}
          <div className="rounded-lg bg-gray-800 p-6">
            <h3 className="mb-4 text-lg font-medium">Asset Allocation</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assets.slice(0, 10)} // Show top 10 assets
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="symbol"
                    labelLine={false}
                    label={({ symbol, allocation }) => `${symbol} (${formatPercentage(allocation)})`}
                  >
                    {assets.slice(0, 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(TOKEN_COLORS)[index % Object.values(TOKEN_COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(name: string) => `Token: ${name}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {assets.slice(0, 10).map((asset, index) => (
                  <div key={asset.mint} className="flex items-center">
                    <div 
                      className="h-3 w-3 mr-2 rounded-full" 
                      style={{ backgroundColor: Object.values(TOKEN_COLORS)[index % Object.values(TOKEN_COLORS).length] }}
                    />
                    <span className="text-sm truncate">{asset.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top assets */}
          <div className="rounded-lg bg-gray-800 p-6">
            <h3 className="mb-4 text-lg font-medium">Top Assets</h3>
            <div className="space-y-4">
              {assets.slice(0, 5).map((asset) => (
                <div key={asset.mint} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TokenIcon mint={asset.mint} size={32} className="mr-3" />
                    <div>
                      <p className="font-medium">{asset.symbol}</p>
                      <p className="text-sm text-gray-400">{asset.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(asset.value)}</p>
                    <p className={`text-sm ${asset.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatRateChange(asset.change24h)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-gray-700 pt-4">
              <h4 className="mb-2 text-sm font-medium text-gray-400">Allocation by Risk</h4>
              <div className="h-6 overflow-hidden rounded-full bg-gray-700">
                <div className="flex h-full">
                  <div className="h-full bg-green-500" style={{ width: '30%' }} />
                  <div className="h-full bg-yellow-500" style={{ width: '40%' }} />
                  <div className="h-full bg-red-500" style={{ width: '30%' }} />
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Low Risk</span>
                <span>Medium Risk</span>
                <span>High Risk</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets list */}
      {portfolioView === 'assets' && (
        <div className="rounded-lg bg-gray-800">
          <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="relative mb-4 md:mb-0 md:w-64">
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
                <svg
                  className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              
              <div className="flex items-center text-sm text-gray-400">
                <span className="hidden md:inline mr-2">Sort by:</span>
                <select
                  value={`${sortBy}_${sortDirection}`}
                  onChange={(e) => {
                    const [col, dir] = e.target.value.split('_');
                    setSortBy(col as any);
                    setSortDirection(dir as 'asc' | 'desc');
                  }}
                  className="rounded-md border-gray-700 bg-gray-900 py-1 pl-3 pr-8 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="value_desc">Value (High to Low)</option>
                  <option value="value_asc">Value (Low to High)</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="change24h_desc">Performance (Best)</option>
                  <option value="change24h_asc">Performance (Worst)</option>
                  <option value="allocation_desc">Allocation (Highest)</option>
                  <option value="allocation_asc">Allocation (Lowest)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="whitespace-nowrap px-4 py-3 font-medium">
                    <button
                      onClick={() => handleSortColumn('name')}
                      className="flex items-center font-medium hover:text-white"
                    >
                      Token
                      {sortBy === 'name' && (
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {sortDirection === 'asc' ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Price</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">
                    <button
                      onClick={() => handleSortColumn('change24h')}
                      className="flex items-center font-medium hover:text-white"
                    >
                      24h Change
                      {sortBy === 'change24h' && (
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {sortDirection === 'asc' ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Balance</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-right">
                    <button
                      onClick={() => handleSortColumn('value')}
                      className="flex items-center justify-end font-medium hover:text-white"
                    >
                      Value
                      {sortBy === 'value' && (
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {sortDirection === 'asc' ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-right">
                    <button
                      onClick={() => handleSortColumn('allocation')}
                      className="flex items-center justify-end font-medium hover:text-white"
                    >
                      Allocation
                      {sortBy === 'allocation' && (
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {sortDirection === 'asc' ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.mint}
                    className="border-b border-gray-700 hover:bg-gray-750"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center">
                        <TokenIcon mint={asset.mint} size={24} className="mr-3" />
                        <div>
                          <p className="font-medium">{asset.symbol}</p>
                          <p className="text-xs text-gray-400">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatCurrency(asset.price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex items-center ${
                          asset.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {asset.change24h >= 0 ? (
                          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 10l7-7m0 0l7 7m-7-7v18"
                            />
                          </svg>
                        ) : (
                          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        )}
                        {formatRateChange(asset.change24h)}%
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      {formatCurrency(asset.value)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      {formatPercentage(asset.allocation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance history */}
      {portfolioView === 'history' && (
        <div className="rounded-lg bg-gray-800 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h3 className="text-lg font-medium">Portfolio Performance</h3>
            <div className="flex space-x-1 rounded-md bg-gray-700 p-1 mt-2 md:mt-0">
              <button
                onClick={() => setTimeframe('1d')}
                className={`rounded-sm px-3 py-1 text-sm ${
                  timeframe === '1d'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                1D
              </button>
              <button
                onClick={() => setTimeframe('7d')}
                className={`rounded-sm px-3 py-1 text-sm ${
                  timeframe === '7d'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeframe('30d')}
                className={`rounded-sm px-3 py-1 text-sm ${
                  timeframe === '30d'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeframe('all')}
                className={`rounded-sm px-3 py-1 text-sm ${
                  timeframe === 'all'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredHistory}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  stroke="#9CA3AF"
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value, "")}
                  stroke="#9CA3AF"
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-md bg-gray-700 p-4">
              <p className="text-sm font-medium text-gray-400">Starting Value</p>
              <p className="mt-1 text-xl font-medium">
                {filteredHistory.length > 0
                  ? formatCurrency(filteredHistory[0].value)
                  : '--'}
              </p>
            </div>
            <div className="rounded-md bg-gray-700 p-4">
              <p className="text-sm font-medium text-gray-400">Ending Value</p>
              <p className="mt-1 text-xl font-medium">
                {filteredHistory.length > 0
                  ? formatCurrency(filteredHistory[filteredHistory.length - 1].value)
                  : '--'}
              </p>
            </div>
            <div className="rounded-md bg-gray-700 p-4">
              <p className="text-sm font-medium text-gray-400">Change</p>
              {filteredHistory.length > 0 && (
                <p
                  className={`mt-1 text-xl font-medium ${
                    filteredHistory[filteredHistory.length - 1].value >= filteredHistory[0].value
                      ? 'text-green-500'
                      : 'text-red-500' 
                  }`}
                >
                  {formatRateChange(
                    ((filteredHistory[filteredHistory.length - 1].value - filteredHistory[0].value) /
                      filteredHistory[0].value) *
                      100
                  )}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioAnalytics;