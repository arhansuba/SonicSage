import React, { useState, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  ScatterChart
} from 'recharts';


// ==========================
// Common Types
// ==========================

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  [key: string]: any; // Allow for additional properties
}

export interface TokenPrice {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface AssetAllocation {
  name: string;
  value: number;
  color?: string;
}

export interface PerformanceData {
  timestamp: number;
  portfolio: number;
  benchmark?: number;
}

// ==========================
// Shared Components
// ==========================

interface TimeFrameSelectorProps {
  timeFrame: TimeFrame;
  onTimeFrameChange: (timeFrame: TimeFrame) => void;
}

export const TimeFrameSelector: React.FC<TimeFrameSelectorProps> = ({
  timeFrame,
  onTimeFrameChange
}) => {
  const timeFrames: TimeFrame[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

  return (
    <div className="flex items-center space-x-2 mb-4">
      {timeFrames.map((tf) => (
        <button
          key={tf}
          className={`px-3 py-1 text-sm rounded-md ${
            timeFrame === tf
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => onTimeFrameChange(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
};

// Custom tooltip for charts
export const CustomTooltip = ({ active, payload, label, labelFormatter, valueFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip bg-white p-3 border border-gray-200 shadow-md rounded-md">
        <p className="label text-gray-700 font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }

  return null;
};

// ==========================
// Price Chart Component
// ==========================

interface PriceChartProps {
  data: TokenPrice[];
  timeFrame?: TimeFrame;
  showVolume?: boolean;
  height?: number;
  colors?: {
    price: string;
    volume: string;
    positive: string;
    negative: string;
    grid: string;
  };
}

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  timeFrame = '1M',
  showVolume = true,
  height = 400,
  colors = {
    price: '#6366F1', // indigo-500
    volume: '#CBD5E1', // slate-300
    positive: '#10B981', // emerald-500
    negative: '#EF4444', // red-500
    grid: '#E2E8F0' // slate-200
  }
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    return data.filter(item => item.timestamp >= filterTime);
  }, [data, currentTimeFrame]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  // Calculate price change
  const priceChange = useMemo(() => {
    if (filteredData.length < 2) return { value: 0, percentage: 0 };
    
    const firstPrice = filteredData[0].price;
    const lastPrice = filteredData[filteredData.length - 1].price;
    const change = lastPrice - firstPrice;
    const percentage = (change / firstPrice) * 100;
    
    return {
      value: change,
      percentage: percentage
    };
  }, [filteredData]);

  // Get the color based on price change direction
  const priceChangeColor = priceChange.percentage >= 0 ? colors.positive : colors.negative;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Price Chart</h3>
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium ${priceChangeColor}`}>
            {priceChange.percentage >= 0 ? '+' : ''}
            {priceChange.percentage.toFixed(2)}% ({formatPrice(priceChange.value)})
          </div>
          <TimeFrameSelector 
            timeFrame={currentTimeFrame} 
            onTimeFrameChange={setCurrentTimeFrame} 
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fontSize: 12 }}
            minTickGap={30}
          />
          <YAxis 
            yAxisId="price" 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            width={60}
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, 'auto']}
              tick={{ fontSize: 12 }}
              tickFormatter={formatVolume}
              width={60}
            />
          )}
          <Tooltip 
            content={<CustomTooltip 
              labelFormatter={(timestamp: number) => new Date(timestamp).toLocaleString()} 
              valueFormatter={(value: number, name: string) => 
                name === 'price' ? formatPrice(value) : formatVolume(value)
              } 
            />} 
          />
          <Legend />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="Price"
            stroke={colors.price}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="Volume"
              fill={colors.volume}
              opacity={0.5}
              barSize={20}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Portfolio Chart Component
// ==========================

interface PortfolioChartProps {
  data: PerformanceData[];
  timeFrame?: TimeFrame;
  height?: number;
  showBenchmark?: boolean;
  colors?: {
    portfolio: string;
    benchmark: string;
    grid: string;
  };
}

export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  data,
  timeFrame = '1M',
  height = 400,
  showBenchmark = true,
  colors = {
    portfolio: '#6366F1', // indigo-500
    benchmark: '#94A3B8', // slate-400
    grid: '#E2E8F0' // slate-200
  }
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    return data.filter(item => item.timestamp >= filterTime);
  }, [data, currentTimeFrame]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  const formatValue = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Calculate performance metrics
  const performance = useMemo(() => {
    if (filteredData.length < 2) return { value: 0, percentage: 0 };
    
    const firstValue = filteredData[0].portfolio;
    const lastValue = filteredData[filteredData.length - 1].portfolio;
    const change = lastValue - firstValue;
    const percentage = (change / firstValue) * 100;
    
    return {
      value: change,
      percentage: percentage
    };
  }, [filteredData]);

  // Get the color based on performance direction
  const performanceColor = performance.percentage >= 0 ? '#10B981' : '#EF4444';

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Portfolio Performance</h3>
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium`} style={{ color: performanceColor }}>
            {performance.percentage >= 0 ? '+' : ''}
            {performance.percentage.toFixed(2)}% ({formatValue(performance.value)})
          </div>
          <TimeFrameSelector 
            timeFrame={currentTimeFrame} 
            onTimeFrameChange={setCurrentTimeFrame} 
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fontSize: 12 }}
            minTickGap={30}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={60}
          />
          <Tooltip 
            content={<CustomTooltip 
              labelFormatter={(timestamp: number) => new Date(timestamp).toLocaleString()} 
              valueFormatter={(value: number) => formatValue(value)} 
            />} 
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="portfolio"
            name="Portfolio Value"
            stroke={colors.portfolio}
            fill={colors.portfolio}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          {showBenchmark && (
            <Area
              type="monotone"
              dataKey="benchmark"
              name="Benchmark"
              stroke={colors.benchmark}
              fill={colors.benchmark}
              fillOpacity={0.1}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Asset Allocation Chart
// ==========================

interface AssetAllocationChartProps {
  data: AssetAllocation[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({
  data,
  height = 400,
  innerRadius = 60,
  outerRadius = 120
}) => {
  // Default colors if not provided
  const DEFAULT_COLORS = [
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#F43F5E', // rose-500
    '#EF4444', // red-500
    '#F97316', // orange-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#14B8A6', // teal-500
    '#0EA5E9', // sky-500
  ];

  // Format the percentage value
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Calculate total for percentage calculations
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Custom label for the pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is significant enough (e.g., > 5%)
    return percent * 100 > 5 ? (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {name} ({(percent * 100).toFixed(1)}%)
      </text>
    ) : null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Asset Allocation</h3>

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data.map(item => ({
              ...item,
              percentage: (item.value / total) * 100
            }))}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any) => [`${(value / total * 100).toFixed(2)}% ($${value.toFixed(2)})`, 'Allocation']}
          />
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right" 
            formatter={(value, entry: any, index) => {
              const item = data[index];
              return (
                <span className="text-sm text-gray-700">
                  {value} ({(item.value / total * 100).toFixed(1)}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Multi-metric Chart
// ==========================

export interface MetricData {
  timestamp: number;
  [key: string]: number | string;
}

interface MultiMetricChartProps {
  data: MetricData[];
  metrics: {
    key: string;
    name: string;
    color: string;
    type: 'line' | 'area' | 'bar';
    yAxisId?: string;
  }[];
  timeFrame?: TimeFrame;
  height?: number;
  gridColor?: string;
}

export const MultiMetricChart: React.FC<MultiMetricChartProps> = ({
  data,
  metrics,
  timeFrame = '1M',
  height = 400,
  gridColor = '#E2E8F0'
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    return data.filter(item => item.timestamp >= filterTime);
  }, [data, currentTimeFrame]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  // Get unique yAxisIds
  const yAxisIds = Array.from(new Set(metrics.map(m => m.yAxisId || 'default')));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Multi-Metric Analysis</h3>
        <TimeFrameSelector 
          timeFrame={currentTimeFrame} 
          onTimeFrameChange={setCurrentTimeFrame} 
        />
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fontSize: 12 }}
            minTickGap={30}
          />
          
          {yAxisIds.map((id, index) => (
            <YAxis
              key={id}
              yAxisId={id}
              orientation={index === 0 ? 'left' : 'right'}
              domain={['auto', 'auto']}
              tick={{ fontSize: 12 }}
              width={60}
            />
          ))}
          
          <Tooltip content={<CustomTooltip labelFormatter={(timestamp: number) => new Date(timestamp).toLocaleString()} />} />
          <Legend />
          
          {metrics.map((metric, index) => {
            const yAxisId = metric.yAxisId || 'default';
            
            if (metric.type === 'line') {
              return (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.name}
                  stroke={metric.color}
                  yAxisId={yAxisId}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              );
            } else if (metric.type === 'area') {
              return (
                <Area
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.name}
                  stroke={metric.color}
                  fill={metric.color}
                  fillOpacity={0.3}
                  yAxisId={yAxisId}
                  strokeWidth={2}
                />
              );
            } else {
              return (
                <Bar
                  key={metric.key}
                  dataKey={metric.key}
                  name={metric.name}
                  fill={metric.color}
                  yAxisId={yAxisId}
                  barSize={20}
                />
              );
            }
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Risk vs. Return Chart
// ==========================

export interface RiskReturnData {
  name: string;
  risk: number;
  return: number;
  allocation: number;
  category?: string;
  color?: string;
}

interface RiskReturnChartProps {
  data: RiskReturnData[];
  height?: number;
  portfolio?: {
    risk: number;
    return: number;
  };
}

export const RiskReturnChart: React.FC<RiskReturnChartProps> = ({
  data,
  height = 400,
  portfolio
}) => {
  // Default colors by category
  const categoryColors: Record<string, string> = {
    'Token': '#6366F1',
    'Strategy': '#8B5CF6',
    'DeFi': '#10B981',
    'Stablecoin': '#0EA5E9',
    'NFT': '#F43F5E',
    'default': '#94A3B8'
  };

  // Format percentage for tooltip
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Risk vs. Return Analysis</h3>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart
          margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            dataKey="risk" 
            name="Risk" 
            label={{ 
              value: 'Risk (Volatility %)', 
              position: 'bottom',
              offset: 0,
              style: { textAnchor: 'middle' }
            }}
            domain={[0, 'auto']}
          />
          <YAxis 
            type="number" 
            dataKey="return" 
            name="Return" 
            label={{ 
              value: 'Return (%)', 
              angle: -90, 
              position: 'left',
              offset: -10,
              style: { textAnchor: 'middle' }
            }}
            domain={[0, 'auto']}
          />
          <Tooltip 
            formatter={(value: number) => [formatPercentage(value)]}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as RiskReturnData;
                return (
                  <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm">Risk: {formatPercentage(item.risk)}</p>
                    <p className="text-sm">Return: {formatPercentage(item.return)}</p>
                    <p className="text-sm">Allocation: {formatPercentage(item.allocation)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          
          {/* Assets scatter plot */}
          <Scatter
            name="Assets"
            data={data}
            fill="#8884d8"
          >
            {data.map((entry, index) => {
              const color = entry.color || 
                (entry.category ? categoryColors[entry.category] : categoryColors['default']);
              
              // Size based on allocation (scaled)
              const size = 20 + (entry.allocation * 50 / 100);
              
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={color} 
                  fillOpacity={0.7}
                />
              );
            })}
          </Scatter>
          
          {/* Portfolio marker (if provided) */}
          {portfolio && (
            <Scatter
              name="Portfolio"
              data={[{ ...portfolio, name: 'Your Portfolio', allocation: 100 }]}
              fill="#EF4444"
              shape="star"
            />
          )}
          
          {/* Efficient frontier line - simplified example */}
          {/* This would typically be calculated from the data */}
          <Line
            name="Efficient Frontier"
            type="monotone"
            dataKey="return"
            data={[
              { risk: 0, return: 1 },
              { risk: 5, return: 7 },
              { risk: 10, return: 12 },
              { risk: 15, return: 16 },
              { risk: 20, return: 19 },
              { risk: 25, return: 21 },
              { risk: 30, return: 22 },
            ]}
            stroke="#94A3B8"
            strokeDasharray="5 5"
            dot={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Historical APY Chart
// ==========================

interface APYData {
  timestamp: number;
  apy: number;
  benchmarkApy?: number;
}

interface APYChartProps {
  data: APYData[];
  timeFrame?: TimeFrame;
  height?: number;
  showBenchmark?: boolean;
  colors?: {
    apy: string;
    benchmark: string;
    grid: string;
  };
}

export const APYChart: React.FC<APYChartProps> = ({
  data,
  timeFrame = '1M',
  height = 400,
  showBenchmark = true,
  colors = {
    apy: '#10B981', // emerald-500
    benchmark: '#94A3B8', // slate-400
    grid: '#E2E8F0' // slate-200
  }
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    return data.filter(item => item.timestamp >= filterTime);
  }, [data, currentTimeFrame]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  const formatAPY = (apy: number): string => {
    return `${apy.toFixed(2)}%`;
  };

  // Calculate current APY
  const currentAPY = useMemo(() => {
    if (filteredData.length === 0) return 0;
    return filteredData[filteredData.length - 1].apy;
  }, [filteredData]);

  // Calculate average APY for the period
  const averageAPY = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const sum = filteredData.reduce((acc, item) => acc + item.apy, 0);
    return sum / filteredData.length;
  }, [filteredData]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Historical APY</h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm space-x-4">
            <span className="font-medium">Current: <span className="text-emerald-600">{formatAPY(currentAPY)}</span></span>
            <span className="font-medium">Average: <span className="text-gray-600">{formatAPY(averageAPY)}</span></span>
          </div>
          <TimeFrameSelector 
            timeFrame={currentTimeFrame} 
            onTimeFrameChange={setCurrentTimeFrame} 
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fontSize: 12 }}
            minTickGap={30}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
            width={60}
          />
          <Tooltip 
            content={<CustomTooltip 
              labelFormatter={(timestamp: number) => new Date(timestamp).toLocaleString()} 
              valueFormatter={(value: number) => formatAPY(value)} 
            />} 
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="apy"
            name="APY"
            stroke={colors.apy}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          {showBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmarkApy"
              name="Benchmark APY"
              stroke={colors.benchmark}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Candle Chart (OHLC) Component
// ==========================

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandleChartProps {
  data: CandleData[];
  timeFrame?: TimeFrame;
  height?: number;
  showVolume?: boolean;
  colors?: {
    up: string;
    down: string;
    volume: string;
    grid: string;
  };
}

export const CandleChart: React.FC<CandleChartProps> = ({
  data,
  timeFrame = '1M',
  height = 500,
  showVolume = true,
  colors = {
    up: '#10B981', // emerald-500
    down: '#EF4444', // red-500
    volume: '#CBD5E1', // slate-300
    grid: '#E2E8F0' // slate-200
  }
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    // Return a subset of the data for better performance
    const filtered = data.filter(item => item.timestamp >= filterTime);
    
    // If still too many points, sample the data
    if (filtered.length > 100) {
      const step = Math.ceil(filtered.length / 100);
      return filtered.filter((_, index) => index % step === 0);
    }
    
    return filtered;
  }, [data, currentTimeFrame]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  // Custom renderer for candlestick bars
  const renderCandlestick = (props: any) => {
    const { x, y, width, height, open, close } = props;
    const fill = open > close ? colors.down : colors.up;
    
    return (
      <g>
        <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={fill} strokeWidth={1} />
        <rect x={x} y={open > close ? y : y + height} width={width} height={Math.abs(height)} fill={fill} />
      </g>
    );
  };

  // Format candlestick data for custom rendering
  const formattedData = filteredData.map(item => ({
    ...item,
    x: item.timestamp,
    y: [item.open, item.high, item.low, item.close],
    height: Math.abs(item.close - item.open),
    isUp: item.close >= item.open
  }));

  // Calculate price change
  const priceChange = useMemo(() => {
    if (filteredData.length < 2) return { value: 0, percentage: 0 };
    
    const firstPrice = filteredData[0].close;
    const lastPrice = filteredData[filteredData.length - 1].close;
    const change = lastPrice - firstPrice;
    const percentage = (change / firstPrice) * 100;
    
    return {
      value: change,
      percentage: percentage
    };
  }, [filteredData]);

  // Get the color based on price change direction
  const priceChangeColor = priceChange.percentage >= 0 ? colors.up : colors.down;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Price Chart (OHLC)</h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium" style={{ color: priceChangeColor }}>
            {priceChange.percentage >= 0 ? '+' : ''}
            {priceChange.percentage.toFixed(2)}% ({formatPrice(priceChange.value)})
          </div>
          <TimeFrameSelector 
            timeFrame={currentTimeFrame} 
            onTimeFrameChange={setCurrentTimeFrame} 
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fontSize: 12 }}
            minTickGap={30}
          />
          <YAxis 
            yAxisId="price"
            domain={['auto', 'auto']}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(2)}`}
            width={60}
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, 'auto']}
              tick={{ fontSize: 12 }}
              tickFormatter={formatVolume}
              width={60}
            />
          )}
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as CandleData;
                return (
                  <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
                    <p className="font-medium">{new Date(data.timestamp).toLocaleString()}</p>
                    <p className="text-sm">Open: {formatPrice(data.open)}</p>
                    <p className="text-sm">High: {formatPrice(data.high)}</p>
                    <p className="text-sm">Low: {formatPrice(data.low)}</p>
                    <p className="text-sm">Close: {formatPrice(data.close)}</p>
                    {data.volume && (
                      <p className="text-sm">Volume: {formatVolume(data.volume)}</p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          
          {/* Custom renderer for candlesticks */}
          {filteredData.map((entry, index) => {
            const isUp = entry.close >= entry.open;
            const x = index * (700 / filteredData.length) + 50; // Approximate positioning
            const candleWidth = Math.max(4, 700 / filteredData.length * 0.7);
            
            return (
              <g key={index}>
                {/* Wick (high to low) */}
                <line 
                  x1={x + candleWidth/2} 
                  y1={-entry.high} 
                  x2={x + candleWidth/2} 
                  y2={-entry.low} 
                  stroke={isUp ? colors.up : colors.down} 
                  strokeWidth={1} 
                />
                {/* Body (open to close) */}
                <rect 
                  x={x} 
                  y={-Math.max(entry.open, entry.close)} 
                  width={candleWidth} 
                  height={Math.abs(entry.close - entry.open)} 
                  fill={isUp ? colors.up : colors.down} 
                />
              </g>
            );
          })}
          
          {/* For visualization, use lines to represent price series */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            name="Close Price"
            stroke="#6366F1"
            dot={false}
            activeDot={false}
            legendType="none"
          />
          
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="Volume"
              fill={colors.volume}
              opacity={0.5}
              barSize={20}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================
// Historical Balances Chart
// ==========================

export interface BalanceData {
  timestamp: number;
  [token: string]: number | string;
}

interface BalanceChartProps {
  data: BalanceData[];
  timeFrame?: TimeFrame;
  height?: number;
  tokenColors?: Record<string, string>;
  stackTokens?: boolean;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({
  data,
  timeFrame = '1M',
  height = 400,
  tokenColors = {},
  stackTokens = true
}) => {
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>(timeFrame);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date().getTime();
    const filterTime = {
      '1D': now - 24 * 60 * 60 * 1000,
      '1W': now - 7 * 24 * 60 * 60 * 1000,
      '1M': now - 30 * 24 * 60 * 60 * 1000,
      '3M': now - 90 * 24 * 60 * 60 * 1000,
      '6M': now - 180 * 24 * 60 * 60 * 1000,
      '1Y': now - 365 * 24 * 60 * 60 * 1000,
      'ALL': 0
    }[currentTimeFrame];

    return data.filter(item => item.timestamp >= filterTime);
  }, [data, currentTimeFrame]);

  // Get token keys excluding timestamp
  const tokenKeys = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(key => key !== 'timestamp');
  }, [data]);

  // Default colors for tokens if not provided
  const DEFAULT_COLORS = [
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#F43F5E', // rose-500
    '#EF4444', // red-500
    '#F97316', // orange-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#14B8A6', // teal-500
    '#0EA5E9', // sky-500
  ];

  const getTokenColor = (token: string, index: number) => {
    return tokenColors[token] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (currentTimeFrame === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (currentTimeFrame === '1W' || currentTimeFrame === '1M') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  };

  const formatBalance = (value: number): string => {
    return value.toFixed(6);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Token Balances Over Time</h3>
        <TimeFrameSelector 
          timeFrame={currentTimeFrame} 
          onTimeFrameChange={setCurrentTimeFrame} 
        />
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {stackTokens ? (
          <AreaChart
            data={filteredData}
            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate} 
              tick={{ fontSize: 12 }}
              minTickGap={30}
            />
            <YAxis 
              domain={[0, 'auto']} 
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
                      <p className="font-medium">{new Date(Number(label)).toLocaleString()}</p>
                      {payload.map((entry, index) => (
                        <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
                          {entry.name}: {formatBalance(entry.value as number)}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            {tokenKeys.map((token, index) => (
              <Area
                key={token}
                type="monotone"
                dataKey={token}
                name={token}
                stackId="1"
                stroke={getTokenColor(token, index)}
                fill={getTokenColor(token, index)}
                fillOpacity={0.5}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart
            data={filteredData}
            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate} 
              tick={{ fontSize: 12 }}
              minTickGap={30}
            />
            <YAxis 
              domain={[0, 'auto']} 
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
                      <p className="font-medium">{new Date(Number(label)).toLocaleString()}</p>
                      {payload.map((entry, index) => (
                        <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
                          {entry.name}: {formatBalance(entry.value as number)}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            {tokenKeys.map((token, index) => (
              <Line
                key={token}
                type="monotone"
                dataKey={token}
                name={token}
                stroke={getTokenColor(token, index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default {
  PriceChart,
  PortfolioChart,
  AssetAllocationChart,
  MultiMetricChart,
  RiskReturnChart,
  APYChart,
  CandleChart,
  BalanceChart,
  TimeFrameSelector
};