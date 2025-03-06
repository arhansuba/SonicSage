// src/components/DeFiStrategyComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/NotificationService';
import { 
  DeFiStrategyService, 
  DeFiStrategy, 
  UserDeFiPosition, 
  ProtocolType,
  DeFiRiskLevel
} from '../services/DeFiStrategyService';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface DeFiStrategyComponentProps {
  connection: Connection;
}

const DeFiStrategyComponent: React.FC<DeFiStrategyComponentProps> = ({ connection }) => {
  const { publicKey, connected } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  // Strategy service
  const [defiService, setDefiService] = useState<DeFiStrategyService | null>(null);
  
  // Component state
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'positions' | 'analytics'>('overview');
  const [strategies, setStrategies] = useState<DeFiStrategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<DeFiStrategy[]>([]);
  const [userPositions, setUserPositions] = useState<UserDeFiPosition[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<DeFiStrategy | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<UserDeFiPosition | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('USDC');
  
  // Filters
  const [selectedProtocolTypes, setSelectedProtocolTypes] = useState<ProtocolType[]>([]);
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<DeFiRiskLevel[]>([]);
  const [minApy, setMinApy] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Market data
  const [marketData, setMarketData] = useState<{
    lendingRates: any;
    farmingApys: any;
    liquidityPools: any;
  } | null>(null);

  // Initialize services
  useEffect(() => {
    const service = DeFiStrategyService.getInstance(connection);
    setDefiService(service);
    
    // Load strategies
    loadStrategies();
    
    // Load market data
    loadMarketData();
  }, [connection]);
  
  // Load user positions when wallet connects
  useEffect(() => {
    if (connected && publicKey && defiService) {
      loadUserPositions();
    } else {
      setUserPositions([]);
      setSelectedPosition(null);
    }
  }, [connected, publicKey, defiService]);
  
  // Load strategies from service
  const loadStrategies = async () => {
    try {
      setIsLoading(true);
      
      if (!defiService) {
        const service = DeFiStrategyService.getInstance(connection);
        setDefiService(service);
      }
      
      // Get all strategies
      const allStrategies = defiService?.getAllStrategies() || [];
      setStrategies(allStrategies);
      setFilteredStrategies(allStrategies);
      
      // Set default selected strategy if none is selected
      if (!selectedStrategy && allStrategies.length > 0) {
        setSelectedStrategy(allStrategies[0]);
      }
    } catch (error) {
      console.error('Error loading strategies:', error);
      notifyMarketEvent(
        'Error Loading Strategies',
        'Failed to load DeFi strategies. Please try again.',
        NotificationType.ERROR
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load user positions
  const loadUserPositions = async () => {
    if (!defiService || !publicKey) return;
    
    try {
      setIsLoading(true);
      const positions = await defiService.getUserPositions(publicKey.toString());
      setUserPositions(positions);
      
      // Set default selected position if none is selected
      if (!selectedPosition && positions.length > 0) {
        setSelectedPosition(positions[0]);
      }
    } catch (error) {
      console.error('Error loading user positions:', error);
      notifyMarketEvent(
        'Error Loading Positions',
        'Failed to load your DeFi positions. Please try again.',
        NotificationType.ERROR
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load market data
  const loadMarketData = async () => {
    if (!defiService) return;
    
    try {
      const data = await defiService.getMarketData();
      setMarketData(data);
    } catch (error) {
      console.error('Error loading market data:', error);
    }
  };
  
  // Apply filters to strategies
  const applyFilters = () => {
    if (!strategies) return;
    
    let filtered = [...strategies];
    
    // Filter by protocol type
    if (selectedProtocolTypes.length > 0) {
      filtered = filtered.filter(strategy => 
        selectedProtocolTypes.includes(strategy.protocolType)
      );
    }
    
    // Filter by risk level
    if (selectedRiskLevels.length > 0) {
      filtered = filtered.filter(strategy => 
        selectedRiskLevels.includes(strategy.riskLevel)
      );
    }
    
    // Filter by minimum APY
    if (minApy > 0) {
      filtered = filtered.filter(strategy => strategy.estimatedApy >= minApy);
    }
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(strategy => 
        strategy.name.toLowerCase().includes(query) ||
        strategy.description.toLowerCase().includes(query) ||
        strategy.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    setFilteredStrategies(filtered);
  };

  // Handle filter changes
  useEffect(() => {
    applyFilters();
  }, [selectedProtocolTypes, selectedRiskLevels, minApy, searchQuery, strategies]);

  // Toggle protocol type filter
  const toggleProtocolType = (type: ProtocolType) => {
    setSelectedProtocolTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  // Toggle risk level filter
  const toggleRiskLevel = (level: DeFiRiskLevel) => {
    setSelectedRiskLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level) 
        : [...prev, level]
    );
  };

  // Subscribe to a strategy
  const handleSubscribe = async () => {
    if (!defiService || !publicKey || !selectedStrategy) return;

    try {
      const amount = parseFloat(investmentAmount);
      if (isNaN(amount) || amount <= 0) {
        notifyMarketEvent(
          'Invalid Amount',
          'Please enter a valid investment amount',
          NotificationType.WARNING
        );
        return;
      }

      // Check minimum investment
      if (amount < selectedStrategy.minInvestment) {
        notifyMarketEvent(
          'Below Minimum Investment',
          `The minimum investment for this strategy is ${selectedStrategy.minInvestment}`,
          NotificationType.WARNING
        );
        return;
      }

      // Create investment amounts object based on selected token
      const investmentAmounts: {[key: string]: number} = {
        [selectedToken]: amount
      };

      await defiService.subscribeToStrategy(selectedStrategy.id, investmentAmounts);

      // Reset form and reload user positions
      setInvestmentAmount('');
      loadUserPositions();

      // Switch to positions tab
      setActiveTab('positions');
    } catch (error) {
      console.error('Error subscribing to strategy:', error);
    }
  };

  // Unsubscribe from a strategy
  const handleUnsubscribe = async (position: UserDeFiPosition) => {
    if (!defiService || !publicKey) return;

    try {
      await defiService.unsubscribeFromStrategy(position.strategyId);

      // Reload user positions
      loadUserPositions();

      // If the unsubscribed position was selected, clear selection
      if (selectedPosition?.strategyId === position.strategyId) {
        setSelectedPosition(null);
      }
    } catch (error) {
      console.error('Error unsubscribing from strategy:', error);
    }
  };

  // Harvest rewards
  const handleHarvest = async (position: UserDeFiPosition) => {
    if (!defiService || !publicKey) return;

    try {
      await defiService.harvestRewards(position.strategyId);

      // Reload user positions
      loadUserPositions();
    } catch (error) {
      console.error('Error harvesting rewards:', error);
    }
  };

  // Rebalance position
  const handleRebalance = async (position: UserDeFiPosition) => {
    if (!defiService || !publicKey) return;

    try {
      await defiService.rebalancePosition(position.strategyId);

      // Reload user positions
      loadUserPositions();
    } catch (error) {
      console.error('Error rebalancing position:', error);
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Get label for protocol type
  const getProtocolTypeLabel = (type: ProtocolType): string => {
    switch (type) {
      case 'lending':
        return 'Lending';
      case 'yield_farming':
        return 'Yield Farming';
      case 'liquidity_providing':
        return 'Liquidity Providing';
      case 'staking':
        return 'Staking';
      case 'options':
        return 'Options';
      default:
        return type;
    }
  };

  // Get label for risk level
  const getRiskLevelLabel = (level: DeFiRiskLevel): string => {
    switch (level) {
      case 'conservative':
        return 'Conservative';
      case 'moderate':
        return 'Moderate';
      case 'aggressive':
        return 'Aggressive';
      case 'experimental':
        return 'Experimental';
      default:
        return level;
    }
  };

  // Get color for risk level
  const getRiskLevelColor = (level: DeFiRiskLevel): string => {
    switch (level) {
      case 'conservative':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-blue-100 text-blue-800';
      case 'aggressive':
        return 'bg-yellow-100 text-yellow-800';
      case 'experimental':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generated random performance data for charts
  const generatePerformanceData = (days: number, volatility: number): any[] => {
    const data = [];
    let value = 100;

    for (let i = 0; i < days; i++) {
      // Random daily change with slight upward bias
      const change = (Math.random() - 0.48) * volatility;
      value = value * (1 + change / 100);

      data.push({
        day: i + 1,
        value: parseFloat(value.toFixed(2))
      });
    }

    return data;
  };

  // Generate APY comparison data
  const generateApyComparisonData = () => {
    if (!filteredStrategies || filteredStrategies.length === 0) return [];

    return filteredStrategies
      .slice(0, 10) // Take top 10 strategies
      .map(strategy => ({
        name: strategy.name,
        apy: strategy.estimatedApy / 100, // Convert basis points to percentage
        risk: strategy.riskLevel
      }));
  };

  // Render Overview Tab
  const renderOverviewTab = () => {
    const performanceData = generatePerformanceData(30, 1.5);
    const apyComparisonData = generateApyComparisonData();

    return (
      <div className="space-y-6">
        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-2">DeFi Market Overview</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Total Value Locked</span>
              <span className="font-medium">$28.5B</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Active Users</span>
              <span className="font-medium">1.2M</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Avg. APY</span>
              <span className="font-medium text-green-600">8.4%</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-2">Top Lending Rates</h3>
            {marketData && (
              <div className="space-y-2">
                {Object.entries(marketData.lendingRates.solend).slice(0, 3).map(([token, rates]: [string, any]) => (
                  <div key={token} className="flex justify-between items-center">
                    <span className="text-sm">{token}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-500">Supply</span>
                      <span className="font-medium text-green-600">{rates.supply}%</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-500">Borrow</span>
                      <span className="font-medium text-blue-600">{rates.borrow}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-2">Top Farming APYs</h3>
            {marketData && (
              <div className="space-y-2">
                {Object.entries(marketData.farmingApys.raydium).slice(0, 3).map(([pool, apy]: [string, any]) => (
                  <div key={pool} className="flex justify-between items-center">
                    <span className="text-sm">{pool}</span>
                    <span className="font-medium text-green-600">{apy}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-4">DeFi Performance Index</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => [`${value}`, 'Value']} />
                  <Area type="monotone" dataKey="value" stroke="#4F46E5" fill="#C7D2FE" fillOpacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-4">Strategy APY Comparison</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apyComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 'dataMax + 5']} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, 'APY']} />
                  <Bar dataKey="apy" barSize={20}>
                    {apyComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.risk === 'conservative' ? '#10B981' :
                        entry.risk === 'moderate' ? '#3B82F6' :
                        entry.risk === 'aggressive' ? '#F59E0B' : '#EF4444'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Featured Strategies */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Featured Strategies</h3>
            <button 
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              onClick={() => setActiveTab('strategies')}
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.slice(0, 3).map(strategy => (
              <div key={strategy.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{strategy.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskLevelColor(strategy.riskLevel)}`}>
                    {getRiskLevelLabel(strategy.riskLevel)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{strategy.description}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">APY</span>
                  <span className="font-medium text-green-600">{(strategy.estimatedApy / 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Type</span>
                  <span>{getProtocolTypeLabel(strategy.protocolType)}</span>
                </div>
                <button
                  className="w-full mt-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                  onClick={() => {
                    setSelectedStrategy(strategy);
                    setActiveTab('strategies');
                  }}
                >
                  View Strategy
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Strategies Tab
  const renderStrategiesTab = () => {
    return (
      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search strategies..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocol Type
              </label>
              <div className="flex flex-wrap gap-2">
                {(['lending', 'yield_farming', 'liquidity_providing', 'staking', 'options'] as ProtocolType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => toggleProtocolType(type)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      selectedProtocolTypes.includes(type)
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-gray-100 text-gray-800 border border-transparent'
                    }`}
                  >
                    {getProtocolTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Level
              </label>
              <div className="flex flex-wrap gap-2">
                {(['conservative', 'moderate', 'aggressive', 'experimental'] as DeFiRiskLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => toggleRiskLevel(level)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      selectedRiskLevels.includes(level)
                        ? getRiskLevelColor(level) + ' border border-current opacity-100'
                        : getRiskLevelColor(level) + ' opacity-60 border border-transparent'
                    }`}
                  >
                    {getRiskLevelLabel(level)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum APY
              </label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={minApy}
                  onChange={(e) => setMinApy(parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="ml-2 text-sm font-medium">{minApy}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Strategies List */}
        <div className="bg-white rounded-lg shadow divide-y">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-500">Loading strategies...</p>
            </div>
          ) : filteredStrategies.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-500">No strategies found matching your filters.</p>
              <button
                className="mt-2 text-indigo-600 hover:text-indigo-800"
                onClick={() => {
                  setSelectedProtocolTypes([]);
                  setSelectedRiskLevels([]);
                  setMinApy(0);
                  setSearchQuery('');
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredStrategies.map(strategy => (
              <div key={strategy.id} className="p-4 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900 mr-2">{strategy.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskLevelColor(strategy.riskLevel)}`}>
                        {getRiskLevelLabel(strategy.riskLevel)}
                      </span>
                      {strategy.verified && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 max-w-3xl">{strategy.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {strategy.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 md:ml-6 flex flex-col md:items-end">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-semibold text-indigo-600">{(strategy.estimatedApy / 100).toFixed(2)}%</span>
                      <span className="ml-1 text-sm text-gray-500">APY</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">TVL: {formatCurrency(strategy.tvl)}</p>
                    <p className="text-sm text-gray-500">Users: {strategy.userCount.toLocaleString()}</p>
                    
                    <div className="mt-3 flex space-x-3">
                      <button
                        className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
                        onClick={() => setSelectedStrategy(strategy)}
                      >
                        Details
                      </button>
                      {connected ? (
                        <button
                          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                          onClick={() => {
                            setSelectedStrategy(strategy);
                            document.getElementById('investModal')?.classList.remove('hidden');
                          }}
                        >
                          Invest
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded cursor-not-allowed"
                          disabled
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Strategy Detail Modal */}
        {selectedStrategy && (
          <div id="strategyDetailModal" className="fixed inset-0 z-50 overflow-y-auto hidden">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">
                        {selectedStrategy.name}
                      </h3>
                      <div className="flex items-center mb-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskLevelColor(selectedStrategy.riskLevel)}`}>
                          {getRiskLevelLabel(selectedStrategy.riskLevel)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">Type: {getProtocolTypeLabel(selectedStrategy.protocolType)}</span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-4">
                        {selectedStrategy.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Estimated APY</h4>
                          <p className="text-lg font-semibold text-indigo-600">{(selectedStrategy.estimatedApy / 100).toFixed(2)}%</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Min. Investment</h4>
                          <p className="text-lg font-semibold">{formatCurrency(selectedStrategy.minInvestment)}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Creator Fee</h4>
                          <p className="text-lg">{(selectedStrategy.feePercentage / 100).toFixed(2)}%</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Total Value Locked</h4>
                          <p className="text-lg">{formatCurrency(selectedStrategy.tvl)}</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Tokens Used</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedStrategy.tokens.map(token => (
                            <div key={token.mint} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              <span>{token.symbol}</span>
                              <span className="ml-1 text-blue-600 font-medium">{token.allocation}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedStrategy.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  {connected ? (
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => {
                        document.getElementById('strategyDetailModal')?.classList.add('hidden');
                        document.getElementById('investModal')?.classList.remove('hidden');
                      }}
                    >
                      Invest
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-300 text-base font-medium text-gray-700 sm:ml-3 sm:w-auto sm:text-sm cursor-not-allowed"
                      disabled
                    >
                      Connect Wallet
                    </button>
                  )}
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => document.getElementById('strategyDetailModal')?.classList.add('hidden')}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Modal */}
        {selectedStrategy && (
          <div id="investModal" className="fixed inset-0 z-50 overflow-y-auto hidden">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Invest in {selectedStrategy.name}
                  </h3>
                  
                  <div className="mb-4">
                    <label htmlFor="tokenSelect" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Token
                    </label>
                    <select
                      id="tokenSelect"
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      {selectedStrategy.tokens.map(token => (
                        <option key={token.mint} value={token.symbol}>{token.symbol}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="investmentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Investment Amount
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="text"
                        id="investmentAmount"
                        value={investmentAmount}
                        onChange={(e) => setInvestmentAmount(e.target.value)}
                        placeholder="0.00"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Minimum investment: {formatCurrency(selectedStrategy.minInvestment)}
                    </p>
                  </div>
                  
                  <div className="mb-4 bg-blue-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Estimated Returns</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Daily:</span>
                        <span className="ml-1 font-medium text-blue-800">
                          {isNaN(parseFloat(investmentAmount)) ? '$0.00' : 
                            formatCurrency(parseFloat(investmentAmount) * (selectedStrategy.estimatedApy / 100) / 365)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Monthly:</span>
                        <span className="ml-1 font-medium text-blue-800">
                          {isNaN(parseFloat(investmentAmount)) ? '$0.00' : 
                            formatCurrency(parseFloat(investmentAmount) * (selectedStrategy.estimatedApy / 100) / 12)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Yearly:</span>
                        <span className="ml-1 font-medium text-blue-800">
                          {isNaN(parseFloat(investmentAmount)) ? '$0.00' : 
                            formatCurrency(parseFloat(investmentAmount) * (selectedStrategy.estimatedApy / 100))}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">APY:</span>
                        <span className="ml-1 font-medium text-blue-800">{(selectedStrategy.estimatedApy / 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => {
                      handleSubscribe();
                      document.getElementById('investModal')?.classList.add('hidden');
                    }}
                  >
                    Confirm Investment
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => document.getElementById('investModal')?.classList.add('hidden')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Positions Tab
  const renderPositionsTab = () => {
    return (
      <div className="space-y-6">
        {/* Positions Summary */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Your DeFi Positions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <span className="text-sm text-gray-500 block">Total Value</span>
              <span className="text-xl font-medium">{formatCurrency(userPositions.reduce((sum, p) => sum + p.investmentValue, 0))}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <span className="text-sm text-gray-500 block">Total Returns</span>
              <span className="text-xl font-medium text-green-600">
                {formatCurrency(userPositions.reduce((sum, p) => sum + (p.investmentValue - p.initialInvestment), 0))}
              </span>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <span className="text-sm text-gray-500 block">Average APY</span>
              <span className="text-xl font-medium text-green-600">
                {userPositions.length > 0 ? formatPercentage(userPositions.reduce((sum, p) => sum + p.apy, 0) / userPositions.length) : '0.00%'}
              </span>
            </div>
          </div>
        </div>

        {/* Position Cards */}
        {isLoading ? (
          <div className="py-20 text-center bg-white rounded-lg shadow">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-500">Loading your positions...</p>
          </div>
        ) : userPositions.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-lg shadow">
            <p className="text-gray-500">You don't have any active DeFi positions.</p>
            <button
              className="mt-2 text-indigo-600 hover:text-indigo-800"
              onClick={() => setActiveTab('strategies')}
            >
              Explore Strategies
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {userPositions.map(position => {
              const strategy = strategies.find(s => s.id === position.strategyId);
              if (!strategy) return null;

              return (
                <div 
                  key={position.strategyId} 
                  className={`bg-white rounded-lg shadow overflow-hidden ${
                    selectedPosition?.strategyId === position.strategyId ? 'ring-2 ring-indigo-500' : ''
                  }`}
                  onClick={() => setSelectedPosition(position)}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">{strategy.name}</h3>
                        <p className="text-sm text-gray-500">{getProtocolTypeLabel(strategy.protocolType)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskLevelColor(strategy.riskLevel)}`}>
                        {getRiskLevelLabel(strategy.riskLevel)}
                      </span>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500 block">Current Value</span>
                        <span className="text-lg font-medium">{formatCurrency(position.investmentValue)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Returns</span>
                        <span className={`text-lg font-medium ${position.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(position.returns)} ({((position.investmentValue / position.initialInvestment - 1) * 100).toFixed(2)}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">APY</span>
                        <span className="text-lg font-medium text-green-600">{formatPercentage(position.apy)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Subscribed On</span>
                        <span className="text-lg font-medium">{new Date(position.subscriptionTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {/* Position tokens */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Position Breakdown</h4>
                      <div className="space-y-2">
                        {position.positions.map((pos, idx) => (
                          <div key={idx} className="bg-gray-50 p-2 rounded-md">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{pos.protocol}</span>
                              <span className="text-xs text-gray-500">{pos.type}</span>
                            </div>
                            {pos.tokenA && (
                              <div className="flex justify-between items-center mt-1 text-sm">
                                <span>{pos.tokenA.symbol}</span>
                                <span className="font-medium">{formatCurrency(pos.tokenA.value)}</span>
                              </div>
                            )}
                            {pos.tokenB && (
                              <div className="flex justify-between items-center mt-1 text-sm">
                                <span>{pos.tokenB.symbol}</span>
                                <span className="font-medium">{formatCurrency(pos.tokenB.value)}</span>
                              </div>
                            )}
                            {pos.healthFactor && (
                              <div className="flex justify-between items-center mt-1 text-sm">
                                <span>Health Factor</span>
                                <span className={`font-medium ${pos.healthFactor < 1.2 ? 'text-red-600' : 'text-green-600'}`}>
                                  {pos.healthFactor.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4 flex space-x-2">
                      <button
                        className="flex-1 py-2 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHarvest(position);
                        }}
                      >
                        Harvest Rewards
                      </button>
                      <button
                        className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRebalance(position);
                        }}
                      >
                        Rebalance
                      </button>
                      <button
                        className="py-2 px-3 text-xs bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to exit this position in "${strategy.name}"?`)) {
                            handleUnsubscribe(position);
                          }
                        }}
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Position Detail */}
        {selectedPosition && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium mb-4">Position Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={generatePerformanceData(30, 2)} 
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}`, 'Value']} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#4F46E5" 
                    fill="#C7D2FE" 
                    fillOpacity={0.5} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Analytics Tab
  const renderAnalyticsTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Portfolio Analytics</h3>
          {/* Analytics content would go here */}
          <p className="py-20 text-center text-gray-500">Advanced analytics coming soon...</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DeFi Strategy Center</h1>
            <p className="text-gray-600">Optimize your yield across multiple DeFi protocols</p>
          </div>

          {connected ? (
            <div className="mt-4 md:mt-0 bg-white px-3 py-2 rounded-md shadow text-sm">
              <span className="text-gray-500">Wallet:</span>
              <span className="ml-1 font-medium">
                {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
              </span>
              <span className="inline-block w-2 h-2 ml-2 bg-green-500 rounded-full"></span>
            </div>
          ) : (
            <button className="mt-4 md:mt-0 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
              Connect Wallet
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              className={`${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`${
                activeTab === 'strategies'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('strategies')}
            >
              Strategies
            </button>
            <button
              className={`${
                activeTab === 'positions'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('positions')}
            >
              Your Positions
              {userPositions.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {userPositions.length}
                </span>
              )}
            </button>
            <button
              className={`${
                activeTab === 'analytics'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'strategies' && renderStrategiesTab()}
          {activeTab === 'positions' && renderPositionsTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </div>
      </div>
    </div>
  );
};

export default DeFiStrategyComponent;