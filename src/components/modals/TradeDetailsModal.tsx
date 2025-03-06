import React from 'react';
import TokenIcon from '../common/TokenIcon';
import { formatCurrency, formatPercent, formatChange } from '../../utils/formatters';

// Trade recommendation type from parent component
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
  outputAmount: number;
  priceImpact: number;
  confidence: number;
  reasoning: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  potentialOutcome: {
    bestCase: number;
    worstCase: number;
    timeFrame: string;
  };
  marketSignals: {
    trend: 'bullish' | 'bearish' | 'neutral' | 'volatile';
    volume: 'increasing' | 'decreasing' | 'stable';
    indicators: string[];
  };
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'rejected';
}

interface TradeDetailsModalProps {
  recommendation: TradeRecommendation;
  onClose: () => void;
  onExecute: () => void;
  onReject: () => void;
  isExecuting: boolean;
}

/**
 * Modal component for displaying detailed information about a trade recommendation
 */
const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({
  recommendation,
  onClose,
  onExecute,
  onReject,
  isExecuting
}) => {
  // Helper to format timeframe for display
  const formatTimeFrame = (timeFrame: string) => {
    switch (timeFrame) {
      case 'short_term':
        return 'Short Term (1-3 days)';
      case 'medium_term':
        return 'Medium Term (1-2 weeks)';
      case 'long_term':
        return 'Long Term (1+ month)';
      default:
        return timeFrame;
    }
  };

  // Get color for market trend
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return 'text-green-500';
      case 'bearish':
        return 'text-red-500';
      case 'volatile':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  // Get trade type description
  const getTradeDescription = () => {
    switch (recommendation.type) {
      case 'buy':
        return `Buy ${recommendation.outputToken.symbol} with ${recommendation.inputToken.symbol}`;
      case 'sell':
        return `Sell ${recommendation.inputToken.symbol} for ${recommendation.outputToken.symbol}`;
      case 'swap':
        return `Swap ${recommendation.inputToken.symbol} for ${recommendation.outputToken.symbol}`;
      default:
        return '';
    }
  };

  // Get confidence level color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get priority color
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        {/* Modal panel */}
        <div className="inline-block transform overflow-hidden rounded-lg bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:max-w-2xl sm:align-middle">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium leading-6 text-white" id="modal-title">
                    {getTradeDescription()}
                  </h3>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Priority and timestamp */}
                <div className="mt-2 flex items-center text-sm text-gray-400">
                  <div className={`mr-2 h-2.5 w-2.5 rounded-full ${getPriorityColor(recommendation.priority)}`}></div>
                  <span className="capitalize">{recommendation.priority} Priority</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(recommendation.timestamp).toLocaleString()}</span>
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-gray-700"></div>

                {/* Token exchange visualization */}
                <div className="mb-6 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <TokenIcon mint={recommendation.inputToken.mint} size={48} className="mb-2" />
                    <div className="text-center">
                      <p className="font-medium">{recommendation.inputToken.symbol}</p>
                      <p className="text-xs text-gray-400">{recommendation.inputToken.name}</p>
                      <p className="mt-1 text-sm">
                        {recommendation.inputAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 6
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mx-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-700">
                    {recommendation.type === 'buy' ? (
                      <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    ) : recommendation.type === 'sell' ? (
                      <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    <TokenIcon mint={recommendation.outputToken.mint} size={48} className="mb-2" />
                    <div className="text-center">
                      <p className="font-medium">{recommendation.outputToken.symbol}</p>
                      <p className="text-xs text-gray-400">{recommendation.outputToken.name}</p>
                      <p className="mt-1 text-sm">
                        {recommendation.outputAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 6
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trade details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md bg-gray-700 p-3">
                    <p className="text-xs text-gray-400">AI Confidence</p>
                    <p className={`text-lg font-medium ${getConfidenceColor(recommendation.confidence)}`}>
                      {recommendation.confidence}%
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-700 p-3">
                    <p className="text-xs text-gray-400">Market Trend</p>
                    <p className={`text-lg font-medium capitalize ${getTrendColor(recommendation.marketSignals.trend)}`}>
                      {recommendation.marketSignals.trend}
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-700 p-3">
                    <p className="text-xs text-gray-400">Price Impact</p>
                    <p className={`text-lg font-medium ${recommendation.priceImpact > 1 ? 'text-red-500' : 'text-gray-300'}`}>
                      {formatPercent(recommendation.priceImpact)}
                    </p>
                  </div>

                  <div className="rounded-md bg-gray-700 p-3">
                    <p className="text-xs text-gray-400">Risk Level</p>
                    <p className="text-lg font-medium capitalize">
                      {recommendation.riskLevel}
                    </p>
                  </div>
                </div>

                {/* AI reasoning */}
                <div className="mt-4">
                  <h4 className="font-medium">AI Reasoning</h4>
                  <p className="mt-1 text-sm text-gray-300">
                    {recommendation.reasoning}
                  </p>
                </div>

                {/* Market signals */}
                <div className="mt-4">
                  <h4 className="font-medium">Market Signals</h4>
                  <div className="mt-2 rounded-md bg-gray-700 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-400">Trend</span>
                      <span className={`text-sm capitalize ${getTrendColor(recommendation.marketSignals.trend)}`}>
                        {recommendation.marketSignals.trend}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-400">Volume</span>
                      <span className="text-sm capitalize">
                        {recommendation.marketSignals.volume}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Indicators</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recommendation.marketSignals.indicators.map((indicator, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center rounded-full bg-gray-600 px-2 py-0.5 text-xs text-gray-300"
                          >
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Potential outcome */}
                <div className="mt-4">
                  <h4 className="font-medium">Potential Outcome</h4>
                  <div className="mt-2 flex items-stretch space-x-4">
                    <div className="flex-1 rounded-md bg-gray-700 p-3">
                      <p className="text-xs text-gray-400">Best Case</p>
                      <p className="text-lg font-medium text-green-500">
                        +{formatChange(recommendation.potentialOutcome.bestCase)}%
                      </p>
                    </div>
                    <div className="flex-1 rounded-md bg-gray-700 p-3">
                      <p className="text-xs text-gray-400">Worst Case</p>
                      <p className="text-lg font-medium text-red-500">
                        {formatChange(recommendation.potentialOutcome.worstCase)}%
                      </p>
                    </div>
                    <div className="flex-1 rounded-md bg-gray-700 p-3">
                      <p className="text-xs text-gray-400">Time Frame</p>
                      <p className="text-sm font-medium">
                        {formatTimeFrame(recommendation.potentialOutcome.timeFrame)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal actions */}
          {recommendation.status === 'pending' ? (
            <div className="border-t border-gray-700 px-4 py-4 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                onClick={onExecute}
                disabled={isExecuting}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <div className="flex items-center">
                    <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Executing...
                  </div>
                ) : 'Execute Trade'}
              </button>
              <button
                type="button"
                onClick={onReject}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-gray-300 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Reject
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-gray-300 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-700 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-gray-300 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:w-auto sm:text-sm"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeDetailsModal;