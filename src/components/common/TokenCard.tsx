import React, { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';

// Import TokenIcon component for displaying token icons
import TokenIcon from '../TokenIcon';

export interface TokenData {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  usdValue: number;
  price: number;
  priceChange24h: number;
  priceChange7d?: number;
  marketCap?: number;
  volume24h?: number;
  allTimeHigh?: number;
  allTimeHighDate?: Date;
  verified?: boolean;
  description?: string;
  website?: string;
  twitter?: string;
  coingeckoId?: string;
  tags?: string[];
  lastUpdated?: Date;
}

interface TokenIconProps {
  symbol: string;
  size: number;
}

interface TokenCardProps {
  token: TokenData;
  expanded?: boolean;
  onExpand?: (mint: string) => void;
  showActions?: boolean;
  showChart?: boolean;
  showBalance?: boolean;
  chartTimeframe?: '1D' | '1W' | '1M' | '3M' | '1Y';
  className?: string;
  onTrade?: (token: TokenData) => void;
  isLoading?: boolean;
}

const TokenCard: React.FC<TokenCardProps> = ({
  token,
  expanded = false,
  onExpand,
  showActions = true,
  showChart = true,
  showBalance = true,
  chartTimeframe = '1W',
  className = '',
  onTrade,
  isLoading = false
}) => {
  const { connection } = useConnection();
  const [isHovering, setIsHovering] = useState(false);

  // Format a number with commas and decimal places
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Format USD value
  const formatUsd = (value: number) => {
    if (value >= 1000000000) {
      return `$${formatNumber(value / 1000000000, 2)}B`;
    } else if (value >= 1000000) {
      return `$${formatNumber(value / 1000000, 2)}M`;
    } else if (value >= 1000) {
      return `$${formatNumber(value / 1000, 2)}K`;
    } else {
      return `$${formatNumber(value, 2)}`;
    }
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  // Format number of tokens with appropriate decimals
  const formatTokenAmount = (amount: number) => {
    if (amount < 0.001) {
      return amount.toFixed(6);
    } else if (amount < 1) {
      return amount.toFixed(4);
    } else if (amount < 1000) {
      return amount.toFixed(2);
    } else {
      return formatNumber(amount, 2);
    }
  };

  // Handle view in explorer
  const handleViewInExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const mintAddress = new PublicKey(token.mint);
      window.open(`https://explorer.sonic.game/address/${mintAddress.toString()}`, '_blank');
    } catch (error) {
      console.error('Invalid mint address:', error);
    }
  };

  // Handle view on CoinGecko
  const handleViewOnCoinGecko = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (token.coingeckoId) {
      window.open(`https://www.coingecko.com/en/coins/${token.coingeckoId}`, '_blank');
    }
  };

  // Handle clicking on card
  const handleCardClick = () => {
    if (onExpand) {
      onExpand(token.mint);
    }
  };

  // Handle click to trade
  const handleTradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTrade) {
      onTrade(token);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow overflow-hidden animate-pulse ${className}`}>
        <div className="p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-gray-200 h-10 w-10"></div>
            <div className="ml-3">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-3 bg-gray-200 rounded w-16 mt-2"></div>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-6 bg-gray-200 rounded mt-2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-lg shadow overflow-hidden transition-all duration-200 ${
        isHovering ? 'shadow-md' : ''
      } ${expanded ? 'border-2 border-indigo-500' : ''} ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleCardClick}
    >
      <div className="p-4">
        {/* Token Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TokenIcon mint={token.mint} size={40} />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                {token.name}
                {token.verified && (
                  <span className="ml-1 text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500">{token.symbol}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{formatUsd(token.price)}</div>
            <div className={`text-sm ${token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(token.priceChange24h)}
            </div>
          </div>
        </div>

        {/* Balance Info (conditional) */}
        {showBalance && (
          <div className="mt-4 bg-gray-50 rounded-md p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">Your Balance</div>
                <div className="text-lg font-medium">{formatTokenAmount(token.balance)} {token.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Value</div>
                <div className="text-lg font-medium">{formatUsd(token.usdValue)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4">
            {/* Market Data */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {token.marketCap && (
                <div>
                  <div className="text-sm text-gray-500">Market Cap</div>
                  <div className="font-medium">{formatUsd(token.marketCap)}</div>
                </div>
              )}
              {token.volume24h && (
                <div>
                  <div className="text-sm text-gray-500">24h Volume</div>
                  <div className="font-medium">{formatUsd(token.volume24h)}</div>
                </div>
              )}
              {token.allTimeHigh && (
                <div>
                  <div className="text-sm text-gray-500">All Time High</div>
                  <div className="font-medium">{formatUsd(token.allTimeHigh)}</div>
                </div>
              )}
              {token.priceChange7d !== undefined && (
                <div>
                  <div className="text-sm text-gray-500">7d Change</div>
                  <div className={`font-medium ${token.priceChange7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(token.priceChange7d)}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {token.description && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">About {token.name}</h4>
                <p className="text-sm text-gray-600">{token.description}</p>
              </div>
            )}

            {/* Tags */}
            {token.tags && token.tags.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {token.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex space-x-2 mb-4">
              {token.website && (
                <a 
                  href={token.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  Website
                </a>
              )}
              {token.twitter && (
                <a 
                  href={`https://twitter.com/${token.twitter}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  Twitter
                </a>
              )}
              {token.coingeckoId && (
                <button 
                  onClick={handleViewOnCoinGecko}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  CoinGecko
                </button>
              )}
              <button
                onClick={handleViewInExplorer}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Explorer
              </button>
            </div>

            {/* Dynamic mini chart placeholder - you can integrate a real chart here */}
            {showChart && (
              <div className="h-24 bg-gray-50 rounded-md flex items-center justify-center">
                <div className="text-sm text-gray-400">Price chart ({chartTimeframe})</div>
              </div>
            )}
          </div>
        )}

        {/* Actions (conditional) */}
        {showActions && (
          <div className={`mt-4 pt-3 ${expanded ? 'border-t border-gray-100' : ''}`}>
            <div className="flex justify-between">
              <button
                onClick={handleViewInExplorer}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Explorer
              </button>
              
              {onTrade && (
                <button
                  onClick={handleTradeClick}
                  className="px-4 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Trade
                </button>
              )}
              
              {onExpand && !expanded && (
                <button
                  onClick={handleCardClick}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Last updated info */}
        {token.lastUpdated && (
          <div className="mt-3 text-xs text-gray-400 text-right">
            Updated {token.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenCard;