import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

// Install this package with: npm install @tremor/react
import { BarList, Bold, Flex, Grid, Metric, Text, Title, Badge } from '@tremor/react';

// Define interfaces for type safety
interface PriceDataItem {
  time: string;
  timestamp: number;
  btcPrice: number | null;
  ethPrice: number | null;
  solPrice: number | null;
  btcPredicted: number | null;
  ethPredicted: number | null;
  solPredicted: number | null;
  portfolio: number | null;
}

interface TradingSignal {
  id: number;
  asset: string;
  type: string;
  confidence: number;
  price: number;
  timestamp: number;
  reason: string;
}

interface PortfolioItem {
  asset: string;
  allocation: number;
  value: number;
  change24h: number;
}

interface PerformanceMetrics {
  overallReturn: number;
  lastWeekReturn: number;
  winRate: number;
  avgTradeReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  trades: {
    total: number;
    successful: number;
    failed: number;
  };
  hourlyReturns: Array<{
    hour: string;
    return: number;
  }>;
}

// Mock data to simulate real-time trading data
const generateMockData = (): PriceDataItem[] => {
  const now = new Date();
  const data: PriceDataItem[] = [];
  
  // Generate the last 24 hours of data
  for (let i = 0; i < 24; i++) {
    const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    
    // Generate BTC price with some randomness around a trend
    const btcBase = 68000;
    const btcTrend = Math.sin(i / 8) * 1000;
    const btcNoise = (Math.random() - 0.5) * 500;
    const btcPrice = btcBase + btcTrend + btcNoise;
    
    // Generate ETH price with similar pattern
    const ethBase = 3750;
    const ethTrend = Math.sin(i / 7) * 80;
    const ethNoise = (Math.random() - 0.5) * 40;
    const ethPrice = ethBase + ethTrend + ethNoise;
    
    // Generate SOL price
    const solBase = 175;
    const solTrend = Math.sin(i / 6) * 5;
    const solNoise = (Math.random() - 0.5) * 3;
    const solPrice = solBase + solTrend + solNoise;
    
    data.push({
      time: time.toISOString(),
      timestamp: time.getTime(),
      btcPrice: btcPrice,
      ethPrice: ethPrice,
      solPrice: solPrice,
      btcPredicted: null,
      ethPredicted: null,
      solPredicted: null,
      portfolio: 25000 + Math.sin(i / 6) * 1000 + i * 50
    });
  }
  
  // Add predictions for the next 6 hours
  for (let i = 0; i < 6; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    
    // Get the last data point's values with proper typing
    const lastData = data[data.length - 1];
    const lastBtc: number = lastData.btcPrice !== null ? lastData.btcPrice : 0;
    const lastEth: number = lastData.ethPrice !== null ? lastData.ethPrice : 0;
    const lastSol: number = lastData.solPrice !== null ? lastData.solPrice : 0;
    
    // Predictions have increasing uncertainty (wider spreads)
    const btcTrend = Math.sin((24 + i) / 8) * 1000;
    const btcNoise = (Math.random() - 0.5) * 500 * (1 + i / 5);
    const btcPredicted: number = lastBtc + (btcTrend + btcNoise) * 0.2;
    
    const ethTrend = Math.sin((24 + i) / 7) * 80;
    const ethNoise = (Math.random() - 0.5) * 40 * (1 + i / 5);
    const ethPredicted: number = lastEth + (ethTrend + ethNoise) * 0.2;
    
    const solTrend = Math.sin((24 + i) / 6) * 5;
    const solNoise = (Math.random() - 0.5) * 3 * (1 + i / 5);
    const solPredicted: number = lastSol + (solTrend + solNoise) * 0.2;
    
    data.push({
      time: time.toISOString(),
      timestamp: time.getTime(),
      btcPrice: null, // No actual price for future
      ethPrice: null,
      solPrice: null,
      btcPredicted: btcPredicted,
      ethPredicted: ethPredicted,
      solPredicted: solPredicted,
      portfolio: null
    });
  }
  
  return data;
};

// Generate mock trading signals
const generateMockSignals = (): TradingSignal[] => {
  return [
    {
      id: 1,
      asset: 'BTC/USD',
      type: 'buy',
      confidence: 0.85,
      price: 67950.25,
      timestamp: new Date().getTime() - 1800000, // 30 minutes ago
      reason: 'Predicted 2.3% increase in next 3 hours with positive EMA crossover'
    },
    {
      id: 2,
      asset: 'SOL/USD',
      type: 'sell',
      confidence: 0.72,
      price: 177.38,
      timestamp: new Date().getTime() - 3600000, // 1 hour ago
      reason: 'Momentum shift detected with increasing sell volume'
    },
    {
      id: 3,
      asset: 'ETH/USD',
      type: 'hold',
      confidence: 0.63,
      price: 3782.19,
      timestamp: new Date().getTime() - 7200000, // 2 hours ago
      reason: 'Neutral oscillator readings with sideways EMA movement'
    }
  ];
};

// Generate mock portfolio data
const generateMockPortfolio = (): PortfolioItem[] => {
  return [
    { asset: 'BTC', allocation: 40, value: 12563.82, change24h: 1.8 },
    { asset: 'ETH', allocation: 25, value: 7852.33, change24h: -0.7 },
    { asset: 'SOL', allocation: 20, value: 6120.05, change24h: 2.3 },
    { asset: 'USDC', allocation: 15, value: 4515.12, change24h: 0.0 }
  ];
};

// Generate mock performance metrics
const generateMockPerformance = (): PerformanceMetrics => {
  return {
    overallReturn: 18.7,
    lastWeekReturn: 2.3,
    winRate: 68,
    avgTradeReturn: 1.2,
    sharpeRatio: 1.8,
    maxDrawdown: -7.5,
    trades: {
      total: 87,
      successful: 59,
      failed: 28
    },
    hourlyReturns: [
      { hour: '00:00', return: 0.2 },
      { hour: '04:00', return: -0.3 },
      { hour: '08:00', return: 0.8 },
      { hour: '12:00', return: 0.5 },
      { hour: '16:00', return: -0.1 },
      { hour: '20:00', return: 0.3 }
    ]
  };
};

const SonicAIDashboard = () => {
  const [priceData, setPriceData] = useState<PriceDataItem[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    overallReturn: 0,
    lastWeekReturn: 0,
    winRate: 0,
    avgTradeReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    trades: {
      total: 0,
      successful: 0,
      failed: 0
    },
    hourlyReturns: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState(5); // 1-10 scale
  const [activeTab, setActiveTab] = useState('overview');
  
  // Simulate loading data
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate API calls
    setTimeout(() => {
      setPriceData(generateMockData());
      setSignals(generateMockSignals());
      setPortfolio(generateMockPortfolio());
      setPerformance(generateMockPerformance());
      setIsLoading(false);
    }, 1500);
  }, []);
  
  // Format timestamp for chart display
  const formatXAxis = (timestamp: number | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.getHours() + ':00';
  };
  
  // Simulate refreshing data
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setPriceData(generateMockData());
      setSignals(generateMockSignals());
      setPortfolio(generateMockPortfolio());
      setPerformance(generateMockPerformance());
      setIsLoading(false);
    }, 1000);
  };
  
  // Handle risk level change
  const handleRiskChange = (value: number) => {
    setRiskLevel(value);
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl font-semibold">Loading SonicAI Trading Dashboard...</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SonicAI Trading Dashboard</h1>
          <p className="text-slate-500">AI-powered trading on Sonic SVM</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Risk Level:</span>
            <div className="w-32">
              <input
                type="range"
                min="1"
                max="10"
                value={riskLevel}
                onChange={(e) => handleRiskChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-sm font-medium">{riskLevel}/10</span>
          </div>
          
          <Button 
            className="flex items-center gap-2" 
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trading">Trading Signals</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4">
          <Grid numItemsMd={2} numItemsLg={3} className="gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Portfolio Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>$31,051.32</Metric>
                  <Text className="text-green-500">+2.5%</Text>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Today's P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>+$752.18</Metric>
                  <Text className="text-green-500">+1.8%</Text>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Active Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>3</Metric>
                  <Badge color="green">2 PROFITABLE</Badge>
                </div>
              </CardContent>
            </Card>
          </Grid>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Price Predictions</CardTitle>
                <CardDescription>Current prices with AI predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatXAxis}
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis yAxisId="btc" orientation="right" domain={['auto', 'auto']} />
                      <YAxis yAxisId="others" orientation="left" domain={['auto', 'auto']} />
                      <Tooltip 
                        formatter={(value: any) => value ? `$${(+value).toFixed(2)}` : 'N/A'}
                        labelFormatter={(label: any) => formatXAxis(label)}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="btcPrice" 
                        stroke="#F7931A" 
                        name="BTC Price"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="btc"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="btcPredicted" 
                        stroke="#F7931A" 
                        strokeDasharray="5 5"
                        name="BTC Predicted"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="btc"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ethPrice" 
                        stroke="#627EEA" 
                        name="ETH Price"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="others"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ethPredicted" 
                        stroke="#627EEA" 
                        strokeDasharray="5 5"
                        name="ETH Predicted"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="others"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="solPrice" 
                        stroke="#00FFA3" 
                        name="SOL Price"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="others"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="solPredicted" 
                        stroke="#00FFA3" 
                        strokeDasharray="5 5"
                        name="SOL Predicted"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="others"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Latest Signals</CardTitle>
                <CardDescription>AI trading recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signals.map(signal => (
                    <div key={signal.id} className="border p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <Badge color={signal.type === 'buy' ? 'green' : signal.type === 'sell' ? 'red' : 'blue'}>
                          {signal.type.toUpperCase()}
                        </Badge>
                        <Text>Confidence: {(signal.confidence * 100).toFixed(0)}%</Text>
                      </div>
                      <div className="mb-1 font-semibold">{signal.asset} @ ${signal.price.toFixed(2)}</div>
                      <Text className="text-sm text-gray-500">{signal.reason}</Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </Text>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">View All Signals</Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Performance</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceData.filter(d => d.portfolio !== null)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatXAxis}
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip 
                        formatter={(value: any) => value ? `$${(+value).toFixed(2)}` : 'N/A'}
                        labelFormatter={(label: any) => formatXAxis(label)}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="portfolio" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.3}
                        name="Portfolio Value"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Asset Allocation</CardTitle>
                <CardDescription>Current portfolio distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolio}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="asset" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `${value}%`} />
                      <Bar dataKey="allocation" fill="#8884d8" name="Allocation" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="trading" className="mt-4">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Active Trading Signals</CardTitle>
                    <CardDescription>AI-generated trading recommendations</CardDescription>
                  </div>
                  <Button>Execute All Signals</Button>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 font-medium">Asset</th>
                      <th className="text-left py-3 font-medium">Signal</th>
                      <th className="text-left py-3 font-medium">Price</th>
                      <th className="text-left py-3 font-medium">Confidence</th>
                      <th className="text-left py-3 font-medium">Reason</th>
                      <th className="text-left py-3 font-medium">Time</th>
                      <th className="text-left py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(signal => (
                      <tr key={signal.id} className="border-b">
                        <td className="py-4">{signal.asset}</td>
                        <td className="py-4">
                          <Badge color={signal.type === 'buy' ? 'green' : signal.type === 'sell' ? 'red' : 'blue'}>
                            {signal.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-4">${signal.price.toFixed(2)}</td>
                        <td className="py-4">{(signal.confidence * 100).toFixed(0)}%</td>
                        <td className="py-4">{signal.reason}</td>
                        <td className="py-4">{new Date(signal.timestamp).toLocaleTimeString()}</td>
                        <td className="py-4">
                          {signal.type !== 'hold' && (
                            <Button size="sm" variant={signal.type === 'buy' ? 'default' : 'destructive'}>
                              Execute
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Strategy Performance</CardTitle>
                  <CardDescription>Success rate by strategy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Momentum Strategy</span>
                        <span className="font-medium text-green-500">76% Win Rate</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full w-3/4"></div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Trend Following</span>
                        <span className="font-medium text-blue-500">68% Win Rate</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full w-2/3"></div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Mean Reversion</span>
                        <span className="font-medium text-yellow-500">54% Win Rate</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-yellow-500 h-2.5 rounded-full w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Trades</CardTitle>
                  <CardDescription>Last 5 executed trades</CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-sm">
                        <th className="text-left py-2 font-medium">Asset</th>
                        <th className="text-left py-2 font-medium">Type</th>
                        <th className="text-left py-2 font-medium">Price</th>
                        <th className="text-left py-2 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr className="border-b">
                        <td className="py-2">BTC/USD</td>
                        <td className="py-2">Buy</td>
                        <td className="py-2">$67,245.30</td>
                        <td className="py-2 text-green-500">+1.2%</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">ETH/USD</td>
                        <td className="py-2">Sell</td>
                        <td className="py-2">$3,798.45</td>
                        <td className="py-2 text-green-500">+0.8%</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">SOL/USD</td>
                        <td className="py-2">Buy</td>
                        <td className="py-2">$172.58</td>
                        <td className="py-2 text-red-500">-0.7%</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">BTC/USD</td>
                        <td className="py-2">Sell</td>
                        <td className="py-2">$68,123.75</td>
                        <td className="py-2 text-green-500">+1.5%</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">ETH/USD</td>
                        <td className="py-2">Buy</td>
                        <td className="py-2">$3,750.25</td>
                        <td className="py-2 text-red-500">-0.2%</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">View Trade History</Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="portfolio" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <Metric>$31,051.32</Metric>
                <div className="flex items-center mt-2">
                  <Badge color="green" className="mr-2">+2.5%</Badge>
                  <Text>Today</Text>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Asset Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {portfolio.map(asset => (
                    <div key={asset.asset} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full mr-2" 
                          style={{ 
                            backgroundColor: 
                              asset.asset === 'BTC' ? '#F7931A' : 
                              asset.asset === 'ETH' ? '#627EEA' : 
                              asset.asset === 'SOL' ? '#00FFA3' : 
                              '#2775CA' 
                          }}
                        ></div>
                        <span>{asset.asset}</span>
                      </div>
                      <div className="text-right">
                        <div>${asset.value.toFixed(2)}</div>
                        <div className={`text-xs ${asset.change24h > 0 ? 'text-green-500' : asset.change24h < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                          {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>AI Allocation Suggestion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span>Current Risk Score</span>
                    <span className="font-medium">{riskLevel}/10</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <span>Suggested Changes:</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>BTC</span>
                    <span className="text-green-500">+5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ETH</span>
                    <span className="text-gray-500">0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SOL</span>
                    <span className="text-red-500">-3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>USDC</span>
                    <span className="text-red-500">-2%</span>
                  </div>
                </div>
                <Button className="w-full mt-4">Rebalance Portfolio</Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Allocation</CardTitle>
                <CardDescription>Current asset distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolio}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="asset" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="allocation" name="Allocation %" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="value" name="Value ($)" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Historical Performance</CardTitle>
                <CardDescription>Portfolio value over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceData.filter(d => d.portfolio !== null)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatXAxis}
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip 
                        formatter={(value: any) => value ? `$${(+value).toFixed(2)}` : 'N/A'}
                        labelFormatter={(label: any) => formatXAxis(label)}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="portfolio" 
                        stroke="#8884d8" 
                        name="Portfolio Value"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="performance" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Overall Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>+{performance.overallReturn}%</Metric>
                  <Text className="text-green-500">
                    <TrendingUp className="h-4 w-4 inline mr-1" />
                    Since Start
                  </Text>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>{performance.winRate}%</Metric>
                  <Text>
                    {performance.trades?.successful || 0}/{performance.trades?.total || 0} Trades
                  </Text>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Sharpe Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline space-x-2">
                  <Metric>{performance.sharpeRatio}</Metric>
                  <Text className={performance.sharpeRatio > 1 ? "text-green-500" : "text-yellow-500"}>
                    {performance.sharpeRatio > 2 ? "Excellent" : 
                      performance.sharpeRatio > 1 ? "Good" : "Moderate"}
                  </Text>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Trade Performance</CardTitle>
                <CardDescription>Success rate and outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Successful', value: performance.trades?.successful || 0, color: 'green' },
                      { name: 'Failed', value: performance.trades?.failed || 0, color: 'red' }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="value" 
                        name="Trades" 
                        fill="#8884d8" 
                        className="fill-current text-green-500"
                        fillOpacity={0.8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Hourly Returns</CardTitle>
                <CardDescription>Performance by time of day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performance.hourlyReturns || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `${value}%`} />
                      <Bar 
                        dataKey="return" 
                        name="Return %" 
                        fill="#16a34a"
                        // We need to fix the dynamic fill function - using a single color instead
                        // fill={(data) => data.return >= 0 ? "#16a34a" : "#dc2626"}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Asset Performance</CardTitle>
              <CardDescription>Return by asset type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { asset: 'BTC', return: 24.5, trades: 32 },
                      { asset: 'ETH', return: 18.2, trades: 28 },
                      { asset: 'SOL', return: 36.7, trades: 22 },
                      { asset: 'Other', return: 12.1, trades: 5 }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="asset" />
                    <YAxis yAxisId="left" orientation="left" label={{ value: 'Return %', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Trades', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="return" name="Return %" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="trades" name="Number of Trades" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SonicAIDashboard;