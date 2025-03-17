import React, { useState, useEffect, useMemo } from 'react';
import { useSonicAgent } from '../contexts/SonicAgentContext';
import TokenIcon from './common/TokenIcon';
import { formatCurrency, formatPercent, formatChange } from '../utils/formatters';
import TradeDetailsModal from './modals/TradeDetailsModal';
import { RiskLevel } from '../contexts/SonicAgentContext';

// Recommendation type
interface TradeRecommendation {
  id: string;
  type: 'buy' | 'sell' | 'swap';
  inputToken: {
    mint: string;
    symbol: string;
    name: string;
    logoURI?: string;
  };
  outputToken: {
    mint: string;
    symbol: string;
    name: string;
    logoURI?: string;
  };
  inputAmount: number;
  outputAmount: number; // Estimated output
  priceImpact: number;
  confidence: number; // 0-100 confidence score
  reasoning: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  riskLevel: RiskLevel;
  potentialOutcome: {
    bestCase: number; // Percentage
    worstCase: number; // Percentage
    timeFrame: string; // "short_term" | "medium_term" | "long_term"
  };
  marketSignals: {
    trend: 'bullish' | 'bearish' | 'neutral' | 'volatile';
    volume: 'increasing' | 'decreasing' | 'stable';
    indicators: string[];
  };
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'rejected';
}

// Filter type
type RecommendationFilter = 'all' | 'high' | 'medium' | 'low' | 'executed' | 'rejected';

/**
 * Trading Recommendations component that displays AI-generated trading suggestions
 */
const TradingRecommendations: React.FC = () => {
  // Get data from context
  const { 
    jupiterTradingStrategy,
    jupiterService,
    riskLevel,
    walletPublicKey,
    notificationService
  } = useSonicAgent();

  // Component state
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTradeId, setLoadingTradeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RecommendationFilter>('all');
  const [selectedRecommendation, setSelectedRecommendation] = useState<TradeRecommendation | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!jupiterTradingStrategy || !walletPublicKey) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get recommendations from the trading strategy service
        const recommendationData = await jupiterTradingStrategy.getRecommendations(riskLevel);
        setRecommendations(recommendationData);
      } catch (err) {
        console.error('Error fetching trading recommendations:', err);
        setError('Failed to load trading recommendations. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();

    // Set up automatic refresh interval
    const intervalId = setInterval(() => {
      fetchRecommendations();
    }, 180000); // Refresh every 3 minutes

    return () => {
      clearInterval(intervalId);
    };
  }, [jupiterTradingStrategy, walletPublicKey, riskLevel]);

  // Manual refresh
  const handleRefresh = async () => {
    if (!jupiterTradingStrategy || refreshing) return;

    setRefreshing(true);
    setError(null);

    try {
      // Get fresh recommendations from the trading strategy service
      const recommendationData = await jupiterTradingStrategy.getRecommendations(riskLevel, true);
      setRecommendations(recommendationData);
      
      if (notificationService) {
        notificationService.sendNotification({
          type: 'info',
          title: 'Recommendations Updated',
          message: 'Trading recommendations have been refreshed with the latest market data.',
          duration: 3000
        });
      }
    } catch (err) {
      console.error('Error refreshing trading recommendations:', err);
      setError('Failed to refresh trading recommendations. Please try again later.');
      
      if (notificationService) {
        notificationService.sendNotification({
          type: 'error',
          title: 'Refresh Failed',
          message: 'Unable to refresh trading recommendations. Please try again later.',
          duration: 5000
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Execute trade
  const executeTrade = async (recommendation: TradeRecommendation) => {
    if (!jupiterTradingStrategy || !jupiterService || !walletPublicKey) {
      if (notificationService) {
        notificationService.sendNotification({
          type: 'error',
          title: 'Execution Failed',
          message: 'Wallet connection or trading services are not available.',
          duration: 5000
        });
      }
      return;
    }

    setLoadingTradeId(recommendation.id);

    try {
      // Update local state to show trade is executing
      setRecommendations(prevRecs => 
        prevRecs.map(rec => 
          rec.id === recommendation.id ? { ...rec, status: 'executing' } : rec
        )
      );

      // Execute the trade
      const result = await jupiterTradingStrategy.executeTrade(recommendation);

      // Update recommendations with new status
      setRecommendations(prevRecs => 
        prevRecs.map(rec => 
          rec.id === recommendation.id ? { ...rec, status: 'executed' } : rec
        )
      );

      if (notificationService) {
        notificationService.sendNotification({
          type: 'success',
          title: 'Trade Executed',
          message: `Successfully ${recommendation.type === 'buy' ? 'bought' : 'sold'} ${recommendation.outputToken.symbol}`,
          link: {
            url: `https://explorer.sonic.game/tx/${result.signature}`,
            text: 'View Transaction'
          },
          duration: 7000
        });
      }
    } catch (err) {
      console.error('Error executing trade:', err);
      
      // Update recommendations with failed status
      setRecommendations(prevRecs => 
        prevRecs.map(rec => 
          rec.id === recommendation.id ? { ...rec, status: 'failed' } : rec
        )
      );

      if (notificationService) {
        notificationService.sendNotification({
          type: 'error',
          title: 'Trade Failed',
          message: `Unable to execute trade: ${(err as Error).message || 'Unknown error'}`,
          duration: 7000
        });
      }
    } finally {
      setLoadingTradeId(null);
    }
  };

  // Reject recommendation
  const rejectRecommendation = (recommendation: TradeRecommendation) => {
    setRecommendations(prevRecs => 
      prevRecs.map(rec => 
        rec.id === recommendation.id ? { ...rec, status: 'rejected' } : rec
      )
    );

    if (notificationService) {
      notificationService.sendNotification({
        type: 'info',
        title: 'Recommendation Rejected',
        message: `You've rejected the recommendation to ${recommendation.type} ${recommendation.outputToken.symbol}.`,
        duration: 3000
      });
    }
  };

  // Open trade details modal
  const openTradeDetails = (recommendation: TradeRecommendation) => {
    setSelectedRecommendation(recommendation);
    setShowTradeModal(true);
  };

  // Close trade details modal
  const closeTradeDetails = () => {
    setShowTradeModal(false);
    setSelectedRecommendation(null);
  };

  // Filter recommendations
  const filteredRecommendations = useMemo(() => {
    if (activeFilter === 'all') {
      return recommendations;
    } else if (activeFilter === 'high') {
      return recommendations.filter(rec => rec.priority === 'high' && rec.status === 'pending');
    } else if (activeFilter === 'medium') {
      return recommendations.filter(rec => rec.priority === 'medium' && rec.status === 'pending');
    } else if (activeFilter === 'low') {
      return recommendations.filter(rec => rec.priority === 'low' && rec.status === 'pending');
    } else if (activeFilter === 'executed') {
      return recommendations.filter(rec => rec.status === 'executed');
    } else if (activeFilter === 'rejected') {
      return recommendations.filter(rec => rec.status === 'rejected');
    }
    return recommendations;
  }, [recommendations, activeFilter]);

  // Get priority badge color
  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get trade type color
  const getTradeTypeColor = (type: 'buy' | 'sell' | 'swap') => {
    switch (type) {
      case 'buy':
        return 'text-green-500';
      case 'sell':
        return 'text-red-500';
      case 'swap':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  // Get confidence level color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
            Pending
          </span>
        );
      case 'executing':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            Executing
          </span>
        );
      case 'executed':
        return (
          <span className="inline-flex items-center rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-400"></span>
            Executed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-400"></span>
            Failed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center rounded-full bg-gray-500/20 px-2.5 py-0.5 text-xs font-medium text-gray-400">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="text-gray-400">Analyzing market and generating recommendations...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg bg-gray-800 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium">Error Loading Recommendations</h3>
        <p className="mt-2 text-gray-400">{error}</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? (
            <>
              <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </>
          )}
        </button>
      </div>
    );
  }

  // No recommendations state
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium">No Recommendations Available</h3>
        <p className="mt-2 text-gray-400">
          Our AI hasn't found any trading opportunities matching your risk profile at this time.
          Check back later or adjust your risk profile in settings.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? (
            <>
              <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Recommendations
            </>
          )}
        </button>
      </div>
    );
  }

  // No filtered recommendations state
  if (filteredRecommendations.length === 0) {
    return (
      <div>
        {/* Filter tabs */}
        <div className="mb-6 border-b border-gray-700">
          <nav className="-mb-px flex overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('high')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'high'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              High Priority
            </button>
            <button
              onClick={() => setActiveFilter('medium')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'medium'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Medium Priority
            </button>
            <button
              onClick={() => setActiveFilter('low')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'low'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Low Priority
            </button>
            <button
              onClick={() => setActiveFilter('executed')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'executed'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Executed
            </button>
            <button
              onClick={() => setActiveFilter('rejected')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'rejected'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Rejected
            </button>
          </nav>
        </div>

        <div className="rounded-lg bg-gray-800 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">No Matching Recommendations</h3>
          <p className="mt-2 text-gray-400">
            There are no recommendations matching your current filter.
            Try selecting a different filter or refresh to get new recommendations.
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={() => setActiveFilter('all')}
              className="inline-flex items-center rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              View All
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with filter tabs and refresh button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="border-b border-gray-700 flex-grow mb-4 sm:mb-0 overflow-x-auto">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveFilter('all')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('high')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'high'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              High Priority
            </button>
            <button
              onClick={() => setActiveFilter('medium')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'medium'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Medium Priority
            </button>
            <button
              onClick={() => setActiveFilter('low')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'low'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Low Priority
            </button>
            <button
              onClick={() => setActiveFilter('executed')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'executed'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Executed
            </button>
            <button
              onClick={() => setActiveFilter('rejected')}
              className={`whitespace-nowrap pb-3 px-4 text-sm font-medium ${
                activeFilter === 'rejected'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
              }`}
            >
              Rejected
            </button>
          </nav>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 inline-flex items-center rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? (
            <>
              <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Recommendations */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredRecommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="overflow-hidden rounded-lg bg-gray-800 shadow transition hover:shadow-lg"
          >
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
              <div className="flex items-center">
                <div className={`mr-2 h-2 w-2 rounded-full ${getPriorityColor(recommendation.priority)}`}></div>
                <span className="font-medium capitalize">
                  {recommendation.priority} Priority
                </span>
              </div>
              {getStatusBadge(recommendation.status)}
            </div>

            {/* Card content */}
            <div className="p-4">
              {/* Trade type */}
              <div className="mb-4 flex items-center">
                <span className={`text-lg font-bold capitalize ${getTradeTypeColor(recommendation.type)}`}>
                  {recommendation.type}
                </span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-sm text-gray-400">
                  {new Date(recommendation.timestamp).toLocaleString()}
                </span>
              </div>

              {/* Tokens */}
              <div className="mb-4 flex items-center">
                {recommendation.type === 'buy' ? (
                  <>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.outputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.outputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.outputToken.name}</p>
                      </div>
                    </div>
                    <div className="mx-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.inputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.inputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.inputToken.name}</p>
                      </div>
                    </div>
                  </>
                ) : recommendation.type === 'sell' ? (
                  <>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.inputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.inputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.inputToken.name}</p>
                      </div>
                    </div>
                    <div className="mx-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                      </svg>
                    </div>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.outputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.outputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.outputToken.name}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.inputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.inputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.inputToken.name}</p>
                      </div>
                    </div>
                    <div className="mx-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <div className="flex items-center">
                      <TokenIcon mint={recommendation.outputToken.mint} size={36} className="mr-2" />
                      <div>
                        <p className="font-medium">{recommendation.outputToken.symbol}</p>
                        <p className="text-xs text-gray-400">{recommendation.outputToken.name}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Trade details */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Amount:</span>
                  <span className="text-sm">
                    {recommendation.inputAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 6
                    })} {recommendation.inputToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Estimated output:</span>
                  <span className="text-sm">
                    {recommendation.outputAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 6
                    })} {recommendation.outputToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Price impact:</span>
                  <span className={`text-sm ${recommendation.priceImpact > 1 ? 'text-red-500' : 'text-gray-300'}`}>
                    {formatPercent(recommendation.priceImpact)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">AI confidence:</span>
                  <span className={`text-sm font-medium ${getConfidenceColor(recommendation.confidence)}`}>
                    {recommendation.confidence}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Market trend:</span>
                  <span className="text-sm capitalize">
                    {recommendation.marketSignals.trend}
                  </span>
                </div>
              </div>

              {/* Reasoning (truncated) */}
              <div className="mt-4">
                <p className="text-sm text-gray-400">AI reasoning:</p>
                <p className="mt-1 text-sm line-clamp-2">
                  {recommendation.reasoning}
                </p>
              </div>

              {/* Action buttons */}
              {recommendation.status === 'pending' && (
                <div className="mt-6 flex space-x-2">
                  <button
                    onClick={() => executeTrade(recommendation)}
                    disabled={loadingTradeId === recommendation.id}
                    className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingTradeId === recommendation.id ? (
                      <div className="flex items-center justify-center">
                        <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Executing...
                      </div>
                    ) : 'Execute Trade'}
                  </button>
                  <button
                    onClick={() => rejectRecommendation(recommendation)}
                    className="rounded-md border border-gray-600 bg-gray-700 py-2 px-3 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => openTradeDetails(recommendation)}
                    className="rounded-md border border-gray-600 bg-gray-700 py-2 px-3 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              )}

              {recommendation.status !== 'pending' && (
                <div className="mt-6">
                  <button
                    onClick={() => openTradeDetails(recommendation)}
                    className="w-full rounded-md border border-gray-600 bg-gray-700 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  >
                    View Details
                  </button>
                </div>
              )}
            </div> 
          </div>
        ))}
      </div>

      {/* Trade details modal */}
      {showTradeModal && selectedRecommendation && ( 
        <TradeDetailsModal
          recommendation={selectedRecommendation}
          onClose={closeTradeDetails}
          onExecute={() => {
            executeTrade(selectedRecommendation);
            closeTradeDetails();
          }}
          onReject={() => {
            rejectRecommendation(selectedRecommendation);
            closeTradeDetails();
          }}
          isExecuting={loadingTradeId === selectedRecommendation.id}
        />
      )}
    </div>
  );
};

export default TradingRecommendations;