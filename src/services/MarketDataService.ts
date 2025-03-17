// src/services/MarketDataService.ts

import { Connection, PublicKey } from '@solana/web3.js';
import { JupiterService } from './JupiterService';
import { 
  PriceHistoryPoint, 
  MarketOverview, 
  TechnicalIndicator, 
  NotificationType 
} from '../types/api';
import { API } from '../constants/endpoints';

/**
 * Service for fetching and analyzing market data
 */
export class MarketDataService {
  getPrices(tokenAddresses: string[]) {
      throw new Error('Method not implemented.');
  }
  private connection: Connection;
  private jupiterService: JupiterService;
  private cacheMap: Map<string, { data: any; timestamp: number; ttl: number }>;
  
  // Known stablecoin mints on Solana
  private stablecoinMints: Set<string> = new Set([
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o', // DAI
    'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',   // USDH
    'USDCet8qY8JXHfSbCNF9yYadZFiEKNbFfCKEjgR5CvQV', // Wormhole USDC
  ]);

  /**
   * Constructor for MarketDataService
   * 
   * @param connection Solana connection
   * @param jupiterService Jupiter service instance
   */
  constructor(connection: Connection, jupiterService: JupiterService) {
    this.connection = connection;
    this.jupiterService = jupiterService;
    this.cacheMap = new Map();
  }

  /**
   * Check if a token is a stablecoin
   * 
   * @param mint Token mint address
   * @returns True if the token is a stablecoin
   */
  public async isStablecoin(mint: string): Promise<boolean> {
    // Check our known stablecoin list first
    if (this.stablecoinMints.has(mint)) {
      return true;
    }

    try {
      // Check if token has 'stablecoin' tag
      const tokenInfo = await this.jupiterService.getTokenInfo(mint);
      if (tokenInfo && tokenInfo.tags) {
        return tokenInfo.tags.some(tag => 
          tag.toLowerCase().includes('stable') || 
          tag.toLowerCase().includes('stablecoin')
        );
      }

      // Check price stability as fallback
      const priceHistory = await this.getHistoricalPriceData(mint, '7d');
      if (priceHistory.length > 0) {
        // Calculate price volatility
        const prices = priceHistory.map(p => p.price);
        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance) / mean;

        // If volatility is less than 1%, it's likely a stablecoin
        return volatility < 0.01;
      }
    } catch (error) {
      console.error(`Error checking if ${mint} is a stablecoin:`, error);
    }

    return false;
  }

  /**
   * Get multiple token prices in one call
   * 
   * @param mints Array of token mint addresses
   * @returns Map of mint addresses to prices
   */
  public async getMultipleTokenPrices(mints: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    
    try {
      // Use Jupiter Price API for bulk price fetching
      const mintChunks = this.chunkArray(mints, 100); // Jupiter API limits to 100 tokens per request
      
      for (const chunk of mintChunks) {
        const priceResponse = await fetch(`${API.jupiter.price}?ids=${chunk.join(',')}`);
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          
          if (priceData.data) {
            // Extract prices from response
            for (const [mint, data] of Object.entries(priceData.data)) {
              // Check if price exists and is valid
              if (data && typeof data === 'object' && 'price' in data) {
                result.set(mint, parseFloat((data as any).price));
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching multiple token prices:', error);
    }
    
    return result;
  }

  /**
   * Get token price changes for the last 24 hours
   * 
   * @param mints Array of token mint addresses
   * @returns Map of mint addresses to price changes
   */
  public async getTokenPriceChanges(mints: string[]): Promise<Map<string, { change24h: number }>> {
    const result = new Map<string, { change24h: number }>();

    try {
      // Use Jupiter Price API for bulk price fetching
      const mintChunks = this.chunkArray(mints, 100); // Jupiter API limits to 100 tokens per request

      for (const chunk of mintChunks) {
        const priceResponse = await fetch(`${API.jupiter.price}?ids=${chunk.join(',')}`);

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();

          if (priceData.data) {
            // Extract price changes from response
            for (const [mint, data] of Object.entries(priceData.data)) {
              // Check if price change exists and is valid
              if (data && typeof data === 'object' && 'change24h' in data) {
                result.set(mint, { change24h: parseFloat((data as any).change24h) });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching token price changes:', error);
    }

    return result;
  }

  /**
   * Get market overview with sentiment and trends
   * 
   * @returns Market overview data
   */
  public async getMarketOverview(): Promise<MarketOverview | null> {
    const cacheKey = 'market_overview';
    const cachedData = this.getFromCache<MarketOverview>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      // Get SOL price changes to determine overall market sentiment
      const solMint = 'So11111111111111111111111111111111111111112';
      const solPriceHistory = await this.getHistoricalPriceData(solMint, '24h');
      
      if (solPriceHistory.length < 2) {
        return null;
      }
      
      // Calculate SOL price change as a proxy for market sentiment
      const firstPrice = solPriceHistory[0].price;
      const lastPrice = solPriceHistory[solPriceHistory.length - 1].price;
      const solChange = (lastPrice - firstPrice) / firstPrice;
      
      // Get additional tokens to analyze
      const popularTokens = await this.jupiterService.getTokensByTag('verified');
      const tokenMints = popularTokens.slice(0, 20).map(token => token.address);
      
      // Get price changes for all tokens
      const priceChanges: Array<{ mint: string, symbol: string, change: number }> = [];
      
      for (const token of popularTokens.slice(0, 20)) {
        const priceHistory = await this.getHistoricalPriceData(token.address, '24h');
        
        if (priceHistory.length >= 2) {
          const firstTokenPrice = priceHistory[0].price;
          const lastTokenPrice = priceHistory[priceHistory.length - 1].price;
          const change = (lastTokenPrice - firstTokenPrice) / firstTokenPrice;
          
          priceChanges.push({
            mint: token.address,
            symbol: token.symbol,
            change
          });
        }
      }
      
      // Sort by performance
      priceChanges.sort((a, b) => b.change - a.change);
      
      // Determine market sentiment
      let marketSentiment: 'bullish' | 'bearish' | 'sideways';
      if (solChange > 0.03) {
        marketSentiment = 'bullish';
      } else if (solChange < -0.03) {
        marketSentiment = 'bearish';
      } else {
        marketSentiment = 'sideways';
      }
      
      // Calculate volatility
      const priceChangesArray = priceChanges.map(p => p.change);
      const volatilityIndex = this.calculateVolatility(priceChangesArray);
      
      // Build market overview
      const marketOverview: MarketOverview = {
        marketSentiment,
        volatilityIndex,
        topPerformers: priceChanges.slice(0, 5).map(p => p.symbol),
        bottomPerformers: priceChanges.slice(-5).reverse().map(p => p.symbol),
        timestamp: Date.now()
      };
      
      // Cache for 5 minutes
      this.setCache(cacheKey, marketOverview, 5 * 60 * 1000);
      
      return marketOverview;
    } catch (error) {
      console.error('Error fetching market overview:', error);
      return null;
    }
  }

  /**
   * Get technical indicators for a token
   * 
   * @param mint Token mint address
   * @returns Map of indicator name to indicator data
   */
  public async getTechnicalIndicators(mint: string): Promise<Map<string, TechnicalIndicator>> {
    const cacheKey = `technical_indicators_${mint}`;
    const cachedData = this.getFromCache<Map<string, TechnicalIndicator>>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    const indicators = new Map<string, TechnicalIndicator>();
    
    try {
      // Get price history for different timeframes
      const priceHistory24h = await this.getHistoricalPriceData(mint, '24h');
      const priceHistory7d = await this.getHistoricalPriceData(mint, '7d');
      const priceHistory30d = await this.getHistoricalPriceData(mint, '30d');
      
      if (priceHistory30d.length > 0) {
        // Calculate RSI (Relative Strength Index)
        const rsiValue = this.calculateRSI(priceHistory7d.map(p => p.price));
        indicators.set('rsi', {
          value: rsiValue,
          interpretation: rsiValue < 30 ? 'oversold' : rsiValue > 70 ? 'overbought' : 'neutral'
        });
        
        // Calculate Moving Averages - 50 day and 200 day
        if (priceHistory30d.length >= 50) {
          const last50Prices = priceHistory30d.slice(-50).map(p => p.price);
          const ma50 = last50Prices.reduce((sum, price) => sum + price, 0) / 50;
          
          let ma200 = 0;
          let maInterpretation = 'neutral';
          
          if (priceHistory30d.length >= 200) {
            const last200Prices = priceHistory30d.slice(-200).map(p => p.price);
            ma200 = last200Prices.reduce((sum, price) => sum + price, 0) / 200;
            
            // Golden cross / death cross
            maInterpretation = ma50 > ma200 ? 'bullish' : 'bearish';
          }
          
          indicators.set('movingAverages', {
            value: ma50,
            ma50,
            ma200,
            interpretation: maInterpretation
          });
        }
        
        // Calculate MACD (simplified)
        const macd = this.calculateMACD(priceHistory30d.map(p => p.price));
        indicators.set('macd', {
          value: macd.histogram,
          interpretation: macd.histogram > 0 ? 'bullish' : 'bearish'
        });
      }
      
      // Cache for 15 minutes
      this.setCache(cacheKey, indicators, 15 * 60 * 1000);
    } catch (error) {
      console.error(`Error calculating technical indicators for ${mint}:`, error);
    }
    
    return indicators;
  }

  /**
   * Get historical price data for a token
   * 
   * @param mint Token mint address
   * @param period Time period ('24h', '7d', '30d', etc.)
   * @returns Array of price history points
   */
  public async getHistoricalPriceData(mint: string, period: string): Promise<PriceHistoryPoint[]> {
    const cacheKey = `price_history_${mint}_${period}`;
    const cachedData = this.getFromCache<PriceHistoryPoint[]>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      // In a real implementation, you would fetch from an API or database
      // For example, using CoinGecko or another price API service
      
      // For this implementation, we'll generate synthetic data
      const pricePoints = this.generateSyntheticPriceData(mint, period);
      
      // Cache for 5 minutes
      this.setCache(cacheKey, pricePoints, 5 * 60 * 1000);
      
      return pricePoints;
    } catch (error) {
      console.error(`Error fetching price history for ${mint}:`, error);
      return [];
    }
  }

  /**
   * Generate synthetic price data for testing
   * @param mint Token mint address
   * @param period Time period
   * @returns Array of price history points
   */
  private generateSyntheticPriceData(mint: string, period: string): PriceHistoryPoint[] {
    // Get current price as a baseline
    const currentPrice = Math.random() * 100; // In a real implementation, fetch from an API
    const result: PriceHistoryPoint[] = [];
    
    // Define the number of data points based on period
    let dataPoints = 24; // 24 hours
    if (period === '7d') dataPoints = 7 * 24;
    if (period === '30d') dataPoints = 30 * 24;
    
    // Generate random price movements with some trend
    const trendFactor = Math.random() * 0.2 - 0.1; // -0.1 to 0.1
    let price = currentPrice * (1 - trendFactor * dataPoints); // Start from past price
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = Date.now() - (dataPoints - i) * 3600 * 1000; // Hourly points
      
      // Random walk with trend
      const randomChange = (Math.random() - 0.5) * 0.02; // -1% to 1%
      price = price * (1 + randomChange + trendFactor);
      
      // Random volume
      const volume = Math.random() * 1000000 + 100000;
      
      result.push({
        timestamp,
        price,
        volume
      });
    }
    
    return result;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   * @param prices Array of prices
   * @param periods Number of periods (default: 14)
   * @returns RSI value (0-100)
   */
  private calculateRSI(prices: number[], periods: number = 14): number {
    if (prices.length < periods + 1) {
      return 50; // Not enough data
    }
    
    let gains = 0;
    let losses = 0;
    
    // Calculate average gains and losses
    for (let i = 1; i <= periods; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change; // Make positive
      }
    }
    
    // Calculate RSI
    const averageGain = gains / periods;
    const averageLoss = losses / periods;
    
    if (averageLoss === 0) {
      return 100; // No losses
    }
    
    const relativeStrength = averageGain / averageLoss;
    const rsi = 100 - (100 / (1 + relativeStrength));
    
    return rsi;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param prices Array of prices
   * @returns MACD values
   */
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    if (prices.length < 26) {
      return { macd: 0, signal: 0, histogram: 0 }; // Not enough data
    }
    
    // Calculate EMA 12 and EMA 26
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    // Calculate MACD line
    const macd = ema12 - ema26;
    
    // Calculate signal line (9-day EMA of MACD)
    // For simplicity, we'll just use a simple approximation
    const signal = macd * 0.9; // Simplified
    
    // Calculate histogram
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   * @param prices Array of prices
   * @param periods Number of periods
   * @returns EMA value
   */
  private calculateEMA(prices: number[], periods: number): number {
    if (prices.length < periods) {
      return prices[prices.length - 1]; // Not enough data, return last price
    }
    
    // Calculate simple moving average first
    const sma = prices.slice(-periods).reduce((sum, price) => sum + price, 0) / periods;
    
    // Calculate multiplier
    const multiplier = 2 / (periods + 1);
    
    // Calculate EMA
    let ema = sma;
    for (let i = prices.length - periods; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Calculate volatility from an array of values
   * @param values Array of values
   * @returns Volatility index
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }
    
    // Calculate mean
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate variance
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Return standard deviation
    return Math.sqrt(variance);
  }

  /**
   * Split array into chunks
   * @param array Array to split
   * @param chunkSize Size of each chunk
   * @returns Array of chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  }

  /**
   * Get data from cache if not expired
   * @param key Cache key
   * @returns Cached data or null
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cacheMap.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.cacheMap.delete(key);
    }
    
    return null;
  }

  /**
   * Set cache data
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds
   */
  private setCache(key: string, data: any, ttl: number): void {
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cacheMap.clear();
  }
}