// src/utils/portfolioMapper.ts

import { Portfolio, PortfolioPerformance, Asset, PerformanceDataPoint } from '../types/notification';

/**
 * Maps API portfolio type to application portfolio type
 * @param apiPortfolio Portfolio from API
 * @returns Mapped portfolio
 */
export function mapPortfolio(apiPortfolio: any): Portfolio {
  // Ensure all required fields are present
  if (!apiPortfolio) {
    throw new Error('Invalid portfolio data');
  }

  // Map portfolio assets
  const assets: Asset[] = (apiPortfolio.assets || []).map((asset: any) => ({
    name: asset.name || 'Unknown Token',
    symbol: asset.symbol || 'UNKNOWN',
    address: asset.address || '',
    amount: parseFloat(asset.amount) || 0,
    price: parseFloat(asset.price) || 0,
    value: parseFloat(asset.value) || 0,
    change24h: parseFloat(asset.change24h) || 0,
    logo: asset.logo
  }));

  return {
    totalValue: parseFloat(apiPortfolio.totalValue) || 0,
    assets: assets,
    lastUpdated: apiPortfolio.lastUpdated ? 
      (typeof apiPortfolio.lastUpdated === 'number' ? 
        apiPortfolio.lastUpdated : 
        new Date(apiPortfolio.lastUpdated).getTime()) : 
      Date.now()
  };
}

/**
 * Maps API portfolio performance to application portfolio performance
 * @param apiPerformance Performance data from API
 * @returns Mapped portfolio performance
 */
export function mapPortfolioPerformance(apiPerformance: any): PortfolioPerformance {
  // Ensure all required fields are present
  if (!apiPerformance) {
    throw new Error('Invalid portfolio performance data');
  }

  // Map data points
  const dataPoints: PerformanceDataPoint[] = (apiPerformance.dataPoints || []).map((point: any) => ({
    timestamp: typeof point.timestamp === 'string' ? 
      new Date(point.timestamp).getTime() : 
      point.timestamp,
    value: parseFloat(point.value) || 0,
    profitLoss: parseFloat(point.profitLoss) || 0
  }));

  return {
    period: apiPerformance.period || '1d',
    totalChange: parseFloat(apiPerformance.totalChange) || 0,
    percentChange: parseFloat(apiPerformance.percentChange) || 0,
    dataPoints: dataPoints
  };
}