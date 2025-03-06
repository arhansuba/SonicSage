import { JupiterService } from './JupiterService';
import { SonicAgent } from './SonicAgent';
import { JupiterTradingStrategy } from './JupiterTradingStrategy';
import { PortfolioRebalancer } from './PortfolioRebalancer';
import { MarketDataService } from './MarketDataService';
import { NotificationService } from './NotificationService';
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
  getPortfolioService() {
      throw new Error('Method not implemented.');
  }
  private static instance: ServiceFactory;
  
  private jupiterService: JupiterService | null = null;
  private sonicAgent: SonicAgent | null = null;
  private jupiterTradingStrategy: JupiterTradingStrategy | null = null;
  private portfolioRebalancer: PortfolioRebalancer | null = null;
  private marketDataService: MarketDataService | null = null;
  private notificationService: NotificationService | null = null;
  
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  
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
   * @returns Promise that resolves when all services are initialized
   */
  public async initialize(): Promise<void> {
    // If already initialized or initializing, return existing promise
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
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
    try {
      if (DEBUGGING_ENABLED) {
        console.log('Initializing services...');
      }
      // Create services in dependency order
      
      // 1. Notification service (used by many other services)
      if (ENABLE_NOTIFICATIONS) {
        this.notificationService = new NotificationService();
        if (DEBUGGING_ENABLED) {
          console.log('NotificationService initialized');
        }
      }
      
      // 2. Jupiter service
      this.jupiterService = new JupiterService(this.notificationService, JUPITER_API_KEY);
      if (DEBUGGING_ENABLED) {
        console.log('JupiterService initialized');
      }
      
      // 3. Market data service (depends on Jupiter service)
      this.marketDataService = new MarketDataService(this.jupiterService);
      if (DEBUGGING_ENABLED) {
        console.log('MarketDataService initialized');
      }
      
      // 4. Sonic agent service
      this.sonicAgent = new SonicAgent(this.notificationService);
      if (DEBUGGING_ENABLED) {
        console.log('SonicAgent initialized');
      }
      
      // 5. Jupiter trading strategy (depends on market data service and Jupiter service)
      this.jupiterTradingStrategy = new JupiterTradingStrategy(
        this.jupiterService,
        this.marketDataService,
        this.notificationService,
        OPENAI_API_KEY
      );
      if (DEBUGGING_ENABLED) {
        console.log('JupiterTradingStrategy initialized');
      }
      
      // 6. Portfolio rebalancer (depends on Jupiter trading strategy and Jupiter service)
      this.portfolioRebalancer = new PortfolioRebalancer(
        this.jupiterService,
        this.jupiterTradingStrategy,
        this.notificationService
      );
      if (DEBUGGING_ENABLED) {
        console.log('PortfolioRebalancer initialized');
      }
      
      // Start auto-trading if enabled
      if (AUTO_TRADING_ENABLED && this.jupiterTradingStrategy) {
        await this.jupiterTradingStrategy.startAutoTrading();
        if (DEBUGGING_ENABLED) {
          console.log('Auto-trading initialized');
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
   * @returns NotificationService instance or null if notifications are disabled
   * @throws Error if service is not initialized
   */
  public getNotificationService(): NotificationService | null {
    if (!this.isInitialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    
    return this.notificationService;
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
        await this.jupiterTradingStrategy.stopAutoTrading();
        if (DEBUGGING_ENABLED) {
          console.log('Auto-trading stopped');
        }
      } catch (error) {
        console.error('Error stopping auto-trading:', error);
      }
    }
    
    // 2. Portfolio rebalancer
    this.portfolioRebalancer = null;
    
    // 3. Jupiter trading strategy
    this.jupiterTradingStrategy = null;
    
    // 4. Sonic agent
    this.sonicAgent = null;
    
    // 5. Market data service
    if (this.marketDataService) {
      try {
        this.marketDataService.clearCache();
      } catch (error) {
        console.error('Error clearing market data cache:', error);
      }
      this.marketDataService = null;
    }
    
    // 6. Jupiter service
    this.jupiterService = null; 
    
    // 7. Notification service
    this.notificationService = null;
    
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