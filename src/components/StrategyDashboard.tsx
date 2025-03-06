// src/components/StrategyDashboard.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AIStrategyService } from '../services/AIStrategyService';
import { TradingStrategy } from '../services/StrategyMarketplace';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/NotificationService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceData {
  date: string;
  value: number;
}

interface StrategyPerformance {
  strategy: TradingStrategy;
  investment: number;
  currentValue: number;
  returns: number;
  subscriptionDate: string;
  performanceData: PerformanceData[];
}

const StrategyDashboard: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  const [subscribedStrategies, setSubscribedStrategies] = useState<StrategyPerformance[]>([]);
  const [createdStrategies, setCreatedStrategies] = useState<TradingStrategy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalInvestment, setTotalInvestment] = useState<number>(0);
  const [totalReturns, setTotalReturns] = useState<number>(0);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyPerformance | null>(null);
  
  // Generate mock performance data
  const generatePerformanceData = (
    days: number,
    startValue: number,
    volatility: number,
    trend: number
  ): PerformanceData[] => {
    const data: PerformanceData[] = [];
    let currentValue = startValue;
    
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some randomness with trend
      const change = (Math.random() - 0.5) * volatility + trend;
      currentValue = currentValue * (1 + change / 100);
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: parseFloat(currentValue.toFixed(2))
      });
    }
    
    return data;
  };
  
  // Fetch user's strategies
  useEffect(() => {
    const fetchStrategies = async () => {
      if (!connected || !publicKey) {
        setSubscribedStrategies([]);
        setCreatedStrategies([]);
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // In a real implementation, this would call the actual AIStrategyService
        // For demo purposes, we'll simulate the data
        
        // Simulate subscribed strategies
        const mockSubscribedStrategies: StrategyPerformance[] = [
          {
            strategy: {
              id: 'momentum-ml-strategy',
              name: 'AI Momentum Alpha',
              description: 'Employs machine learning to identify short-term momentum patterns in major tokens.',
              creatorAddress: 'AiXZdnAMYcdnAvc54Cd55555Z7777aaaa3333333',
              creatorName: 'Quantum Quant Labs',
              verified: true,
              riskLevel: 'medium',
              timeHorizon: 'short_term',
              aiModels: ['momentum', 'sentiment'],
              tokenSupport: 'major_only',
              activeUsers: 3245,
              tvl: 2450000,
              feePercentage: 1.5,
              performanceFee: 10,
              backtestResults: [],
              lastUpdated: '2024-10-18T14:30:00Z',
              tags: ['momentum', 'machine learning', 'sentiment', 'short-term'],
              contractAddress: 'Mo77777777777771111111111111111UUUUUUUUuu',
              minInvestment: 500,
              version: '2.1.0',
              compatibleWith: ['SonicAgent', 'Jupiter', 'Orca']
            },
            investment: 1500,
            currentValue: 1725,
            returns: 15,
            subscriptionDate: '2024-09-15T10:30:00Z',
            performanceData: generatePerformanceData(30, 1500, 2, 0.5)
          },
          {
            strategy: {
              id: 'conservative-ai-portfolio',
              name: 'StableGrowth AI',
              description: 'A conservative portfolio management strategy using AI to maintain balanced exposure across major tokens.',
              creatorAddress: 'SG777777777777771111111111111111UUUUUUUUuu',
              creatorName: 'Guardian Quant',
              verified: true,
              riskLevel: 'low',
              timeHorizon: 'long_term',
              aiModels: ['multi_factor', 'market_regime'],
              tokenSupport: 'major_only',
              activeUsers: 4250,
              tvl: 8500000,
              feePercentage: 1.0,
              performanceFee: 10,
              backtestResults: [],
              lastUpdated: '2024-10-26T12:15:00Z',
              tags: ['conservative', 'portfolio', 'balanced', 'capital preservation'],
              contractAddress: 'SG77777777777771111111111111111UUUUUUUUuu',
              minInvestment: 500,
              version: '3.1.2',
              compatibleWith: ['SonicAgent', 'Jupiter', 'Marinade Finance']
            },
            investment: 2000,
            currentValue: 2120,
            returns: 6,
            subscriptionDate: '2024-09-20T14:45:00Z',
            performanceData: generatePerformanceData(30, 2000, 1, 0.2)
          }
        ];
        
        // Simulate created strategies
        const mockCreatedStrategies: TradingStrategy[] = [
          {
            id: 'custom-momentum-ai',
            name: 'Custom Momentum AI',
            description: 'My custom momentum strategy using machine learning.',
            creatorAddress: publicKey.toString(),
            creatorName: 'You',
            verified: false,
            riskLevel: 'medium',
            timeHorizon: 'medium_term',
            aiModels: ['momentum', 'pattern_recognition'],
            tokenSupport: 'major_and_medium',
            activeUsers: 12,
            tvl: 15000,
            feePercentage: 2.0,
            performanceFee: 15,
            backtestResults: [],
            lastUpdated: '2024-10-10T09:20:00Z',
            tags: ['momentum', 'custom', 'medium-term'],
            contractAddress: 'YO77777777777771111111111111111UUUUUUUUuu',
            minInvestment: 100,
            version: '1.0.0',
            compatibleWith: ['SonicAgent']
          }
        ];
        
        setSubscribedStrategies(mockSubscribedStrategies);
        setCreatedStrategies(mockCreatedStrategies);
        
        // Calculate totals
        const totalInv = mockSubscribedStrategies.reduce((sum, strategy) => sum + strategy.investment, 0);
        const totalVal = mockSubscribedStrategies.reduce((sum, strategy) => sum + strategy.currentValue, 0);
        
        setTotalInvestment(totalInv);
        setTotalValue(totalVal);
        setTotalReturns(((totalVal / totalInv) - 1) * 100);
        
        // Set default selected strategy
        if (mockSubscribedStrategies.length > 0) {
          setSelectedStrategy(mockSubscribedStrategies[0]);
        }
      } catch (error) {
        console.error('Error fetching strategies:', error);
        
        notifyMarketEvent(
          'Error Loading Strategies',
          'Failed to load your strategies. Please try again.',
          NotificationType.ERROR
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStrategies();
  }, [connected, publicKey]);
  
  // Handle unsubscribe from strategy
  const handleUnsubscribe = async (strategy: TradingStrategy) => {
    try {
      // In a real implementation, this would call the actual AIStrategyService
      
      // Simulate unsubscribe
      setSubscribedStrategies(prevStrategies => 
        prevStrategies.filter(s => s.strategy.id !== strategy.id)
      );
      
      // Update totals
      const unsubscribedStrategy = subscribedStrategies.find(s => s.strategy.id === strategy.id);
      if (unsubscribedStrategy) {
        setTotalInvestment(prev => prev - unsubscribedStrategy.investment);
        setTotalValue(prev => prev - unsubscribedStrategy.currentValue);
        
        // Recalculate returns
        const newInvestment = totalInvestment - unsubscribedStrategy.investment;
        const newValue = totalValue - unsubscribedStrategy.currentValue;
        
        if (newInvestment > 0) {
          setTotalReturns(((newValue / newInvestment) - 1) * 100);
        } else {
          setTotalReturns(0);
        }
      }
      
      // Update selected strategy
      if (selectedStrategy?.strategy.id === strategy.id) {
        setSelectedStrategy(subscribedStrategies.find(s => s.strategy.id !== strategy.id) || null);
      }
      
      notifyMarketEvent(
        'Strategy Unsubscribed',
        `Successfully unsubscribed from ${strategy.name}`,
        NotificationType.SUCCESS
      );
    } catch (error) {
      console.error('Error unsubscribing from strategy:', error);
      
      notifyMarketEvent(
        'Unsubscribe Failed',
        `Failed to unsubscribe from ${strategy.name}`,
        NotificationType.ERROR
      );
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
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-6">Strategy Dashboard</h2>
      
      {!connected ? (
        <div className="bg-blue-50 p-4 rounded-md mb-6">
          <p className="text-blue-700">Connect your wallet to view your AI strategy portfolio</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Portfolio Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium mb-4">Portfolio Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-md shadow-sm">
                <p className="text-sm text-gray-500">Total Investment</p>
                <p className="text-xl font-bold">{formatCurrency(totalInvestment)}</p>
              </div>
              <div className="bg-white p-4 rounded-md shadow-sm">
                <p className="text-sm text-gray-500">Current Value</p>
                <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
              <div className="bg-white p-4 rounded-md shadow-sm">
                <p className="text-sm text-gray-500">Total Returns</p>
                <p className={`text-xl font-bold ${totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(totalReturns)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Strategies and Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subscribed Strategies List */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-medium mb-4">Your Strategies</h3>
              {subscribedStrategies.length === 0 ? (
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-gray-600">You haven't subscribed to any strategies yet</p>
                  <button
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
                    onClick={() => {
                      // Navigate to strategy marketplace
                    }}
                  >
                    Browse Strategies
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscribedStrategies.map((strategy) => (
                    <div 
                      key={strategy.strategy.id}
                      className={`bg-white rounded-md border p-4 cursor-pointer transition-colors ${
                        selectedStrategy?.strategy.id === strategy.strategy.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedStrategy(strategy)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{strategy.strategy.name}</h4>
                          <p className="text-sm text-gray-500">{strategy.strategy.creatorName}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          strategy.returns >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {formatPercentage(strategy.returns)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Investment:</span>
                          <span className="ml-1 font-medium">{formatCurrency(strategy.investment)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Current:</span>
                          <span className="ml-1 font-medium">{formatCurrency(strategy.currentValue)}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          className="text-xs text-red-600 hover:text-red-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnsubscribe(strategy.strategy);
                          }}
                        >
                          Unsubscribe
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Strategy Performance */}
            <div className="lg:col-span-2">
              <h3 className="text-lg font-medium mb-4">Strategy Performance</h3>
              {!selectedStrategy ? (
                <div className="bg-gray-50 p-8 rounded-md text-center">
                  <p className="text-gray-600">Select a strategy to view its performance</p>
                </div>
              ) : (
                <div>
                  <div className="bg-white rounded-md border border-gray-200 p-4 mb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-medium">{selectedStrategy.strategy.name}</h4>
                        <p className="text-sm text-gray-500">{selectedStrategy.strategy.description}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedStrategy.strategy.riskLevel === 'low'
                          ? 'bg-green-100 text-green-800'
                          : selectedStrategy.strategy.riskLevel === 'medium'
                            ? 'bg-blue-100 text-blue-800'
                            : selectedStrategy.strategy.riskLevel === 'high'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedStrategy.strategy.riskLevel === 'low'
                          ? 'Low Risk'
                          : selectedStrategy.strategy.riskLevel === 'medium'
                            ? 'Medium Risk'
                            : selectedStrategy.strategy.riskLevel === 'high'
                              ? 'High Risk'
                              : 'Very High Risk'
                        }
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-500 block">Investment</span>
                        <span className="text-lg font-medium">{formatCurrency(selectedStrategy.investment)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Current Value</span>
                        <span className="text-lg font-medium">{formatCurrency(selectedStrategy.currentValue)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Returns</span>
                        <span className={`text-lg font-medium ${selectedStrategy.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(selectedStrategy.returns)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">Subscribed On</span>
                        <span className="text-lg font-medium">
                          {new Date(selectedStrategy.subscriptionDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Performance Chart</h5>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={selectedStrategy.performanceData}
                            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date"
                              tickFormatter={(date) => {
                                const d = new Date(date);
                                return `${d.getMonth() + 1}/${d.getDate()}`;
                              }}
                            />
                            <YAxis />
                            <Tooltip
                              formatter={(value) => [`${value}`, 'Value']}
                              labelFormatter={(date) => new Date(date).toLocaleDateString()}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#3b82f6" 
                              fill="#93c5fd" 
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">Strategy Details</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Time Horizon</span>
                          <span className="font-medium">
                            {selectedStrategy.strategy.timeHorizon === 'short_term'
                              ? 'Short Term'
                              : selectedStrategy.strategy.timeHorizon === 'medium_term'
                                ? 'Medium Term'
                                : 'Long Term'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Management Fee</span>
                          <span className="font-medium">{selectedStrategy.strategy.feePercentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Performance Fee</span>
                          <span className="font-medium">{selectedStrategy.strategy.performanceFee}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Value Locked</span>
                          <span className="font-medium">${(selectedStrategy.strategy.tvl / 1000).toFixed(0)}k</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Active Users</span>
                          <span className="font-medium">{selectedStrategy.strategy.activeUsers}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">AI Models</h5>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {selectedStrategy.strategy.aiModels.map((model) => (
                          <span
                            key={model}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {model.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </span>
                        ))}
                      </div>
                      
                      <h5 className="text-sm font-medium text-gray-700 mb-2 mt-4">Tags</h5>
                      <div className="flex flex-wrap gap-1">
                        {selectedStrategy.strategy.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Created Strategies */}
          {createdStrategies.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Strategies You Created</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdStrategies.map((strategy) => (
                  <div key={strategy.id} className="bg-white rounded-md border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2">{strategy.description}</p>
                      </div>
                      {strategy.verified ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">TVL:</span>
                        <span className="ml-1 font-medium">${(strategy.tvl / 1000).toFixed(0)}k</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Users:</span>
                        <span className="ml-1 font-medium">{strategy.activeUsers}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Fee:</span>
                        <span className="ml-1 font-medium">{strategy.feePercentage}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <span className="ml-1 font-medium">
                          {new Date(strategy.lastUpdated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <button
                        className="flex-1 text-xs font-medium py-1 px-3 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        onClick={() => {
                          // View strategy details
                        }}
                      >
                        View Details
                      </button>
                      <button
                        className="flex-1 text-xs font-medium py-1 px-3 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          // Edit strategy
                        }}
                      >
                        Edit Strategy
                      </button>
                    </div>
                  </div>
                ))} 
                
                <div className="bg-gray-50 rounded-md border border-dashed border-gray-300 p-4 flex flex-col items-center justify-center text-center">
                  <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Create a new strategy</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Develop your own AI trading strategy and earn fees from subscribers
                  </p>
                  <button
                    className="mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      // Navigate to strategy creation
                    }}
                  >
                    Create Strategy
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StrategyDashboard;