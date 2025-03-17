import { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';

import { InstructionWithEphemeralSigners } from '@pythnetwork/pyth-solana-receiver';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { PythDataProvider } from './utils/feed-integration';

// Load environment variables
dotenv.config();

/**
 * SonicAITrader - A demo of an AI-powered trading system using Pyth price feeds
 * 
 * This system:
 * 1. Monitors multiple asset prices in real-time
 * 2. Uses a simple AI strategy to generate trading signals
 * 3. Executes trades based on these signals on Sonic SVM
 */
class SonicAITrader {
  private connection: Connection;
  private keypair: Keypair;
  private pythProvider: PythDataProvider;
  private priceStreams: Map<string, EventSource> = new Map();
  private latestPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, {price: number, timestamp: number}[]> = new Map();
  private assetPairs: {base: string, quote: string, priceId: string}[] = [];
  private isTrading: boolean = false;

  /**
   * Initialize the AI trader
   * @param connection Solana connection to Sonic SVM
   * @param keypair Wallet keypair for transactions
   */
  constructor(connection: Connection, keypair: Keypair) {
    this.connection = connection;
    this.keypair = keypair;
    this.pythProvider = new PythDataProvider(connection, keypair);
    
    // Initialize asset pairs to trade
    this.assetPairs = [
      {
        base: 'BTC',
        quote: 'USD',
        priceId: PythDataProvider.PRICE_FEED_IDS.BTC_USD
      },
      {
        base: 'ETH',
        quote: 'USD',
        priceId: PythDataProvider.PRICE_FEED_IDS.ETH_USD
      },
      {
        base: 'SOL',
        quote: 'USD',
        priceId: PythDataProvider.PRICE_FEED_IDS.SOL_USD
      }
    ];
    
    // Initialize price history
    this.assetPairs.forEach(pair => {
      this.priceHistory.set(pair.priceId, []);
    });
  }

  /**
   * Start the AI trading system
   */
  public async startTrading() {
    if (this.isTrading) {
      console.log('Trading already in progress');
      return;
    }
    
    this.isTrading = true;
    console.log('🚀 Starting AI trading system...');
    
    // Start streaming prices for all tracked assets
    for (const pair of this.assetPairs) {
      await this.startPriceStream(pair);
    }
    
    // Start the trading loop
    this.runTradingLoop();
    
    console.log('Trading system active and monitoring markets');
  }

  /**
   * Stop the AI trading system
   */
  public stopTrading() {
    console.log('Stopping trading system...');
    this.isTrading = false;
    
    // Close all price streams
    this.priceStreams.forEach(stream => stream.close());
    this.priceStreams.clear();
    
    console.log('Trading system stopped');
  }

  /**
   * Start a price stream for a specific asset pair
   */
  private async startPriceStream(pair: {base: string, quote: string, priceId: string}) {
    console.log(`Starting price stream for ${pair.base}/${pair.quote}`);
    
    try {
      const eventSource = await this.pythProvider.streamPrices(
        [pair.priceId],
        (id, price, confidence, timestamp) => {
          // Store latest price
          this.latestPrices.set(id, price);
          
          // Update price history (keep last 100 price points)
          const history = this.priceHistory.get(id) || [];
          history.push({ price, timestamp });
          if (history.length > 100) {
            history.shift(); // Remove oldest price point
          }
          this.priceHistory.set(id, history);
          
          // Log price updates
          console.log(`[${new Date(timestamp * 1000).toISOString()}] ${pair.base}/${pair.quote}: $${price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`);
        }
      );
      
      this.priceStreams.set(pair.priceId, eventSource);
    } catch (error) {
      console.error(`Error starting price stream for ${pair.base}/${pair.quote}:`, error);
    }
  }

  /**
   * Main trading loop that analyzes markets and executes trades
   */
  private async runTradingLoop() {
    // Check if we should continue trading
    if (!this.isTrading) return;
    
    try {
      // Analyze each asset and generate trading signals
      for (const pair of this.assetPairs) {
        const signal = this.generateTradingSignal(pair.priceId);
        
        if (signal) {
          console.log(`🔔 Trading signal for ${pair.base}/${pair.quote}: ${signal.action} (confidence: ${signal.confidence.toFixed(2)})`);
          
          // If signal is strong enough, execute a trade
          if (signal.confidence > 0.7) {
            await this.executeTrade(pair, signal);
          }
        }
      }
    } catch (error) {
      console.error('Error in trading loop:', error);
    }
    
    // Schedule next iteration
    setTimeout(() => this.runTradingLoop(), 30000); // Run every 30 seconds
  }

  /**
   * Generate a trading signal based on price analysis
   * This is a simple example - in a real system, this would use more sophisticated AI/ML
   */
  private generateTradingSignal(priceId: string): {action: 'BUY' | 'SELL' | 'HOLD', confidence: number} | null {
    const history = this.priceHistory.get(priceId);
    if (!history || history.length < 5) return null; // Need at least 5 data points
    
    // Calculate simple moving averages
    const shortTermSMA = this.calculateSMA(history, 5);
    const longTermSMA = this.calculateSMA(history, 20);
    
    if (!shortTermSMA || !longTermSMA) return null;
    
    // Simple crossover strategy
    if (shortTermSMA > longTermSMA) {
      // Bullish signal - short-term average above long-term
      const crossoverStrength = (shortTermSMA / longTermSMA) - 1;
      return {
        action: 'BUY',
        confidence: Math.min(crossoverStrength * 5, 0.95) // Scale confidence
      };
    } else if (longTermSMA > shortTermSMA) {
      // Bearish signal - long-term average above short-term
      const crossoverStrength = (longTermSMA / shortTermSMA) - 1;
      return {
        action: 'SELL',
        confidence: Math.min(crossoverStrength * 5, 0.95) // Scale confidence
      };
    }
    
    return {
      action: 'HOLD',
      confidence: 0.5
    };
  }

  /**
   * Calculate simple moving average from price history
   */
  private calculateSMA(history: {price: number, timestamp: number}[], periods: number): number | null {
    if (history.length < periods) return null;
    
    const recentPrices = history.slice(-periods);
    const sum = recentPrices.reduce((acc, point) => acc + point.price, 0);
    return sum / periods;
  }

  /**
   * Execute a trade based on a trading signal
   * This is a simplified example - in a real system, this would interact with DEX protocols
   */
  private async executeTrade(
    pair: {base: string, quote: string, priceId: string},
    signal: {action: 'BUY' | 'SELL' | 'HOLD', confidence: number}
  ) {
    console.log(`📈 Executing ${signal.action} for ${pair.base}/${pair.quote}`);
    
    try {
      // Post the price update and execute the trade
      const signatures = await this.pythProvider.postPriceUpdatesAndExecute(
        [pair.priceId],
        async (getPriceUpdateAccount) => {
          // Get the price update account for this pair
          const priceAccount = getPriceUpdateAccount(pair.priceId);
          
          // In a real implementation, you would create an instruction to your trading program
          // that takes the price feed and executes the appropriate swap/trade
          
          console.log(`Using price account: ${priceAccount.toString()}`);
          console.log(`Trade details: ${signal.action} ${pair.base}/${pair.quote} with confidence ${signal.confidence.toFixed(2)}`);
          
          // For demo purposes, we're just returning an empty instruction set
          // In a real application, you would create instructions to interact with Jupiter or another DEX
          return [] as InstructionWithEphemeralSigners[];
        }
      );
      
      console.log(`Trade transaction signatures: ${signatures.join(', ')}`);
    } catch (error) {
      console.error(`Error executing trade for ${pair.base}/${pair.quote}:`, error);
    }
  }
}

/**
 * Run the AI trader demo
 */
async function runAITraderDemo() {
  try {
    // Connect to Sonic SVM
    const connection = new Connection('https://api.mainnet-alpha.sonic.game', 'confirmed');
    
    // Load wallet keypair
    let keypair: Keypair;
    
    if (process.env.PRIVATE_KEY) {
      // Load from environment variable
      const privateKeyArray = JSON.parse(process.env.PRIVATE_KEY);
      keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } else if (fs.existsSync('./keypair.json')) {
      // Load from file
      const keypairJson = JSON.parse(fs.readFileSync('./keypair.json', 'utf-8'));
      keypair = Keypair.fromSecretKey(Uint8Array.from(keypairJson));
    } else {
      // Generate a random keypair for demo
      console.warn('⚠️ Using a randomly generated keypair. In production, use a secure stored keypair.');
      keypair = Keypair.generate();
    }
    
    console.log(`Using wallet: ${keypair.publicKey.toString()}`);
    
    // Initialize and start the AI trader
    const aiTrader = new SonicAITrader(connection, keypair);
    await aiTrader.startTrading();
    
    // Run for a limited time in this demo
    console.log('AI Trader will run for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
    
    // Stop trading
    aiTrader.stopTrading();
    console.log('AI Trader demo completed');
    
  } catch (error) {
    console.error('Error running AI Trader demo:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runAITraderDemo().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export { SonicAITrader };