import React, { useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  RefreshCw, 
  ArrowRightLeft, 
  TrendingUp, 
  AlertCircle, 
  PieChart,
  BarChart3,
  LineChart,
  Diamond,
  AlertTriangle
} from 'lucide-react';
import usePortfolio, { PortfolioAsset } from '@/hooks/usePortfolio';
import useMarketData from '@/hooks/useMarketData';
import { useTradingNotifications } from '@/hooks/useTradingNotifications';
import { HermesClient } from '@pythnetwork/hermes-client';
import { AIOptimizationService, RiskProfile, StrategyRecommendation } from '@/services/AIOptimizationService';
import { DeFiStrategy, DeFiRiskLevel, ProtocolType } from '@/services/DeFiStrategyService';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { Connection } from '@solana/web3.js';

interface AssetDistributionData {
  name: string;
  value: number;
  color: string;
}

interface PerformanceData {
  date: string;
  value: number;
}

interface RecommendationCardProps {
  recommendation: StrategyRecommendation;
  onSelectStrategy: (strategy: DeFiStrategy) => void;
}

interface PortfolioAnalyticsProps {
  connection: Connection;
}

// Helper function to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Helper function to format percentage
const formatPercentage = (value: number): string => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Helper function to truncate wallet address
const truncateAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Asset coloring based on performance
const getAssetColor = (performance: number): string => {
  if (performance > 10) return 'rgb(34, 197, 94)'; // Green
  if (performance > 0) return 'rgb(74, 222, 128)'; // Light green
  if (performance > -10) return 'rgb(252, 165, 165)'; // Light red
  return 'rgb(239, 68, 68)'; // Red
};

// Portfolio Asset Card Component
const AssetCard = ({ asset }: { asset: PortfolioAsset }) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            {asset.logoURI ? (
              <img src={asset.logoURI} alt={asset.symbol} className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                {asset.symbol.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-bold">{asset.symbol}</h3>
              <p className="text-xs text-gray-500">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(asset.usdValue)}</p>
            <div className="flex items-center text-xs">
              {asset.priceChange24h && asset.priceChange24h > 0 ? (
                <div className="flex items-center text-green-500">
                  <ArrowUpRight size={14} />
                  <span>{formatPercentage(asset.priceChange24h)}</span>
                </div>
              ) : (
                <div className="flex items-center text-red-500">
                  <ArrowDownRight size={14} />
                  <span>{formatPercentage(asset.priceChange24h || 0)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-sm mb-1">
            <span>Allocation</span>
            <span>{asset.allocation.toFixed(2)}%</span>
          </div>
          <Progress value={asset.allocation} max={100} className="h-2" />
          
          {asset.needsRebalancing && asset.targetAllocation !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center text-amber-500">
                  <AlertCircle size={14} className="mr-1" />
                  Target Allocation
                </span>
                <span>{asset.targetAllocation.toFixed(2)}%</span>
              </div>
              <Progress value={asset.targetAllocation} max={100} className="h-2 bg-gray-200" 
                        color={asset.targetAllocation > asset.allocation ? "bg-green-500" : "bg-red-500"} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Recommendation Card Component
const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation, onSelectStrategy }) => {
  // Helper function to get risk level badge color
  const getRiskLevelColor = (riskLevel: DeFiRiskLevel): string => {
    switch (riskLevel) {
      case DeFiRiskLevel.CONSERVATIVE:
        return "bg-blue-100 text-blue-800";
      case DeFiRiskLevel.MODERATE:
        return "bg-amber-100 text-amber-800";
      case DeFiRiskLevel.AGGRESSIVE:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Helper function to get protocol type badge
  const getProtocolTypeBadge = (type: ProtocolType): React.ReactNode => {
    let icon;
    let color;
    
    switch (type) {
      case ProtocolType.LENDING:
        icon = <ArrowRightLeft size={14} />;
        color = "bg-purple-100 text-purple-800";
        break;
      case ProtocolType.YIELD_FARMING:
        icon = <TrendingUp size={14} />;
        color = "bg-green-100 text-green-800";
        break;
      case ProtocolType.LIQUIDITY_PROVIDING:
        icon = <Diamond size={14} />;
        color = "bg-blue-100 text-blue-800";
        break;
      case ProtocolType.STAKING:
        icon = <BarChart3 size={14} />;
        color = "bg-amber-100 text-amber-800";
        break;
      default:
        icon = <AlertCircle size={14} />;
        color = "bg-gray-100 text-gray-800";
    }
    
    return (
      <Badge variant="outline" className={`${color} flex items-center gap-1`}>
        {icon}
        {type}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{recommendation.strategy.name}</CardTitle>
            <CardDescription className="line-clamp-2">{recommendation.strategy.description}</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <TrendingUp size={14} />
            {recommendation.strategy.estimatedApy.toFixed(2)}% APY
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className={getRiskLevelColor(recommendation.strategy.riskLevel)}>
            {recommendation.strategy.riskLevel}
          </Badge>
          {getProtocolTypeBadge(recommendation.strategy.protocolType)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Match Score</span>
            <span className="font-semibold">{recommendation.matchScore}/100</span>
          </div>
          <Progress value={recommendation.matchScore} max={100} className="h-2" />
          
          <div className="flex justify-between text-sm">
            <span>Recommended Allocation</span>
            <span className="font-semibold">{recommendation.recommendedAllocation}%</span>
          </div>
          
          <div className="mt-3 text-sm">
            <h4 className="font-semibold mb-1">Why this recommendation:</h4>
            <ul className="list-disc pl-5 space-y-1">
              {recommendation.reasonsForRecommendation.slice(0, 2).map((reason, index) => (
                <li key={index} className="text-gray-600">{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={() => onSelectStrategy(recommendation.strategy)}
        >
          View Strategy Details
        </Button>
      </CardFooter>
    </Card>
  );
};

// Portfolio Distribution Chart
const PortfolioDistributionChart = ({ assets }: { assets: PortfolioAsset[] }) => {
  const chartData = useMemo(() => {
    // Group small allocations as "Other"
    const threshold = 5; // 5% threshold for grouping
    const mainAssets: AssetDistributionData[] = [];
    let otherValue = 0;
    
    // Color palette
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
      '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
      '#84cc16', '#14b8a6', '#6366f1', '#d946ef'
    ];
    
    assets.forEach((asset, index) => {
      if (asset.allocation >= threshold) {
        mainAssets.push({
          name: asset.symbol,
          value: asset.allocation,
          color: colors[index % colors.length]
        });
      } else {
        otherValue += asset.allocation;
      }
    });
    
    // Add "Other" category if needed
    if (otherValue > 0) {
      mainAssets.push({
        name: 'Other',
        value: otherValue,
        color: '#9ca3af' // Gray color for "Other"
      });
    }
    
    return mainAssets;
  }, [assets]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
            labelLine={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Allocation']}
            labelFormatter={(index) => chartData[index as number].name}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Portfolio Performance Chart
const PortfolioPerformanceChart = ({ 
  performanceData 
}: { 
  performanceData: PerformanceData[] 
}) => {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={performanceData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Portfolio Value']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Main Portfolio Analytics Component
const PortfolioAnalyticsComponent: React.FC<PortfolioAnalyticsProps> = ({ connection }) => {
  const { publicKey, connected } = useWallet();
  
  const { 
    isLoading, 
    error, 
    assets, 
    analytics, 
    lastUpdated, 
    isRebalancing,
    refreshPortfolio,
    generateRebalancingRecommendations,
    executeRebalancing
  } = usePortfolio();
  
  const { trackTransaction, reportMarketEvent } = useTradingNotifications();
  
  // State for strategy recommendations
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<DeFiStrategy | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  
  // Generate sample performance data
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  
  // Create mock historical performance data if none is available
  useEffect(() => {
    if (analytics && analytics.totalValue > 0) {
      const generateMockPerformanceData = () => {
        const data: PerformanceData[] = [];
        const now = new Date();
        let currentValue = analytics.totalValue;
        
        // Generate data for the last 30 days
        for (let i = 30; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          
          // Random daily fluctuation between -3% and +3%
          const fluctuation = 1 + (Math.random() * 0.06 - 0.03);
          
          // Apply fluctuation to previous day's value
          if (i !== 30) { // Not the first day
            currentValue = currentValue * fluctuation;
          }
          
          data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: currentValue
          });
        }
        
        return data;
      };
      
      setPerformanceData(generateMockPerformanceData());
    }
  }, [analytics]);
  
  // Initialize AI service and fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!analytics || !assets.length) return;
      
      setIsLoadingRecommendations(true);
      
      try {
        // Get AI service instance
        const aiService = AIOptimizationService.getInstance();
        
        // Generate sample risk profile based on portfolio
        const sampleRiskProfile: RiskProfile = {
          riskTolerance: 'medium',
          investmentHorizon: 'medium',
          liquidityNeeds: 'medium',
          volatilityTolerance: 5,
          experienceLevel: 'intermediate'
        };
        
        setRiskProfile(sampleRiskProfile);
        
        // Analyze market conditions
        const marketCondition = await aiService.analyzeMarketConditions();
        
        // Generate sample strategies
        const strategies = await generateSampleStrategies();
        
        // Get recommendations
        const recs = await aiService.recommendStrategies(
          strategies,
          sampleRiskProfile,
          marketCondition
        );
        
        setRecommendations(recs);
      } catch (err) {
        console.error('Error fetching strategy recommendations:', err);
      } finally {
        setIsLoadingRecommendations(false);
      }
    };
    
    fetchRecommendations();
  }, [analytics, assets]);
  
  // Generate sample strategies for demonstration
  const generateSampleStrategies = async (): Promise<DeFiStrategy[]> => {
    return [
      {
        id: 'solend-main-usdc',
        name: 'Solend USDC Lending',
        description: 'Lend USDC on Solend to earn interest with low risk',
        protocolType: ProtocolType.LENDING,
        riskLevel: DeFiRiskLevel.CONSERVATIVE,
        tokens: [
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            symbol: 'USDC',
            allocation: 100
          }
        ],
        estimatedApy: 5.2,
        tvl: 128000000,
        userCount: 12500,
        creatorAddress: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
        protocolConfig: {
          platform: 'solend',
          programId: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
          collateralFactor: 0.8,
          maxUtilization: 0.9,
          autoCompound: true,
          autoRebalance: true,
          liquidationBuffer: 0.05,
          priceFeedIds: {
            'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'
          }
        },
        feePercentage: 0.1,
        minInvestment: 0
      },
      {
        id: 'marinade-sol-staking',
        name: 'Marinade SOL Staking',
        description: 'Stake SOL with Marinade to earn staking rewards and get liquid mSOL',
        protocolType: ProtocolType.STAKING,
        riskLevel: DeFiRiskLevel.CONSERVATIVE,
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112', // SOL
            symbol: 'SOL',
            allocation: 100
          }
        ],
        estimatedApy: 6.8,
        tvl: 256000000,
        userCount: 45000,
        creatorAddress: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
        protocolConfig: {
          platform: 'marinade',
          programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
          autoCompound: true,
          unstakeCooldown: 86400,
          priceFeedIds: {
            'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
            'MSOL': '0xc2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4'
          }
        },
        feePercentage: 0.3,
        minInvestment: 0
      },
      {
        id: 'raydium-sol-usdc-lp',
        name: 'Raydium SOL-USDC LP',
        description: 'Provide liquidity to the SOL-USDC pool on Raydium to earn trading fees and rewards',
        protocolType: ProtocolType.LIQUIDITY_PROVIDING,
        riskLevel: DeFiRiskLevel.MODERATE,
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112', // SOL
            symbol: 'SOL',
            allocation: 50
          },
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            symbol: 'USDC',
            allocation: 50
          }
        ],
        estimatedApy: 15.5,
        tvl: 87000000,
        userCount: 8200,
        creatorAddress: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr',
        protocolConfig: {
          platform: 'raydium',
          programId: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr',
          poolAddress: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
          rebalanceThreshold: 0.05,
          maxSlippage: 0.01,
          autoCompound: true,
          priceFeedIds: {
            'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
            'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'
          }
        },
        feePercentage: 0.25,
        minInvestment: 0
      },
      {
        id: 'jupiter-governance-staking',
        name: 'Jupiter Governance Staking',
        description: 'Stake JUP tokens to participate in governance and earn rewards',
        protocolType: ProtocolType.STAKING,
        riskLevel: DeFiRiskLevel.MODERATE,
        tokens: [
          {
            mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
            symbol: 'JUP',
            allocation: 100
          }
        ],
        estimatedApy: 8.7,
        tvl: 45000000,
        userCount: 5600,
        creatorAddress: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
        protocolConfig: {
          platform: 'jupiter',
          programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          autoCompound: false,
          unstakeCooldown: 259200, // 3 days
          priceFeedIds: {
            'JUP': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996'
          }
        },
        feePercentage: 0.0,
        minInvestment: 0
      },
      {
        id: 'orca-whirlpool-sol-msol',
        name: 'Orca SOL-mSOL Whirlpool',
        description: 'Provide concentrated liquidity to the SOL-mSOL pool on Orca for boosted returns',
        protocolType: ProtocolType.YIELD_FARMING,
        riskLevel: DeFiRiskLevel.AGGRESSIVE,
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112', // SOL
            symbol: 'SOL',
            allocation: 50
          },
          {
            mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
            symbol: 'mSOL',
            allocation: 50
          }
        ],
        estimatedApy: 24.8,
        tvl: 23000000,
        userCount: 1850,
        creatorAddress: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
        protocolConfig: {
          platform: 'orca',
          programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
          poolAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm',
          harvestFrequency: 86400, // Daily
          autoCompound: true,
          maxSlippage: 0.01,
          priceFeedIds: {
            'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
            'MSOL': '0xc2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4'
          }
        },
        feePercentage: 0.3,
        minInvestment: 0
      }
    ];
  };
  
  // Handler for refreshing portfolio data
  const handleRefresh = () => {
    refreshPortfolio();
  };
  
  // Handler for rebalancing portfolio
  const handleRebalance = async () => {
    try {
      await generateRebalancingRecommendations();
    } catch (err) {
      console.error('Error generating rebalance recommendations:', err);
    }
  };
  
  // Handler for executing rebalancing
  const handleExecuteRebalancing = async () => {
    try {
      await executeRebalancing();
    } catch (err) {
      console.error('Error executing rebalancing:', err);
    }
  };
  
  // Handler for strategy selection
  const handleSelectStrategy = (strategy: DeFiStrategy) => {
    setSelectedStrategy(strategy);
  };
  
  // Test fetching a price from Pyth
  const fetchPythPrice = async () => {
    try {
      const hermesClient = new HermesClient("https://hermes.pyth.network/", {});
      
      // Get SOL price from Pyth
      const priceUpdates = await hermesClient.getLatestPriceUpdates([
        "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" // SOL/USD
      ]);
      
      if (priceUpdates.parsed && priceUpdates.parsed.length > 0) {
        const solPrice = priceUpdates.parsed[0].price;
        console.log("SOL Price from Pyth:", solPrice);
        
        // Report market event for demonstration
        reportMarketEvent({
          type: 'priceMove',
          token: 'So11111111111111111111111111111111111111112',
          tokenSymbol: 'SOL',
          message: `SOL price is now $${(Number(solPrice.price) * Math.pow(10, Number(solPrice.expo))).toFixed(2)}`
        });
      }
    } catch (err) {
      console.error('Error fetching Pyth price:', err);
    }
  };
  
  // Calculate total assets needing rebalancing
  const assetsNeedingRebalance = assets.filter(asset => asset.needsRebalancing).length;
  
  if (!connected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Portfolio Analytics</CardTitle>
          <CardDescription>Connect your wallet to view your portfolio</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Wallet size={48} className="text-gray-400 mb-4" />
          <p className="text-center text-gray-500">Connect your wallet to see your portfolio analytics and get personalized DeFi recommendations</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header Card */}
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <CardTitle>Portfolio Analytics</CardTitle>
              <CardDescription>
                {publicKey && `Wallet: ${truncateAddress(publicKey.toString())}`}
              </CardDescription>
            </div>
            <div className="mt-2 sm:mt-0 flex items-center">
              <Button 
                variant="outline" 
                className="mr-2 flex items-center" 
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw size={16} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="default" 
                className="flex items-center" 
                onClick={handleRebalance}
                disabled={isLoading || isRebalancing}
              >
                <ArrowRightLeft size={16} className="mr-1" />
                Rebalance
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="text-center p-4 text-red-500">
              <AlertTriangle size={24} className="mx-auto mb-2" />
              <p>Error loading portfolio data: {error.message}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow">
                  <p className="text-sm text-gray-500 mb-1">Total Portfolio Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</p>
                  <div className="flex items-center mt-1">
                    {analytics.changePercentage24h >= 0 ? (
                      <div className="flex items-center text-green-500 text-sm">
                        <ArrowUpRight size={14} className="mr-1" />
                        <span>{formatPercentage(analytics.changePercentage24h)}</span>
                        <span className="text-gray-500 ml-1">24h</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500 text-sm">
                        <ArrowDownRight size={14} className="mr-1" />
                        <span>{formatPercentage(analytics.changePercentage24h)}</span>
                        <span className="text-gray-500 ml-1">24h</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 shadow">
                  <p className="text-sm text-gray-500 mb-1">Asset Diversity</p>
                  <p className="text-2xl font-bold">{assets.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Tracked tokens</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 shadow">
                  <p className="text-sm text-gray-500 mb-1">SOL Price</p>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.solPrice)}</p>
                  <div className="flex items-center mt-1">
                    {assets.find(a => a.symbol === 'SOL')?.priceChange24h! >= 0 ? (
                      <div className="flex items-center text-green-500 text-sm">
                        <ArrowUpRight size={14} className="mr-1" />
                        <span>{formatPercentage(assets.find(a => a.symbol === 'SOL')?.priceChange24h || 0)}</span>
                        <span className="text-gray-500 ml-1">24h</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500 text-sm">
                        <ArrowDownRight size={14} className="mr-1" />
                        <span>{formatPercentage(assets.find(a => a.symbol === 'SOL')?.priceChange24h || 0)}</span>
                        <span className="text-gray-500 ml-1">24h</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {assetsNeedingRebalance > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle size={20} className="text-amber-500 mr-2" />
                    <div>
                      <p className="font-medium text-amber-800">Portfolio Rebalance Recommended</p>
                      <p className="text-sm text-amber-700">
                        {assetsNeedingRebalance} assets need rebalancing to optimize your portfolio
                      </p>
                    </div>
                    <Button 
                      className="ml-auto" 
                      onClick={handleExecuteRebalancing}
                      disabled={isRebalancing}
                    >
                      {isRebalancing ? 'Rebalancing...' : 'Execute Rebalance'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Tabs for Portfolio Analytics */}
      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="assets" className="flex items-center">
            <Wallet size={16} className="mr-2" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center">
            <LineChart size={16} className="mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center">
            <PieChart size={16} className="mr-2" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center">
            <TrendingUp size={16} className="mr-2" />
            Recommendations
          </TabsTrigger>
        </TabsList>
        
        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <>
              {assets.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Wallet size={48} className="text-gray-300 mb-2" />
                    <h3 className="text-lg font-medium">No assets found</h3>
                    <p className="text-gray-500 mt-1">
                      Your wallet doesn't have any token balances to display.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <AssetCard key={asset.mint} asset={asset} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Performance</CardTitle>
              <CardDescription>Historical performance of your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  {performanceData.length > 0 ? (
                    <PortfolioPerformanceChart performanceData={performanceData} />
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <p className="text-gray-500">Not enough data to display performance chart</p>
                    </div>
                  )}
                </>
              )}
              <div className="mt-4 text-xs text-gray-500">
                <p>
                  Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'}
                </p>
                <p>
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-xs" 
                    onClick={fetchPythPrice}
                  >
                    Test Pyth Price Feed
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Distribution Tab */}
        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Asset Distribution</CardTitle>
              <CardDescription>Breakdown of your portfolio by asset</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  {assets.length > 0 ? (
                    <PortfolioDistributionChart assets={assets} />
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <p className="text-gray-500">No assets to display in distribution chart</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Strategy Recommendations</CardTitle>
              <CardDescription>
                Personalized DeFi strategies based on your risk profile and current market conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRecommendations ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {recommendations.length === 0 ? (
                    <div className="text-center py-8">
                      <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium mb-2">No recommendations available</h3>
                      <p className="text-gray-500 max-w-md mx-auto mb-4">
                        We need more data about your portfolio to generate personalized recommendations.
                      </p>
                      <Button onClick={handleRefresh}>
                        Refresh Portfolio
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {riskProfile && (
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <h3 className="font-medium text-blue-800 mb-1">Your Risk Profile</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-blue-700">
                            <div>
                              <span className="font-medium">Risk Tolerance:</span> {riskProfile.riskTolerance}
                            </div>
                            <div>
                              <span className="font-medium">Investment Horizon:</span> {riskProfile.investmentHorizon}
                            </div>
                            <div>
                              <span className="font-medium">Liquidity Needs:</span> {riskProfile.liquidityNeeds}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-medium mb-2">Top Recommendations</h3>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {recommendations.slice(0, 4).map((recommendation) => (
                          <RecommendationCard
                            key={recommendation.strategy.id}
                            recommendation={recommendation}
                            onSelectStrategy={handleSelectStrategy}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Strategy Details Modal would go here in a full implementation */}
      
      {lastUpdated && (
        <div className="text-xs text-gray-500 text-right mt-2">
          Data last updated: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default PortfolioAnalyticsComponent;