import { Connection, Keypair } from '@solana/web3.js';
import { JupiterService } from './JupiterService';
import { SonicAgent } from './SonicAgent';
import { JupiterTradingStrategy } from './JupiterTradingStrategy';
import { PortfolioRebalancer } from './PortfolioRebalancer';
import { MarketDataService } from './MarketDataService';
import { NotificationService } from './NotificationService';
import { DeFiStrategyService } from './DeFiStrategyService';
import { AIOptimizationService } from './AIOptimizationService';
import { 
  JUPITER_API_KEY, 
  OPENAI_API_KEY, 
  ENABLE_NOTIFICATIONS,
  AUTO_TRADING_ENABLED,
  DEBUGGING_ENABLED
} from '../constants/config';

/**
 * Factory for creating and managing service instances
 * 
 * This follows the factory pattern to centralize service creation,
 * dependency injection, and lifecycle management.
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  
  private connection: Connection | null = null;
  private jupiterService: JupiterService | null = null;
  private sonicAgent: SonicAgent | null = null;
  private jupiterTradingStrategy: JupiterTradingStrategy | null = null;
  private portfolioRebalancer: PortfolioRebalancer | null = null;
  private marketDataService: MarketDataService | null = null;
  private notificationService: NotificationService | undefined = undefined;
  private defiStrategyService: DeFiStrategyService | null = null;
  private aiOptimizationService: AIOptimizationService | null = null;
  
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}
  
  /**
   * Get the singleton instance of ServiceFactory
   * 
   * @returns ServiceFactory instance
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    
    return ServiceFactory.instance;
  }
  
  /**
   * Initialize all services
   * 
   * @param connection Solana connection
   * @returns Promise that resolves when all services are initialized
   */
  public async initialize(connection: Connection): Promise<void> {
    // If already initialized or initializing, return existing promise
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Store connection
    this.connection = connection;
    
    // Start initialization
    this.initPromise = this.initializeInternal();
    return this.initPromise;
  }
  
  /**
   * Internal initialization logic
   * 
   * @returns Promise that resolves when all services are initialized
   */
  private async initializeInternal(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not set. Call initialize(connection) first.');
    }
    
    try {
      if (DEBUGGING_ENABLED) {
        console.log('Initializing services...');
      }
      // Create services in dependency order
      
      // 1. Notification service (used by many other services)
      if (ENABLE_NOTIFICATIONS) {
        this.notificationService = NotificationService.getInstance();
        if (DEBUGGING_ENABLED) {
          console.log('NotificationService initialized');
        }
      }
      
      // 2. Jupiter service
      this.jupiterService = new JupiterService(
        this.connection,
        JUPITER_API_KEY,
        this.notificationService
      );
      if (DEBUGGING_ENABLED) {
        console.log('JupiterService initialized');
      }
      
      // 3. Market data service (depends on Jupiter service)
      if (this.jupiterService) {
        this.marketDataService = new MarketDataService(
          this.connection, 
          this.jupiterService
        );
        if (DEBUGGING_ENABLED) {
          console.log('MarketDataService initialized');
        }
      }
      
      // 4. Sonic agent service
      this.sonicAgent = new SonicAgent(
        this.connection,
        this.notificationService
      );
      if (DEBUGGING_ENABLED) {
        console.log('SonicAgent initialized');
      }
      
      // 5. Jupiter trading strategy (depends on market data service and Jupiter service)
      if (this.jupiterService && this.marketDataService && this.sonicAgent) {
        this.jupiterTradingStrategy = new JupiterTradingStrategy(
          this.connection,
          this.sonicAgent,
          this.jupiterService,
          this.marketDataService,
          this.notificationService
        );
        if (DEBUGGING_ENABLED) {
          console.log('JupiterTradingStrategy initialized');
        }
      }
      
      // 6. Portfolio rebalancer (depends on Jupiter trading strategy and Jupiter service)
      if (this.jupiterService && this.sonicAgent && this.marketDataService) {
        this.portfolioRebalancer = new PortfolioRebalancer(
          this.connection,
          this.sonicAgent,
          this.jupiterService,
          this.marketDataService,
          this.notificationService
        );
        if (DEBUGGING_ENABLED) {
          console.log('PortfolioRebalancer initialized');
        }
      }
      
      // 7. DeFi Strategy Service
      this.defiStrategyService = DeFiStrategyService.getInstance(this.connection);
      if (DEBUGGING_ENABLED) {
        console.log('DeFiStrategyService initialized');
      }
      
      // 8. AI Optimization Service
      this.aiOptimizationService = AIOptimizationService.getInstance();
      if (DEBUGGING_ENABLED) {
        console.log('AIOptimizationService initialized');
      }
      
      // Start automated services
      if (AUTO_TRADING_ENABLED && this.jupiterTradingStrategy) {
        // Only start auto trading if explicitly defined in the JupiterTradingStrategy
        if (typeof (this.jupiterTradingStrategy as any).startAutoTrading === 'function') {
          await (this.jupiterTradingStrategy as any).startAutoTrading();
          if (DEBUGGING_ENABLED) {
            console.log('Auto-trading initialized');
          }
        }
      }
      
      this.isInitialized = true;
      if (DEBUGGING_ENABLED) {
        console.log('All services initialized successfully');
      }
      
    } catch (error) {
      console.error('Error initializing services:', error);
      
      // Clean up any created services
      await this.shutdown();
      
      // Reset initialization state
      this.isInitialized = false;
      this.initPromise = null;
      
      // Re-throw the error
      throw error;
    }
  }
  
  /**
   * Get JupiterService instance
   * 
   * @returns JupiterService instance
   * @throws Error if service is not initialized
   */
  public getJupiterService(): JupiterService {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.jupiterService) {
      throw new Error('JupiterService not available');
    }
    
    return this.jupiterService;
  }
  
  /**
   * Get SonicAgent instance
   * 
   * @returns SonicAgent instance
   * @throws Error if service is not initialized
   */
  public getSonicAgent(): SonicAgent {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.sonicAgent) {
      throw new Error('SonicAgent not available');
    }
    
    return this.sonicAgent;
  }
  
  /**
   * Get JupiterTradingStrategy instance
   * 
   * @returns JupiterTradingStrategy instance
   * @throws Error if service is not initialized
   */
  public getJupiterTradingStrategy(): JupiterTradingStrategy {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.jupiterTradingStrategy) {
      throw new Error('JupiterTradingStrategy not available');
    }
    
    return this.jupiterTradingStrategy;
  }
  
  /**
   * Get PortfolioRebalancer instance
   * 
   * @returns PortfolioRebalancer instance
   * @throws Error if service is not initialized
   */
  public getPortfolioRebalancer(): PortfolioRebalancer {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.portfolioRebalancer) {
      throw new Error('PortfolioRebalancer not available');
    }
    
    return this.portfolioRebalancer;
  }
  
  /**
   * Get MarketDataService instance
   * 
   * @returns MarketDataService instance
   * @throws Error if service is not initialized
   */
  public getMarketDataService(): MarketDataService {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.marketDataService) {
      throw new Error('MarketDataService not available');
    }
    
    return this.marketDataService;
  }
  
  /**
   * Get NotificationService instance
   * 
   * @returns NotificationService instance or undefined if notifications are disabled
   * @throws Error if service is not initialized
   */
  public getNotificationService(): NotificationService | undefined {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    return this.notificationService;
  }
  
  /**
   * Get DeFiStrategyService instance
   * 
   * @returns DeFiStrategyService instance
   * @throws Error if service is not initialized
   */
  public getDeFiStrategyService(): DeFiStrategyService {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.defiStrategyService) {
      throw new Error('DeFiStrategyService not available');
    }
    
    return this.defiStrategyService;
  }
  
  /**
   * Get AIOptimizationService instance
   * 
   * @returns AIOptimizationService instance
   * @throws Error if service is not initialized
   */
  public getAIOptimizationService(): AIOptimizationService {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    if (!this.aiOptimizationService) {
      throw new Error('AIOptimizationService not available');
    }
    
    return this.aiOptimizationService;
  }
  
  /**
   * Shutdown all services and clean up resources
   * 
   * @returns Promise that resolves when all services are shut down
   */
  public async shutdown(): Promise<void> {
    if (DEBUGGING_ENABLED) {
      console.log('Shutting down services...');
    }
    
    // Shut down services in reverse order of creation
    
    // 1. Stop auto-trading if enabled
    if (AUTO_TRADING_ENABLED && this.jupiterTradingStrategy) {
      try {
        // Only stop auto trading if explicitly defined in the JupiterTradingStrategy
        if (typeof (this.jupiterTradingStrategy as any).stopAutoTrading === 'function') {
          await (this.jupiterTradingStrategy as any).stopAutoTrading();
          if (DEBUGGING_ENABLED) {
            console.log('Auto-trading stopped');
          }
        }
      } catch (error) {
        console.error('Error stopping auto-trading:', error);
      }
    }
    
    // 2. AI Optimization Service
    this.aiOptimizationService = null;
    
    // 3. DeFi Strategy Service
    this.defiStrategyService = null;
    
    // 4. Portfolio rebalancer
    this.portfolioRebalancer = null;
    
    // 5. Jupiter trading strategy
    this.jupiterTradingStrategy = null;
    
    // 6. Sonic agent
    this.sonicAgent = null;
    
    // 7. Market data service
    if (this.marketDataService) {
      try {
        this.marketDataService.clearCache();
      } catch (error) {
        console.error('Error clearing market data cache:', error);
      }
      this.marketDataService = null;
    }
    
    // 8. Jupiter service 
    this.jupiterService = null; 
    
    // 9. Notification service
    this.notificationService = undefined;
    
    // 10. Connection
    this.connection = null;
    
    // Reset initialization state
    this.isInitialized = false;
    this.initPromise = null;
    
    if (DEBUGGING_ENABLED) {
      console.log('All services shut down successfully');
    }
  }
  
  /**
   * Check if all services are initialized
   * 
   * @returns Whether services are initialized
   */
  public isServicesInitialized(): boolean {
    return this.isInitialized;
  }
}