import axios  from 'axios';
import { GraphQLClient, gql } from 'graphql-request';

/**
 * Interface for token allocation in a strategy
 */
export interface TokenAllocation {
  token: string;
  percentage: number;
  reason?: string;
}

/**
 * Interface for a pool
 */
export interface Pool {
  address: string;
  dex: string;
  tokenA: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenB: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tvl?: number;
  apy?: number;
  volume24h?: number;
}

/**
 * Interface for liquidity details
 */
export interface LiquidityDetails {
  tvl: number;
  apy: number;
  volume24h: number;
  fee24h: number;
}

/**
 * Interface for investment opportunities
 */
export interface InvestmentOpportunity {
  pool: Pool;
  expectedYield: number;
  risk: 'low' | 'medium' | 'high';
  recommendation: string;
}

/**
 * Interface for REST API pool response
 */
interface PoolResponse {
  pool?: Pool;
  pools?: Pool[];
}

/**
 * Interface for liquidity details response
 */
interface LiquidityDetailsResponse {
  liquidity_details: LiquidityDetails;
}

/**
 * Interface for yield farming opportunities response
 */
interface YieldFarmingResponse {
  opportunities: any[];
}

/**
 * Interface for historical data points
 */
interface HistoricalDataPoint {
  timestamp: number;
  value: number;
}

/**
 * Interface for historical TVL response
 */
interface HistoricalTVLResponse {
  tvl_history: HistoricalDataPoint[];
}

/**
 * Interface for historical APY response
 */
interface HistoricalAPYResponse {
  apy_history: HistoricalDataPoint[];
}

/**
 * Interface for token price response
 */
interface TokenPriceResponse {
  price: number;
}

/**
 * Interface for token info response
 */
interface TokenInfoResponse {
  token: any;
}

/**
 * Service for integrating with Shyft's DeFi APIs and GraphQL
 */
export class ShyftDeFiService {
  private apiKey: string;
  private restBaseUrl: string = 'https://defi.shyft.to/v0';
  private graphqlBaseUrl: string = 'https://programs.shyft.to/v0/graphql';
  private graphqlClient: GraphQLClient;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // Initialize GraphQL client
    this.graphqlClient = new GraphQLClient(`${this.graphqlBaseUrl}/?api_key=${this.apiKey}`, {
      method: 'POST',
      jsonSerializer: {
        parse: JSON.parse,
        stringify: JSON.stringify,
      },
    });
  }
  
  /**
   * Get pool information by address using REST API
   * @param poolAddress Pool address
   * @returns Pool details
   */
  async getPoolByAddress(poolAddress: string): Promise<Pool> {
    try {
      const response = await axios.get<PoolResponse>(`${this.restBaseUrl}/pools/get_by_address`, {
        params: {
          address: poolAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.pool as Pool;
    } catch (error) {
      console.error('Error fetching pool by address:', error);
      throw error;
    }
  }
  
  /**
   * Get pools by token pair using REST API
   * @param tokenA First token address
   * @param tokenB Second token address
   * @param dex Optional array of DEX names
   * @param page Page number
   * @param limit Results per page
   * @returns Array of pools
   */
  async getPoolsByPair(
    tokenA: string,
    tokenB: string,
    dex?: string[],
    page: number = 1,
    limit: number = 10
  ): Promise<Pool[]> {
    try {
      const params: any = {
        tokenA,
        tokenB,
        page,
        limit
      };
      
      if (dex && dex.length > 0) {
        params.dex = dex;
      }
      
      const response = await axios.get<PoolResponse>(`${this.restBaseUrl}/pools/get_by_pair`, {
        params,
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.pools || [];
    } catch (error) {
      console.error('Error fetching pools by pair:', error);
      throw error;
    }
  }
  
  /**
   * Get all pools for a token using REST API
   * @param token Token address
   * @param page Page number
   * @param limit Results per page
   * @returns Array of pools
   */
  async getPoolsByToken(
    token: string,
    page: number = 1,
    limit: number = 10
  ): Promise<Pool[]> {
    try {
      const response = await axios.get<PoolResponse>(`${this.restBaseUrl}/pools/get_by_token`, {
        params: {
          token,
          page,
          limit
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.pools || [];
    } catch (error) {
      console.error('Error fetching pools by token:', error);
      throw error;
    }
  }
  
  /**
   * Get liquidity details for a pool using REST API
   * @param poolAddress Pool address
   * @returns Liquidity details
   */
  async getLiquidityDetails(poolAddress: string): Promise<LiquidityDetails> {
    try {
      const response = await axios.get<LiquidityDetailsResponse>(`${this.restBaseUrl}/pools/get_liquidity_details`, {
        params: {
          address: poolAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.liquidity_details;
    } catch (error) {
      console.error('Error fetching liquidity details:', error);
      throw error;
    }
  }
  
  /**
   * Get pool information by address using GraphQL
   * @param poolAddress Pool address
   * @returns Pool details
   */
  async getPoolByAddressGraphQL(poolAddress: string): Promise<any> {
    try {
      const query = gql`
        query GetPool($where: Raydium_LiquidityPoolv4_bool_exp) {
          Raydium_LiquidityPoolv4(where: $where) {
            baseDecimal
            baseMint
            baseVault
            lpMint
            marketId
            openOrders
            poolOpenTime
            quoteDecimal
            quoteMint
            quoteVault
            status
            pubkey
          }
        }
      `;
      
      const variables = {
        where: {
          pubkey: {
            _eq: poolAddress
          }
        }
      };
      
      const data = await this.graphqlClient.request<{ Raydium_LiquidityPoolv4: any[] }>(query, variables);
      return data.Raydium_LiquidityPoolv4[0] || null;
    } catch (error) {
      console.error('Error fetching pool by address using GraphQL:', error);
      throw error;
    }
  }
  
  /**
   * Get pools by token using GraphQL
   * @param token Token address
   * @returns Array of pools
   */
  async getPoolsByTokenGraphQL(token: string): Promise<any[]> {
    try {
      const query = gql`
        query GetPoolsByToken($where: Raydium_LiquidityPoolv4_bool_exp) {
          Raydium_LiquidityPoolv4(where: $where) {
            baseDecimal
            baseMint
            baseVault
            lpMint
            marketId
            openOrders
            poolOpenTime
            quoteDecimal
            quoteMint
            quoteVault
            status
            pubkey
          }
        }
      `;
      
      const variables = {
        where: {
          _or: [
            { baseMint: { _eq: token } },
            { quoteMint: { _eq: token } }
          ]
        }
      };
      
      const data = await this.graphqlClient.request<{ Raydium_LiquidityPoolv4: any[] }>(query, variables);
      return data.Raydium_LiquidityPoolv4 || [];
    } catch (error) {
      console.error('Error fetching pools by token using GraphQL:', error);
      throw error;
    }
  }

  /**
   * Get top performing pools using REST API
   * @param limit Number of top pools to return
   * @param sortBy Field to sort by ('tvl', 'apy', or 'volume24h')
   * @returns Array of pools
   */
  async getTopPerformingPools(
    limit: number = 10,
    sortBy: 'tvl' | 'apy' | 'volume24h' = 'apy'
  ): Promise<Pool[]> {
    try {
      const response = await axios.get<PoolResponse>(`${this.restBaseUrl}/pools/top_performing`, {
        params: {
          limit,
          sort_by: sortBy
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.pools || [];
    } catch (error) {
      console.error('Error fetching top performing pools:', error);
      throw error;
    }
  }

  /**
   * Get token price using REST API
   * @param tokenAddress Token address
   * @returns Token price in USD
   */
  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await axios.get<TokenPriceResponse>(`${this.restBaseUrl}/tokens/price`, {
        params: {
          address: tokenAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.price;
    } catch (error) {
      console.error('Error fetching token price:', error);
      throw error;
    }
  }

  /**
   * Get token information using REST API
   * @param tokenAddress Token address
   * @returns Token details
   */
  async getTokenInfo(tokenAddress: string): Promise<any> {
    try {
      const response = await axios.get<TokenInfoResponse>(`${this.restBaseUrl}/tokens/info`, {
        params: {
          address: tokenAddress
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.token;
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw error;
    }
  }

  /**
   * Get investment recommendations based on user risk profile and token preferences
   * @param riskProfile User risk profile 
   * @param tokens Array of token addresses user is interested in
   * @param limit Number of recommendations to return
   * @returns Array of investment opportunities
   */
  async getInvestmentRecommendations(
    riskProfile: 'low' | 'medium' | 'high',
    tokens: string[],
    limit: number = 5
  ): Promise<InvestmentOpportunity[]> {
    try {
      // First, get all pools for the tokens
      const poolPromises = tokens.map(token => this.getPoolsByToken(token));
      const poolsArrays = await Promise.all(poolPromises);
      
      // Flatten the array of arrays
      let allPools: Pool[] = [];
      poolsArrays.forEach(pools => {
        allPools = [...allPools, ...pools];
      });
      
      // Remove duplicates by creating a map of pool addresses
      const uniquePools = new Map<string, Pool>();
      allPools.forEach(pool => {
        if (!uniquePools.has(pool.address)) {
          uniquePools.set(pool.address, pool);
        }
      });
      
      // Get liquidity details for each pool
      const detailsPromises = Array.from(uniquePools.values()).map(async pool => {
        try {
          const details = await this.getLiquidityDetails(pool.address);
          return {
            pool,
            details
          };
        } catch (error) {
          console.error(`Error fetching liquidity details for pool ${pool.address}:`, error);
          return null;
        }
      });
      
      const poolsWithDetails = (await Promise.all(detailsPromises)).filter(item => item !== null) as {
        pool: Pool;
        details: LiquidityDetails;
      }[];
      
      // Calculate risk score and filter based on risk profile
      const opportunities: InvestmentOpportunity[] = poolsWithDetails.map(({ pool, details }) => {
        // Simple risk calculation - can be more sophisticated in production
        let risk: 'low' | 'medium' | 'high';
        if (details.tvl > 1000000 && details.apy < 30) {
          risk = 'low';
        } else if (details.tvl > 500000 && details.apy < 100) {
          risk = 'medium';
        } else {
          risk = 'high';
        }
        
        // Generate recommendation text
        let recommendation = `${pool.dex} pool with ${pool.tokenA.symbol}-${pool.tokenB.symbol}. `;
        recommendation += `TVL: $${details.tvl.toLocaleString()}, APY: ${details.apy.toFixed(2)}%. `;
        recommendation += `24h Volume: $${details.volume24h.toLocaleString()}, 24h Fees: $${details.fee24h.toLocaleString()}.`;
        
        return {
          pool,
          expectedYield: details.apy,
          risk,
          recommendation
        };
      });
      
      // Filter by risk profile
      let filteredOpportunities = opportunities;
      if (riskProfile === 'low') {
        filteredOpportunities = opportunities.filter(o => o.risk === 'low');
      } else if (riskProfile === 'medium') {
        filteredOpportunities = opportunities.filter(o => o.risk === 'low' || o.risk === 'medium');
      }
      
      // Sort by expected yield (APY) and limit results
      return filteredOpportunities
        .sort((a, b) => b.expectedYield - a.expectedYield)
        .slice(0, limit);
    } catch (error) {
      console.error('Error generating investment recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate a balanced portfolio strategy based on user's risk tolerance
   * @param riskProfile User risk profile
   * @param investmentAmount Total amount to invest in USD
   * @returns Array of token allocations
   */
  async generatePortfolioStrategy(
    riskProfile: 'low' | 'medium' | 'high',
    investmentAmount: number
  ): Promise<TokenAllocation[]> {
    // Define allocation percentages based on risk profile
    let stableAllocation: number;
    let blueChipAllocation: number;
    let midCapAllocation: number;
    let highRiskAllocation: number;
    
    switch (riskProfile) {
      case 'low':
        stableAllocation = 60;
        blueChipAllocation = 30;
        midCapAllocation = 10;
        highRiskAllocation = 0;
        break;
      case 'medium':
        stableAllocation = 40;
        blueChipAllocation = 30;
        midCapAllocation = 20;
        highRiskAllocation = 10;
        break;
      case 'high':
        stableAllocation = 20;
        blueChipAllocation = 30;
        midCapAllocation = 30;
        highRiskAllocation = 20;
        break;
    }
    
    // Define token categories
    const stablecoins = [
      {
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
        symbol: 'USDC',
        weight: 70
      },
      {
        token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
        symbol: 'USDT',
        weight: 30
      }
    ];
    
    const blueChips = [
      {
        token: 'So11111111111111111111111111111111111111112', // Wrapped SOL
        symbol: 'SOL',
        weight: 40
      },
      {
        token: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // Wrapped BTC on Solana
        symbol: 'BTC',
        weight: 30
      },
      {
        token: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk', // Wrapped ETH on Solana
        symbol: 'ETH',
        weight: 30
      }
    ];
    
    const midCaps = [
      {
        token: 'AfXLBfMZd32pN6QauazHCd7diEPbpL5SgXwBJFrpZSHC', // Polygon on Solana
        symbol: 'MATIC',
        weight: 25
      },
      {
        token: 'EPeUFDgHRxs9xxEPVaL6kfGQvCon7jmAWKVUHuux1Tpz', // Optimism on Solana
        symbol: 'OP',
        weight: 25
      },
      {
        token: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6', // Kin on Solana
        symbol: 'KIN',
        weight: 25
      },
      {
        token: 'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a', // Raydium on Solana
        symbol: 'RAY',
        weight: 25
      }
    ];
    
    const highRiskTokens = [
      {
        token: 'CiKu4eHsVrc1eueVQeHn7qhXTcVu95gSQmBpX4utjL9z', // Bonfida on Solana
        symbol: 'FIDA',
        weight: 30
      },
      {
        token: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey', // Marinade Staked SOL on Solana
        symbol: 'MSOL',
        weight: 40
      },
      {
        token: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // Mango on Solana
        symbol: 'MNGO',
        weight: 30
      }
    ];
    
    // Calculate allocations
    const allocations: TokenAllocation[] = [];
    
    // Helper function to calculate individual token allocations
    const calculateAllocation = (
      tokens: {token: string, symbol: string, weight: number}[],
      totalAllocation: number
    ) => {
      return tokens.map(({token, symbol, weight}) => {
        const percentage = (totalAllocation * weight) / 100;
        const reason = `${symbol} allocated at ${percentage.toFixed(2)}% as part of the ${
          totalAllocation === stableAllocation ? 'stablecoin' :
          totalAllocation === blueChipAllocation ? 'blue chip' :
          totalAllocation === midCapAllocation ? 'mid cap' :
          'high risk'
        } allocation for a ${riskProfile} risk profile strategy.`;
        
        return {
          token,
          percentage,
          reason
        };
      });
    };
    
    // Add allocations for each category
    allocations.push(...calculateAllocation(stablecoins, stableAllocation));
    allocations.push(...calculateAllocation(blueChips, blueChipAllocation));
    allocations.push(...calculateAllocation(midCaps, midCapAllocation));
    allocations.push(...calculateAllocation(highRiskTokens, highRiskAllocation));
    
    return allocations;
  }

  /**
   * Get DeFi yield farming opportunities from Shyft REST API
   * @param minApy Minimum APY to filter results
   * @param maxRisk Maximum risk level to filter results
   * @param limit Number of opportunities to return
   * @returns Array of yield farming opportunities
   */
  async getYieldFarmingOpportunities(
    minApy: number = 0,
    maxRisk: 'low' | 'medium' | 'high' = 'high',
    limit: number = 10
  ): Promise<any[]> {
    try {
      const response = await axios.get<YieldFarmingResponse>(`${this.restBaseUrl}/yield/opportunities`, {
        params: {
          min_apy: minApy,
          max_risk: maxRisk,
          limit
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.opportunities || [];
    } catch (error) {
      console.error('Error fetching yield farming opportunities:', error);
      throw error;
    }
  }

  /**
   * Get historical TVL data for a pool using REST API
   * @param poolAddress Pool address
   * @param startTime Start timestamp in seconds
   * @param endTime End timestamp in seconds
   * @param interval Data interval ('hourly', 'daily', 'weekly')
   * @returns Array of TVL data points
   */
  async getHistoricalTVL(
    poolAddress: string,
    startTime: number,
    endTime: number,
    interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<HistoricalDataPoint[]> {
    try {
      const response = await axios.get<HistoricalTVLResponse>(`${this.restBaseUrl}/pools/historical_tvl`, {
        params: {
          address: poolAddress,
          start_time: startTime,
          end_time: endTime,
          interval
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.tvl_history || [];
    } catch (error) {
      console.error('Error fetching historical TVL:', error);
      throw error;
    }
  }

  /**
   * Get historical APY data for a pool using REST API
   * @param poolAddress Pool address
   * @param startTime Start timestamp in seconds
   * @param endTime End timestamp in seconds
   * @param interval Data interval ('hourly', 'daily', 'weekly')
   * @returns Array of APY data points
   */
  async getHistoricalAPY(
    poolAddress: string,
    startTime: number,
    endTime: number,
    interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<HistoricalDataPoint[]> {
    try {
      const response = await axios.get<HistoricalAPYResponse>(`${this.restBaseUrl}/pools/historical_apy`, {
        params: {
          address: poolAddress,
          start_time: startTime,
          end_time: endTime,
          interval
        },
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey
        }
      });
      
      return response.data.apy_history || [];
    } catch (error) {
      console.error('Error fetching historical APY:', error);
      throw error;
    }
  }
}