import React, { useState, useMemo } from 'react';

import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

// Import TokenIcon component for displaying token icons
import TokenIcon from '../TokenIcon';
import { formatDistance } from 'date-fns/formatDistance';

// Define asset type
export interface Asset {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  usdValue: number;
  price: number;
  priceChange24h: number;
  lastUpdated?: Date;
}

interface AssetTableProps {
  assets: Asset[];
  isLoading?: boolean;
  onAssetSelect?: (asset: Asset) => void;
  showLastUpdated?: boolean;
  showActions?: boolean;
  emptyStateMessage?: string;
  onRefresh?: () => void;
}

const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  isLoading = false,
  onAssetSelect,
  showLastUpdated = false,
  showActions = true,
  emptyStateMessage = "No assets found",
  onRefresh
}) => {
  const { connection } = useConnection();
  const [sortField, setSortField] = useState<keyof Asset>('usdValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle sorting
  const handleSort = (field: keyof Asset) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort assets based on sort field and direction
  const sortedAssets = useMemo(() => {
    if (isLoading) return [];

    return [...assets].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [assets, sortField, sortDirection, isLoading]);

  // Format number with commas and decimal places
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Format USD value
  const formatUsd = (value: number) => {
    if (value >= 1000000) {
      return `$${formatNumber(value / 1000000, 2)}M`;
    } else if (value >= 1000) {
      return `$${formatNumber(value / 1000, 2)}K`;
    } else {
      return `$${formatNumber(value, 2)}`;
    }
  };

  // Handle view in explorer action
  const handleViewInExplorer = (mint: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const mintAddress = new PublicKey(mint);
      window.open(`https://explorer.sonic.game/address/${mintAddress.toString()}?tab=tokens`, '_blank');
    } catch (error) {
      console.error('Invalid mint address:', error);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse p-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-4">
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">{emptyStateMessage}</h3>
          {onRefresh && (
            <div className="mt-6">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={onRefresh}
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    clipRule="evenodd"
                  />
                </svg>
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render the table
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Asset
                  {sortField === 'name' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('balance')}
              >
                <div className="flex items-center">
                  Balance
                  {sortField === 'balance' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center">
                  Price
                  {sortField === 'price' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('priceChange24h')}
              >
                <div className="flex items-center">
                  24h Change
                  {sortField === 'priceChange24h' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('usdValue')}
              >
                <div className="flex items-center">
                  Value
                  {sortField === 'usdValue' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              {showLastUpdated && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Updated
                </th>
              )}
              {showActions && (
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAssets.map((asset) => (
              <tr
                key={asset.mint}
                className={`${
                  onAssetSelect ? 'cursor-pointer hover:bg-gray-50' : ''
                }`}
                onClick={() => onAssetSelect && onAssetSelect(asset)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8">
                      <TokenIcon symbol={asset.symbol} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {asset.name}
                      </div>
                      <div className="text-sm text-gray-500">{asset.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatNumber(asset.balance, 6)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${formatNumber(asset.price, 6)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`text-sm ${
                      asset.priceChange24h > 0
                        ? 'text-green-600'
                        : asset.priceChange24h < 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {asset.priceChange24h > 0 ? '+' : ''}
                    {formatNumber(asset.priceChange24h, 2)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatUsd(asset.usdValue)}
                  </div>
                </td>
                {showLastUpdated && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {asset.lastUpdated
                      ? formatDistance(asset.lastUpdated, new Date(), {
                          addSuffix: true,
                        })
                      : 'N/A'}
                  </td>
                )}
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      onClick={(e) => handleViewInExplorer(asset.mint, e)}
                    >
                      Explorer
                    </button>
                    {onAssetSelect && (
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssetSelect(asset);
                        }}
                      >
                        View
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetTable;