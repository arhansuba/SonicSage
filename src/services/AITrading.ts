
import { PythDataProvider } from '@/utils/feed-integration';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import * as tf from '@tensorflow/tfjs';

/**
 * Interface for strategy evaluation result
 */
export interface StrategyEvaluation {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reason: string;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: 'short' | 'medium' | 'long';
}

/**
 * Interface for trading metrics
 */
export interface TradingMetrics {
  assetId: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  profitLoss: number;
  winRate: number;
  averageReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

/**
 * Constants for strategy parameters
 */
const STRATEGY_CONSTANTS = {
  // Short-term momentum thresholds
  SHORT_TERM_BUY_THRESHOLD: 1.5,   // 1.5% price increase prediction
  SHORT_TERM_SELL_THRESHOLD: -1.5, // 1.5% price decrease prediction
  
  // Medium-term trend thresholds
  MEDIUM_TERM_BUY_THRESHOLD: 3.0,  // 3% uptrend over 1-3 days
  MEDIUM_TERM_SELL_THRESHOLD: -3.0, // 3% downtrend over 1-3 days
  
  // Long-term position thresholds
  LONG_TERM_BUY_THRESHOLD: 8.0,    // 8% predicted increase over weeks
  LONG_TERM_SELL_THRESHOLD: -8.0,  // 8% predicted decrease over weeks
  
  // Risk management
  MAX_POSITION_SIZE: 0.1,          // Max 10% of portfolio in one asset
  STOP_LOSS_PERCENTAGE: 5.0,       // 5% stop loss from entry
  TAKE_PROFIT_PERCENTAGE: 10.0,    // 10% take profit from entry
  
  // Time windows for analysis (in data points)
  SHORT_TERM_WINDOW: 24,           // 24 hourly points = 1 day
  MEDIUM_TERM_WINDOW: 72,          // 72 hourly points = 3 days
  LONG_TERM_WINDOW: 168,           // 168 hourly points = 7 days
};

/**
 * AITradingStrategies - Implementation of AI-powered trading strategies
 * This class provides various trading strategies based on:
 * 1. Price prediction using LSTM models
 * 2. Technical indicators with ML enhancement
 * 3. Sentiment analysis integration
 * 4. Portfolio optimization
 */
export class AITradingStrategies {
  private priceModel: tf.LayersModel | null = null;
  private portfolioModel: tf.LayersModel | null = null;
  private sentimentModel: tf.LayersModel | null = null;
  private pythDataProvider: PythDataProvider;
  private metrics: Map<string, TradingMetrics> = new Map();
  
  /**
   * Initialize the trading strategies
   * @param pythDataProvider Instance of PythDataProvider
   */
  constructor(pythDataProvider: PythDataProvider) {
    this.pythDataProvider = pythDataProvider;
  }
  
  /**
   * Load the price prediction model
   * @param modelPath Path to the TensorFlow.js model
   */
  public async loadPriceModel(modelPath: string): Promise<void> {
    try {
      this.priceModel = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('Price prediction model loaded successfully');
    } catch (error) {
      console.error('Failed to load price prediction model:', error);
      throw error;
    }
  }
  
  /**
   * Load the portfolio optimization model
   * @param modelPath Path to the TensorFlow.js model
   */
  public async loadPortfolioModel(modelPath: string): Promise<void> {
    try {
      this.portfolioModel = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('Portfolio optimization model loaded successfully');
    } catch (error) {
      console.error('Failed to load portfolio model:', error);
      throw error;
    }
  }
  
  /**
   * Load the sentiment analysis model
   * @param modelPath Path to the TensorFlow.js model
   */
  public async loadSentimentModel(modelPath: string): Promise<void> {
    try {
      this.sentimentModel = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('Sentiment analysis model loaded successfully');
    } catch (error) {
      console.error('Failed to load sentiment model:', error);
      throw error;
    }
  }
  
  /**
   * Predict future price using LSTM model
   * @param priceHistory Array of historical prices
   * @param steps Number of steps to predict into the future
   * @returns Predicted prices
   */
  public async predictPrice(priceHistory: number[], steps: number = 1): Promise<number[]> {
    if (!this.priceModel) {
      throw new Error('Price prediction model not loaded');
    }
    
    try {
      // Prepare the data - ensure we have enough history
      if (priceHistory.length < 30) {
        throw new Error('Not enough price history for prediction (need at least 30 data points)');
      }
      
      // Use last 30 points for prediction
      const inputData = priceHistory.slice(-30);
      
      // Normalize the data
      const { normalizedData, min, max } = this.normalizeData(inputData);
      
      // Reshape for LSTM input [batch, timesteps, features]
      // Fix the TypeScript error by explicitly creating a 3D tensor
      const reshapedData = [];
      for (let i = 0; i < normalizedData.length; i++) {
        reshapedData.push([normalizedData[i]]);
      }
      const input = tf.tensor3d([reshapedData], [1, normalizedData.length, 1]);
      
      // Make predictions
      const predictions: number[] = [];
      let currentInput = input;
      
      for (let i = 0; i < steps; i++) {
        // Get prediction for next step
        const predictionTensor = this.priceModel.predict(currentInput) as tf.Tensor;
        const predictionValue = predictionTensor.dataSync()[0];
        
        // Denormalize the prediction
        const denormalizedPrediction = predictionValue * (max - min) + min;
        predictions.push(denormalizedPrediction);
        
        // For multi-step prediction, update input with the new prediction
        if (steps > 1 && i < steps - 1) {
          // Get the last 29 points from the input plus the new prediction
          const lastSequence = currentInput.slice([0, 1, 0], [1, normalizedData.length - 1, 1]);
          // Create a properly shaped tensor for the new point
          const newPointReshaped = [[predictionValue]];
          const newPoint = tf.tensor3d([newPointReshaped], [1, 1, 1]);
          currentInput = tf.concat([lastSequence, newPoint], 1);
        }
        
        // Clean up tensor
        predictionTensor.dispose();
      }
      
      // Clean up input tensor
      input.dispose();
      if (currentInput !== input) {
        currentInput.dispose();
      }
      
      return predictions;
    } catch (error) {
      console.error('Error predicting price:', error);
      throw error;
    }
  }
  
  /**
   * Momentum trading strategy using price prediction
   * @param assetId Pyth price feed ID
   * @param priceHistory Array of historical prices
   * @returns Strategy evaluation
   */
  public async evaluateMomentumStrategy(
    assetId: string,
    priceHistory: number[]
  ): Promise<StrategyEvaluation> {
    try {
      if (priceHistory.length < STRATEGY_CONSTANTS.SHORT_TERM_WINDOW) {
        return {
          action: 'hold',
          confidence: 0,
          reason: 'Insufficient price history',
          timeframe: 'short'
        };
      }
      
      // Get the current price (last in the history)
      const currentPrice = priceHistory[priceHistory.length - 1];
      
      // Predict future price (1 step ahead)
      const predictedPrices = await this.predictPrice(priceHistory, 1);
      const predictedPrice = predictedPrices[0];
      
      // Calculate percentage change
      const percentageChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
      
      // Calculate recent volatility (standard deviation of returns)
      const recentPrices = priceHistory.slice(-STRATEGY_CONSTANTS.SHORT_TERM_WINDOW);
      const returns = this.calculateReturns(recentPrices);
      const volatility = this.calculateStandardDeviation(returns);
      
      // Adjust confidence based on volatility (lower confidence in high volatility)
      let confidenceAdjustment = 1.0;
      if (volatility > 2.0) {
        confidenceAdjustment = 2.0 / volatility; // Reduce confidence in high volatility
      }
      
      // Calculate EMA crossover signal
      const emaCrossoverSignal = this.calculateEMACrossover(priceHistory);
      
      // Determine action based on predicted change and crossover signal
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let confidence = 0;
      let reason = '';
      
      if (percentageChange > STRATEGY_CONSTANTS.SHORT_TERM_BUY_THRESHOLD && emaCrossoverSignal > 0) {
        action = 'buy';
        confidence = Math.min(0.9, (percentageChange / 10) * confidenceAdjustment);
        reason = `Predicted ${percentageChange.toFixed(2)}% increase with positive EMA crossover`;
      } else if (percentageChange < STRATEGY_CONSTANTS.SHORT_TERM_SELL_THRESHOLD && emaCrossoverSignal < 0) {
        action = 'sell';
        confidence = Math.min(0.9, (Math.abs(percentageChange) / 10) * confidenceAdjustment);
        reason = `Predicted ${percentageChange.toFixed(2)}% decrease with negative EMA crossover`;
      } else {
        action = 'hold';
        confidence = 0.5;
        reason = `No strong momentum signal, predicted change: ${percentageChange.toFixed(2)}%`;
      }
      
      return {
        action,
        confidence,
        reason,
        targetPrice: action === 'buy' ? currentPrice * (1 + STRATEGY_CONSTANTS.TAKE_PROFIT_PERCENTAGE/100) : undefined,
        stopLoss: action === 'buy' ? currentPrice * (1 - STRATEGY_CONSTANTS.STOP_LOSS_PERCENTAGE/100) : undefined,
        timeframe: 'short'
      };
    } catch (error) {
      console.error('Error evaluating momentum strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reason: `Error evaluating strategy: ${error}`,
        timeframe: 'short'
      };
    }
  }
  
  /**
   * Trend following strategy for medium-term positions
   * @param assetId Pyth price feed ID
   * @param priceHistory Array of historical prices
   * @returns Strategy evaluation
   */
  public async evaluateTrendFollowingStrategy(
    assetId: string,
    priceHistory: number[]
  ): Promise<StrategyEvaluation> {
    try {
      if (priceHistory.length < STRATEGY_CONSTANTS.MEDIUM_TERM_WINDOW) {
        return {
          action: 'hold',
          confidence: 0,
          reason: 'Insufficient price history',
          timeframe: 'medium'
        };
      }
      
      // Get the current price
      const currentPrice = priceHistory[priceHistory.length - 1];
      
      // Calculate trend strength using various indicators
      
      // 1. Calculate multiple moving averages
      const sma20 = this.calculateSMA(priceHistory, 20);
      const sma50 = this.calculateSMA(priceHistory, 50);
      const sma100 = this.calculateSMA(priceHistory, 100);
      
      // 2. Calculate MACD
      const macdResult = this.calculateMACD(priceHistory);
      const macdSignal = macdResult.macd - macdResult.signal;
      
      // 3. Calculate RSI
      const rsi = this.calculateRSI(priceHistory, 14);
      
      // 4. Predict multi-step future prices
      const predictedPrices = await this.predictPrice(priceHistory, 3);
      const averagePredictedChange = (
        (predictedPrices[0] - currentPrice) / currentPrice +
        (predictedPrices[1] - currentPrice) / currentPrice +
        (predictedPrices[2] - currentPrice) / currentPrice
      ) / 3 * 100; // Average percentage change
      
      // Combine signals into a trend strength indicator
      let trendStrength = 0;
      
      // Moving average alignment
      if (sma20 > sma50 && sma50 > sma100) {
        trendStrength += 1; // Uptrend
      } else if (sma20 < sma50 && sma50 < sma100) {
        trendStrength -= 1; // Downtrend
      }
      
      // MACD signal
      trendStrength += Math.sign(macdSignal) * Math.min(1, Math.abs(macdSignal) / 2);
      
      // RSI signal
      if (rsi > 70) {
        trendStrength -= 0.5; // Overbought
      } else if (rsi < 30) {
        trendStrength += 0.5; // Oversold
      }
      
      // Predicted price change signal
      trendStrength += averagePredictedChange / 5; // Scale the contribution
      
      // Normalize trend strength to [-1, 1] range
      trendStrength = Math.max(-1, Math.min(1, trendStrength / 3));
      
      // Determine action based on trend strength
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let confidence = Math.abs(trendStrength);
      let reason = '';
      
      if (trendStrength > 0.3) {
        action = 'buy';
        reason = `Strong uptrend detected (${(trendStrength * 100).toFixed(1)}% strength)`;
      } else if (trendStrength < -0.3) {
        action = 'sell';
        reason = `Strong downtrend detected (${(Math.abs(trendStrength) * 100).toFixed(1)}% strength)`;
      } else {
        action = 'hold';
        reason = `No clear trend direction (${(trendStrength * 100).toFixed(1)}% strength)`;
      }
      
      return {
        action,
        confidence,
        reason,
        targetPrice: action === 'buy' ? currentPrice * (1 + STRATEGY_CONSTANTS.TAKE_PROFIT_PERCENTAGE/100) : undefined,
        stopLoss: action === 'buy' ? currentPrice * (1 - STRATEGY_CONSTANTS.STOP_LOSS_PERCENTAGE/100) : undefined,
        timeframe: 'medium'
      };
    } catch (error) {
      console.error('Error evaluating trend following strategy:', error);
      return {
        action: 'hold',
        confidence: 0,
        reason: `Error evaluating strategy: ${error}`,
        timeframe: 'medium'
      };
    }
  }
  
  /**
   * Generate trade instructions based on strategy evaluation
   * @param assetId Pyth price feed ID
   * @param evaluation Strategy evaluation
   * @param priceUpdateAccount Pyth price update account
   * @returns Array of transaction instructions
   */
  public generateTradeInstructions(
    assetId: string,
    evaluation: StrategyEvaluation,
    priceUpdateAccount: PublicKey
  ): TransactionInstruction[] {
    // This is a placeholder function that would be expanded in a real implementation
    // In a real application, you would:
    // 1. Create instructions for token swaps or liquidity operations
    // 2. Record trade details for later analysis and reporting
    // 3. Implement proper position sizing and risk management
    
    console.log(`Generating trade instructions for ${assetId}`);
    console.log(`Action: ${evaluation.action} with ${(evaluation.confidence * 100).toFixed(1)}% confidence`);
    console.log(`Reason: ${evaluation.reason}`);
    console.log(`Using price update account: ${priceUpdateAccount.toString()}`);
    
    // Update metrics for this asset
    this.updateMetrics(assetId, evaluation);
    
    // Return an empty array of instructions - in a real implementation, this would
    // include actual trading instructions using protocols on Sonic SVM
    return [];
  }
  
  /**
   * Update trading metrics for performance tracking
   * @param assetId Asset identifier
   * @param evaluation Strategy evaluation that was acted upon
   * @param result Optional trade result for completed trades
   */
  private updateMetrics(
    assetId: string,
    evaluation: StrategyEvaluation,
    result?: { success: boolean; returnPercentage: number }
  ): void {
    // Get existing metrics or initialize new ones
    let metrics = this.metrics.get(assetId);
    
    if (!metrics) {
      metrics = {
        assetId,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        profitLoss: 0,
        winRate: 0,
        averageReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      };
    }
    
    // If this is a new trade (not hold)
    if (evaluation.action !== 'hold') {
      metrics.totalTrades++;
    }
    
    // If we have a result from a completed trade
    if (result) {
      if (result.success) {
        metrics.successfulTrades++;
      } else {
        metrics.failedTrades++;
      }
      
      // Update profit/loss
      metrics.profitLoss += result.returnPercentage;
      
      // Update win rate
      metrics.winRate = metrics.successfulTrades / metrics.totalTrades;
      
      // Update average return
      metrics.averageReturn = metrics.profitLoss / metrics.totalTrades;
      
      // In a real implementation, you would also update sharpe ratio and max drawdown
    }
    
    // Store updated metrics
    this.metrics.set(assetId, metrics);
  }
  
  /**
   * Get trading metrics for an asset
   * @param assetId Asset identifier
   * @returns Trading metrics or undefined if not available
   */
  public getMetrics(assetId: string): TradingMetrics | undefined {
    return this.metrics.get(assetId);
  }
  
  /**
   * Get all trading metrics
   * @returns Map of asset IDs to trading metrics
   */
  public getAllMetrics(): Map<string, TradingMetrics> {
    return this.metrics;
  }
  
  /**
   * Normalize data for model input
   * @param data Array of numerical data
   * @returns Normalized data and scaling factors
   */
  private normalizeData(data: number[]): { normalizedData: number[]; min: number; max: number } {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    
    if (range === 0) {
      return { normalizedData: data.map(() => 0.5), min, max };
    }
    
    const normalizedData = data.map(value => (value - min) / range);
    return { normalizedData, min, max };
  }
  
  /**
   * Calculate returns from price series
   * @param prices Array of prices
   * @returns Array of percentage returns
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1] * 100;
      returns.push(returnValue);
    }
    
    return returns;
  }
  
  /**
   * Calculate standard deviation
   * @param values Array of numerical values
   * @returns Standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / n;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate Simple Moving Average (SMA)
   * @param prices Array of prices
   * @param period Period for the moving average
   * @returns Current SMA value
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }
    
    const relevantPrices = prices.slice(-period);
    return relevantPrices.reduce((sum, price) => sum + price, 0) / period;
  }
  
  /**
   * Calculate Exponential Moving Average (EMA)
   * @param prices Array of prices
   * @param period Period for the moving average
   * @returns Current EMA value
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return this.calculateSMA(prices, prices.length);
    }
    
    const k = 2 / (period + 1);
    const initialSMA = this.calculateSMA(prices.slice(0, period), period);
    
    let ema = initialSMA;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }
  
  /**
   * Calculate EMA crossover signal
   * @param prices Array of prices
   * @returns Signal strength (-1 to 1, positive indicates bullish crossover)
   */
  private calculateEMACrossover(prices: number[]): number {
    const fastEMA = this.calculateEMA(prices, 12);
    const slowEMA = this.calculateEMA(prices, 26);
    
    // Calculate crossover strength relative to price
    const currentPrice = prices[prices.length - 1];
    const relativeStrength = (fastEMA - slowEMA) / currentPrice;
    
    // Return a signal between -1 and 1
    return Math.max(-1, Math.min(1, relativeStrength * 100));
  }
  
  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param prices Array of prices
   * @returns MACD components
   */
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const fastEMA = this.calculateEMA(prices, 12);
    const slowEMA = this.calculateEMA(prices, 26);
    const macd = fastEMA - slowEMA;
    
    // Calculate signal line (9-day EMA of MACD)
    // In a real implementation, you would calculate this properly from the MACD history
    const signal = macd * 0.9; // Simplified approximation
    
    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }
  
  /**
   * Calculate RSI (Relative Strength Index)
   * @param prices Array of prices
   * @param period Period for the RSI
   * @returns RSI value (0-100)
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) {
      return 50; // Not enough data, return neutral value
    }
    
    // Calculate price changes
    const changes: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // Get relevant changes for the period
    const relevantChanges = changes.slice(-period);
    
    // Separate gains and losses
    const gains = relevantChanges.filter(change => change > 0);
    const losses = relevantChanges.filter(change => change < 0).map(Math.abs);
    
    // Calculate average gain and average loss
    const avgGain = gains.length > 0 ? gains.reduce((sum, val) => sum + val, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, val) => sum + val, 0) / period : 0;
    
    // Calculate RS and RSI
    if (avgLoss === 0) {
      return 100; // No losses, RSI is 100
    }
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
}