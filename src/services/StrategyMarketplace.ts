// src/services/StrategyMarketplace.ts


export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum TimeHorizon {
  SHORT_TERM = 'short_term', // Hours to days
  MEDIUM_TERM = 'medium_term', // Days to weeks
  LONG_TERM = 'long_term' // Weeks to months
}

export enum AIModelType {
  MOMENTUM = 'momentum',
  MEAN_REVERSION = 'mean_reversion',
  SENTIMENT = 'sentiment',
  STATISTICAL_ARBITRAGE = 'statistical_arbitrage',
  REINFORCEMENT_LEARNING = 'reinforcement_learning',
  MULTI_FACTOR = 'multi_factor',
  VOLATILITY_PREDICTION = 'volatility_prediction',
  MARKET_REGIME = 'market_regime',
  ORDER_FLOW = 'order_flow',
  PATTERN_RECOGNITION = 'pattern_recognition'
}

export enum TokenSupportType {
  MAJOR_ONLY = 'major_only', // Only major tokens (SOL, USDC, etc.)
  MAJOR_AND_MEDIUM = 'major_and_medium', // Major and medium cap tokens
  WIDE_COVERAGE = 'wide_coverage', // Most listed tokens
  CUSTOM_BASKET = 'custom_basket' // Custom selection of tokens
}

export enum BacktestTimespan {
  ONE_MONTH = '1month',
  THREE_MONTHS = '3months',
  SIX_MONTHS = '6months',
  ONE_YEAR = '1year'
}

export interface BacktestResult {
  timespan: BacktestTimespan;
  startDate: string;
  endDate: string;
  startingBalance: number;
  endingBalance: number;
  totalReturn: number; // Percentage
  maxDrawdown: number; // Percentage
  sharpeRatio: number;
  winRate: number; // Percentage
  tradesExecuted: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  creatorAddress: string;
  creatorName: string;
  verified: boolean;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  aiModels: AIModelType[];
  tokenSupport: TokenSupportType;
  activeUsers: number;
  tvl: number; // Total Value Locked in USD
  feePercentage: number; // Revenue sharing percentage for creator
  performanceFee: number; // Performance fee percentage
  backtestResults: BacktestResult[];
  lastUpdated: string; // ISO date string
  tags: string[];
  contractAddress?: string; // On-chain strategy contract address
  minInvestment?: number; // Minimum investment in USD
  documentation?: string; // URL to documentation
  repositoryUrl?: string; // Public repository if open source
  version: string;
  compatibleWith: string[]; // List of compatible platforms/services
}

export class StrategyMarketplaceService {
  private static instance: StrategyMarketplaceService;
  private strategies: TradingStrategy[] = [];

  private constructor() {
    // Initialize with predefined strategies
    this.initializeStrategies();
  }

  public static getInstance(): StrategyMarketplaceService {
    if (!StrategyMarketplaceService.instance) {
      StrategyMarketplaceService.instance = new StrategyMarketplaceService();
    }
    return StrategyMarketplaceService.instance;
  }

  private initializeStrategies(): void {
    // AI-powered momentum strategy
    this.strategies.push({
      id: 'momentum-ml-strategy',
      name: 'AI Momentum Alpha',
      description: 'Employs machine learning to identify short-term momentum patterns in major tokens. This strategy uses a combination of technical indicators and sentiment analysis to predict price trends.',
      creatorAddress: 'AiXZdnAMYcdnAvc54Cd55555Z7777aaaa3333333',
      creatorName: 'Quantum Quant Labs',
      verified: true,
      riskLevel: RiskLevel.MEDIUM,
      timeHorizon: TimeHorizon.SHORT_TERM,
      aiModels: [AIModelType.MOMENTUM, AIModelType.SENTIMENT],
      tokenSupport: TokenSupportType.MAJOR_ONLY,
      activeUsers: 3245,
      tvl: 2450000,
      feePercentage: 1.5,
      performanceFee: 10,
      backtestResults: [
        {
          timespan: BacktestTimespan.SIX_MONTHS,
          startDate: '2024-04-01',
          endDate: '2024-10-01',
          startingBalance: 10000,
          endingBalance: 14500,
          totalReturn: 45,
          maxDrawdown: 12.5,
          sharpeRatio: 1.8,
          winRate: 62.5,
          tradesExecuted: 82
        }
      ],
      lastUpdated: '2024-10-18T14:30:00Z',
      tags: ['momentum', 'machine learning', 'sentiment', 'short-term'],
      contractAddress: 'Mo77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 500,
      version: '2.1.0',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Orca']
    });

    // AI-powered mean reversion strategy
    this.strategies.push({
      id: 'mean-reversion-ml',
      name: 'Quantum Mean Reverter',
      description: 'Uses advanced statistical models to identify temporary price deviations and capitalize on the reversion to mean. Employs multiple timeframe analysis to filter signals.',
      creatorAddress: 'MR555555555555555555555555555555555555555',
      creatorName: 'AlphaRev Research',
      verified: true,
      riskLevel: RiskLevel.MEDIUM,
      timeHorizon: TimeHorizon.MEDIUM_TERM,
      aiModels: [AIModelType.MEAN_REVERSION, AIModelType.STATISTICAL_ARBITRAGE],
      tokenSupport: TokenSupportType.MAJOR_AND_MEDIUM,
      activeUsers: 1875,
      tvl: 1250000,
      feePercentage: 1.2,
      performanceFee: 15,
      backtestResults: [
        {
          timespan: BacktestTimespan.ONE_YEAR,
          startDate: '2023-10-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 13800,
          totalReturn: 38,
          maxDrawdown: 9.2,
          sharpeRatio: 1.6,
          winRate: 68.2,
          tradesExecuted: 120
        }
      ],
      lastUpdated: '2024-10-20T09:15:00Z',
      tags: ['mean reversion', 'statistical', 'medium-term'],
      contractAddress: 'MR77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1000,
      documentation: 'https://docs.alpharev.io/quantum-reverter',
      version: '3.0.1',
      compatibleWith: ['SonicAgent', 'Jupiter']
    });

    // Reinforcement learning strategy
    this.strategies.push({
      id: 'rl-adaptive-trader',
      name: 'RL Adaptive Trader',
      description: 'Revolutionary reinforcement learning model that adapts to changing market conditions. The agent continuously learns from market behavior and optimizes its decision-making process.',
      creatorAddress: 'RL999999999999999999999999999999999999999',
      creatorName: 'DeepTrade AI',
      verified: true,
      riskLevel: RiskLevel.HIGH,
      timeHorizon: TimeHorizon.MEDIUM_TERM,
      aiModels: [AIModelType.REINFORCEMENT_LEARNING, AIModelType.MARKET_REGIME],
      tokenSupport: TokenSupportType.WIDE_COVERAGE,
      activeUsers: 957,
      tvl: 1875000,
      feePercentage: 2.0,
      performanceFee: 20,
      backtestResults: [
        {
          timespan: BacktestTimespan.SIX_MONTHS,
          startDate: '2024-04-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 16200,
          totalReturn: 62,
          maxDrawdown: 18.5,
          sharpeRatio: 2.1,
          winRate: 58.5,
          tradesExecuted: 205
        }
      ],
      lastUpdated: '2024-10-25T16:45:00Z',
      tags: ['reinforcement learning', 'adaptive', 'dynamic', 'AI agent'],
      contractAddress: 'RL77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 2000,
      documentation: 'https://deeptrade.ai/docs/rl-adaptive',
      repositoryUrl: 'https://github.com/deeptradeai/rl-trader-public',
      version: '1.5.2',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Raydium']
    });

    // Sentiment-based strategy
    this.strategies.push({
      id: 'sentiment-alpha',
      name: 'NeuralSentiment Alpha',
      description: 'Leverages natural language processing to analyze real-time social media, news, and on-chain data to predict market sentiment shifts before they affect prices.',
      creatorAddress: 'SE777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'DataMinds',
      verified: true,
      riskLevel: RiskLevel.HIGH,
      timeHorizon: TimeHorizon.SHORT_TERM,
      aiModels: [AIModelType.SENTIMENT, AIModelType.MOMENTUM],
      tokenSupport: TokenSupportType.MAJOR_AND_MEDIUM,
      activeUsers: 2124,
      tvl: 2250000,
      feePercentage: 1.8,
      performanceFee: 18,
      backtestResults: [
        {
          timespan: BacktestTimespan.THREE_MONTHS,
          startDate: '2024-07-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 13500,
          totalReturn: 35,
          maxDrawdown: 15.2,
          sharpeRatio: 1.9,
          winRate: 60.8,
          tradesExecuted: 98
        }
      ],
      lastUpdated: '2024-10-22T11:30:00Z',
      tags: ['sentiment analysis', 'NLP', 'social media', 'news'],
      contractAddress: 'NS77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1000,
      documentation: 'https://dataminds.io/neural-sentiment',
      version: '2.3.0',
      compatibleWith: ['SonicAgent', 'Jupiter']
    });

    // Multi-factor AI strategy
    this.strategies.push({
      id: 'multi-factor-ai',
      name: 'QuantumFactor Alpha',
      description: 'Combines multiple AI models analyzing fundamental, technical, and sentiment factors to create a robust trading strategy that performs well across different market conditions.',
      creatorAddress: 'MF777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'Tensor Quant',
      verified: true,
      riskLevel: RiskLevel.MEDIUM,
      timeHorizon: TimeHorizon.MEDIUM_TERM,
      aiModels: [AIModelType.MULTI_FACTOR, AIModelType.MARKET_REGIME, AIModelType.PATTERN_RECOGNITION],
      tokenSupport: TokenSupportType.MAJOR_AND_MEDIUM,
      activeUsers: 1560,
      tvl: 3150000,
      feePercentage: 1.5,
      performanceFee: 15,
      backtestResults: [
        {
          timespan: BacktestTimespan.ONE_YEAR,
          startDate: '2023-10-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 14200,
          totalReturn: 42,
          maxDrawdown: 11.3,
          sharpeRatio: 1.75,
          winRate: 65.4,
          tradesExecuted: 142
        }
      ],
      lastUpdated: '2024-10-26T08:20:00Z',
      tags: ['multi-factor', 'quantitative', 'balanced', 'all-weather'],
      contractAddress: 'QF77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1500,
      documentation: 'https://tensorquant.com/quantum-factor',
      version: '2.0.1',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Mango Markets']
    });

    // Volatility prediction strategy
    this.strategies.push({
      id: 'volatility-trader-ai',
      name: 'VolTraderAI',
      description: 'Uses neural networks to predict volatility spikes and exploits options and futures markets during high volatility periods. Includes volatility-based position sizing.',
      creatorAddress: 'VT777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'VolMatrix',
      verified: true,
      riskLevel: RiskLevel.VERY_HIGH,
      timeHorizon: TimeHorizon.SHORT_TERM,
      aiModels: [AIModelType.VOLATILITY_PREDICTION, AIModelType.PATTERN_RECOGNITION],
      tokenSupport: TokenSupportType.MAJOR_ONLY,
      activeUsers: 685,
      tvl: 1350000,
      feePercentage: 2.2,
      performanceFee: 25,
      backtestResults: [
        {
          timespan: BacktestTimespan.SIX_MONTHS,
          startDate: '2024-04-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 17800,
          totalReturn: 78,
          maxDrawdown: 24.5,
          sharpeRatio: 1.95,
          winRate: 55.2,
          tradesExecuted: 112
        }
      ],
      lastUpdated: '2024-10-24T15:10:00Z',
      tags: ['volatility', 'options', 'futures', 'high-risk'],
      contractAddress: 'VT77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 2500,
      documentation: 'https://volmatrix.io/voltrader-ai',
      version: '1.2.3',
      compatibleWith: ['SonicAgent', 'Zeta Markets', 'Drift Protocol']
    });

    // Order flow analysis strategy
    this.strategies.push({
      id: 'order-flow-quant',
      name: 'FlowSeeker Alpha',
      description: 'Analyzes on-chain order flow data to identify institutional movements and smart money patterns, with a proprietary liquidity detection mechanism.',
      creatorAddress: 'OF777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'Cipher Analytics',
      verified: true,
      riskLevel: RiskLevel.HIGH,
      timeHorizon: TimeHorizon.SHORT_TERM,
      aiModels: [AIModelType.ORDER_FLOW, AIModelType.PATTERN_RECOGNITION],
      tokenSupport: TokenSupportType.MAJOR_AND_MEDIUM,
      activeUsers: 1220,
      tvl: 1950000,
      feePercentage: 1.9,
      performanceFee: 20,
      backtestResults: [
        {
          timespan: BacktestTimespan.THREE_MONTHS,
          startDate: '2024-07-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 13200,
          totalReturn: 32,
          maxDrawdown: 14.8,
          sharpeRatio: 1.65,
          winRate: 59.5,
          tradesExecuted: 175
        }
      ],
      lastUpdated: '2024-10-23T14:25:00Z',
      tags: ['order flow', 'liquidity', 'institutional', 'on-chain analysis'],
      contractAddress: 'FS77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1800,
      documentation: 'https://cipheranalytics.io/flow-seeker',
      version: '1.8.5',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Openbook']
    });

    // Statistical arbitrage strategy
    this.strategies.push({
      id: 'stat-arb-neural',
      name: 'NeuralArb',
      description: 'Identifies statistical arbitrage opportunities across multiple DEXs and tokens using neural networks to detect pricing inefficiencies.',
      creatorAddress: 'NA777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'QuantumEdge',
      verified: true,
      riskLevel: RiskLevel.MEDIUM,
      timeHorizon: TimeHorizon.SHORT_TERM,
      aiModels: [AIModelType.STATISTICAL_ARBITRAGE, AIModelType.REINFORCEMENT_LEARNING],
      tokenSupport: TokenSupportType.WIDE_COVERAGE,
      activeUsers: 945,
      tvl: 2350000,
      feePercentage: 1.6,
      performanceFee: 18,
      backtestResults: [
        {
          timespan: BacktestTimespan.SIX_MONTHS,
          startDate: '2024-04-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 13100,
          totalReturn: 31,
          maxDrawdown: 8.5,
          sharpeRatio: 2.2,
          winRate: 72.5,
          tradesExecuted: 320
        }
      ],
      lastUpdated: '2024-10-26T10:45:00Z',
      tags: ['statistical arbitrage', 'market neutral', 'DEX arbitrage', 'neural network'],
      contractAddress: 'NA77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1000,
      documentation: 'https://quantumedge.io/neural-arb',
      repositoryUrl: 'https://github.com/quantumedge/neural-arb-public',
      version: '2.4.1',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Orca', 'Raydium']
    });

    // Micro-cap token discovery strategy
    this.strategies.push({
      id: 'micro-hunter-ai',
      name: 'MicroHunter AI',
      description: 'Specialized in discovering promising micro-cap tokens with high growth potential using a proprietary ranking algorithm and sentiment analysis.',
      creatorAddress: 'MH777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'Frontier Labs',
      verified: true,
      riskLevel: RiskLevel.VERY_HIGH,
      timeHorizon: TimeHorizon.MEDIUM_TERM,
      aiModels: [AIModelType.SENTIMENT, AIModelType.MULTI_FACTOR, AIModelType.PATTERN_RECOGNITION],
      tokenSupport: TokenSupportType.CUSTOM_BASKET,
      activeUsers: 580,
      tvl: 850000,
      feePercentage: 2.5,
      performanceFee: 25,
      backtestResults: [
        {
          timespan: BacktestTimespan.THREE_MONTHS,
          startDate: '2024-07-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 18500,
          totalReturn: 85,
          maxDrawdown: 32.5,
          sharpeRatio: 1.4,
          winRate: 42.5,
          tradesExecuted: 65
        }
      ],
      lastUpdated: '2024-10-25T09:30:00Z',
      tags: ['micro-cap', 'discovery', 'high-growth', 'early-stage'],
      contractAddress: 'MH77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 1000,
      documentation: 'https://frontierlabs.io/micro-hunter',
      version: '1.0.5',
      compatibleWith: ['SonicAgent', 'Jupiter']
    });

    // Conservative AI portfolio strategy
    this.strategies.push({
      id: 'conservative-ai-portfolio',
      name: 'StableGrowth AI',
      description: 'A conservative portfolio management strategy using AI to maintain balanced exposure across major tokens with focus on capital preservation and steady growth.',
      creatorAddress: 'SG777777777777771111111111111111UUUUUUUUuu',
      creatorName: 'Guardian Quant',
      verified: true,
      riskLevel: RiskLevel.LOW,
      timeHorizon: TimeHorizon.LONG_TERM,
      aiModels: [AIModelType.MULTI_FACTOR, AIModelType.MARKET_REGIME],
      tokenSupport: TokenSupportType.MAJOR_ONLY,
      activeUsers: 4250,
      tvl: 8500000,
      feePercentage: 1.0,
      performanceFee: 10,
      backtestResults: [
        {
          timespan: BacktestTimespan.ONE_YEAR,
          startDate: '2023-10-15',
          endDate: '2024-10-15',
          startingBalance: 10000,
          endingBalance: 12800,
          totalReturn: 28,
          maxDrawdown: 6.5,
          sharpeRatio: 1.8,
          winRate: 68.5,
          tradesExecuted: 45
        }
      ],
      lastUpdated: '2024-10-26T12:15:00Z',
      tags: ['conservative', 'portfolio', 'balanced', 'capital preservation'],
      contractAddress: 'SG77777777777771111111111111111UUUUUUUUuu',
      minInvestment: 500,
      documentation: 'https://guardianquant.com/stable-growth',
      version: '3.1.2',
      compatibleWith: ['SonicAgent', 'Jupiter', 'Marinade Finance']
    });
  }

  /**
   * Get all available strategies
   */
  public getAllStrategies(): TradingStrategy[] {
    return [...this.strategies];
  }

  /**
   * Get strategy by ID
   */
  public getStrategyById(id: string): TradingStrategy | undefined {
    return this.strategies.find(strategy => strategy.id === id);
  }

  /**
   * Filter strategies by various criteria
   */
  public filterStrategies(filters: {
    riskLevel?: RiskLevel[],
    timeHorizon?: TimeHorizon[],
    aiModels?: AIModelType[],
    tokenSupport?: TokenSupportType[],
    minTvl?: number,
    minActiveUsers?: number,
    tags?: string[],
    verified?: boolean,
    maxFeePercentage?: number,
    maxPerformanceFee?: number,
    minSharpeRatio?: number
  }): TradingStrategy[] {
    return this.strategies.filter(strategy => {
      if (filters.riskLevel && filters.riskLevel.length > 0 && !filters.riskLevel.includes(strategy.riskLevel)) {
        return false;
      }
      
      if (filters.timeHorizon && filters.timeHorizon.length > 0 && !filters.timeHorizon.includes(strategy.timeHorizon)) {
        return false;
      }
      
      if (filters.aiModels && filters.aiModels.length > 0 && !filters.aiModels.some(model => strategy.aiModels.includes(model))) {
        return false;
      }
      
      if (filters.tokenSupport && filters.tokenSupport.length > 0 && !filters.tokenSupport.includes(strategy.tokenSupport)) {
        return false;
      }
      
      if (filters.minTvl !== undefined && strategy.tvl < filters.minTvl) {
        return false;
      }
      
      if (filters.minActiveUsers !== undefined && strategy.activeUsers < filters.minActiveUsers) {
        return false;
      }
      
      if (filters.tags && filters.tags.length > 0 && !filters.tags.some(tag => strategy.tags.includes(tag))) {
        return false;
      }
      
      if (filters.verified !== undefined && strategy.verified !== filters.verified) {
        return false;
      }
      
      if (filters.maxFeePercentage !== undefined && strategy.feePercentage > filters.maxFeePercentage) {
        return false;
      }
      
      if (filters.maxPerformanceFee !== undefined && strategy.performanceFee > filters.maxPerformanceFee) {
        return false;
      }
      
      if (filters.minSharpeRatio !== undefined) {
        // Find the highest Sharpe ratio among all backtest results
        const maxSharpeRatio = Math.max(...strategy.backtestResults.map(result => result.sharpeRatio));
        if (maxSharpeRatio < filters.minSharpeRatio) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Sort strategies by specified criteria
   */
  public sortStrategies(
    strategies: TradingStrategy[],
    sortBy: 'tvl' | 'activeUsers' | 'totalReturn' | 'sharpeRatio' | 'winRate' | 'feePercentage',
    ascending: boolean = false
  ): TradingStrategy[] {
    return [...strategies].sort((a, b) => {
      let valueA: number;
      let valueB: number;
      
      switch (sortBy) {
        case 'tvl':
          valueA = a.tvl;
          valueB = b.tvl;
          break;
        case 'activeUsers':
          valueA = a.activeUsers;
          valueB = b.activeUsers;
          break;
        case 'totalReturn':
          // Use the most recent backtest result
          valueA = a.backtestResults.length > 0 ? a.backtestResults[0].totalReturn : 0;
          valueB = b.backtestResults.length > 0 ? b.backtestResults[0].totalReturn : 0;
          break;
        case 'sharpeRatio':
          // Use the most recent backtest result
          valueA = a.backtestResults.length > 0 ? a.backtestResults[0].sharpeRatio : 0;
          valueB = b.backtestResults.length > 0 ? b.backtestResults[0].sharpeRatio : 0;
          break;
        case 'winRate':
          // Use the most recent backtest result
          valueA = a.backtestResults.length > 0 ? a.backtestResults[0].winRate : 0;
          valueB = b.backtestResults.length > 0 ? b.backtestResults[0].winRate : 0;
          break;
        case 'feePercentage':
          valueA = a.feePercentage;
          valueB = b.feePercentage;
          break;
        default:
          valueA = 0;
          valueB = 0;
      }
      
      return ascending ? valueA - valueB : valueB - valueA;
    });
  }

  /**
   * Search strategies by name or description
   */
  public searchStrategies(query: string): TradingStrategy[] {
    if (!query) {
      return this.strategies;
    }
    
    const lowerQuery = query.toLowerCase();
    return this.strategies.filter(strategy => 
      strategy.name.toLowerCase().includes(lowerQuery) ||
      strategy.description.toLowerCase().includes(lowerQuery) ||
      strategy.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      strategy.creatorName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get trending strategies (simplified implementation)
   */
  public getTrendingStrategies(limit: number = 5): TradingStrategy[] {
    // In a real implementation, this would use actual metrics like
    // recent subscription growth, performance, etc.
    // For this example, we'll simply sort by active users and return top N
    return this.sortStrategies(this.strategies, 'activeUsers').slice(0, limit);
  }

  /**
   * Get top performing strategies
   */
  public getTopPerformingStrategies(
    timeframe: BacktestTimespan = BacktestTimespan.THREE_MONTHS,
    limit: number = 5
  ): TradingStrategy[] {
    // Filter strategies that have backtest results for the specified timeframe
    const filteredStrategies = this.strategies.filter(strategy => 
      strategy.backtestResults.some(result => result.timespan === timeframe)
    );
    
    // Sort by total return from the relevant backtest period
    return [...filteredStrategies].sort((a, b) => {
      const resultA = a.backtestResults.find(result => result.timespan === timeframe);
      const resultB = b.backtestResults.find(result => result.timespan === timeframe);
      
      const returnA = resultA ? resultA.totalReturn : 0;
      const returnB = resultB ? resultB.totalReturn : 0;
      
      return returnB - returnA;
    }).slice(0, limit);
  }

  /**
   * Get recommended strategies based on user profile (simplified)
   */
  public getRecommendedStrategies(
    riskTolerance: RiskLevel,
    preferredTimeHorizon: TimeHorizon,
    limit: number = 3
  ): TradingStrategy[] {
    // Filter strategies matching user preferences
    const matchingStrategies = this.strategies.filter(strategy => {
      // Match risk level (allow one level higher or lower)
      const riskLevels = [riskTolerance];
      if (riskTolerance === RiskLevel.LOW) {
        riskLevels.push(RiskLevel.MEDIUM);
      } else if (riskTolerance === RiskLevel.MEDIUM) {
        riskLevels.push(RiskLevel.LOW, RiskLevel.HIGH);
      } else if (riskTolerance === RiskLevel.HIGH) {
        riskLevels.push(RiskLevel.MEDIUM, RiskLevel.VERY_HIGH);
      } else {
        riskLevels.push(RiskLevel.HIGH);
      }
      
      // Match time horizon (exact match only)
      const timeHorizons = [preferredTimeHorizon];
      
      return riskLevels.includes(strategy.riskLevel) && 
             timeHorizons.includes(strategy.timeHorizon);
    });
    
    // Sort by a combination of factors (this is a simplified scoring system)
    return matchingStrategies.sort((a, b) => {
      // Calculate a score based on multiple factors
      const getScore = (strategy: TradingStrategy): number => {
        // Start with sharpe ratio (higher is better)
        const mostRecentBacktest = strategy.backtestResults[0] || { sharpeRatio: 0, totalReturn: 0, winRate: 0 };
        let score = mostRecentBacktest.sharpeRatio * 10;
        
        // Add bonus for verified strategies
        if (strategy.verified) score += 5;
        
        // Consider active users (popularity)
        score += Math.log10(strategy.activeUsers) * 2;
        
        // Consider TVL (more TVL = more trust)
        score += Math.log10(strategy.tvl / 10000) * 3;
        
        // Penalize high fees
        score -= strategy.feePercentage;
        score -= strategy.performanceFee / 10;
        
        return score;
      };
      
      return getScore(b) - getScore(a);
    }).slice(0, limit);
  }

  /**
   * Subscribe to a strategy
   * In a real implementation, this would interact with the on-chain contract
   */
  public async subscribeToStrategy(
    strategyId: string,
    userAddress: string,
    investmentAmount: number
  ): Promise<boolean> {
    const strategy = this.getStrategyById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy with ID ${strategyId} not found`);
    }
    
    if (strategy.minInvestment && investmentAmount < strategy.minInvestment) {
      throw new Error(`Minimum investment is ${strategy.minInvestment}`);
    }
    
    // In a real implementation, this would call a smart contract function
    // to subscribe the user to the strategy
    console.log(`User ${userAddress} subscribed to strategy ${strategyId} with ${investmentAmount}`);
    
    // Simulate successful subscription
    return true;
  }

  /**
   * Unsubscribe from a strategy
   */
  public async unsubscribeFromStrategy(
    strategyId: string,
    userAddress: string
  ): Promise<boolean> {
    const strategy = this.getStrategyById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy with ID ${strategyId} not found`);
    }
    
    // In a real implementation, this would call a smart contract function
    // to unsubscribe the user from the strategy
    console.log(`User ${userAddress} unsubscribed from strategy ${strategyId}`);
    
    // Simulate successful unsubscription
    return true;
  }

  /**
   * Get user's active strategy subscriptions
   */
  public async getUserSubscriptions(userAddress: string): Promise<TradingStrategy[]> {
    // In a real implementation, this would fetch on-chain data
    // to determine which strategies the user is subscribed to
    
    // For demo purposes, return some sample strategies
    return [
      this.getStrategyById('conservative-ai-portfolio')!,
      this.getStrategyById('multi-factor-ai')!
    ].filter(Boolean);
  }
}

export default StrategyMarketplaceService;
      //