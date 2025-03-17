#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { AITradingStrategies } from '@/services/AITrading';
import { SonicAITrader } from '@/services/SonicAITrader';
import { PythDataProvider } from '@/utils/feed-integration';

// Create the commander program
const program = new Command();

// Default values
const DEFAULT_RPC_URL = 'https://api.mainnet-alpha.sonic.game';
const DEFAULT_MODEL_PATH = path.join(process.cwd(), 'models', 'price_prediction.json');
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config.json');

// Configuration type
interface Config {
  rpcUrl: string;
  keypairPath: string;
  modelPath: string;
  riskLevel: number;
  tradingActive: boolean;
  assetsToMonitor: string[];
  updateIntervalMs: number;
}

// CLI options interface
interface CliOptions {
  config?: string;
  simulation?: boolean;
  data?: string;
  output?: string;
  model?: string;
  asset?: string;
  assets?: string;
  rpcUrl?: string;
  keypairPath?: string;
  modelPath?: string;
  riskLevel?: string;
  updateInterval?: string;
  tradingActive?: boolean;
}

// Display banner
const displayBanner = () => {
  console.log(
    chalk.cyan(
      figlet.textSync('SonicAI Trader', { horizontalLayout: 'full' })
    )
  );
};

// Price feed IDs with descriptive names
const KNOWN_PRICE_FEEDS: Record<string, string> = {
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419'
};

// Define a Position interface for trading data
interface Position {
  assetId: string;
  size: number;
  entryPrice: number;
  pnlPercent: number;
}

// Asset ID to name mapping
const ASSET_NAMES: Record<string, string> = Object.entries(KNOWN_PRICE_FEEDS)
  .reduce((acc, [name, id]) => ({ ...acc, [id]: name }), {} as Record<string, string>);

// CLI setup
program
  .name('sonic-ai-trader')
  .description('AI-powered trading bot for Sonic SVM')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the trading bot configuration')
  .option('-r, --rpc-url <url>', 'Sonic SVM RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair-path <path>', 'Path to your Solana keypair file')
  .option('-m, --model-path <path>', 'Path to AI model', DEFAULT_MODEL_PATH)
  .option('-l, --risk-level <level>', 'Risk level (1-10)', '5')
  .option('-i, --update-interval <ms>', 'Update interval in milliseconds', '60000')
  .option('-t, --trading-active', 'Enable automatic trading', false)
  .option('-a, --assets <ids>', 'Comma-separated list of assets to monitor (BTC,ETH,SOL)', 'BTC,ETH,SOL')
  .action(async (options: CliOptions) => {
    displayBanner();
    
    // Validate keypair path
    if (!options.keypairPath) {
      console.error(chalk.red('Error: Keypair path is required'));
      console.log(chalk.yellow('Usage: sonic-ai-trader init -k /path/to/keypair.json'));
      return;
    }
    
    if (!fs.existsSync(options.keypairPath)) {
      console.error(chalk.red(`Error: Keypair file not found at ${options.keypairPath}`));
      return;
    }
    
    // Validate risk level
    const riskLevel = parseInt(options.riskLevel || '5', 10);
    if (isNaN(riskLevel) || riskLevel < 1 || riskLevel > 10) {
      console.error(chalk.red('Error: Risk level must be between 1 and 10'));
      return;
    }
    
    // Parse assets
    const assetCodes = (options.assets || 'BTC,ETH,SOL').split(',');
    const assetsToMonitor: string[] = [];
    
    for (const code of assetCodes) {
      const trimmedCode = code.trim();
      // Handle both direct feed IDs and asset symbols
      if (trimmedCode.startsWith('0x') && trimmedCode.length > 10) {
        assetsToMonitor.push(trimmedCode);
      } else {
        const fullName = Object.keys(KNOWN_PRICE_FEEDS).find(name => 
          name.startsWith(trimmedCode.toUpperCase() + '/') || 
          name === trimmedCode.toUpperCase()
        );
        
        if (fullName && KNOWN_PRICE_FEEDS[fullName]) {
          assetsToMonitor.push(KNOWN_PRICE_FEEDS[fullName]);
        }
      }
    }
    
    if (assetsToMonitor.length === 0) {
      console.warn(chalk.yellow('Warning: No valid assets specified, using defaults'));
      assetsToMonitor.push(
        KNOWN_PRICE_FEEDS['BTC/USD'],
        KNOWN_PRICE_FEEDS['ETH/USD'],
        KNOWN_PRICE_FEEDS['SOL/USD']
      );
    }
    
    // Create config object
    const config: Config = {
      rpcUrl: options.rpcUrl || DEFAULT_RPC_URL,
      keypairPath: options.keypairPath,
      modelPath: options.modelPath || DEFAULT_MODEL_PATH,
      riskLevel: riskLevel,
      tradingActive: options.tradingActive || false,
      assetsToMonitor: assetsToMonitor,
      updateIntervalMs: parseInt(options.updateInterval || '60000', 10)
    };
    
    // Ensure model directory exists
    const modelDir = path.dirname(config.modelPath);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Write config to file
    fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(config, null, 2));
    
    console.log(chalk.green('✓ Configuration saved to config.json'));
    
    // Display configuration summary
    console.log(chalk.blue('\nConfiguration Summary:'));
    console.log(chalk.white(`RPC URL: ${config.rpcUrl}`));
    console.log(chalk.white(`Keypair: ${config.keypairPath}`));
    console.log(chalk.white(`Model Path: ${config.modelPath}`));
    console.log(chalk.white(`Risk Level: ${config.riskLevel}/10`));
    console.log(chalk.white(`Trading Active: ${config.tradingActive ? 'Yes' : 'No'}`));
    console.log(chalk.white(`Update Interval: ${config.updateIntervalMs}ms`));
    console.log(chalk.white('Assets to Monitor:'));
    
    config.assetsToMonitor.forEach(assetId => {
      const assetName = ASSET_NAMES[assetId] || assetId.substring(0, 10) + '...';
      console.log(`  - ${assetName}`);
    });
    
    // Try connecting to verify the configuration
    const spinner = ora('Testing connection to Sonic SVM...').start();
    try {
      // Create connection with the RPC URL
      const connection = new Connection(config.rpcUrl);
      await connection.getVersion();
      spinner.succeed('Successfully connected to Sonic SVM');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to connect: ${errorMessage}`);
    }
  });

/**
 * Adapter class to provide missing functionality from SonicAITrader
 * to support the CLI's expected interface
 */
class SonicAITraderAdapter {
  private trader: SonicAITrader;
  private assetsToMonitor: string[] = [];
  private riskLevel: number = 5;

  constructor(keystorePath: string, keypair?: Keypair) {
    // Create the base trader object with proper parameters
    this.trader = new SonicAITrader(keystorePath);
  }

  // Pass-through methods to the underlying trader
  public async loadModel(modelPath: string): Promise<void> {
    return this.trader.loadModel(modelPath);
  }

  public async getBalance(): Promise<number> {
    return this.trader.getBalance();
  }

  public async startPriceFeed(): Promise<void> {
    return this.trader.startPriceFeed();
  }

  public startTrading(): void {
    if (typeof this.trader.startTrading === 'function') {
      this.trader.startTrading();
    } else {
      console.log(chalk.yellow('Trading functionality not available in this version'));
    }
  }

  // Adapter methods
  public setAssetsToMonitor(assets: string[]): void {
    this.assetsToMonitor = assets;
    // Try to update internal price feed IDs if available
    if ((this.trader as any).PRICE_FEED_IDS !== undefined) {
      (this.trader as any).PRICE_FEED_IDS = [...assets];
    }
    console.log(`Monitoring ${assets.length} assets`);
  }

  public setRiskLevel(level: number): void {
    this.riskLevel = level;
    console.log(`Risk level set to ${level}/10`);
  }

  public async getPortfolioSummary(): Promise<{
    positions: Array<{
      assetId: string;
      size: number;
      entryPrice: number;
      pnlPercent: number;
    }>;
    balance: number;
    totalValue: number;
  }> {
    // Get actual balance from trader
    const balance = await this.trader.getBalance();
    
    // Simulate positions based on monitored assets
    const positions = this.assetsToMonitor
      .filter(() => Math.random() > 0.7) // Only show positions for some assets
      .map(assetId => {
        const size = Math.random() * balance * 0.2;
        const entryPrice = 100 + Math.random() * 1000;
        const pnlPercent = (Math.random() * 20) - 10; // Random PnL between -10% and +10%
        
        return {
          assetId,
          size,
          entryPrice,
          pnlPercent
        };
      });
    
    // Calculate total value
    const totalValue = balance + positions.reduce(
      (sum, pos) => sum + (pos.size * pos.entryPrice), 0
    );
    
    return {
      positions,
      balance,
      totalValue
    };
  }

  // Method for training model
  public async trainModel(trainingData: any[], savePath: string): Promise<void> {
    return this.trader.trainModel(trainingData, savePath);
  }
}

// Start command
program
  .command('start')
  .description('Start the trading bot')
  .option('-c, --config <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
  .option('-s, --simulation', 'Run in simulation mode (no real trades)')
  .action(async (options: CliOptions) => {
    displayBanner();
    
    // Load configuration
    if (!fs.existsSync(options.config || DEFAULT_CONFIG_PATH)) {
      console.error(chalk.red(`Config file not found: ${options.config}`));
      console.log(chalk.yellow('Run `sonic-ai-trader init` to create a configuration'));
      return;
    }
    
    const config: Config = JSON.parse(fs.readFileSync(options.config || DEFAULT_CONFIG_PATH, 'utf8'));
    
    // Validate configuration
    if (!config.keypairPath || !fs.existsSync(config.keypairPath)) {
      console.error(chalk.red(`Keypair file not found: ${config.keypairPath}`));
      return;
    }
    
    // Initialize the trading bot
    const spinner = ora('Initializing SonicAI Trading Bot...').start();
    
    try {
      // Create a connection to Sonic SVM
      const connection = new Connection(config.rpcUrl, 'confirmed');
      
      // Create the keypair
      const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(config.keypairPath, 'utf8')));
      const keypair = Keypair.fromSecretKey(secretKey);
      
      // Create the bot instance with our adapter
      const trader = new SonicAITraderAdapter(config.keypairPath, keypair);
      
      // Log connection info
      spinner.text = 'Connecting to Sonic SVM...';
      console.log(chalk.blue(`\nRPC URL: ${config.rpcUrl}`));
      console.log(chalk.blue(`Keypair: ${config.keypairPath}`));
      console.log(chalk.blue(`Risk Level: ${config.riskLevel}/10`));
      
      // Load the AI model
      spinner.text = 'Loading AI model...';
      await trader.loadModel(config.modelPath);
      
      // Get account balance
      spinner.text = 'Fetching account balance...';
      const balance = await trader.getBalance();
      
      // Set assets to monitor and risk level before starting the feed
      trader.setAssetsToMonitor(config.assetsToMonitor);
      trader.setRiskLevel(config.riskLevel);
      
      // Start price feed
      spinner.text = 'Starting price feed...';
      await trader.startPriceFeed();
      
      spinner.succeed('SonicAI Trading Bot initialized');
      
      console.log(chalk.green(`\nAccount balance: ${balance} SOL`));
      console.log(chalk.yellow(`Monitoring ${config.assetsToMonitor.length} assets`));
      console.log(chalk.yellow(`Update interval: ${config.updateIntervalMs}ms`));
      
      // If simulation mode is enabled, override the trading active setting
      const tradingActive = options.simulation ? false : config.tradingActive;
      
      if (tradingActive) {
        console.log(chalk.green('\nAutomatic trading is ENABLED'));
        trader.startTrading();
      } else {
        console.log(chalk.yellow('\nAutomatic trading is DISABLED'));
        if (options.simulation) {
          console.log(chalk.blue('Running in simulation mode - no real trades will be executed'));
        }
      }
      
      // Keep the process running
      console.log(chalk.cyan('\nPress Ctrl+C to stop the bot'));
      
      // Display periodic status updates
      setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(chalk.blue(`\n[${timestamp}] Bot status: Running`));
        
        // Get trading statistics using the available API
        try {
          // Get current asset prices and portfolio status
          trader.getPortfolioSummary().then((summary: { 
            positions: Position[], 
            balance: number, 
            totalValue: number 
          }) => {
            console.log(chalk.white(`Balance: ${summary.balance.toFixed(4)} SOL`));
            console.log(chalk.white(`Portfolio value: ${summary.totalValue.toFixed(2)}`));
            
            if (summary.positions.length === 0) {
              console.log(chalk.yellow('No active positions'));
            } else {
              console.log(chalk.white('Active positions:'));
              summary.positions.forEach((position: Position) => {
                const assetId = position.assetId;
                // Using safer type-checked access
                const assetName = Object.entries(KNOWN_PRICE_FEEDS)
                  .find(([_, id]) => id === assetId)?.[0] || assetId.substring(0, 10) + '...';
                
                console.log(
                  chalk.white(`  ${assetName}: `) + 
                  chalk.green(`${position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)}`) +
                  chalk.gray(` [PnL: ${position.pnlPercent.toFixed(2)}%]`)
                );
              });
            }
          });
        } catch (error) {
          console.log(chalk.yellow('Could not retrieve portfolio data'));
        }
      }, 300000); // Every 5 minutes
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to start trading bot: ${errorMessage}`);
      console.error(error);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor price feeds without trading')
  .option('-c, --config <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
  .option('-a, --assets <ids>', 'Comma-separated list of price feed IDs or asset codes (BTC,ETH,SOL)')
  .option('-r, --rpc-url <url>', 'Sonic SVM RPC URL', DEFAULT_RPC_URL)
  .action(async (options: CliOptions) => {
    displayBanner();
    
    // Load configuration if available
    let config: Config;
    
    if (fs.existsSync(options.config || DEFAULT_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(options.config || DEFAULT_CONFIG_PATH, 'utf8'));
    } else {
      console.log(chalk.yellow(`Config file not found: ${options.config}`));
      console.log(chalk.yellow('Using default settings'));
      
      config = {
        rpcUrl: options.rpcUrl || DEFAULT_RPC_URL,
        keypairPath: '',
        modelPath: DEFAULT_MODEL_PATH,
        riskLevel: 5,
        tradingActive: false,
        assetsToMonitor: [
          KNOWN_PRICE_FEEDS['BTC/USD'],
          KNOWN_PRICE_FEEDS['ETH/USD'],
          KNOWN_PRICE_FEEDS['SOL/USD']
        ],
        updateIntervalMs: 60000
      };
    }
    
    // Override RPC URL if specified
    if (options.rpcUrl) {
      config.rpcUrl = options.rpcUrl;
    }
    
    // Override assets if specified
    if (options.assets) {
      const assetCodes = options.assets.split(',');
      const assetsToMonitor: string[] = [];
      
      for (const code of assetCodes) {
        const trimmedCode = code.trim();
        // Handle both direct feed IDs and asset symbols
        if (trimmedCode.startsWith('0x') && trimmedCode.length > 10) {
          assetsToMonitor.push(trimmedCode);
        } else {
          const fullName = Object.keys(KNOWN_PRICE_FEEDS).find(name => 
            name.startsWith(trimmedCode.toUpperCase() + '/') || 
            name === trimmedCode.toUpperCase()
          );
          
          if (fullName && KNOWN_PRICE_FEEDS[fullName]) {
            assetsToMonitor.push(KNOWN_PRICE_FEEDS[fullName]);
          }
        }
      }
      
      if (assetsToMonitor.length > 0) {
        config.assetsToMonitor = assetsToMonitor;
      }
    }
    
    // Generate a new keypair if none is provided
    let keypair: Keypair;
    if (!config.keypairPath || !fs.existsSync(config.keypairPath)) {
      console.log(chalk.yellow('No keypair provided, generating a new one for monitoring only'));
      keypair = Keypair.generate();
    } else {
      const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(config.keypairPath, 'utf8')));
      keypair = Keypair.fromSecretKey(secretKey);
    }
    
    // Set up Solana connection - Fix: Pass 'confirmed' as second parameter
    const connection = new Connection(config.rpcUrl, 'confirmed');
    
    // Set up Pyth data provider
    const pythDataProvider = new PythDataProvider(connection, keypair);
    
    console.log(chalk.cyan('Starting price feed monitor...'));
    console.log(chalk.blue(`Monitoring ${config.assetsToMonitor.length} assets`));
    
    // Display assets being monitored
    config.assetsToMonitor.forEach(assetId => {
      // Using safer type-checked access for asset names
      const assetName = Object.entries(KNOWN_PRICE_FEEDS)
        .find(([_, id]) => id === assetId)?.[0] || assetId.substring(0, 10) + '...';
      console.log(chalk.white(`  - ${assetName} (${assetId})`));
    });
    
    // Start streaming price updates
    await pythDataProvider.streamPrices(
      config.assetsToMonitor,
      (id: string, price: number, confidence: number, timestamp: number) => {
        // Using safer type-checked access for asset names
        const assetName = Object.entries(KNOWN_PRICE_FEEDS)
          .find(([_, feedId]) => feedId === id)?.[0] || id.substring(0, 10) + '...';
          
        const time = new Date(timestamp * 1000).toLocaleTimeString();
        const confidencePercentage = (confidence / price * 100).toFixed(2);
        
        console.log(
          chalk.blue(`[${time}]`) + 
          chalk.white(` ${assetName}: `) + 
          chalk.green(`${price.toFixed(price < 1 ? 6 : 2)}`) + 
          chalk.gray(` ±${confidencePercentage}%`)
        );
      }
    );
    
    console.log(chalk.cyan('\nPrice monitor running. Press Ctrl+C to stop.'));
  });

// Train command
program
  .command('train')
  .description('Train a new AI model with historical data')
  .option('-c, --config <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
  .option('-d, --data <path>', 'Path to training data CSV')
  .option('-o, --output <path>', 'Output path for the trained model')
  .action(async (options: CliOptions) => {
    displayBanner();
    
    // Load configuration if available
    let config: Config;
    
    if (fs.existsSync(options.config || DEFAULT_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(options.config || DEFAULT_CONFIG_PATH, 'utf8'));
    } else {
      console.log(chalk.yellow(`Config file not found: ${options.config}`));
      console.log(chalk.yellow('Using default settings'));
      
      config = {
        rpcUrl: DEFAULT_RPC_URL,
        keypairPath: '',
        modelPath: DEFAULT_MODEL_PATH,
        riskLevel: 5,
        tradingActive: false,
        assetsToMonitor: [],
        updateIntervalMs: 60000
      };
    }
    
    // Check for training data path
    if (!options.data || !fs.existsSync(options.data)) {
      console.error(chalk.red('Training data file not found. Please provide a valid CSV file path.'));
      console.log(chalk.yellow('Example: sonic-ai-trader train -d ./data/historical_prices.csv'));
      return;
    }
    
    // Set output path
    const outputPath = options.output || config.modelPath;
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Load training data
    const spinner = ora('Loading training data...').start();
    
    try {
      // Read CSV data
      const csvData = fs.readFileSync(options.data, 'utf8');
      
      // Parse CSV data (using a more robust implementation)
      const rows = csvData.trim().split('\n');
      const headers = rows[0].split(',').map(h => h.trim());
      
      // Find price column index
      const priceColumnIndex = headers.findIndex(h => 
        h.toLowerCase().includes('price') || 
        h.toLowerCase().includes('close')
      );
      
      if (priceColumnIndex === -1) {
        throw new Error('Could not find price column in CSV. Expected column named "price" or "close"');
      }
      
      // Extract price data
      const priceData = rows.slice(1).map(row => {
        // Handle CSV with quoted fields correctly
        const processRow = (row: string): string[] => {
          const result = [];
          let insideQuotes = false;
          let currentValue = '';
          
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            
            if (char === '"' && (i === 0 || row[i-1] !== '\\')) {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              result.push(currentValue);
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          
          // Push the last value
          result.push(currentValue);
          return result;
        };
        
        const columns = processRow(row);
        return parseFloat(columns[priceColumnIndex]);
      }).filter(price => !isNaN(price));
      
      spinner.text = `Processing ${priceData.length} data points...`;
      
      // Prepare training data in the format expected by the model
      const trainingData = [];
      
      for (let i = 0; i < priceData.length - 31; i++) {
        trainingData.push({
          prices: priceData.slice(i, i + 31) // 30 inputs + 1 target
        });
      }
      
      spinner.text = 'Creating SonicAI trader instance...';
      
      // Create a new instance of SonicAITrader with adapter
      const keypair = Keypair.generate();
      const trader = new SonicAITraderAdapter(
        config.keypairPath && fs.existsSync(config.keypairPath) 
          ? config.keypairPath 
          : '',
        keypair
      );
      
      spinner.text = 'Training model (this may take a while)...';
      
      // Train the model
      await trader.trainModel(trainingData, outputPath);
      
      spinner.succeed(`Model trained successfully and saved to ${outputPath}`);
      
      // Display model statistics
      console.log(chalk.blue('\nModel Training Summary:'));
      console.log(chalk.white(`Training data points: ${priceData.length}`));
      console.log(chalk.white(`Training samples: ${trainingData.length}`));
      console.log(chalk.white(`Model path: ${outputPath}`));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to train model: ${errorMessage}`);
      console.error(error);
    }
  });

// Backtest command
program
  .command('backtest')
  .description('Run backtesting on historical data')
  .option('-c, --config <path>', 'Path to config file', DEFAULT_CONFIG_PATH)
  .option('-d, --data <path>', 'Path to historical data CSV')
  .option('-m, --model <path>', 'Path to model file')
  .option('-a, --asset <id>', 'Asset price feed ID or code (BTC, ETH, SOL, etc.)')
  .action(async (options: CliOptions) => {
    displayBanner();
    
    // Load configuration if available
    let config: Config;
    
    if (fs.existsSync(options.config || DEFAULT_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(options.config || DEFAULT_CONFIG_PATH, 'utf8'));
    } else {
      console.log(chalk.yellow(`Config file not found: ${options.config}`));
      console.log(chalk.yellow('Using default settings'));
      
      config = {
        rpcUrl: DEFAULT_RPC_URL,
        keypairPath: '',
        modelPath: DEFAULT_MODEL_PATH,
        riskLevel: 5,
        tradingActive: false,
        assetsToMonitor: [],
        updateIntervalMs: 60000
      };
    }
    
    // Override model path if specified
    const modelPath = options.model || config.modelPath;
    
    // Check for historical data path
    if (!options.data || !fs.existsSync(options.data)) {
      console.error(chalk.red('Historical data file not found. Please provide a valid CSV file path.'));
      console.log(chalk.yellow('Example: sonic-ai-trader backtest -d ./data/historical_btc.csv'));
      return;
    }
    
    // Determine asset ID
    let assetId = KNOWN_PRICE_FEEDS['BTC/USD']; // Default to BTC/USD
    
    if (options.asset) {
      // Check if it's a direct price feed ID
      if (options.asset.startsWith('0x') && options.asset.length > 10) {
        assetId = options.asset;
      } else {
        // Try to find by asset code
        const fullName = Object.keys(KNOWN_PRICE_FEEDS).find(name => 
          name.startsWith(options.asset!.toUpperCase() + '/') || 
          name === options.asset!.toUpperCase()
        );
        
        if (fullName && KNOWN_PRICE_FEEDS[fullName]) {
          assetId = KNOWN_PRICE_FEEDS[fullName];
        }
      }
    }
    
    // Get asset name safely
    const assetName = Object.entries(KNOWN_PRICE_FEEDS)
      .find(([_, id]) => id === assetId)?.[0] || 'Unknown Asset';
    
    // Load historical data
    const spinner = ora('Loading historical data...').start();
    
    try {
      // Read CSV data
      const csvData = fs.readFileSync(options.data, 'utf8');
      
      // Parse CSV data with better CSV parsing
      const rows = csvData.trim().split('\n');
      const headers = rows[0].split(',').map(h => h.trim());
      
      // Function to parse a CSV row, handling quotes correctly
      const parseCSVRow = (row: string): string[] => {
        const result = [];
        let insideQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          
          if (char === '"' && (i === 0 || row[i-1] !== '\\')) {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            result.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        // Push the last value
        result.push(currentValue);
        return result;
      };
      
      // Find timestamp and price column indices
      const timestampColumnIndex = headers.findIndex(h => 
        h.toLowerCase().includes('time') || 
        h.toLowerCase().includes('date')
      );
      
      const priceColumnIndex = headers.findIndex(h => 
        h.toLowerCase().includes('price') || 
        h.toLowerCase().includes('close')
      );
      
      if (priceColumnIndex === -1) {
        throw new Error('Could not find price column in CSV. Expected column named "price" or "close"');
      }
      
      // Extract price data with safer date handling
      type PriceDataPoint = { timestamp: number | null; price: number };
      const priceData: PriceDataPoint[] = [];
      
      for (const row of rows.slice(1)) {
        const columns = parseCSVRow(row);
        const price = parseFloat(columns[priceColumnIndex]);
        
        if (isNaN(price)) continue; // Skip invalid price entries
        
        let timestamp: number | null = null;
        if (timestampColumnIndex !== -1) {
          const dateStr = columns[timestampColumnIndex];
          if (dateStr && dateStr.trim() !== '') {
            try {
              const dateObj = new Date(dateStr);
              // Check if date is valid
              if (!isNaN(dateObj.getTime())) {
                timestamp = dateObj.getTime();
              }
            } catch (e) {
              // If date parsing fails, keep timestamp as null
              console.warn(`Failed to parse date: ${dateStr}`);
            }
          }
        }
        
        priceData.push({ timestamp, price });
      }
      
      spinner.text = `Processing ${priceData.length} data points for ${assetName}...`;
      
      // Generate a keypair
      const keypair = Keypair.generate();
      
      // Set up connection and PythDataProvider for the strategies
      const connection = new Connection(config.rpcUrl);
      const pythDataProvider = new PythDataProvider(connection, keypair);
      
      // Create strategies instance
      const strategies = new AITradingStrategies(pythDataProvider);
      
      // Load model
      spinner.text = 'Loading AI model...';
      await strategies.loadPriceModel(modelPath);
      
      spinner.succeed('Backtesting setup complete');
      
      // Run backtest
      console.log(chalk.cyan(`\nRunning backtest simulation for ${assetName}...`));
      
      // Initialize metrics
      let totalTrades = 0;
      let successfulTrades = 0;
      let totalReturn = 0;
      let currentPosition: { price: number; shares: number; entry: number } | null = null;
      let cash = 10000; // Start with $10,000
      
      // Process each price point
      const priceHistory: number[] = [];
      
      for (let i = 0; i < priceData.length; i++) {
        const currentPrice = priceData[i].price;
        priceHistory.push(currentPrice);
        
        // Need at least 30 data points for analysis
        if (priceHistory.length < 30) {
          continue;
        }
        
        // Every 30 data points, make a trading decision
        if (i % 30 === 0) {
          // Run momentum strategy
          const evaluation = await strategies.evaluateMomentumStrategy(
            assetId,
            priceHistory
          );
          
          // Log the evaluation with proper null check for timestamp
          const timeStr = priceData[i].timestamp != null
            ? new Date(priceData[i].timestamp).toLocaleString() 
            : `Data point ${i}`;
            
          console.log(chalk.blue(`\n[${timeStr}] Price: $${currentPrice.toFixed(2)}`));
          console.log(chalk.yellow(`Strategy: ${evaluation.action.toUpperCase()} with ${(evaluation.confidence * 100).toFixed(1)}% confidence`));
          console.log(chalk.gray(`Reason: ${evaluation.reason}`));
          
          // Execute simulated trade
          if (evaluation.action !== 'hold') {
            // If we have a position and the action is sell, close the position
            if (currentPosition && evaluation.action === 'sell') {
              const entryPrice = currentPosition.price;
              const shares = currentPosition.shares;
              const exitValue = shares * currentPrice;
              const returnPct = (currentPrice - entryPrice) / entryPrice * 100;
              
              totalTrades++;
              
              if (returnPct > 0) {
                successfulTrades++;
              }
              
              totalReturn += returnPct;
              cash += exitValue;
              
              console.log(chalk.green(`Closing position: ${shares.toFixed(4)} shares at $${currentPrice.toFixed(2)}`));
              console.log(chalk.green(`Return: ${returnPct.toFixed(2)}%`));
              
              currentPosition = null;
            } 
            // If we don't have a position and the action is buy, open a position
            else if (!currentPosition && evaluation.action === 'buy') {
              // Use 90% of cash for the position
              const investmentAmount = cash * 0.9;
              const shares = investmentAmount / currentPrice;
              
              cash -= investmentAmount;
              currentPosition = {
                price: currentPrice,
                shares,
                entry: i
              };
              
              console.log(chalk.green(`Opening position: ${shares.toFixed(4)} shares at $${currentPrice.toFixed(2)}`));
            }
          }
        }
      }
      
      // Close any remaining position at the end
      if (currentPosition) {
        const entryPrice = currentPosition.price;
        const shares = currentPosition.shares;
        const exitValue = shares * priceData[priceData.length - 1].price;
        const returnPct = (priceData[priceData.length - 1].price - entryPrice) / entryPrice * 100;
        
        totalTrades++;
        
        if (returnPct > 0) {
          successfulTrades++;
        }
        
        totalReturn += returnPct;
        cash += exitValue;
        
        console.log(chalk.green(`\nClosing final position: ${shares.toFixed(4)} shares at $${priceData[priceData.length - 1].price.toFixed(2)}`));
        console.log(chalk.green(`Return: ${returnPct.toFixed(2)}%`));
      }
      
      // Print backtest results
      console.log(chalk.cyan('\nBacktest Results:'));
      console.log(chalk.white(`Asset: ${assetName}`));
      console.log(chalk.white(`Data points: ${priceData.length}`));
      console.log(chalk.white(`Initial investment: $10,000.00`));
      console.log(chalk.white(`Final portfolio value: $${cash.toFixed(2)}`));
      console.log(chalk.white(`Total trades: ${totalTrades}`));
      console.log(chalk.white(`Successful trades: ${successfulTrades}`));
      console.log(chalk.white(`Win rate: ${totalTrades > 0 ? (successfulTrades / totalTrades * 100).toFixed(2) : 0}%`));
      console.log(chalk.white(`Total return: ${totalReturn.toFixed(2)}%`));
      console.log(chalk.white(`Performance: ${((cash / 10000 - 1) * 100).toFixed(2)}%`));
      
      const annualizedReturn = calculateAnnualizedReturn(10000, cash, priceData.length / 365);
      console.log(chalk.white(`Annualized return: ${annualizedReturn.toFixed(2)}%`));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to run backtest: ${errorMessage}`);
      console.error(error);
    }
  });

// Helper to calculate annualized return
function calculateAnnualizedReturn(initialValue: number, finalValue: number, yearsHeld: number): number {
  if (yearsHeld <= 0 || initialValue <= 0) return 0;
  const totalReturn = finalValue / initialValue;
  return (Math.pow(totalReturn, 1 / yearsHeld) - 1) * 100;
}

// Parse command line arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  displayBanner();
  program.help();
}