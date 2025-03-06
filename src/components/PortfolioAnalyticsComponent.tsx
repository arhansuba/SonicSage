// src/components/PortfolioAnalyticsComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { DeFiStrategy, UserDeFiPosition } from '../services/DeFiStrategyService';
import { AIOptimizationService, MarketCondition } from '../services/AIOptimizationService';
import { SonicSVMService } from '../services/SonicSVMService';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/NotificationService';

interface PortfolioAnalyticsComponentProps {
  connection: Connection;
}

/**
 * Portfolio Analytics Component for visualizing and analyzing user's DeFi portfolio
 */
const PortfolioAnalyticsComponent: React.FC<PortfolioAnalyticsComponentProps> = ({ connection }) => {
  const { publicKey, connected } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  // Services
  const [aiService, setAiService] = useState<AIOptimizationService | null>(null);
  const [sonicService, setSonicService] = useState<SonicSVMService | null>(null);
  
  // Component state
  const [activeView, setActiveView] = useState<'overview' | 'performance' | 'allocation' | 'insights'>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userPositions, setUserPositions] = useState<UserDeFiPosition[]>([]);
  const [strategies, setStrategies] = useState<DeFiStrategy[]>([]);
  const [marketCondition, setMarketCondition] = useState<MarketCondition | null>(null);
  const [timeframe, setTimeframe] = useState<'1d' | '1w' | '1m' | '3m' | 'all'>('1m');
  
  // Portfolio metrics
  const [portfolioMetrics, setPortfolioMetrics] = useState<{
    totalValue: number;
    totalInvestment: number;
    totalReturns: number;
    returnPercentage: number;
    averageApy: number;
    riskScore: number;
    tokenAllocation: {name: string; value: number}[];
    protocolAllocation: {name: string; value: number}[];
    riskAllocation: {name: string; value: number}[];
  }>({
    totalValue: 0,
    totalInvestment: 0,
    totalReturns: 0,
    returnPercentage: 0,
    averageApy: 0,
    riskScore: 0,
    tokenAllocation: [],
    protocolAllocation: [],
    riskAllocation: []
  });
  
  // Performance data
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  
  // AI insights
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  
  // Initialize services
  useEffect(() => {
    setAiService(AIOptimizationService.getInstance());
    setSonicService(SonicSVMService.getInstance(connection));
  }, [connection]);
  
  // Load user data when wallet connects
  useEffect(() => {
    const loadUserData = async () => {
      if (!connected || !publicKey || !sonicService || !aiService) return;
      
      setIsLoading(true);
      
      try {
        // Load user positions
        const positions = await sonicService.getUserPositions(publicKey);
        setUserPositions(positions);
        
        // Load strategies
        // In a real app, we would fetch actual strategies
        const mockStrategies = generateMockStrategies();
        setStrategies(mockStrategies);
        
        // Get market condition
        const market = await aiService.analyzeMarketConditions();
        setMarketCondition(market);
        
        // Generate portfolio metrics
        calculatePortfolioMetrics(positions, mockStrategies);
        
        // Generate performance data
        generatePerformanceData(positions, timeframe);
        
        // Generate AI insights
        generateAiInsights(positions, mockStrategies, market);
      } catch (error) {
        console.error('Error loading user data:', error);
        notifyMarketEvent(
          'Error Loading Portfolio Data',
          'Failed to load your portfolio data. Please try again.',
          NotificationType.ERROR
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, [connected, publicKey, sonicService, aiService]);
  
  // Recalculate performance data when timeframe changes
  useEffect(() => {
    if (userPositions.length > 0) {
      generatePerformanceData(userPositions, timeframe);
    }
  }, [timeframe, userPositions]);
  
  // Calculate portfolio metrics
  const calculatePortfolioMetrics = (positions: UserDeFiPosition[], allStrategies: DeFiStrategy[]) => {
    if (positions.length === 0) return;
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.investmentValue, 0);
    const totalInvestment = positions.reduce((sum, pos) => sum + pos.initialInvestment, 0);
    const totalReturns = totalValue - totalInvestment;
    const returnPercentage = (totalReturns / totalInvestment) * 100;
    const averageApy = positions.reduce((sum, pos) => sum + pos.apy, 0) / positions.length;
    
    // Calculate risk score (weighted average based on position values)
    let weightedRiskScore = 0;
    positions.forEach(pos => {
      const strategy = allStrategies.find(s => s.id === pos.strategyId);
      if (strategy) {
        const riskValue = 
          strategy.riskLevel === 'conservative' ? 2 :
          strategy.riskLevel === 'moderate' ? 5 :
          strategy.riskLevel === 'aggressive' ? 8 : 10;
        
        weightedRiskScore += (pos.investmentValue / totalValue) * riskValue;
      }
    });
    
    // Calculate token allocation
    const tokenMap = new Map<string, number>();
    positions.forEach(pos => {
      pos.positions.forEach(position => {
        if (position.tokenA) {
          const currentValue = tokenMap.get(position.tokenA.symbol) || 0;
          tokenMap.set(position.tokenA.symbol, currentValue + position.tokenA.value);
        }
        if (position.tokenB) {
          const currentValue = tokenMap.get(position.tokenB.symbol) || 0;
          tokenMap.set(position.tokenB.symbol, currentValue + position.tokenB.value);
        }
      });
    });
    
    const tokenAllocation = Array.from(tokenMap.entries()).map(([name, value]) => ({
      name,
      value: (value / totalValue) * 100
    })).sort((a, b) => b.value - a.value);
    
    // Calculate protocol allocation
    const protocolMap = new Map<string, number>();
    positions.forEach(pos => {
      pos.positions.forEach(position => {
        const currentValue = protocolMap.get(position.protocol) || 0;
        const positionValue = (position.tokenA?.value || 0) + (position.tokenB?.value || 0);
        protocolMap.set(position.protocol, currentValue + positionValue);
      });
    });
    
    const protocolAllocation = Array.from(protocolMap.entries()).map(([name, value]) => ({
      name,
      value: (value / totalValue) * 100
    })).sort((a, b) => b.value - a.value);
    
    // Calculate risk allocation
    const riskMap = new Map<string, number>();
    positions.forEach(pos => {
      const strategy = allStrategies.find(s => s.id === pos.strategyId);
      if (strategy) {
        const riskLevel = strategy.riskLevel.charAt(0).toUpperCase() + strategy.riskLevel.slice(1);
        const currentValue = riskMap.get(riskLevel) || 0;
        riskMap.set(riskLevel, currentValue + pos.investmentValue);
      }
    });
    
    const riskAllocation = Array.from(riskMap.entries()).map(([name, value]) => ({
      name,
      value: (value / totalValue) * 100
    })).sort((a, b) => b.value - a.value);
    
    setPortfolioMetrics({
      totalValue,
      totalInvestment,
      totalReturns,
      returnPercentage,
      averageApy,
      riskScore: weightedRiskScore,
      tokenAllocation,
      protocolAllocation,
      riskAllocation
    });
  };
  
  // Generate performance data
  const generatePerformanceData = (positions: UserDeFiPosition[], timeframe: '1d' | '1w' | '1m' | '3m' | 'all') => {
    if (positions.length === 0) return;
    
    const now = new Date();
    const data: any[] = [];
    
    // Determine number of data points and interval based on timeframe
    let days = 0;
    let interval = 1;
    
    switch (timeframe) {
      case '1d':
        days = 1;
        interval = 1/24; // hourly
        break;
      case '1w':
        days = 7;
        interval = 1; // daily
        break;
      case '1m':
        days = 30;
        interval = 1; // daily
        break;
      case '3m':
        days = 90;
        interval = 3; // every 3 days
        break;
      case 'all':
        // Find earliest subscription date
        const earliestDate = Math.min(
          ...positions.map(pos => pos.subscriptionTime)
        );
        days = Math.max(90, Math.ceil((now.getTime() - earliestDate) / (24 * 60 * 60 * 1000)));
        interval = Math.max(1, Math.floor(days / 60)); // at most 60 data points
        break;
    }
    
    // Generate data points
    for (let i = 0; i <= days; i += interval) {
      const date = new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Calculate portfolio value at this date
      let portfolioValue = 0;
      
      positions.forEach(pos => {
        // Skip positions subscribed after this date
        if (pos.subscriptionTime > date.getTime()) return;
        
        // Calculate position value at this date
        const daysSinceSubscription = (date.getTime() - pos.subscriptionTime) / (24 * 60 * 60 * 1000);
        const dailyReturn = pos.apy / 365 / 100;
        const value = pos.initialInvestment * Math.pow(1 + dailyReturn, daysSinceSubscription);
        
        portfolioValue += value;
      });
      
      data.push({
        date: dateStr,
        value: portfolioValue.toFixed(2)
      });
    }
    
    setPerformanceData(data);
  };
  
  // Generate AI insights
  const generateAiInsights = (
    positions: UserDeFiPosition[],
    allStrategies: DeFiStrategy[],
    market: MarketCondition
  ) => {
    if (positions.length === 0) return;
    
    const insights = [];
    
    // Portfolio diversification insight
    const tokenCount = new Set(positions.flatMap(pos => 
      pos.positions.flatMap(p => [p.tokenA?.symbol, p.tokenB?.symbol].filter(Boolean))
    )).size;
    
    const protocolCount = new Set(positions.flatMap(pos => 
      pos.positions.map(p => p.protocol)
    )).size;
    
    if (tokenCount < 4) {
      insights.push({
        type: 'diversification',
        title: 'Low Token Diversification',
        description: `Your portfolio only contains ${tokenCount} unique tokens. Consider adding more assets to reduce concentration risk.`,
        score: 3,
        recommendations: [
          'Add stable tokens like USDC to reduce volatility',
          'Consider liquid staking derivatives like mSOL or jitoSOL',
          'Explore blue-chip tokens from the Solana ecosystem'
        ]
      });
    } else {
      insights.push({
        type: 'diversification',
        title: 'Good Token Diversification',
        description: `Your portfolio contains ${tokenCount} unique tokens, providing good diversification across assets.`,
        score: 8,
        recommendations: [
          'Continue maintaining a diverse token allocation',
          'Consider rebalancing to your target allocations periodically'
        ]
      });
    }
    
    // Risk assessment insight
    const riskLevel = 
      portfolioMetrics.riskScore < 3 ? 'very conservative' :
      portfolioMetrics.riskScore < 5 ? 'conservative' :
      portfolioMetrics.riskScore < 7 ? 'moderate' :
      portfolioMetrics.riskScore < 9 ? 'aggressive' : 'very aggressive';
    
    insights.push({
      type: 'risk',
      title: 'Portfolio Risk Assessment',
      description: `Your portfolio has a ${riskLevel} risk profile with a score of ${portfolioMetrics.riskScore.toFixed(1)}/10.`,
      score: riskLevel === 'moderate' ? 7 : 5,
      recommendations: 
        riskLevel === 'very conservative' ? [
          'Consider adding some moderate risk positions for higher returns',
          'Explore yield farming strategies with blue-chip tokens',
          'Increase allocation to liquid staking derivatives'
        ] : riskLevel === 'very aggressive' ? [
          'Add some conservative positions to reduce overall risk',
          'Consider taking profits from highly volatile assets',
          'Increase stablecoin allocation as a safety measure'
        ] : [
          'Your risk level appears balanced for steady returns',
          'Consider regular rebalancing to maintain this profile',
          'Adjust based on market conditions and risk tolerance'
        ]
    });
    
    // Market alignment insight
    const marketTrend = market.marketTrend;
    const volatilityIndex = market.volatilityIndex;
    
    let alignmentScore = 6; // Default moderate alignment
    
    if (marketTrend === 'bull' && portfolioMetrics.riskScore > 6) {
      alignmentScore = 9;
    } else if (marketTrend === 'bull' && portfolioMetrics.riskScore < 4) {
      alignmentScore = 4;
    } else if (marketTrend === 'bear' && portfolioMetrics.riskScore > 6) {
      alignmentScore = 3;
    } else if (marketTrend === 'bear' && portfolioMetrics.riskScore < 4) {
      alignmentScore = 8;
    }
    
    insights.push({
      type: 'market_alignment',
      title: 'Market Alignment Analysis',
      description: `Your portfolio is ${alignmentScore > 7 ? 'well aligned' : alignmentScore > 5 ? 'moderately aligned' : 'not well aligned'} with current market conditions (${marketTrend}ish, volatility: ${volatilityIndex.toFixed(1)}/10).`,
      score: alignmentScore,
      recommendations: 
        marketTrend === 'bull' && alignmentScore < 5 ? [
          'Consider increasing exposure to growth assets to capitalize on bullish momentum',
          'Explore liquidity providing strategies for higher returns',
          'Reduce stablecoin allocation temporarily'
        ] : marketTrend === 'bear' && alignmentScore < 5 ? [
          'Consider reducing exposure to high-risk assets temporarily',
          'Increase lending positions to generate stable income',
          'Add stablecoin positions as a hedge against volatility'
        ] : [
          'Continue monitoring market conditions for potential adjustments',
          'Regular rebalancing will help maintain alignment',
          'Consider small tactical adjustments based on shorter-term trends'
        ]
    });
    
    // Performance insight
    const portfolioReturn = portfolioMetrics.returnPercentage;
    
    insights.push({
      type: 'performance',
      title: 'Performance Analysis',
      description: `Your portfolio has ${portfolioReturn >= 0 ? 'gained' : 'lost'} ${Math.abs(portfolioReturn).toFixed(2)}% with an average APY of ${portfolioMetrics.averageApy.toFixed(2)}%.`,
      score: portfolioReturn > 10 ? 9 : portfolioReturn > 0 ? 6 : 3,
      recommendations: 
        portfolioReturn < 0 ? [
          'Consider repositioning underperforming assets',
          'Evaluate whether losses are due to temporary market conditions or structural issues',
          'Look for higher-yielding opportunities with similar risk profiles'
        ] : portfolioReturn < 5 ? [
          'Your returns are positive but could be optimized',
          'Consider strategies with higher APY while maintaining your risk profile',
          'Evaluate fee structures of current positions'
        ] : [
          'Your portfolio is performing well',
          'Continue monitoring to ensure sustainable returns',
          'Consider taking some profits from best performers'
        ]
    });
    
    // Opportunity insight
    insights.push({
      type: 'opportunity',
      title: 'AI-Identified Opportunities',
      description: 'Based on your portfolio and current market conditions, our AI has identified potential opportunities to optimize returns.',
      score: 7,
      recommendations: [
        market.marketTrend === 'bull' ? 
          'Consider adding exposure to Solana liquid staking derivatives for strong passive yields' : 
          'Lending markets currently offer attractive risk-adjusted returns',
        volatilityIndex > 7 ? 
          'Volatility is high - consider options strategies to capitalize on price movements' :
          'Market volatility is moderate - liquidity provision could offer stable returns',
        'The JUP/SOL liquidity pair is currently offering above-average returns with reasonable risk'
      ]
    });
    
    setAiInsights(insights);
  };
  
  // Generate mock strategies
  const generateMockStrategies = (): DeFiStrategy[] => {
    return [
      {
        id: 'strategy_001',
        name: 'Safe Stablecoin Yield',
        description: 'A conservative strategy focusing on generating stable yield from USDC and other stablecoins using lending protocols and staking.',
        protocolType: 'lending',
        riskLevel: 'conservative',
        estimatedApy: 800, // 8.00%
        tags: ['Stablecoin', 'Income', 'Safe', 'Lending'],
        tvl: 2450000, // $2.45M
        userCount: 156,
        creatorAddress: 'Sonic3pXG67xdWbxCSx4pRDyQMvCtr6bwYRodnsFYGNPq',
        lockupPeriod: 7,
        minInvestment: 10, // $10
        feePercentage: 20, // 0.2%
        tokens: [
          { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', allocation: 60 },
          { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', allocation: 30 },
          { symbol: 'DAI', mint: 'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o', allocation: 10 }
        ],
        verified: true,
        protocols: {
          'Solend': 45,
          'Tulip': 35,
          'Marinade': 20
        }
      },
      {
        id: 'strategy_002',
        name: 'Balanced SOL Maximizer',
        description: 'A balanced strategy that maximizes yield from SOL and SOL liquid staking derivatives while maintaining moderate risk exposure.',
        protocolType: 'staking',
        riskLevel: 'moderate',
        estimatedApy: 1500, // 15.00%
        tags: ['Solana', 'Staking', 'Moderate', 'LSD'],
        tvl: 4750000, // $4.75M
        userCount: 312,
        creatorAddress: 'Sonic7ZKBqAEHHFQgVcKKTYDjKDA5wTGMnHLgAn6MwFAh',
        lockupPeriod: 14,
        minInvestment: 25, // $25
        feePercentage: 30, // 0.3%
        tokens: [
          { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', allocation: 40 },
          { symbol: 'mSOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfXcJm7So', allocation: 35 },
          { symbol: 'jitoSOL', mint: 'jito1ncmFPJNq2L6XNtyJPFwN7ULxo5rkWjz6w8gqgG', allocation: 25 }
        ],
        verified: true,
        protocols: {
          'Marinade': 35,
          'Jito': 25,
          'Lido': 20,
          'Solana Staking': 20
        }
      },
      {
        id: 'strategy_003',
        name: 'DeFi Blue Chip Alpha',
        description: 'An aggressive strategy targeting high APY through a combination of blue-chip DeFi protocols on Solana, optimized for maximum returns.',
        protocolType: 'yield_farming',
        riskLevel: 'aggressive',
        estimatedApy: 3500, // 35.00%
        tags: ['Yield', 'LP', 'Aggressive', 'Farming'],
        tvl: 1250000, // $1.25M
        userCount: 98,
        creatorAddress: 'SonicDXYi8n1Mt9edjcnJLHNQpyJKbXWK5hcZBtJ6GHK9',
        lockupPeriod: 30,
        minInvestment: 100, // $100
        feePercentage: 50, // 0.5%
        tokens: [
          { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', allocation: 30 },
          { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', allocation: 30 },
          { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', allocation: 20 },
          { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', allocation: 20 }
        ],
        verified: true,
        protocols: {
          'Raydium': 30,
          'Orca': 30,
          'Jupiter': 25,
          'Drift': 15
        }
      }
    ];
  };
  
  // Color schemes for charts
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
  const RISK_COLORS = {
    'Conservative': '#10B981',
    'Moderate': '#3B82F6',
    'Aggressive': '#F59E0B',
    'Experimental': '#EF4444'
  };
  
  // Formatter for currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Render the not connected state
  if (!connected) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center py-16">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect your wallet</h2>
        <p className="text-gray-600 mb-6">Please connect your wallet to view your portfolio analytics</p>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Connect Wallet
        </button>
      </div>
    );
  }
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Portfolio Data</h2>
        <p className="text-gray-600">Fetching your positions and analyzing performance...</p>
      </div>
    );
  }
  
  // Render empty state
  if (userPositions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center py-16">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Portfolio Positions</h2>
        <p className="text-gray-600 mb-6">You don't have any active DeFi positions yet</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Explore Strategies
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            Create Strategy
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Portfolio header */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Portfolio Analytics</h2>
          <p className="text-gray-600 mt-1">AI-powered insights and visualization of your DeFi portfolio</p>
        </div>
        
        <div className="px-6 py-4 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(portfolioMetrics.totalValue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Return</p>
              <p className={`text-lg font-semibold ${portfolioMetrics.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(portfolioMetrics.totalReturns)} ({portfolioMetrics.returnPercentage.toFixed(2)}%)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average APY</p>
              <p className="text-lg font-semibold text-green-600">{portfolioMetrics.averageApy.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Positions</p>
              <p className="text-lg font-semibold text-gray-900">{userPositions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Risk Score</p>
              <p className="text-lg font-semibold text-gray-900">{portfolioMetrics.riskScore.toFixed(1)}/10</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* View tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              className={`${
                activeView === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex-1 text-center`}
              onClick={() => setActiveView('overview')}
            >
              Overview
            </button>
            <button
              className={`${
                activeView === 'performance'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex-1 text-center`}
              onClick={() => setActiveView('performance')}
            >
              Performance
            </button>
            <button
              className={`${
                activeView === 'allocation'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex-1 text-center`}
              onClick={() => setActiveView('allocation')}
            >
              Allocation
            </button>
            <button
              className={`${
                activeView === 'insights'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex-1 text-center`}
              onClick={() => setActiveView('insights')}
            >
              AI Insights
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {/* Overview View */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Performance Chart */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Performance</h3>
                    <div className="flex space-x-2">
                      {(['1w', '1m', '3m', 'all'] as const).map((tf) => (
                        <button
                          key={tf}
                          className={`px-2 py-1 text-xs rounded ${
                            timeframe === tf ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'
                          }`}
                          onClick={() => setTimeframe(tf)}
                        >
                          {tf === '1w' ? '1W' : tf === '1m' ? '1M' : tf === '3m' ? '3M' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={performanceData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => [formatCurrency(parseFloat(value as string)), 'Value']} />
                        <Area type="monotone" dataKey="value" stroke="#4F46E5" fill="#C7D2FE" fillOpacity={0.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Allocation Chart */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Asset Allocation</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioMetrics.tokenAllocation}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {portfolioMetrics.tokenAllocation.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Allocation']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Positions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Your Positions</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">APY</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscribed</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userPositions.map((position) => {
                        const strategy = strategies.find(s => s.id === position.strategyId);
                        return (
                          <tr key={position.strategyId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">{strategy?.name || 'Unknown Strategy'}</div>
                              <div className="text-sm text-gray-500">{
                                strategy?.protocolType === 'lending' ? 'Lending' :
                                strategy?.protocolType === 'liquidity_providing' ? 'Liquidity Providing' :
                                strategy?.protocolType === 'yield_farming' ? 'Yield Farming' :
                                strategy?.protocolType === 'staking' ? 'Staking' : 'Options'
                              }</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(position.investmentValue)}</div>
                              <div className="text-xs text-gray-500">
                                {((position.investmentValue / portfolioMetrics.totalValue) * 100).toFixed(1)}% of portfolio
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${position.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(position.returns)}
                              </div>
                              <div className={`text-xs ${position.returns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {((position.returns / position.initialInvestment) * 100).toFixed(2)}%
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-green-600">{position.apy.toFixed(2)}%</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                strategy?.riskLevel === 'conservative' ? 'bg-green-100 text-green-800' :
                                strategy?.riskLevel === 'moderate' ? 'bg-blue-100 text-blue-800' :
                                strategy?.riskLevel === 'aggressive' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {strategy?.riskLevel.charAt(0).toUpperCase() + (strategy?.riskLevel.slice(1) || '')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(position.subscriptionTime).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* AI Insight Summary */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">AI Portfolio Insight</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>Based on our AI analysis, your portfolio is {
                        portfolioMetrics.riskScore < 4 ? 'conservatively positioned' :
                        portfolioMetrics.riskScore < 7 ? 'moderately positioned' : 'aggressively positioned'
                      } with a {
                        marketCondition?.marketTrend === 'bull' ? 'bullish' :
                        marketCondition?.marketTrend === 'bear' ? 'bearish' : 'neutral'
                      } market alignment. {
                        portfolioMetrics.returnPercentage >= 10 ? 'Performance is strong with above-average returns.' :
                        portfolioMetrics.returnPercentage >= 0 ? 'Performance is positive but could be optimized.' :
                        'Performance needs attention with negative returns.'
                      }</p>
                    </div>
                    <div className="mt-3">
                      <button
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        onClick={() => setActiveView('insights')}
                      >
                        View Detailed Insights →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Performance View */}
          {activeView === 'performance' && (
            <div className="space-y-6">
              {/* Performance Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Performance History</h3>
                  <div className="flex space-x-2">
                    {(['1d', '1w', '1m', '3m', 'all'] as const).map((tf) => (
                      <button
                        key={tf}
                        className={`px-2 py-1 text-xs rounded ${
                          timeframe === tf ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'
                        }`}
                        onClick={() => setTimeframe(tf)}
                      >
                        {tf === '1d' ? '1D' : tf === '1w' ? '1W' : tf === '1m' ? '1M' : tf === '3m' ? '3M' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={performanceData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(parseFloat(value as string)), 'Value']} />
                      <Legend />
                      <Area type="monotone" dataKey="value" stroke="#4F46E5" fill="#C7D2FE" fillOpacity={0.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Return Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Strategy Returns Comparison</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={userPositions.map(pos => {
                          const strategy = strategies.find(s => s.id === pos.strategyId);
                          return {
                            name: strategy?.name || 'Unknown',
                            return: ((pos.investmentValue - pos.initialInvestment) / pos.initialInvestment) * 100,
                            apy: pos.apy
                          };
                        })}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${parseFloat(value as string).toFixed(2)}%`, 'Return']} />
                        <Legend />
                        <Bar dataKey="return" fill="#4F46E5" name="Actual Return %" />
                        <Bar dataKey="apy" fill="#10B981" name="APY %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Performance Metrics</h3>
                  
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">Total Portfolio Return</span>
                      <span className={`text-sm font-medium ${portfolioMetrics.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioMetrics.returnPercentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${portfolioMetrics.returnPercentage >= 0 ? 'bg-green-600' : 'bg-red-600'}`}
                        style={{ width: `${Math.min(100, Math.max(0, Math.abs(portfolioMetrics.returnPercentage)))}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Average APY</span>
                        <span className="text-sm font-medium text-green-600">{portfolioMetrics.averageApy.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-600"
                          style={{ width: `${Math.min(100, portfolioMetrics.averageApy * 2)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Risk Score</span>
                        <span className="text-sm font-medium text-gray-700">{portfolioMetrics.riskScore.toFixed(1)}/10</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            portfolioMetrics.riskScore < 3 ? 'bg-green-600' :
                            portfolioMetrics.riskScore < 6 ? 'bg-blue-600' :
                            portfolioMetrics.riskScore < 8 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${portfolioMetrics.riskScore * 10}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Best Performing Position</span>
                      <span className="text-sm font-medium text-green-600">
                        {(() => {
                          const bestPosition = [...userPositions].sort((a, b) => 
                            (b.investmentValue / b.initialInvestment) - (a.investmentValue / a.initialInvestment)
                          )[0];
                          const bestStrategy = strategies.find(s => s.id === bestPosition?.strategyId);
                          return bestStrategy?.name || 'N/A';
                        })()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Worst Performing Position</span>
                      <span className="text-sm font-medium text-red-600">
                        {(() => {
                          const worstPosition = [...userPositions].sort((a, b) => 
                            (a.investmentValue / a.initialInvestment) - (b.investmentValue / b.initialInvestment)
                          )[0];
                          const worstStrategy = strategies.find(s => s.id === worstPosition?.strategyId);
                          return worstStrategy?.name || 'N/A';
                        })()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Highest APY Position</span>
                      <span className="text-sm font-medium text-green-600">
                        {(() => {
                          const highestApyPosition = [...userPositions].sort((a, b) => b.apy - a.apy)[0];
                          const highestApyStrategy = strategies.find(s => s.id === highestApyPosition?.strategyId);
                          return highestApyStrategy?.name || 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Historical Performance */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Monthly Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Starting Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">APY</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Generate 6 months of mock data */}
                      {Array.from({ length: 6 }).map((_, i) => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - i);
                        const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        
                        // Generate random values for demonstration
                        const monthlyReturn = (Math.random() * 10) - 3; // Between -3% and 7%
                        const startValue = portfolioMetrics.totalValue / (1 + monthlyReturn / 100);
                        const endValue = portfolioMetrics.totalValue;
                        const monthlyApy = (Math.random() * 5) + 5; // Between 5% and 10%
                        
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(startValue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(endValue)}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {monthlyReturn.toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{monthlyApy.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Allocation View */}
          {activeView === 'allocation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Token Allocation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Token Allocation</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioMetrics.tokenAllocation}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {portfolioMetrics.tokenAllocation.map((entry, index) => (
                            <Cell key={`token-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Allocation']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Protocol Allocation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Protocol Allocation</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioMetrics.protocolAllocation}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {portfolioMetrics.protocolAllocation.map((entry, index) => (
                            <Cell key={`protocol-cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Allocation']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Risk Allocation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Risk Allocation</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioMetrics.riskAllocation}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {portfolioMetrics.riskAllocation.map((entry) => (
                            <Cell 
                              key={`risk-cell-${entry.name}`} 
                              fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS] || COLORS[0]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Allocation']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Token Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Asset Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocation</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">30d Change</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {portfolioMetrics.tokenAllocation.map((token, index) => {
                        // Generate random data for demonstration
                        const value = (portfolioMetrics.totalValue * token.value) / 100;
                        const change = (Math.random() * 40) - 15; // Between -15% and 25%
                        
                        return (
                          <tr key={token.name} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                  <span className="text-xs font-medium">{token.name.slice(0, 2)}</span>
                                </div>
                                <div className="text-sm font-medium text-gray-900">{token.name}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="h-2 rounded-full"
                                    style={{ 
                                      width: `${token.value}%`,
                                      backgroundColor: COLORS[index % COLORS.length]
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-900">{token.value.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(value)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Protocol Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Protocol Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {portfolioMetrics.protocolAllocation.map((protocol, index) => {
                    // Generate random data for demonstration
                    const value = (portfolioMetrics.totalValue * protocol.value) / 100;
                    const apy = 5 + Math.random() * 20; // Between 5% and 25%
                    
                    return (
                      <div key={protocol.name} className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium text-gray-900">{protocol.name}</h4>
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}
                          ></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-gray-500">Allocation</p>
                            <p className="text-sm font-medium">{protocol.value.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Value</p>
                            <p className="text-sm font-medium">{formatCurrency(value)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Avg APY</p>
                            <p className="text-sm font-medium text-green-600">{apy.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Positions</p>
                            <p className="text-sm font-medium">{1 + Math.floor(Math.random() * 3)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* AI Insights View */}
          {activeView === 'insights' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-indigo-900">AI Portfolio Analysis</h3>
                    <p className="mt-1 text-sm text-indigo-700">
                      Our AI has analyzed your DeFi portfolio and identified opportunities and risks based on your positions and current market conditions.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aiInsights.map((insight, index) => (
                  <div key={insight.type} className={`bg-white rounded-lg shadow overflow-hidden border-t-4 ${
                    insight.score >= 8 ? 'border-green-500' :
                    insight.score >= 6 ? 'border-blue-500' :
                    insight.score >= 4 ? 'border-yellow-500' : 'border-red-500'
                  }`}>
                    <div className="p-5">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{insight.title}</h3>
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 mr-2">Score:</span>
                          <div className="relative h-8 w-8 flex items-center justify-center">
                            <svg className="absolute inset-0 h-8 w-8" viewBox="0 0 36 36">
                              <circle
                                cx="18" cy="18" r="16"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="3"
                              />
                              <circle
                                cx="18" cy="18" r="16"
                                fill="none"
                                stroke={
                                  insight.score >= 8 ? '#10B981' :
                                  insight.score >= 6 ? '#3B82F6' :
                                  insight.score >= 4 ? '#F59E0B' : '#EF4444'
                                }
                                strokeWidth="3"
                                strokeDasharray={`${insight.score * 10.05} 100`}
                                strokeDashoffset="25"
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="text-xs font-semibold">{insight.score}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{insight.description}</p>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
                        <ul className="space-y-1 text-sm">
                          {insight.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start">
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-green-100 text-green-600 mr-2 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                              <span className="text-gray-700">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <button className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 px-4 rounded transition-colors">
                        Apply Recommendations
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Market Conditions */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Market Conditions</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Market Trend</span>
                      <span className={`font-medium text-sm ${
                        marketCondition?.marketTrend === 'bull' ? 'text-green-600' :
                        marketCondition?.marketTrend === 'bear' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {marketCondition?.marketTrend === 'bull' ? 'Bullish' :
                         marketCondition?.marketTrend === 'bear' ? 'Bearish' : 'Neutral'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Volatility</span>
                      <span className="font-medium text-sm">{marketCondition?.volatilityIndex.toFixed(1)}/10</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Solana Price</span>
                      <span className="font-medium text-sm">${marketCondition?.solanaPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Total DeFi TVL</span>
                      <span className="font-medium text-sm">${(marketCondition?.totalValueLocked || 0 / 1000000000).toFixed(2)}B</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">Market Advisory</h4>
                      <div className="mt-1 text-sm text-yellow-700">
                        <p>
                          {marketCondition?.marketTrend === 'bull'
                            ? 'The market is currently showing bullish momentum. Consider capitalizing on growth opportunities while maintaining risk controls.'
                            : marketCondition?.marketTrend === 'bear'
                            ? 'The market is in a bearish trend. Focus on capital preservation and consider increasing allocation to stable assets.'
                            : 'The market is in a neutral phase. This may be a good time for rebalancing and position optimization.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* AI Position Recommendations */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Position Recommendations</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Allocation</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recommended</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Impact</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userPositions.map((position) => {
                        const strategy = strategies.find(s => s.id === position.strategyId);
                        if (!strategy) return null;
                        
                        // Generate random recommendation data for demo
                        const currentAllocation = (position.investmentValue / portfolioMetrics.totalValue * 100).toFixed(1);
                        const action = Math.random() > 0.6 ? 'increase' : Math.random() > 0.3 ? 'decrease' : 'maintain';
                        const changeAmount = action === 'maintain' ? 0 : Math.floor(Math.random() * 10) + 1;
                        const recommendedAllocation = action === 'increase' 
                          ? (parseFloat(currentAllocation) + changeAmount).toFixed(1)
                          : action === 'decrease'
                          ? (Math.max(0, parseFloat(currentAllocation) - changeAmount)).toFixed(1)
                          : currentAllocation;
                        
                        const impactText = action === 'increase'
                          ? `+${(Math.random() * 2).toFixed(2)}% expected return`
                          : action === 'decrease'
                          ? `-${(Math.random() * 2).toFixed(2)}% portfolio risk`
                          : 'Optimal allocation';
                          
                        return (
                          <tr key={position.strategyId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">{strategy.name}</div>
                              <div className="text-xs text-gray-500">{strategy.protocolType}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {currentAllocation}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {recommendedAllocation}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                action === 'increase' ? 'bg-green-100 text-green-800' :
                                action === 'decrease' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {action === 'increase' ? '+ Increase' :
                                 action === 'decrease' ? '- Decrease' : '= Maintain'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {impactText}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Rebalance Portfolio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioAnalyticsComponent;