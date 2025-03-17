// src/components/SonicAINavigatorApp.tsx

import React, { useState, useEffect } from 'react';
import { useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { Connection } from '@solana/web3.js';

import DeFiStrategyComponent from './DeFiStrategyComponent';
import AIStrategyGeneratorComponent from './AIStrategyGeneratorComponent';
import PortfolioAnalyticsComponent from './PortfolioAnalyticsComponent';
import PriceAlertComponent from './PriceAlertComponent'; // Replacing RiskMonitorComponent with PriceAlertComponent
import { DeFiStrategy, ProtocolType, DeFiRiskLevel } from '../types/defi';
import { AIOptimizationService } from '../services/AIOptimizationService';
import { RiskMonitorService } from '../services/RiskMonitorService';
import { SonicSVMService } from '../services/SonicSVMService';
import { NotificationProvider } from '../providers/NotificationProvider';

interface SonicAINavigatorAppProps {
  connection: Connection;
}

/**
 * Main application component that integrates all SonicAI DeFi Navigator features
 */
const SonicAINavigatorApp: React.FC<SonicAINavigatorAppProps> = ({ connection }) => {
  const { publicKey, connected } = useWallet();
  
  // Application state
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'create' | 'analytics' | 'risk'>('overview');
  const [strategies, setStrategies] = useState<DeFiStrategy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userStrategies, setUserStrategies] = useState<DeFiStrategy[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  
  // Services
  const [aiService] = useState<AIOptimizationService>(AIOptimizationService.getInstance());
  const [riskService] = useState<RiskMonitorService>(RiskMonitorService.getInstance());
  const [sonicService] = useState<SonicSVMService>(new SonicSVMService(connection));
  
  // Initialize services and load initial data
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      
      try {
        // Simulate loading strategies
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate sample strategies
        const sampleStrategies = generateSampleStrategies();
        setStrategies(sampleStrategies);
        
        // Filter user created strategies
        if (connected && publicKey) {
          const userCreated = sampleStrategies.filter(s => 
            s.creatorAddress === publicKey.toString()
          );
          setUserStrategies(userCreated);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, [connection]);
  
  // Monitor for risk alerts when user connects
  useEffect(() => {
    if (connected && publicKey) {
      // Start risk monitoring
      const checkForAlerts = () => {
        const unreadCount = riskService.getUnreadAlertCount(publicKey);
        setUnreadAlertCount(unreadCount);
      };
      
      // Check immediately and then every 30 seconds
      checkForAlerts();
      const interval = setInterval(checkForAlerts, 30000);
      
      return () => clearInterval(interval);
    } else {
      setUnreadAlertCount(0);
    }
  }, [connected, publicKey, riskService]);
  
  // Handle strategy creation
  const handleStrategyCreated = (strategy: DeFiStrategy) => {
    const completeStrategy = { ...strategy, protocolConfig: strategy.protocolConfig || {} };
    setStrategies(prevStrategies => [...prevStrategies, completeStrategy]);
    if (connected && publicKey && strategy.creatorAddress === publicKey.toString()) {
      setUserStrategies(prevUserStrategies => [...prevUserStrategies, completeStrategy]);
    }
  };
  
  // Generate sample strategies for the demo
  const generateSampleStrategies = (): DeFiStrategy[] => {
    return [
      {
        id: 'strategy_001',
        name: 'Safe Stablecoin Yield',
        description: 'A conservative strategy focusing on generating stable yield from USDC and other stablecoins using lending protocols and staking.',
        protocolType: 'lending' as ProtocolType,
        riskLevel: 'conservative' as DeFiRiskLevel,
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
        },
        protocolConfig: {} as any // Add missing required property
      },
      {
        id: 'strategy_002',
        name: 'Balanced SOL Maximizer',
        description: 'A balanced strategy that maximizes yield from SOL and SOL liquid staking derivatives while maintaining moderate risk exposure.',
        protocolType: 'staking' as ProtocolType,
        riskLevel: 'moderate' as DeFiRiskLevel,
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
        },
        protocolConfig: {} // Add missing required property
      },
      {
        id: 'strategy_003',
        name: 'DeFi Blue Chip Alpha',
        description: 'An aggressive strategy targeting high APY through a combination of blue-chip DeFi protocols on Solana, optimized for maximum returns.',
        protocolType: 'yield_farming' as ProtocolType,
        riskLevel: 'aggressive' as DeFiRiskLevel,
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
        },
        protocolConfig: {} // Add missing required property
      },
      {
        id: 'strategy_004',
        name: 'Meme Token Moonshot',
        description: 'A highly experimental strategy focused on emerging meme tokens with high volatility but potentially explosive returns, optimized by AI for detecting early momentum.',
        protocolType: 'liquidity_providing' as ProtocolType,
        riskLevel: 'experimental' as DeFiRiskLevel,
        estimatedApy: 12000, // 120.00%
        tags: ['Meme', 'Experimental', 'High Risk', 'Liquidity'],
        tvl: 350000, // $350K
        userCount: 45,
        creatorAddress: 'Sonic9BqCxwxHCVKMzqyCK9V6VKZUgjVJ5A5HUzLnTJRE',
        lockupPeriod: 7,
        minInvestment: 50, // $50
        feePercentage: 100, // 1.0%
        tokens: [
          { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', allocation: 25 },
          { symbol: 'BERN', mint: '7SZUzXzvnfEMdVdiKRtNRQJ7ii7Yg7T361aNtMmBgy7K', allocation: 25 },
          { symbol: 'SLERF', mint: '2MKXk7T3qSnLBcf4BKzjfxGUVAo4FsKDsZ1sKpM8xhLd', allocation: 25 },
          { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', allocation: 25 }
        ],
        verified: false,
        protocols: {
          'Raydium': 35,
          'Orca': 35,
          'Meteora': 30
        },
        protocolConfig: {} // Add missing required property
      },
      {
        id: 'strategy_005',
        name: 'AI Token Index',
        description: 'A growth-oriented strategy focusing on AI-related tokens in the Solana ecosystem, optimized for long-term appreciation through exposure to the AI technology trend.',
        protocolType: 'yield_farming' as ProtocolType,
        riskLevel: 'moderate' as DeFiRiskLevel,
        estimatedApy: 2200, // 22.00%
        tags: ['AI', 'Growth', 'Technology', 'Index'],
        tvl: 875000, // $875K
        userCount: 73,
        creatorAddress: 'SonicDXYi8n1Mt9edjcnJLHNQpyJKbXWK5hcZBtJ6GHK9',
        lockupPeriod: 60,
        minInvestment: 50, // $50
        feePercentage: 40, // 0.4%
        tokens: [
          { symbol: 'RENDER', mint: 'rndrizKT3MK1iimdxRdWabWdXS9zJDUJfhp4JGcwq7v', allocation: 30 },
          { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', allocation: 25 },
          { symbol: 'GFX', mint: 'GFX1ZjR2P15tmrSwow6FjyDYcEkoFb4p4gJCpLBjaxHD', allocation: 25 },
          { symbol: 'HNT', mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmTUDrALvDXK7hhh', allocation: 20 }
        ],
        verified: true,
        protocols: {
          'Raydium': 40,
          'Orca': 30,
          'Jupiter': 30
        },
        protocolConfig: {} // Add missing required property
      }
    ];
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Loading SonicAI DeFi Navigator...</h2>
          <p className="text-gray-600 mt-2">Connecting to Solana and initializing AI services</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img src="/sonic-ai-logo.svg" alt="SonicAI Logo" className="h-10 w-10" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold">SonicAI DeFi Navigator</h1>
                <p className="text-indigo-200 text-sm">Intelligent DeFi Strategies powered by AI</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {connected ? (
                <div className="bg-indigo-800 px-4 py-2 rounded-md flex items-center">
                  <div className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium">
                    {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
                  </span>
                </div>
              ) : (
                <button className="bg-white text-indigo-700 px-4 py-2 rounded-md font-medium hover:bg-indigo-50">
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Navigation tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              DeFi Strategies
            </button>
            
            <button
              className={`${
                activeTab === 'create'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('create')}
            >
              Create Strategy
            </button>
            
            <button
              className={`${
                activeTab === 'analytics'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('analytics')}
            >
              Portfolio Analytics
            </button>
            
            <button
              className={`${
                activeTab === 'risk'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm relative`}
              onClick={() => setActiveTab('risk')}
            >
              Risk Monitor
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {unreadAlertCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to SonicAI DeFi Navigator</h2>
                <p className="text-gray-600 mb-4">
                  SonicAI DeFi Navigator leverages artificial intelligence to help you navigate the complex world of 
                  decentralized finance on Solana. Our platform analyzes market conditions, monitors risk, and recommends 
                  optimal strategies to maximize your returns.
                </p>
                
                <div className="bg-indigo-50 border border-indigo-100 rounded-md p-4">
                  <h3 className="font-medium text-indigo-800 mb-2">AI-Powered DeFi Features</h3>
                  <ul className="list-disc pl-5 text-indigo-700 space-y-1">
                    <li>Strategy recommendations based on your risk profile</li>
                    <li>Real-time portfolio monitoring and rebalancing</li>
                    <li>Risk assessment and automated alerts</li>
                    <li>Create custom strategies with AI assistance</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Popular Strategies</h2>
                  <button 
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    onClick={() => setActiveTab('strategies')}
                  >
                    View All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {strategies.slice(0, 4).map(strategy => (
                    <div key={strategy.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{strategy.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          strategy.riskLevel === 'conservative' ? 'bg-green-100 text-green-800' :
                          strategy.riskLevel === 'moderate' ? 'bg-blue-100 text-blue-800' :
                          strategy.riskLevel === 'aggressive' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {strategy.riskLevel.charAt(0).toUpperCase() + strategy.riskLevel.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{strategy.description}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">APY</span>
                        <span className="font-medium text-green-600">{(strategy.estimatedApy / 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">DeFi Market Overview</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Value Locked</span>
                    <span className="font-medium">$9.72B</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">SOL Price</span>
                    <span className="font-medium">$112.57</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Market Condition</span>
                    <span className="font-medium text-green-600">Bullish</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average DeFi APY</span>
                    <span className="font-medium">12.4%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Volatility Index</span>
                    <span className="font-medium">5.8 / 10</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Get Started</h2>
                <div className="space-y-4">
                  <button
                    className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 hover:bg-indigo-700 transition-colors"
                    onClick={() => setActiveTab('strategies')}
                  >
                    Browse Strategies
                  </button>
                  <button
                    className="w-full bg-green-600 text-white rounded-md py-2 px-4 hover:bg-green-700 transition-colors"
                    onClick={() => setActiveTab('create')}
                  >
                    Create Custom Strategy
                  </button>
                  <button
                    className="w-full bg-blue-600 text-white rounded-md py-2 px-4 hover:bg-blue-700 transition-colors"
                    onClick={() => setActiveTab('analytics')}
                    disabled={!connected}
                  >
                    Analyze Portfolio
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'strategies' && (
          <div>
            <DeFiStrategyComponent connection={connection} />
          </div>
        )}
        
        {activeTab === 'create' && (
          <div>
            <AIStrategyGeneratorComponent 
              connection={connection} 
             // onStrategyCreated={handleStrategyCreated} 
            />
          </div>
        )}
        
        {activeTab === 'analytics' && (
          <div>
            <PortfolioAnalyticsComponent connection={connection} />
          </div>
        )}
        
        {activeTab === 'risk' && (
          <div>
            <PriceAlertComponent tokens={[]} />
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center">
                <img src="/sonic-ai-logo.svg" alt="SonicAI Logo" className="h-8 w-8" />
                <span className="ml-2 text-lg font-semibold">SonicAI DeFi Navigator</span>
              </div>
              <p className="text-gray-400 text-sm mt-1">Built on Sonic SVM for the Sonic Mobius Hackathon</p>
            </div>
            
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white">Documentation</a>
              <a href="#" className="text-gray-400 hover:text-white">Github</a>
              <a href="#" className="text-gray-400 hover:text-white">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Wrapped application with necessary providers
 */
const SonicAINavigatorAppWrapper: React.FC = () => {
  // Initialize connection to Solana
  const [connection] = useState<Connection>(
    new Connection(process.env.REACT_APP_RPC_URL || 'https://api.mainnet-beta.solana.com')
  );
  
  return (
    <WalletProvider wallets={[]} autoConnect>
      <NotificationProvider>
        <SonicAINavigatorApp connection={connection} />
      </NotificationProvider>
    </WalletProvider>
  ); 
};

export default SonicAINavigatorAppWrapper;