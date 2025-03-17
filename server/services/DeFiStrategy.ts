import { PublicKey } from '@solana/web3.js';
import axios from 'axios';

/**
 * Represents a liquidity pool from a DEX
 */
export interface LiquidityPool {
  address: string;
  dex: string;
  tokenA: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  tokenB: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  lpToken?: {
    address: string;
    supply: string;
  };
  fee?: number;
  apy?: number;
  tvl?: number;
}

/**
 * Represents liquidity details for a pool
 */
export interface LiquidityDetails {
  tvl: number;
  apy: number;
  volume24h: number;
  fee24h: number;
}

/**
 * Service for interacting with Shyft DeFi APIs and implementing DeFi strategies
 */
export class DeFiStrategyService {
  private apiKey: string;
  private baseUrl: string = 'https://defi.shyft.to/v0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get pool by address
   * @param address The pool address
   * @returns The pool details
   */
  async getPoolByAddress(address: string): Promise<LiquidityPool> {
    try {
      const response = await axios.get(`${this.baseUrl}/pools/get_by_address`, {
        params: { address },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      return (response.data as { pool: LiquidityPool }).pool;
    } catch (error) {
      console.error('Error fetching pool by address:', error);
      throw new Error('Failed to fetch pool details');
    }
  }

  /**
   * Get pools by token pair
   * @param tokenA First token address
   * @param tokenB Second token address
   * @param dex Optional DEX name filter
   * @param page Page number
   * @param limit Results per page
   * @returns List of pools
   */
  async getPoolsByPair(
    tokenA: string, 
    tokenB: string, 
    dex?: string[], 
    page: number = 1, 
    limit: number = 10
  ): Promise<LiquidityPool[]> {
    try {
      const params: any = { tokenA, tokenB, page, limit };
      if (dex) {
        params.dex = dex;
      }

      const response = await axios.get(`${this.baseUrl}/pools/get_by_pair`, {
        params,
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      const data = response.data as { pools: LiquidityPool[] };
      return data.pools;
    } catch (error) {
      console.error('Error fetching pools by pair:', error);
      throw new Error('Failed to fetch pools by token pair');
    }
  }

  /**
   * Get all pools for a token
   * @param token Token address
   * @param page Page number
   * @param limit Results per page
   * @returns List of pools
   */
  async getPoolsByToken(
    token: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<LiquidityPool[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/pools/get_by_token`, {
        params: { token, page, limit },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      const data = response.data as { pools: LiquidityPool[] };
      return data.pools;
    } catch (error) {
      console.error('Error fetching pools by token:', error);
      throw new Error('Failed to fetch pools for token');
    }
  }

  /**
   * Get liquidity details for a pool
   * @param address Pool address
   * @returns Liquidity details
   */
  async getLiquidityDetails(address: string): Promise<LiquidityDetails> {
    try {
      const response = await axios.get(`${this.baseUrl}/pools/get_liquidity_details`, {
        params: { address },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      return (response.data as { liquidity_details: LiquidityDetails }).liquidity_details;
    } catch (error) {
      console.error('Error fetching liquidity details:', error);
      throw new Error('Failed to fetch liquidity details');
    }
  }

  /**
   * Find the best yield farming opportunities across DEXs
   * @param investmentAmount Amount to invest in base token (e.g., USDC)
   * @param baseToken Base token address
   * @param minApy Minimum APY threshold
   * @returns Top yield farming opportunities
   */
  async findBestYieldFarmingOpportunities(
    investmentAmount: number,
    baseToken: string,
    minApy: number = 5
  ): Promise<{ pool: LiquidityPool, expectedYield: number }[]> {
    try {
      // Get all pools for the base token
      const pools = await this.getPoolsByToken(baseToken, 1, 100);
      
      // Get liquidity details for each pool
      const poolsWithDetails = await Promise.all(
        pools.map(async (pool) => {
          try {
            const details = await this.getLiquidityDetails(pool.address);
            return {
              ...pool,
              apy: details.apy,
              tvl: details.tvl
            };
          } catch (error) {
            return {
              ...pool,
              apy: 0,
              tvl: 0
            };
          }
        })
      );
      
      // Filter and sort by APY
      const filteredPools = poolsWithDetails
        .filter(pool => pool.apy && pool.apy >= minApy)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0));
      
      // Calculate expected yield
      return filteredPools.map(pool => ({
        pool,
        expectedYield: investmentAmount * (pool.apy || 0) / 100
      }));
    } catch (error) {
      console.error('Error finding yield farming opportunities:', error);
      throw new Error('Failed to find yield farming opportunities');
    }
  }

  /**
   * Calculate impermanent loss for a liquidity provision
   * @param initialPriceRatio Initial price ratio between token A and B
   * @param currentPriceRatio Current price ratio between token A and B
   * @returns Impermanent loss as a percentage
   */
  calculateImpermanentLoss(
    initialPriceRatio: number,
    currentPriceRatio: number
  ): number {
    const priceRatio = currentPriceRatio / initialPriceRatio;
    const sqrtPriceRatio = Math.sqrt(priceRatio);
    
    // Formula: 2*sqrt(priceRatio) / (1 + priceRatio) - 1
    const impermanentLoss = (2 * sqrtPriceRatio) / (1 + priceRatio) - 1;
    
    // Convert to percentage
    return impermanentLoss * 100;
  }

  /**
   * Generate a DeFi strategy based on user's risk profile
   * @param walletAddress User's wallet address
   * @param riskProfile Risk profile (conservative, moderate, aggressive)
   * @returns Strategy recommendations
   */
  async generateStrategy(
    walletAddress: string,
    riskProfile: 'conservative' | 'moderate' | 'aggressive'
  ): Promise<any> {
    try {
      // This would be a more complex implementation that analyzes user's portfolio
      // and market conditions to generate a personalized DeFi strategy
      
      // For now, return placeholder recommendations based on risk profile
      const strategies = {
        conservative: {
          allocation: {
            stablecoinPairs: 70,
            bluechipPairs: 20,
            riskierPairs: 10
          },
          recommendedPools: [] as LiquidityPool[],
          expectedReturns: "5-10% APY",
          description: "Focus on stable pairs with lower yields but higher safety"
        },
        moderate: {
          allocation: {
            stablecoinPairs: 40,
            bluechipPairs: 40,
            riskierPairs: 20
          },
          recommendedPools: [] as LiquidityPool[],
          expectedReturns: "10-20% APY",
          description: "Balanced approach with mix of stable and higher-yield pairs"
        },
        aggressive: {
          allocation: {
            stablecoinPairs: 20,
            bluechipPairs: 30,
            riskierPairs: 50
          },
          recommendedPools: [] as LiquidityPool[],
          expectedReturns: "20-40+ APY",
          description: "Focus on higher-yield opportunities with higher risk"
        }
      };
      
      // Get some real pool data to populate recommendations
      const stablePairs = await this.getPoolsByPair(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"  // USDT
      );
      
      const solPairs = await this.getPoolsByPair(
        "So11111111111111111111111111111111111111112",   // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // USDC
      );
      
      // Populate recommended pools based on risk profile
      strategies.conservative.recommendedPools = stablePairs.slice(0, 3);
      strategies.moderate.recommendedPools = [...stablePairs.slice(0, 2), ...solPairs.slice(0, 2)];
      strategies.aggressive.recommendedPools = [...solPairs.slice(0, 3), ...stablePairs.slice(0, 1)];
      
      return strategies[riskProfile];
    } catch (error) {
      console.error('Error generating DeFi strategy:', error);
      throw new Error('Failed to generate DeFi strategy');
    }
  }
}