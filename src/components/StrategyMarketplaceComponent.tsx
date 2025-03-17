// src/components/StrategyMarketplaceComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  StrategyMarketplaceService, 
  TradingStrategy, 
  RiskLevel, 
  TimeHorizon, 
  AIModelType, 
  TokenSupportType,
  BacktestTimespan
} from '../services/StrategyMarketplace';

import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '@/services/DeFiStrategyService';

const riskLevelColors = {
  [RiskLevel.LOW]: 'bg-green-100 text-green-800',
  [RiskLevel.MEDIUM]: 'bg-blue-100 text-blue-800',
  [RiskLevel.HIGH]: 'bg-yellow-100 text-yellow-800',
  [RiskLevel.VERY_HIGH]: 'bg-red-100 text-red-800',
};

const riskLevelLabels = {
  [RiskLevel.LOW]: 'Low Risk',
  [RiskLevel.MEDIUM]: 'Medium Risk',
  [RiskLevel.HIGH]: 'High Risk',
  [RiskLevel.VERY_HIGH]: 'Very High Risk',
};

const timeHorizonLabels = {
  [TimeHorizon.SHORT_TERM]: 'Short Term',
  [TimeHorizon.MEDIUM_TERM]: 'Medium Term',
  [TimeHorizon.LONG_TERM]: 'Long Term',
};

const aiModelLabels = {
  [AIModelType.MOMENTUM]: 'Momentum',
  [AIModelType.MEAN_REVERSION]: 'Mean Reversion',
  [AIModelType.SENTIMENT]: 'Sentiment Analysis',
  [AIModelType.STATISTICAL_ARBITRAGE]: 'Statistical Arbitrage',
  [AIModelType.REINFORCEMENT_LEARNING]: 'Reinforcement Learning',
  [AIModelType.MULTI_FACTOR]: 'Multi-Factor',
  [AIModelType.VOLATILITY_PREDICTION]: 'Volatility Prediction',
  [AIModelType.MARKET_REGIME]: 'Market Regime',
  [AIModelType.ORDER_FLOW]: 'Order Flow',
  [AIModelType.PATTERN_RECOGNITION]: 'Pattern Recognition',
};

const tokenSupportLabels = {
  [TokenSupportType.MAJOR_ONLY]: 'Major Tokens Only',
  [TokenSupportType.MAJOR_AND_MEDIUM]: 'Major & Medium Cap',
  [TokenSupportType.WIDE_COVERAGE]: 'Wide Coverage',
  [TokenSupportType.CUSTOM_BASKET]: 'Custom Basket',
};

interface StrategyFilterProps {
  selectedRiskLevels: RiskLevel[];
  selectedTimeHorizons: TimeHorizon[];
  selectedAIModels: AIModelType[];
  setSelectedRiskLevels: (values: RiskLevel[]) => void;
  setSelectedTimeHorizons: (values: TimeHorizon[]) => void;
  setSelectedAIModels: (values: AIModelType[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

const StrategyFilter: React.FC<StrategyFilterProps> = ({
  selectedRiskLevels,
  selectedTimeHorizons,
  selectedAIModels,
  setSelectedRiskLevels,
  setSelectedTimeHorizons,
  setSelectedAIModels,
  searchQuery,
  setSearchQuery,
  onApplyFilters,
  onClearFilters
}) => {
  // Toggle risk level selection
  const toggleRiskLevel = (riskLevel: RiskLevel) => {
    if (selectedRiskLevels.includes(riskLevel)) {
      setSelectedRiskLevels(selectedRiskLevels.filter(level => level !== riskLevel));
    } else {
      setSelectedRiskLevels([...selectedRiskLevels, riskLevel]);
    }
  };

  // Toggle time horizon selection
  const toggleTimeHorizon = (timeHorizon: TimeHorizon) => {
    if (selectedTimeHorizons.includes(timeHorizon)) {
      setSelectedTimeHorizons(selectedTimeHorizons.filter(horizon => horizon !== timeHorizon));
    } else {
      setSelectedTimeHorizons([...selectedTimeHorizons, timeHorizon]);
    }
  };

  // Toggle AI model selection
  const toggleAIModel = (aiModel: AIModelType) => {
    if (selectedAIModels.includes(aiModel)) {
      setSelectedAIModels(selectedAIModels.filter(model => model !== aiModel));
    } else {
      setSelectedAIModels([...selectedAIModels, aiModel]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-lg font-medium mb-4">Filter Strategies</h3>
      
      {/* Search Box */}
      <div className="mb-4">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
          Search
        </label>
        <input
          type="text"
          id="search"
          placeholder="Search by name, description, or tag"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* Risk Level Filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Level</h4>
        <div className="flex flex-wrap gap-2">
          {Object.values(RiskLevel).map((riskLevel) => (
            <button
              key={riskLevel}
              onClick={() => toggleRiskLevel(riskLevel)}
              className={`text-xs px-2 py-1 rounded-full ${
                selectedRiskLevels.includes(riskLevel)
                  ? riskLevelColors[riskLevel]
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {riskLevelLabels[riskLevel]}
            </button>
          ))}
        </div>
      </div>
      
      {/* Time Horizon Filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Time Horizon</h4>
        <div className="flex flex-wrap gap-2">
          {Object.values(TimeHorizon).map((timeHorizon) => (
            <button
              key={timeHorizon}
              onClick={() => toggleTimeHorizon(timeHorizon)}
              className={`text-xs px-2 py-1 rounded-full ${
                selectedTimeHorizons.includes(timeHorizon)
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {timeHorizonLabels[timeHorizon]}
            </button>
          ))}
        </div>
      </div>
      
      {/* AI Model Filter */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">AI Models</h4>
        <div className="flex flex-wrap gap-2">
          {Object.values(AIModelType).map((aiModel) => (
            <button
              key={aiModel}
              onClick={() => toggleAIModel(aiModel)}
              className={`text-xs px-2 py-1 rounded-full ${
                selectedAIModels.includes(aiModel)
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {aiModelLabels[aiModel]}
            </button>
          ))}
        </div>
      </div>
      
      {/* Filter Button */}
      <div className="flex justify-between space-x-2">
        <button
          onClick={onClearFilters}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-500 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Clear Filters
        </button>
        <button
          onClick={onApplyFilters}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

interface StrategyMarketplaceProps {
  initialRiskLevel?: RiskLevel;
  initialTimeHorizon?: TimeHorizon;
}

const StrategyMarketplaceComponent: React.FC<StrategyMarketplaceProps> = ({
  initialRiskLevel,
  initialTimeHorizon
}) => {
  const { publicKey } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  // State for selected strategy for details modal
  const [selectedStrategy, setSelectedStrategy] = useState<TradingStrategy | null>(null);
  
  // Strategy marketplace service
  const marketplaceService = StrategyMarketplaceService.getInstance();
  
  // Filter states
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<RiskLevel[]>(
    initialRiskLevel ? [initialRiskLevel] : []
  );
  const [selectedTimeHorizons, setSelectedTimeHorizons] = useState<TimeHorizon[]>(
    initialTimeHorizon ? [initialTimeHorizon] : []
  );
  const [selectedAIModels, setSelectedAIModels] = useState<AIModelType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'all' | 'trending' | 'top-performing' | 'recommended'>('all');
  
  // Strategies state
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<TradingStrategy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Load initial strategies
  useEffect(() => {
    // Simulating API call
    setIsLoading(true);
    setTimeout(() => {
      const allStrategies = marketplaceService.getAllStrategies();
      setStrategies(allStrategies);
      setFilteredStrategies(allStrategies);
      setIsLoading(false);
    }, 500);
  }, []);
  
  // Apply filters and search
  const applyFilters = () => {
    let result = strategies;
    
    // Apply risk level filter
    if (selectedRiskLevels.length > 0) {
      result = result.filter(strategy => selectedRiskLevels.includes(strategy.riskLevel));
    }
    
    // Apply time horizon filter
    if (selectedTimeHorizons.length > 0) {
      result = result.filter(strategy => selectedTimeHorizons.includes(strategy.timeHorizon));
    }
    
    // Apply AI model filter
    if (selectedAIModels.length > 0) {
      result = result.filter(strategy => 
        strategy.aiModels.some(model => selectedAIModels.includes(model))
      );
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(strategy => 
        strategy.name.toLowerCase().includes(lowerQuery) ||
        strategy.description.toLowerCase().includes(lowerQuery) ||
        strategy.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        strategy.creatorName.toLowerCase().includes(lowerQuery)
      );
    }
    
    setFilteredStrategies(result);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSelectedRiskLevels([]);
    setSelectedTimeHorizons([]);
    setSelectedAIModels([]);
    setSearchQuery('');
    setFilteredStrategies(strategies);
  };
  
  // Apply filters when they change
  useEffect(() => {
    if (activeTab === 'all') {
      applyFilters();
    }
  }, [activeTab]);
  
  // Handle tab changes
  useEffect(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      let result: TradingStrategy[];
      
      switch (activeTab) {
        case 'trending':
          result = marketplaceService.getTrendingStrategies();
          break;
        case 'top-performing':
          result = marketplaceService.getTopPerformingStrategies(BacktestTimespan.THREE_MONTHS);
          break;
        case 'recommended':
          result = marketplaceService.getRecommendedStrategies(
            RiskLevel.MEDIUM, // Default risk level, ideally from user profile
            TimeHorizon.MEDIUM_TERM, // Default time horizon, ideally from user profile
            10 // Show more recommendations
          );
          break;
        default:
          result = strategies;
          applyFilters();
          break;
      }
      
      if (activeTab !== 'all') {
        setFilteredStrategies(result);
      }
      
      setIsLoading(false);
    }, 500);
  }, [activeTab]);
  
  // Handle strategy subscription
  const handleSubscribe = async (strategy: TradingStrategy, amount: number) => {
    if (!publicKey) {
      notifyMarketEvent(
        'Wallet Required',
        'Please connect your wallet to subscribe to this strategy',
        NotificationType.WARNING
      );
      return;
    }
    
    try {
      // In a real implementation, this would call the smart contract
      const success = await marketplaceService.subscribeToStrategy(
        strategy.id,
        publicKey.toString(),
        amount
      );
      
      if (success) {
        notifyMarketEvent(
          'Strategy Subscribed',
          `Successfully subscribed to ${strategy.name} with ${amount}`,
          NotificationType.SUCCESS,
          { strategyId: strategy.id, amount }
        );
      }
    } catch (error) {
      notifyMarketEvent(
        'Subscription Failed',
        (error instanceof Error ? error.message : 'Failed to subscribe to strategy'),
        NotificationType.ERROR
      );
    }
  };
  
  // Open strategy details modal
  const openStrategyDetails = (strategy: TradingStrategy) => {
    setSelectedStrategy(strategy);
  };
  
  // Close strategy details modal
  const closeStrategyDetails = () => {
    setSelectedStrategy(null);
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              AI Strategy Marketplace
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Browse and subscribe to AI-powered trading strategies
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filter Sidebar */}
          <div className="lg:col-span-1">
            <StrategyFilter
              selectedRiskLevels={selectedRiskLevels}
              selectedTimeHorizons={selectedTimeHorizons}
              selectedAIModels={selectedAIModels}
              setSelectedRiskLevels={setSelectedRiskLevels}
              setSelectedTimeHorizons={setSelectedTimeHorizons}
              setSelectedAIModels={setSelectedAIModels}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onApplyFilters={applyFilters}
              onClearFilters={clearFilters}
            />
          </div>
          
          {/* Strategies List */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="mb-6">
              <div className="sm:hidden">
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                >
                  <option value="all">All Strategies</option>
                  <option value="trending">Trending</option>
                  <option value="top-performing">Top Performing</option>
                  <option value="recommended">Recommended for You</option>
                </select>
              </div>
              <div className="hidden sm:block">
                <nav className="flex space-x-4" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-2 font-medium text-sm rounded-md ${
                      activeTab === 'all'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    All Strategies
                  </button>
                  <button
                    onClick={() => setActiveTab('trending')}
                    className={`px-3 py-2 font-medium text-sm rounded-md ${
                      activeTab === 'trending'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Trending
                  </button>
                  <button
                    onClick={() => setActiveTab('top-performing')}
                    className={`px-3 py-2 font-medium text-sm rounded-md ${
                      activeTab === 'top-performing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Top Performing
                  </button>
                  <button
                    onClick={() => setActiveTab('recommended')}
                    className={`px-3 py-2 font-medium text-sm rounded-md ${
                      activeTab === 'recommended'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Recommended
                  </button>
                </nav>
              </div>
            </div>
            
            {/* Strategy Cards */}
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredStrategies.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No strategies found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters or search query to find more strategies.
                </p>
                <div className="mt-6">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredStrategies.map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    onSubscribe={() => openStrategyDetails(strategy)}
                    onViewDetails={() => openStrategyDetails(strategy)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          onClose={closeStrategyDetails}
          onSubscribe={handleSubscribe}
        />
      )}
    </div>
  );
};

export default StrategyMarketplaceComponent;

interface StrategyCardProps {
  strategy: TradingStrategy;
  onSubscribe: (strategy: TradingStrategy) => void;
  onViewDetails: (strategy: TradingStrategy) => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ 
  strategy, 
  onSubscribe,
  onViewDetails
}) => {
  // Get most recent backtest result
  const recentBacktest = strategy.backtestResults[0] || {
    totalReturn: 0,
    sharpeRatio: 0,
    winRate: 0
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{strategy.name}</h3>
            <p className="text-sm text-gray-500">{strategy.creatorName}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskLevelColors[strategy.riskLevel]}`}>
            {riskLevelLabels[strategy.riskLevel]}
          </span>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">{strategy.description}</p>
        
        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">Return</p>
            <p className="text-lg font-medium text-gray-900">{recentBacktest.totalReturn}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Sharpe</p>
            <p className="text-lg font-medium text-gray-900">{recentBacktest.sharpeRatio.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Win Rate</p>
            <p className="text-lg font-medium text-gray-900">{recentBacktest.winRate}%</p>
          </div>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {strategy.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {tag}
            </span>
          ))}
          {strategy.tags.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              +{strategy.tags.length - 3} more
            </span>
          )}
        </div>
        
        {/* Strategy Info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
          <div>
            <span className="font-medium">Time Horizon:</span> {timeHorizonLabels[strategy.timeHorizon]}
          </div>
          <div>
            <span className="font-medium">Fee:</span> {strategy.feePercentage}%
          </div>
          <div>
            <span className="font-medium">Active Users:</span> {strategy.activeUsers.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">TVL:</span> ${strategy.tvl.toLocaleString()}
          </div>
        </div>
        
        {/* AI Models */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-1">AI Models:</p>
          <div className="flex flex-wrap gap-1">
            {strategy.aiModels.map((model) => (
              <span key={model} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                {aiModelLabels[model]}
              </span>
            ))}
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => onViewDetails(strategy)}
            className="flex-1 text-xs font-medium py-2 px-4 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View Details
          </button>
          <button
            onClick={() => onSubscribe(strategy)}
            className="flex-1 text-xs font-medium py-2 px-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
};

interface StrategyDetailModalProps {
  strategy: TradingStrategy | null;
  onClose: () => void;
  onSubscribe: (strategy: TradingStrategy, amount: number) => void;
}

const StrategyDetailModal: React.FC<StrategyDetailModalProps> = ({
  strategy,
  onClose,
  onSubscribe
}) => {
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  
  // Update validation when investment amount changes
  useEffect(() => {
    if (!strategy) return;
    
    const amount = parseFloat(investmentAmount);
    setIsValid(
      !isNaN(amount) && 
      amount > 0 && 
      (!strategy.minInvestment || amount >= strategy.minInvestment)
    );
  }, [investmentAmount, strategy]);
  
  // Handle input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInvestmentAmount(value);
    }
  };
  
  // Handle subscribe button click
  const handleSubscribe = () => {
    if (!strategy || !isValid) return;
    
    onSubscribe(strategy, parseFloat(investmentAmount));
    onClose();
  };
  
  if (!strategy) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {strategy.name}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Creator Info */}
            <div className="mt-2 flex items-center">
              <span className="text-sm text-gray-500 mr-2">Created by:</span>
              <span className="text-sm font-medium">{strategy.creatorName}</span>
              {strategy.verified && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              )}
            </div>
            
            {/* Description */}
            <div className="mt-4">
              <p className="text-sm text-gray-600">{strategy.description}</p>
            </div>
            
            {/* Strategy Details */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Risk Level</h4>
                <p className="mt-1 text-sm text-gray-500">{riskLevelLabels[strategy.riskLevel]}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Time Horizon</h4>
                <p className="mt-1 text-sm text-gray-500">{timeHorizonLabels[strategy.timeHorizon]}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Management Fee</h4>
                <p className="mt-1 text-sm text-gray-500">{strategy.feePercentage}%</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Performance Fee</h4>
                <p className="mt-1 text-sm text-gray-500">{strategy.performanceFee}%</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Token Support</h4>
                <p className="mt-1 text-sm text-gray-500">{tokenSupportLabels[strategy.tokenSupport]}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Min Investment</h4>
                <p className="mt-1 text-sm text-gray-500">
                  {strategy.minInvestment ? `$${strategy.minInvestment}` : 'No minimum'}
                </p>
              </div>
            </div>
            
            {/* AI Models */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900">AI Models</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {strategy.aiModels.map((model) => (
                  <span key={model} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {aiModelLabels[model]}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Backtest Results */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900">Performance</h4>
              <table className="min-w-full divide-y divide-gray-200 mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sharpe
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Drawdown
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Win Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {strategy.backtestResults.map((result, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {result.timespan}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {result.totalReturn}%
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {result.sharpeRatio.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        -{result.maxDrawdown}%
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {result.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Investment Input */}
            <div className="mt-6">
              <label htmlFor="investment-amount" className="block text-sm font-medium text-gray-700">
                Investment Amount (USD)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="text"
                  id="investment-amount"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                  placeholder="0.00"
                  value={investmentAmount}
                  onChange={handleAmountChange}
                />
              </div>
              {strategy.minInvestment && (
                <p className="mt-2 text-xs text-gray-500">
                  Minimum investment: ${strategy.minInvestment}
                </p>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                isValid 
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
              onClick={handleSubscribe}
              disabled={!isValid} 
            >
              Subscribe
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>)};