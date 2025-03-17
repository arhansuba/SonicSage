import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from '@coral-xyz/anchor';
import { SonicAgent } from '../services/SonicAgent';
import { JupiterService } from '../services/JupiterService';
import { MarketDataService } from '../services/MarketDataService';
import { JupiterTradingStrategy, TradeRecommendation } from '../services/JupiterTradingStrategy';
import { PortfolioRebalancer, RebalanceAction } from '../services/PortfolioRebalancer';
import { NotificationService, Notification } from '../services/NotificationService';
import { NotificationType } from '../types/notification';
import { Portfolio, PortfolioPerformance } from '../types/api';
import { ENDPOINT_SONIC_RPC } from '../constants/endpoints';

// Define interfaces for the data structures
interface AgentConfig {
  status: 'active' | 'paused' | 'inactive';
  name: string;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  autoTrade: boolean;
  autoRebalance: boolean;
  maxTradesPerDay: number;
  maxAmountPerTrade: number;
  maxSlippageBps: number;
  rebalanceThreshold: number;
}

// Create a wallet adapter to bridge between wallet-adapter-react and @coral-xyz/anchor
class AnchorWalletAdapter implements Wallet {
  publicKey: PublicKey;
  
  constructor(public wallet: any) {
    this.publicKey = wallet.publicKey;
  }

  async signTransaction<T>(tx: T): Promise<T> {
    return await this.wallet.signTransaction(tx);
  }

  async signAllTransactions<T>(txs: T[]): Promise<T[]> {
    return await this.wallet.signAllTransactions(txs);
  }

  get payer(): Keypair {
    // This is needed for the Anchor Wallet interface
    return Keypair.fromSecretKey(this.wallet.secretKey);
  }
}

interface Services {
  connection: Connection;
  notificationService: NotificationService;
  sonicAgent: SonicAgent;
  jupiterService: JupiterService;
  marketDataService: MarketDataService;
  tradingStrategy: JupiterTradingStrategy;
  portfolioRebalancer: PortfolioRebalancer;
}

// Initialize services
const initializeServices = (wallet: any): Services => {
  const connection = new Connection(ENDPOINT_SONIC_RPC, 'confirmed');
  const notificationService = NotificationService.getInstance();
  const sonicAgent = new SonicAgent(connection, notificationService);
  
  // Create an adapter that implements the Anchor Wallet interface
  const anchorWallet = new AnchorWalletAdapter(wallet);
  
  // Pass the API key as undefined since it's optional
  const jupiterService = new JupiterService(connection, undefined, notificationService);
  const marketDataService = new MarketDataService(connection, jupiterService);
  const tradingStrategy = new JupiterTradingStrategy(
    connection,
    sonicAgent,
    jupiterService,
    marketDataService,
    notificationService
  );
  const portfolioRebalancer = new PortfolioRebalancer(
    connection,
    sonicAgent,
    jupiterService,
    marketDataService,
    notificationService
  );
  
  return {
    connection,
    notificationService,
    sonicAgent,
    jupiterService,
    marketDataService,
    tradingStrategy,
    portfolioRebalancer
  };
};

const SonicAgentDashboard: React.FC = () => {
  const wallet = useWallet();
  const [tab, setTab] = useState<'portfolio' | 'recommendations' | 'rebalance' | 'settings'>('portfolio');
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioPerformance, setPortfolioPerformance] = useState<PortfolioPerformance | null>(null);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [needsRebalance, setNeedsRebalance] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [services, setServices] = useState<Services | null>(null);
  
  // Initialize services when wallet is connected
  useEffect(() => {
    if (wallet && wallet.connected && wallet.publicKey) {
      const services = initializeServices(wallet);
      setServices(services);
      
      // Subscribe to notifications
      const unsubscribe = services.notificationService.addListener((notifications: Notification[]) => {
        setNotifications(notifications);
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [wallet]);
  
  // Load agent data when services are initialized
  useEffect(() => {
    if (services && wallet && wallet.connected && wallet.publicKey) {
      loadAgentData();
    }
  }, [services, wallet]);
  
  // Refresh data periodically
  useEffect(() => {
    if (services && wallet && wallet.connected && wallet.publicKey) {
      const interval = setInterval(() => {
        loadAgentData();
      }, 60000); // Refresh every minute
      
      return () => clearInterval(interval);
    }
  }, [services, wallet]);
  
  // Load agent data
  const loadAgentData = async (): Promise<void> => {
    if (!services || !wallet || !wallet.connected || !wallet.publicKey) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const walletPublicKey = wallet.publicKey.toString();
      
      // Load agent config
      const config = await services.sonicAgent.getAgentConfig(walletPublicKey);
      setAgentConfig(config);
      
      // Load portfolio data
      const portfolio = await services.sonicAgent.getPortfolio(walletPublicKey);
      
      // Convert timestamps from string to number if needed
      if (portfolio) {
        setPortfolio(portfolio);
      }
      
      // Load portfolio performance
      const performance = await services.sonicAgent.getPortfolioPerformance(walletPublicKey);
      
      // Convert timestamps from string to number if needed
      if (performance) {
        const convertedPerformance: PortfolioPerformance = {
          ...performance,
          dataPoints: performance.dataPoints.map(point => ({
            ...point,
            timestamp: typeof point.timestamp === 'string' ? new Date(point.timestamp).toISOString() : new Date(point.timestamp).toISOString()
          }))
        };
        setPortfolioPerformance(convertedPerformance);
      }
      
      // Check if portfolio needs rebalancing
      const needsRebalance = await services.portfolioRebalancer.checkRebalanceNeeded(walletPublicKey);
      setNeedsRebalance(needsRebalance);
      
      if (needsRebalance) {
        // Get rebalance actions
        const actions = await services.portfolioRebalancer.getRebalanceActions(walletPublicKey);
        setRebalanceActions(actions);
      }
      
      // Get trading recommendations
      const recs = await services.tradingStrategy.getRecommendations(walletPublicKey);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading agent data:', error);
      setError(error instanceof Error ? error.message : 'Error loading agent data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Execute a recommended trade
  const executeTrade = async (recommendation: TradeRecommendation): Promise<{ success: boolean } | undefined> => {
    if (!services || !wallet || !wallet.connected || !wallet.publicKey) {
      return;
    }
    
    try {
      // Create an Anchor wallet adapter for the connected wallet
      const anchorWallet = new AnchorWalletAdapter(wallet);
      
      // Call the strategy with the wallet public key and the Anchor wallet adapter
      const result = await services.tradingStrategy.executeTrade(
        wallet.publicKey.toString(),
        anchorWallet,
        recommendation
      );
      
      if (result.success) {
        // Reload data after successful trade
        loadAgentData();
      }
      
      return result;
    } catch (error) {
      console.error('Error executing trade:', error);
      services.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Trade Failed',
        message: error instanceof Error ? error.message : 'Error executing trade'
      });
    }
  };
  
  // Execute portfolio rebalance
  const executeRebalance = async (): Promise<{ success: boolean } | undefined> => {
    if (!services || !wallet || !wallet.connected || !wallet.publicKey || rebalanceActions.length === 0) {
      return;
    }
    
    try {
      // Create an Anchor wallet adapter for the connected wallet
      const anchorWallet = new AnchorWalletAdapter(wallet);
      
      const result = await services.portfolioRebalancer.executeRebalance(
        wallet.publicKey.toString(),
        anchorWallet,
        rebalanceActions
      );
      
      if (result.success) {
        // Reload data after successful rebalance
        loadAgentData();
      }
      
      return result;
    } catch (error) {
      console.error('Error executing rebalance:', error);
      services.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Rebalance Failed',
        message: error instanceof Error ? error.message : 'Error executing rebalance'
      });
    }
  };
  
  // Start or stop the agent
  const toggleAgentStatus = async (): Promise<void> => {
    if (!services || !wallet || !wallet.connected || !wallet.publicKey || !agentConfig) {
      return;
    }
    
    try {
      if (agentConfig.status === 'active') {
        // Stop agent
        await services.sonicAgent.stopAgent(wallet.publicKey.toString());
      } else {
        // Start agent
        await services.sonicAgent.startAgent(wallet.publicKey.toString());
      }
      
      // Reload agent config
      const config = await services.sonicAgent.getAgentConfig(wallet.publicKey.toString());
      setAgentConfig(config);
    } catch (error) {
      console.error('Error toggling agent status:', error);
      services.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error toggling agent status'
      });
    }
  };
  
  // Render loading state
  if (isLoading && !portfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agent data...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && !portfolio) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }
  
  // Render main dashboard
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Agent Status Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">SonicAgent Dashboard</h1>
          {agentConfig && (
            <div className="flex items-center mt-2">
              <span className="mr-2">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                agentConfig.status === 'active' ? 'bg-green-100 text-green-800' :
                agentConfig.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {agentConfig.status.toUpperCase()}
              </span>
              <button 
                onClick={toggleAgentStatus}
                className={`ml-4 px-3 py-1 rounded text-white ${
                  agentConfig.status === 'active' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {agentConfig.status === 'active' ? 'Stop Agent' : 'Start Agent'}
              </button>
            </div>
          )}
        </div>
        
        {/* Notification Badge */}
        <div className="relative">
          <button className="p-2 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px">
          <button 
            onClick={() => setTab('portfolio')}
            className={`py-3 px-4 text-center border-b-2 font-medium text-sm ${
              tab === 'portfolio' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Portfolio
          </button>
          <button 
            onClick={() => setTab('recommendations')}
            className={`py-3 px-4 text-center border-b-2 font-medium text-sm ${
              tab === 'recommendations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Recommendations
          </button>
          <button 
            onClick={() => setTab('rebalance')}
            className={`py-3 px-4 text-center border-b-2 font-medium text-sm ${
              tab === 'rebalance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Rebalance
            {needsRebalance && (
              <span className="ml-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded">
                Needed
              </span>
            )}
          </button>
          <button 
            onClick={() => setTab('settings')}
            className={`py-3 px-4 text-center border-b-2 font-medium text-sm ${
              tab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>
      
      {/* Portfolio Tab */}
      {tab === 'portfolio' && portfolio && (
        <div>
          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-gray-500 text-sm font-medium mb-2">Total Value</h3>
              <div className="flex items-baseline">
                <span className="text-3xl font-semibold text-gray-900">${portfolio.totalValue.toFixed(2)}</span>
                {portfolioPerformance && (
                  <span className={`ml-2 text-sm font-medium ${
                    portfolioPerformance.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {portfolioPerformance.percentageChange >= 0 ? '+' : ''}
                    {portfolioPerformance.percentageChange.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-gray-500 text-sm font-medium mb-2">Today's Profit/Loss</h3>
              <div className="flex items-baseline">
                {portfolioPerformance && portfolioPerformance.dataPoints.length > 0 && (
                  <>
                    <span className={`text-3xl font-semibold ${
                      portfolioPerformance.dataPoints[portfolioPerformance.dataPoints.length - 1].profitLoss >= 0 
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {portfolioPerformance.dataPoints[portfolioPerformance.dataPoints.length - 1].profitLoss >= 0 ? '+' : ''}
                      ${portfolioPerformance.dataPoints[portfolioPerformance.dataPoints.length - 1].profitLoss.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-gray-500 text-sm font-medium mb-2">Risk Profile</h3>
              <div className="flex items-baseline">
                <span className="text-3xl font-semibold text-gray-900 capitalize">
                  {agentConfig ? agentConfig.riskProfile : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Portfolio Performance Chart */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Portfolio Performance</h3>
            {portfolioPerformance && portfolioPerformance.dataPoints.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={portfolioPerformance.dataPoints}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(timestamp: number) => new Date(timestamp).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
                      labelFormatter={(timestamp: number) => new Date(timestamp).toLocaleDateString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      activeDot={{ r: 8 }}
                      name="Portfolio Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">No performance data available</div>
            )}
          </div>
          
          {/* Asset Allocation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Allocation Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Asset Allocation</h3>
              {portfolio && portfolio.assets.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolio.assets.map(asset => ({
                          name: asset.symbol,
                          value: asset.value // Use value instead of usdValue to match the API type
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }: { name: string, percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {portfolio.assets.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 25 % 360}, 70%, 60%)`} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-12">No assets available</div>
              )}
            </div>
            
            {/* Asset List */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assets</h3>
              {portfolio && portfolio.assets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {portfolio.assets.map((asset, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold mr-3">
                                {asset.symbol.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{asset.symbol}</div>
                                <div className="text-xs text-gray-500">{asset.name || asset.symbol}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                            {asset.balance.toFixed(asset.decimals === 6 ? 2 : 4)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                            ${asset.value.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-12">No assets available</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* AI Recommendations Tab */}
      {tab === 'recommendations' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">AI Trading Recommendations</h2>
            <button 
              onClick={loadAgentData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Recommendations
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Analyzing market data...</p>
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{recommendation.strategyName}</h3>
                        <p className="text-gray-500 text-sm">{recommendation.reason}</p>
                      </div>
                      <div className="flex items-center">
                        <div className="mr-4 text-right">
                          <div className="text-sm text-gray-500">Confidence</div>
                          <div className="text-xl font-semibold">{recommendation.confidence}%</div>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          recommendation.confidence > 80 ? 'bg-green-100 text-green-800' :
                          recommendation.confidence > 60 ? 'bg-blue-100 text-blue-800' :
                          recommendation.confidence > 40 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {recommendation.confidence > 80 ? '👍' :
                           recommendation.confidence > 60 ? '👌' :
                           recommendation.confidence > 40 ? '👀' :
                           '👎'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Trade Details */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-3">Trade Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">From</div>
                            <div className="text-lg font-medium">
                              {recommendation.inputAmount.toFixed(4)} {recommendation.inputSymbol}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">To</div>
                            <div className="text-lg font-medium">
                              ~{recommendation.estimatedOutputAmount.toFixed(4)} {recommendation.outputSymbol}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Price Impact</div>
                            <div className={`text-sm font-medium ${
                              recommendation.priceImpact > 1 ? 'text-red-600' :
                              recommendation.priceImpact > 0.5 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {recommendation.priceImpact.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* AI Signals */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-3">AI Signals</h4>
                        <div className="space-y-2">
                          {recommendation.signals.map((signal, signalIndex) => (
                            <div key={signalIndex} className="flex items-center justify-between">
                              <div className="text-sm">{signal.name}</div>
                              <div className={`text-sm font-medium ${
                                signal.impact === 'positive' ? 'text-green-600' :
                                signal.impact === 'negative' ? 'text-red-600' :
                                'text-gray-600'
                              }`}>
                                {signal.impact === 'positive' ? '✓' :
                                 signal.impact === 'negative' ? '✗' :
                                 '○'} {signal.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => executeTrade(recommendation)}
                        className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Execute Trade
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No Recommendations Available</h3>
              <p className="mt-2 text-gray-500">Based on your portfolio and market conditions, we don't have any trading recommendations at this time.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Rebalance Tab */}
      {tab === 'rebalance' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Portfolio Rebalancing</h2>
            <div>
              {needsRebalance && (
                <span className="mr-4 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                  Rebalance Needed
                </span>
              )}
              <button 
                onClick={loadAgentData}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Analyze Portfolio
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Analyzing portfolio allocation...</p>
              </div>
            </div>
          ) : needsRebalance && rebalanceActions.length > 0 ? (
            <div>
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rebalance Actions</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deviation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rebalanceActions.map((action, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              action.operation === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {action.operation === 'buy' ? 'Buy' : 'Sell'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {action.fromSymbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {action.toSymbol}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                            {action.amount.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                            {action.currentPercentage.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                            {action.targetPercentage.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                            <span className={action.deviation > 0 ? 'text-red-600' : 'text-green-600'}>
                              {action.deviation > 0 ? '+' : ''}{action.deviation.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={executeRebalance}
                    className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Execute Rebalance
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Portfolio is Balanced</h3>
              <p className="mt-2 text-gray-500">Your portfolio allocation is within the target thresholds. No rebalancing is needed at this time.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Settings Tab */}
      {tab === 'settings' && agentConfig && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Agent Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.name}
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Risk Profile</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.riskProfile}
                    disabled
                  >
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={agentConfig.autoTrade}
                    readOnly
                    disabled
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Auto-trade based on AI recommendations
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={agentConfig.autoRebalance}
                    readOnly
                    disabled
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Auto-rebalance portfolio when needed
                  </label>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Trading Rules</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Trades Per Day</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.maxTradesPerDay}
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount Per Trade ($)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.maxAmountPerTrade}
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Slippage (bps)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.maxSlippageBps}
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rebalance Threshold (%)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={agentConfig.rebalanceThreshold}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <p className="text-sm text-gray-500">
              Note: This dashboard currently displays settings in read-only mode. Use the SonicAgent SDK to update these settings programmatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SonicAgentDashboard;