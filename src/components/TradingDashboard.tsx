import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Price feed IDs for the assets we want to track
const PRICE_FEED_IDS = {
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
};

// Period options for the chart
const PERIOD_OPTIONS = [
  { label: '1 Hour', value: 60 },
  { label: '4 Hours', value: 240 },
  { label: '1 Day', value: 1440 },
  { label: '1 Week', value: 10080 }
];

// Strategy options for AI-based trading
const STRATEGY_OPTIONS = [
  { label: 'Momentum', value: 'momentum' },
  { label: 'Trend Following', value: 'trend' },
  { label: 'Mean Reversion', value: 'reversion' }
];

interface PriceData {
  id: string;
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
  change24h: number;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence_score: number;
}

interface TradeHistory {
  timestamp: number;
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  txid?: string;
}

interface ChartData {
  timestamp: number;
  [key: string]: number | string | Date;
}

// Main Trading Dashboard Component
const TradingDashboard: React.FC = () => {
  const { publicKey, wallet, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedAsset, setSelectedAsset] = useState<string>("BTC/USD");
  const [selectedPeriod, setSelectedPeriod] = useState<number>(240); // 4 hours
  const [selectedStrategy, setSelectedStrategy] = useState<string>("momentum");
  const [priceData, setPriceData] = useState<Map<string, PriceData>>(new Map());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [isTrading, setIsTrading] = useState<boolean>(false);
  const [aiPrediction, setAiPrediction] = useState<{ price: number, timestamp: number, confidence: number } | null>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize Pyth client
  const hermesClient = new HermesClient("https://hermes.pyth.network/", {});
  
  // Get real-time price updates
  useEffect(() => {
    if (!publicKey) return;

    const fetchPrices = async () => {
      try {
        setIsLoading(true);
        const feedIds = Object.values(PRICE_FEED_IDS);
        const priceUpdates = await hermesClient.getLatestPriceUpdates(feedIds);

        if (!priceUpdates || !priceUpdates.parsed) {
          throw new Error('No price updates available');
        }

        const newPriceData = new Map<string, PriceData>();

        priceUpdates.parsed.forEach((update: any) => {
          const symbol = (Object.keys(PRICE_FEED_IDS) as (keyof typeof PRICE_FEED_IDS)[]).find(
            key => PRICE_FEED_IDS[key] === update.id
          ) || 'Unknown';

          const price = update.price.price * Math.pow(10, update.price.expo);

          newPriceData.set(update.id, {
            id: update.id,
            symbol,
            price,
            confidence: update.price.conf * Math.pow(10, update.price.expo),
            timestamp: update.price.publish_time * 1000,
            change24h: Math.random() * 10 - 5, // Mock 24h change (replace with real data)
            recommendation: ['buy', 'sell', 'hold'][(Math.floor(Math.random() * 3))] as 'buy' | 'sell' | 'hold', // Mock recommendation
            confidence_score: Math.random() * 0.6 + 0.3 // Mock confidence
          });
        });

        setPriceData(newPriceData);
        fetchHistoricalData(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS], selectedPeriod);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching price data:', err);
        setError('Failed to fetch price data');
        setIsLoading(false);
      }
    };

    fetchPrices();
    const intervalId = setInterval(fetchPrices, 15000); // Update every 15 seconds

    return () => clearInterval(intervalId);
  }, [publicKey, selectedAsset, selectedPeriod]);
  
  // Fetch historical price data for charts
  const fetchHistoricalData = async (feedId: string, period: number) => {
    try {
      // In a real app, you would fetch historical data from an API
      // Here we'll generate some mock data for demonstration
      const now = Date.now();
      const intervalMs = period * 60 * 1000 / 60; // Convert to milliseconds, 60 data points
      
      const mockData: ChartData[] = [];
      const selectedSymbol = (Object.keys(PRICE_FEED_IDS) as (keyof typeof PRICE_FEED_IDS)[]).find(
        key => PRICE_FEED_IDS[key] === feedId
      ) || 'Unknown';
      
      // Get the current price as a base
      const currentData = priceData.get(feedId);
      const currentPrice = currentData?.price || 50000;
      
      // Generate historical data
      for (let i = 60; i >= 0; i--) {
        const timestamp = now - (i * intervalMs);
        const volatility = selectedAsset.includes('BTC') ? 0.02 : 
                          selectedAsset.includes('ETH') ? 0.03 : 0.04;
        
        // Create some realistic price movement
        const randomFactor = 1 + ((Math.random() - 0.5) * volatility);
        const price = currentPrice * Math.pow(randomFactor, i / 10);
        
        mockData.push({
          timestamp,
          date: new Date(timestamp),
          [selectedSymbol]: price
        });
      }
      
      setChartData(mockData);
      
      // Generate AI prediction
      const lastPrice = mockData[mockData.length - 1][selectedSymbol] as number;
      const predictedChange = (Math.random() * 0.06) - 0.02; // -2% to +4%
      const predictedPrice = lastPrice * (1 + predictedChange);
      
      setAiPrediction({
        price: predictedPrice,
        timestamp: now + 24 * 60 * 60 * 1000, // 24 hours in the future
        confidence: 0.7 + (Math.random() * 0.2) // 70-90% confidence
      });
      
    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError('Failed to fetch historical data');
    }
  };
  
  // Execute a trade (demonstration only)
  const executeTrade = async (action: 'buy' | 'sell') => {
    if (!publicKey || !wallet) {
      setError('Please connect your wallet');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // In a real app, you would:
      // 1. Create a transaction for the trade
      // 2. Post price updates to Solana
      // 3. Execute the trade on a DEX
      
      // For this demo, we'll just simulate a successful trade
      setTimeout(() => {
        const currentData = priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS]);
        
        if (currentData) {
          const newTrade: TradeHistory = {
            timestamp: Date.now(),
            symbol: currentData.symbol,
            action,
            price: currentData.price,
            amount: action === 'buy' ? 0.01 : 0.01,
            status: 'completed',
            txid: Array(64).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)).join('')
          };
          
          setTradeHistory(prev => [newTrade, ...prev]);
          
          // Update mock balance
          setAccountBalance(prev => 
            action === 'buy' 
              ? prev - (currentData.price * 0.01) 
              : prev + (currentData.price * 0.01)
          );
        }
        
        setIsLoading(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error executing trade:', err);
      setError('Failed to execute trade');
      setIsLoading(false);
    }
  };
  
  // Toggle AI trading bot
  const toggleAutomatedTrading = () => {
    setIsTrading(!isTrading);
    
    if (!isTrading) {
      // Start automated trading (demonstration)
      alert('Automated trading would start here with the selected strategy: ' + selectedStrategy);
    } else {
      // Stop automated trading
      alert('Automated trading stopped');
    }
  };
  
  // Fetch wallet balance
  useEffect(() => {
    if (!publicKey) return;
    
    const fetchBalance = async () => {
      try {
        const connection = new Connection('https://api.mainnet-alpha.sonic.game', 'confirmed');
        const balance = await connection.getBalance(publicKey);
        setAccountBalance(balance / 1e9); // Convert from lamports to SOL
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    };
    
    fetchBalance();
  }, [publicKey]);
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Trading Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            {publicKey ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Balance:</span>
                <span className="font-bold">{accountBalance.toFixed(4)} SOL</span>
                <span className="px-2 py-1 bg-green-900 rounded-md text-sm">Connected: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}</span>
              </div>
            ) : (
              <span className="px-2 py-1 bg-red-900 rounded-md text-sm">Wallet Not Connected</span>
            )}
          </div>
        </div>
      </header>
      
      {error && (
        <div className="bg-red-900 px-4 py-2 text-center">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="underline ml-2">Dismiss</button>
        </div>
      )}
      
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Overview */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Price Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from(priceData.values()).map((data) => (
              <div 
                key={data.id} 
                className={`p-4 rounded-lg ${selectedAsset === data.symbol ? 'bg-blue-900 border border-blue-500' : 'bg-gray-700'} cursor-pointer`}
                onClick={() => setSelectedAsset(data.symbol)}
              >
                <div className="flex justify-between">
                  <h3 className="font-bold">{data.symbol}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    data.recommendation === 'buy' ? 'bg-green-700' : 
                    data.recommendation === 'sell' ? 'bg-red-700' : 'bg-gray-600'
                  }`}>
                    {data.recommendation.toUpperCase()}
                  </span>
                </div>
                
                <div className="text-2xl font-bold mt-2">${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                
                <div className="flex justify-between mt-2 text-sm">
                  <span className={`${data.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change24h >= 0 ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%
                  </span>
                  <span className="text-gray-400">Conf: ±${data.confidence.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Chart */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{selectedAsset} Price Chart</h2>
            
            <div className="flex items-center space-x-2">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
              >
                {PERIOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                    stroke="#9CA3AF"
                  />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.25rem' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, selectedAsset]}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey={selectedAsset.split('/')[0]} 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  
                  {/* AI Prediction Point */}
                  {aiPrediction && (
                    <Line 
                      type="monotone" 
                      dataKey="prediction"
                      stroke="#10B981" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Loading chart data...</p>
              </div>
            )}
          </div>
          
          {/* AI Prediction */}
          {aiPrediction && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">AI Price Prediction (24h)</h3>
              <div className="flex justify-between">
                <div>
                  <span className="text-lg font-bold">${aiPrediction.price.toFixed(2)}</span>
                  <span className={`ml-2 ${aiPrediction.price > (priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.price || 0) ? 'text-green-400' : 'text-red-400'}`}>
                    {aiPrediction.price > (priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.price || 0) ? '↑' : '↓'} 
                    {(Math.abs(aiPrediction.price - (priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.price || 0)) / (priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.price || 1) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  Confidence: {(aiPrediction.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Trading Panel */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Trading Controls</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trading Strategy</label>
              <select 
                value={selectedStrategy} 
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                {STRATEGY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => executeTrade('buy')}
                disabled={isLoading || !publicKey}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Buy {selectedAsset.split('/')[0]}
              </button>
              
              <button 
                onClick={() => executeTrade('sell')}
                disabled={isLoading || !publicKey}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Sell {selectedAsset.split('/')[0]}
              </button>
            </div>
            
            <div className="pt-4 border-t border-gray-700">
              <button 
                onClick={toggleAutomatedTrading}
                disabled={!publicKey}
                className={`w-full font-bold py-3 px-4 rounded disabled:opacity-50 ${
                  isTrading ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isTrading ? 'Stop AI Trading Bot' : 'Start AI Trading Bot'}
              </button>
              
              <p className="text-sm text-gray-400 mt-2">
                {isTrading 
                  ? `AI trading bot is active using ${selectedStrategy} strategy` 
                  : 'Start automated trading based on AI predictions'}
              </p>
            </div>
          </div>
          
          {/* Recommendation */}
          {priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS]) && (
            <div className="mt-6 p-3 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">AI Recommendation</h3>
              
              <div className="flex items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ${
                  priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.recommendation === 'buy' ? 'bg-green-900 text-green-300' : 
                  priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.recommendation === 'sell' ? 'bg-red-900 text-red-300' : 
                  'bg-gray-600 text-gray-300'
                }`}>
                  {priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.recommendation.toUpperCase()}
                </div>
                
                <div className="ml-4">
                  <div className="font-semibold">
                    {priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.recommendation === 'buy' ? 'Strong Buy Signal' : 
                     priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.recommendation === 'sell' ? 'Strong Sell Signal' : 
                     'Hold Position'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Confidence: {(priceData.get(PRICE_FEED_IDS[selectedAsset as keyof typeof PRICE_FEED_IDS])?.confidence_score || 0) * 100}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Recent Trades */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
          
          {tradeHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 px-4 text-left">Time</th>
                    <th className="py-2 px-4 text-left">Asset</th>
                    <th className="py-2 px-4 text-left">Action</th>
                    <th className="py-2 px-4 text-left">Price</th>
                    <th className="py-2 px-4 text-left">Amount</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory.map((trade, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="py-2 px-4">{new Date(trade.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-4">{trade.symbol}</td>
                      <td className={`py-2 px-4 ${trade.action === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.action.toUpperCase()}
                      </td>
                      <td className="py-2 px-4">${trade.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="py-2 px-4">{trade.amount}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          trade.status === 'completed' ? 'bg-green-700' : 
                          trade.status === 'pending' ? 'bg-yellow-700' : 'bg-red-700'
                        }`}>
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {trade.txid ? (
                          <a 
                            href={`https://explorer.sonic.game/tx/${trade.txid}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 underline"
                          >
                            {trade.txid.slice(0, 8)}...{trade.txid.slice(-8)}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              No trades executed yet
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-gray-800 px-6 py-4 border-t border-gray-700">
        <div className="text-center text-gray-400 text-sm">
          <p>AI Trading Dashboard powered by Pyth Network on Sonic SVM</p>
          <p className="mt-1">Prices are sourced from Pyth Network and may vary from other sources</p>
        </div>
      </footer>
    </div>
  );
};

export default TradingDashboard;