// src/services/AIStrategyService.ts
// src/services/AIStrategyService.ts

import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program, BN, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { StrategyMarketplaceService, TradingStrategy, RiskLevel, TimeHorizon, AIModelType, TokenSupportType } from './StrategyMarketplace';
import { NotificationService } from './NotificationService';
import { NotificationType } from '@/types/notification';

// This would be imported from your program's IDL
// For this example, we'll define a simplified interface
interface AIStrategyProgram {
  rpc: {
    createStrategy: (
      id: string,
      name: string,
      descriptionHash: string, 
      riskLevel: number,
      timeHorizon: number,
      aiModels: number,
      tokenSupport: number,
      managementFeeBps: number,
      performanceFeeBps: number,
      minInvestment: BN,
      accounts: any
    ) => Promise<string>;
    
    subscribeToStrategy: (
      investmentAmount: BN,
      accounts: any
    ) => Promise<string>;
    
    unsubscribeFromStrategy: (
      accounts: any
    ) => Promise<string>;
    
    updateStrategy: (
      name: string | null,
      descriptionHash: string | null,
      riskLevel: number | null,
      timeHorizon: number | null,
      aiModels: number | null,
      tokenSupport: number | null,
      managementFeeBps: number | null,
      performanceFeeBps: number | null,
      minInvestment: BN | null,
      status: number | null,
      accounts: any
    ) => Promise<string>;
  };
  
  account: {
    strategyRegistry: {
      fetch: (address: PublicKey) => Promise<any>;
    };
    aIStrategy: {
      fetch: (address: PublicKey) => Promise<any>;
      all: (filters?: any[]) => Promise<{ publicKey: PublicKey; account: any }[]>;
    };
    strategySubscription: {
      fetch: (address: PublicKey) => Promise<any>;
      all: (filters?: any[]) => Promise<{ publicKey: PublicKey; account: any }[]>;
    };
  };
}

export class AIStrategyService {
  private static instance: AIStrategyService;
  private connection: Connection;
  private program: AIStrategyProgram | null = null;
  private provider: AnchorProvider | null = null;
  private programId: PublicKey;
  private registryAddress: PublicKey | null = null;
  private notificationService: NotificationService;
  private marketplaceService: StrategyMarketplaceService;
  
  private constructor(connection: Connection, programId: string) {
    this.connection = connection;
    this.programId = new PublicKey(programId);
    this.notificationService = NotificationService.getInstance();
    this.marketplaceService = StrategyMarketplaceService.getInstance();
  }
  
  public static getInstance(connection?: Connection, programId?: string): AIStrategyService {
    if (!AIStrategyService.instance && connection && programId) {
      AIStrategyService.instance = new AIStrategyService(connection, programId);
    }
    return AIStrategyService.instance;
  }
  
  /**
   * Initialize the service with a wallet provider
   */
  public async initialize(provider: AnchorProvider): Promise<void> {
    this.provider = provider;
    
    // In a real implementation, load the program using Anchor
    // this.program = new Program(idl, this.programId, this.provider);
    
    // For demo purposes, we'll pretend we have a program
    this.program = null as any;
    
    // Find the registry PDA
    this.registryAddress = PublicKey.findProgramAddressSync(
      [Buffer.from('strategy-registry')],
      this.programId
    )[0];
  }
  
  /**
   * Check if the service is initialized
   */
  private checkInitialized(): void {
    if (!this.provider || !this.program) {
      throw new Error('AIStrategyService not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Convert a TradingStrategy to on-chain format
   */
  private tradingStrategyToOnChain(strategy: TradingStrategy): {
    id: string;
    name: string;
    descriptionHash: string;
    riskLevel: number;
    timeHorizon: number;
    aiModels: number;
    tokenSupport: number;
    managementFeeBps: number;
    performanceFeeBps: number;
    minInvestment: BN;
  } {
    // Convert risk level
    let riskLevel: number;
    switch (strategy.riskLevel) {
      case RiskLevel.LOW:
        riskLevel = 0;
        break;
      case RiskLevel.MEDIUM:
        riskLevel = 1;
        break;
      case RiskLevel.HIGH:
        riskLevel = 2;
        break;
      case RiskLevel.VERY_HIGH:
        riskLevel = 3;
        break;
      default:
        riskLevel = 1; // Default to medium
    }
    
    // Convert time horizon
    let timeHorizon: number;
    switch (strategy.timeHorizon) {
      case TimeHorizon.SHORT_TERM:
        timeHorizon = 0;
        break;
      case TimeHorizon.MEDIUM_TERM:
        timeHorizon = 1;
        break;
      case TimeHorizon.LONG_TERM:
        timeHorizon = 2;
        break;
      default:
        timeHorizon = 1; // Default to medium
    }
    
    // Convert AI models to bitmap
    let aiModels = 0;
    strategy.aiModels.forEach(model => {
      let bit: number;
      switch (model) {
        case AIModelType.MOMENTUM:
          bit = 0;
          break;
        case AIModelType.MEAN_REVERSION:
          bit = 1;
          break;
        case AIModelType.SENTIMENT:
          bit = 2;
          break;
        case AIModelType.STATISTICAL_ARBITRAGE:
          bit = 3;
          break;
        case AIModelType.REINFORCEMENT_LEARNING:
          bit = 4;
          break;
        case AIModelType.MULTI_FACTOR:
          bit = 5;
          break;
        case AIModelType.VOLATILITY_PREDICTION:
          bit = 6;
          break;
        case AIModelType.MARKET_REGIME:
          bit = 7;
          break;
        case AIModelType.ORDER_FLOW:
          bit = 8;
          break;
        case AIModelType.PATTERN_RECOGNITION:
          bit = 9;
          break;
        default:
          bit = 0;
      }
      if (aiModels !== null) {
        if (aiModels !== null) {
          if (aiModels !== null) {
            if (aiModels !== null) {
              aiModels |= (1 << bit);
            }
          }
        }
      }
    });
    
    // Convert token support
    let tokenSupport: number;
    switch (strategy.tokenSupport) {
      case TokenSupportType.MAJOR_ONLY:
        tokenSupport = 0;
        break;
      case TokenSupportType.MAJOR_AND_MEDIUM:
        tokenSupport = 1;
        break;
      case TokenSupportType.WIDE_COVERAGE:
        tokenSupport = 2;
        break;
      case TokenSupportType.CUSTOM_BASKET:
        tokenSupport = 3;
        break;
      default:
        tokenSupport = 0; // Default to major only
    }
    
    // Convert fees and minimum investment
    const managementFeeBps = Math.round(strategy.feePercentage * 100); // Convert to basis points
    const performanceFeeBps = Math.round(strategy.performanceFee * 100); // Convert to basis points
    const minInvestment = new BN(Math.round((strategy.minInvestment || 0) * 1e9)); // Convert to lamports
    
    // Create a description hash (in a real implementation, this would be IPFS CID or similar)
    const descriptionHash = `desc_${strategy.id}_${Date.now()}`;
    
    return {
      id: strategy.id,
      name: strategy.name,
      descriptionHash,
      riskLevel,
      timeHorizon,
      aiModels,
      tokenSupport,
      managementFeeBps,
      performanceFeeBps,
      minInvestment
    };
  }
  
  /**
   * Convert on-chain strategy data to TradingStrategy format
   */
  private onChainToTradingStrategy(
    address: PublicKey,
    data: any
  ): TradingStrategy {
    // Extract risk level
    let riskLevel: RiskLevel;
    switch (data.riskLevel) {
      case 0:
        riskLevel = RiskLevel.LOW;
        break;
      case 1:
        riskLevel = RiskLevel.MEDIUM;
        break;
      case 2:
        riskLevel = RiskLevel.HIGH;
        break;
      case 3:
        riskLevel = RiskLevel.VERY_HIGH;
        break;
      default:
        riskLevel = RiskLevel.MEDIUM;
    }
    
    // Extract time horizon
    let timeHorizon: TimeHorizon;
    switch (data.timeHorizon) {
      case 0:
        timeHorizon = TimeHorizon.SHORT_TERM;
        break;
      case 1:
        timeHorizon = TimeHorizon.MEDIUM_TERM;
        break;
      case 2:
        timeHorizon = TimeHorizon.LONG_TERM;
        break;
      default:
        timeHorizon = TimeHorizon.MEDIUM_TERM;
    }
    
    // Extract AI models from bitmap
    const aiModels: AIModelType[] = [];
    const modelMap: { [key: number]: AIModelType } = {
      0: AIModelType.MOMENTUM,
      1: AIModelType.MEAN_REVERSION,
      2: AIModelType.SENTIMENT,
      3: AIModelType.STATISTICAL_ARBITRAGE,
      4: AIModelType.REINFORCEMENT_LEARNING,
      5: AIModelType.MULTI_FACTOR,
      6: AIModelType.VOLATILITY_PREDICTION,
      7: AIModelType.MARKET_REGIME,
      8: AIModelType.ORDER_FLOW,
      9: AIModelType.PATTERN_RECOGNITION
    };
    
    for (let i = 0; i < 10; i++) {
      if ((data.aiModels & (1 << i)) !== 0) {
        aiModels.push(modelMap[i]);
      }
    }
    
    // Extract token support
    let tokenSupport: TokenSupportType;
    switch (data.tokenSupport) {
      case 0:
        tokenSupport = TokenSupportType.MAJOR_ONLY;
        break;
      case 1:
        tokenSupport = TokenSupportType.MAJOR_AND_MEDIUM;
        break;
      case 2:
        tokenSupport = TokenSupportType.WIDE_COVERAGE;
        break;
      case 3:
        tokenSupport = TokenSupportType.CUSTOM_BASKET;
        break;
      default:
        tokenSupport = TokenSupportType.MAJOR_ONLY;
    }
    
    // Build sample strategy (in real implementation, more data would be available)
    return {
      id: data.id,
      name: data.name,
      description: 'Description not available', // Would be fetched from IPFS using descriptionHash
      creatorAddress: data.creator.toString(),
      creatorName: 'Unknown Creator', // Would be fetched from a user registry
      verified: data.verified,
      riskLevel,
      timeHorizon,
      aiModels,
      tokenSupport,
      activeUsers: data.subscriberCount.toNumber(),
      tvl: data.tvl.toNumber() / 1e9, // Convert from lamports to SOL
      feePercentage: data.managementFeeBps / 100, // Convert from basis points
      performanceFee: data.performanceFeeBps / 100, // Convert from basis points
      backtestResults: [],
      lastUpdated: new Date(data.updatedAt.toNumber() * 1000).toISOString(),
      tags: [], // Would be extracted from description
      contractAddress: address.toString(),
      minInvestment: data.minInvestment.toNumber() / 1e9, // Convert from lamports to SOL
      version: '1.0.0',
      compatibleWith: ['SonicAgent']
    };
  }
  
  /**
   * Register a new AI strategy on-chain
   */
  public async registerStrategy(strategy: TradingStrategy): Promise<string> {
    this.checkInitialized();
    
    try {
      // Convert to on-chain format
      const onChainStrategy = this.tradingStrategyToOnChain(strategy);
      
      // Find the next strategy PDA
      const registryData = await this.program!.account.strategyRegistry.fetch(this.registryAddress!);
      const strategyCount = registryData.strategyCount.toNumber();
      
      const [strategyAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('strategy'),
          this.provider!.wallet.publicKey.toBuffer(),
          Buffer.from(strategyCount.toString())
        ],
        this.programId
      );
      
      // Call the program to create the strategy
      const txid = await this.program!.rpc.createStrategy(
        onChainStrategy.id,
        onChainStrategy.name,
        onChainStrategy.descriptionHash,
        onChainStrategy.riskLevel,
        onChainStrategy.timeHorizon,
        onChainStrategy.aiModels,
        onChainStrategy.tokenSupport,
        onChainStrategy.managementFeeBps,
        onChainStrategy.performanceFeeBps,
        onChainStrategy.minInvestment,
        {
          accounts: {
            creator: this.provider!.wallet.publicKey,
            registry: this.registryAddress,
            strategy: strategyAddress,
            systemProgram: SystemProgram.programId,
          },
        }
      );
      
      // Notify user
      this.notificationService.addNotification({
        type: NotificationType.SUCCESS,
        title: 'Strategy Created',
        message: `Your strategy '${strategy.name}' has been successfully created`,
        data: {
          strategyId: strategy.id,
          txid
        }
      });
      
      return txid;
    } catch (error: unknown) {
      console.error('Error registering strategy:', error);
      
      // Notify user of error
      this.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Strategy Creation Failed',
        message: `Failed to create strategy: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }
  
  /**
   * Subscribe to a strategy
   */
  public async subscribeToStrategy(
    strategyAddress: string,
    investmentAmount: number,
    paymentTokenMint: string
  ): Promise<string> {
    this.checkInitialized();
    
    try {
      const strategyPublicKey = new PublicKey(strategyAddress);
      const paymentTokenMintPublicKey = new PublicKey(paymentTokenMint);
      
      // Find the subscription PDA
      const [subscriptionAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('subscription'),
          strategyPublicKey.toBuffer(),
          this.provider!.wallet.publicKey.toBuffer()
        ],
        this.programId
      );
      
      // Get associated token accounts
      const subscriberTokenAccount = await getAssociatedTokenAddress(
        paymentTokenMintPublicKey,
        this.provider!.wallet.publicKey
      );
      
      // Find the strategy's token account
      // In a real implementation, this would be derived from the strategy PDA
      const strategyTokenAccount = await getAssociatedTokenAddress(
        paymentTokenMintPublicKey,
        strategyPublicKey,
        true // Allow PDA as owner
      );
      
      // Convert investment amount to lamports
      const investmentAmountLamports = new BN(Math.round(investmentAmount * 1e9));
      
      // Create transaction
      const transaction = new Transaction();
      
      // Check if the token accounts exist and create if needed
      const subscriberAccountInfo = await this.connection.getAccountInfo(subscriberTokenAccount);
      if (!subscriberAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.provider!.wallet.publicKey,
            subscriberTokenAccount,
            this.provider!.wallet.publicKey,
            paymentTokenMintPublicKey
          )
        );
      }
      
      const strategyAccountInfo = await this.connection.getAccountInfo(strategyTokenAccount);
      if (!strategyAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.provider!.wallet.publicKey,
            strategyTokenAccount,
            strategyPublicKey,
            paymentTokenMintPublicKey
          )
        );
      }
      
      // Call the program to subscribe to the strategy
      const txid = await this.program!.rpc.subscribeToStrategy(
        investmentAmountLamports,
        {
          accounts: {
            subscriber: this.provider!.wallet.publicKey,
            strategy: strategyPublicKey,
            subscription: subscriptionAddress,
            subscriberTokenAccount,
            strategyTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
        }
      );
      
      // Get strategy data to include in notification
      const strategyData = await this.program!.account.aIStrategy.fetch(strategyPublicKey);
      
      // Notify user
      this.notificationService.addNotification({
        type: NotificationType.SUCCESS,
        title: 'Strategy Subscription',
        message: `You have successfully subscribed to '${strategyData.name}' with ${investmentAmount} SOL`,
        data: {
          strategyId: strategyData.id,
          amount: investmentAmount,
          txid
        }
      });
      
      return txid;
    } catch (error: unknown) {
      console.error('Error subscribing to strategy:', error);
      
      // Notify user of error
      this.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Strategy Subscription Failed',
        message: `Failed to subscribe to strategy: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a strategy
   */
  public async unsubscribeFromStrategy(
    strategyAddress: string,
    paymentTokenMint: string
  ): Promise<string> {
    this.checkInitialized();
    
    try {
      const strategyPublicKey = new PublicKey(strategyAddress);
      const paymentTokenMintPublicKey = new PublicKey(paymentTokenMint);
      
      // Find the subscription PDA
      const [subscriptionAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('subscription'),
          strategyPublicKey.toBuffer(),
          this.provider!.wallet.publicKey.toBuffer()
        ],
        this.programId
      );
      
      // Get associated token accounts
      const subscriberTokenAccount = await getAssociatedTokenAddress(
        paymentTokenMintPublicKey,
        this.provider!.wallet.publicKey
      );
      
      // Find the strategy's token account
      const strategyTokenAccount = await getAssociatedTokenAddress(
        paymentTokenMintPublicKey,
        strategyPublicKey,
        true // Allow PDA as owner
      );
      
      // Call the program to unsubscribe from the strategy
      const txid = await this.program!.rpc.unsubscribeFromStrategy(
        {
          accounts: {
            subscriber: this.provider!.wallet.publicKey,
            strategy: strategyPublicKey,
            subscription: subscriptionAddress,
            subscriberTokenAccount,
            strategyTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
        }
      );
      
      // Get strategy data to include in notification
      const strategyData = await this.program!.account.aIStrategy.fetch(strategyPublicKey);
      
      // Notify user
      this.notificationService.addNotification({
        type: NotificationType.SUCCESS,
        title: 'Strategy Unsubscription',
        message: `You have successfully unsubscribed from '${strategyData.name}'`,
        data: {
          strategyId: strategyData.id,
          txid
        }
      });
      
      return txid;
    } catch (error: unknown) {
      console.error('Error unsubscribing from strategy:', error);
      
      // Notify user of error
      this.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Strategy Unsubscription Failed',
        message: `Failed to unsubscribe from strategy: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }
  
  /**
   * Update an existing strategy
   */
  public async updateStrategy(
    strategyAddress: string,
    updates: Partial<TradingStrategy>
  ): Promise<string> {
    this.checkInitialized();
    
    try {
      const strategyPublicKey = new PublicKey(strategyAddress);
      
      // Get current strategy data
      const strategyData = await this.program!.account.aIStrategy.fetch(strategyPublicKey);
      
      // Check if user is the creator
      if (strategyData.creator.toString() !== this.provider!.wallet.publicKey.toString()) {
        throw new Error('Only the strategy creator can update it');
      }
      
      // Prepare update parameters
      let name = null;
      let descriptionHash = null;
      let riskLevel = null;
      let timeHorizon = null;
      let aiModels: number | null = null;
      let tokenSupport = null;
      let managementFeeBps = null;
      let performanceFeeBps = null;
      let minInvestment = null;
      let status = null;
      
      if (updates.name) {
        name = updates.name;
      }
      
      if (updates.description) {
        // In a real implementation, this would upload to IPFS and get a CID
        descriptionHash = `desc_${strategyData.id}_${Date.now()}`;
      }
      
      if (updates.riskLevel) {
        switch (updates.riskLevel) {
          case RiskLevel.LOW:
            riskLevel = 0;
            break;
          case RiskLevel.MEDIUM:
            riskLevel = 1;
            break;
          case RiskLevel.HIGH:
            riskLevel = 2;
            break;
          case RiskLevel.VERY_HIGH:
            riskLevel = 3;
            break;
        }
      }
      
      if (updates.timeHorizon) {
        switch (updates.timeHorizon) {
          case TimeHorizon.SHORT_TERM:
            timeHorizon = 0;
            break;
          case TimeHorizon.MEDIUM_TERM:
            timeHorizon = 1;
            break;
          case TimeHorizon.LONG_TERM:
            timeHorizon = 2;
            break;
        }
      }
      
      if (updates.aiModels && updates.aiModels.length > 0) {
        aiModels = 0;
        updates.aiModels.forEach(model => {
          let bit: number;
          switch (model) {
            case AIModelType.MOMENTUM:
              bit = 0;
              break;
            case AIModelType.MEAN_REVERSION:
              bit = 1;
              break;
            case AIModelType.SENTIMENT:
              bit = 2;
              break;
            case AIModelType.STATISTICAL_ARBITRAGE:
              bit = 3;
              break;
            case AIModelType.REINFORCEMENT_LEARNING:
              bit = 4;
              break;
            case AIModelType.MULTI_FACTOR:
              bit = 5;
              break;
            case AIModelType.VOLATILITY_PREDICTION:
              bit = 6;
              break;
            case AIModelType.MARKET_REGIME:
              bit = 7;
              break;
            case AIModelType.ORDER_FLOW:
              bit = 8;
              break;
            case AIModelType.PATTERN_RECOGNITION:
              bit = 9;
              break;
            default:
              bit = 0;
          }
          aiModels! |= (1 << bit);
        });
      }
      
      if (updates.tokenSupport) {
        switch (updates.tokenSupport) {
          case TokenSupportType.MAJOR_ONLY:
            tokenSupport = 0;
            break;
          case TokenSupportType.MAJOR_AND_MEDIUM:
            tokenSupport = 1;
            break;
          case TokenSupportType.WIDE_COVERAGE:
            tokenSupport = 2;
            break;
          case TokenSupportType.CUSTOM_BASKET:
            tokenSupport = 3;
            break;
        }
      }
      
      if (updates.feePercentage !== undefined) {
        managementFeeBps = Math.round(updates.feePercentage * 100);
      }
      
      if (updates.performanceFee !== undefined) {
        performanceFeeBps = Math.round(updates.performanceFee * 100);
      }
      
      if (updates.minInvestment !== undefined) {
        minInvestment = new BN(Math.round(updates.minInvestment * 1e9));
      }
      
      // Call the program to update the strategy
      const txid = await this.program!.rpc.updateStrategy(
        name,
        descriptionHash,
        riskLevel,
        timeHorizon,
        aiModels,
        tokenSupport,
        managementFeeBps,
        performanceFeeBps,
        minInvestment,
        status,
        {
          accounts: {
            creator: this.provider!.wallet.publicKey,
            strategy: strategyPublicKey,
          },
        }
      );
      
      // Notify user
      this.notificationService.addNotification({
        type: NotificationType.SUCCESS,
        title: 'Strategy Updated',
        message: `Your strategy '${strategyData.name}' has been successfully updated`,
        data: {
          strategyId: strategyData.id,
          txid
        }
      });
      
      return txid;
    } catch (error: unknown) {
      console.error('Error updating strategy:', error);
      
      // Notify user of error
      this.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: 'Strategy Update Failed',
        message: `Failed to update strategy: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }
  
  /**
   * Get all strategies created by the current user
   */
  public async getUserCreatedStrategies(): Promise<TradingStrategy[]> {
    this.checkInitialized();
    
    try {
      // Get all strategies
      const strategies = await this.program!.account.aIStrategy.all([
        {
          memcmp: {
            offset: 8, // After the discriminator
            bytes: this.provider!.wallet.publicKey.toBase58()
          }
        }
      ]);
      
      // Convert to TradingStrategy format
      return strategies.map(({ publicKey, account }) => 
        this.onChainToTradingStrategy(publicKey, account)
      );
    } catch (error) {
      console.error('Error fetching user created strategies:', error);
      throw error;
    }
  }
  
  /**
   * Get all strategies the user is subscribed to
   */
  public async getUserSubscribedStrategies(): Promise<TradingStrategy[]> {
    this.checkInitialized();
    
    try {
      // Get all user subscriptions
      const subscriptions = await this.program!.account.strategySubscription.all([
        {
          memcmp: {
            offset: 40, // After discriminator and strategy address
            bytes: this.provider!.wallet.publicKey.toBase58()
          }
        }
      ]);
      
      // Fetch all strategy data
      const strategies: TradingStrategy[] = [];
      
      for (const { account } of subscriptions) {
        const strategyData = await this.program!.account.aIStrategy.fetch(account.strategy);
        strategies.push(this.onChainToTradingStrategy(account.strategy, strategyData));
      }
      
      return strategies;
    } catch (error) {
      console.error('Error fetching user subscribed strategies:', error);
      throw error;
    }
  }
  
  /**
   * Get strategy performance details
   */
  public async getStrategyPerformance(
    strategyAddress: string,
    userAddress?: string
  ): Promise<{
    strategyDetails: TradingStrategy;
    userInvestment?: number;
    userCurrentValue?: number;
    userReturns?: number;
    userSubscriptionDate?: string;
  }> {
    this.checkInitialized();
    
    try {
      const strategyPublicKey = new PublicKey(strategyAddress);
      
      // Get strategy data
      const strategyData = await this.program!.account.aIStrategy.fetch(strategyPublicKey);
      const strategyDetails = this.onChainToTradingStrategy(strategyPublicKey, strategyData);
      
      // If userAddress is provided, get user subscription data
      if (userAddress) {
        const userPubkey = new PublicKey(userAddress);
        
        // Find the subscription PDA
        const [subscriptionAddress] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('subscription'),
            strategyPublicKey.toBuffer(),
            userPubkey.toBuffer()
          ],
          this.programId
        );
        
        try {
          const subscriptionData = await this.program!.account.strategySubscription.fetch(subscriptionAddress);
          
                    return {
                      strategyDetails,
                      userInvestment: subscriptionData.investmentAmount.toNumber() / 1e9,
                      userCurrentValue: subscriptionData.currentValue.toNumber() / 1e9,
                      userReturns: ((subscriptionData.currentValue.toNumber() / subscriptionData.investmentAmount.toNumber()) - 1) * 100,
                      userSubscriptionDate: new Date(subscriptionData.subscribedAt.toNumber() * 1000).toISOString()
                    };
                  } catch (error) {
                    console.error('Error fetching subscription data:', error);
                    throw error;
                  }
                }
          
                return { strategyDetails };
              } catch (error) {
                console.error('Error fetching strategy performance:', error);
                throw error;
              }
            }
          }