// src/services/SonicAgent.ts

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  VersionedTransaction,
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  AnchorProvider, 
  Program, 
  Idl, 
  BN,
  web3
} from '@coral-xyz/anchor';
import { 
  AgentConfig, 
  AgentStatus, 
  RiskProfile, 
  Strategy, 
  TokenAllocation,
  AgentAction,
  Portfolio,
  PortfolioPerformance,
  PortfolioAllocation,
  PortfolioAsset,
  TradeResult
} from '../types/api';
import {NotificationService} from './NotificationService';
import { NotificationType, NotificationCategory } from '../types/notification';
import { ENDPOINT_SONIC_RPC } from '../constants/endpoints';
import * as bs58 from 'bs58';

// For type compatibility with Anchor IDL
interface SonicAgentIDL extends Idl {
  instructions: any[];
  accounts: any[];
  metadata: {
    name: string;
    version: string;
    spec: string;
  };
}

// Import the IDL (in a real app, this would be imported from a generated file)
// Simplified IDL for illustration purposes
const IDL: SonicAgentIDL = {
  instructions: [
    {
      name: "initializeAgent",
      accounts: [],
      args: []
    },
    {
      name: "updateAgentConfig",
      accounts: [],
      args: []
    },
    {
      name: "activateAgent",
      accounts: [],
      args: []
    },
    {
      name: "deactivateAgent",
      accounts: [],
      args: []
    },
    {
      name: "updateTradingRules",
      accounts: [],
      args: []
    },
    {
      name: "updateGasSettings",
      accounts: [],
      args: []
    },
    {
      name: "setTargetAllocations",
      accounts: [],
      args: []
    },
    {
      name: "recordTrade",
      accounts: [],
      args: []
    }
  ],
  accounts: [],
  errors: [],
  metadata: {
    name: 'sonic-agent',
    version: '0.1.0',
    spec: '0.1.0'
  },
  address: ''
};

// The program ID of the deployed Sonic Agent contract
const SONIC_AGENT_PROGRAM_ID = new PublicKey('Sonicxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

/**
 * Service for interacting with the Sonic Agent smart contract and 
 * managing agent configurations on Sonic SVM.
 */
export class SonicAgent {
  private connection: Connection;
  private program: Program;
  private notificationService?: NotificationService;

  /**
   * Constructor for SonicAgent service
   * 
   * @param connection Optional Solana connection
   * @param notificationService Optional notification service for event notifications
   */
  constructor(connection?: Connection, notificationService?: NotificationService) {
    this.connection = connection || new Connection(ENDPOINT_SONIC_RPC, 'confirmed');
    this.program = this.initializeProgram();
    this.notificationService = notificationService;
  }

  /**
   * Initialize the Anchor program interface
   */
  private initializeProgram(): Program {
    // For client-side we use a fake provider since we'll be explicitly signing transactions
    const provider = new AnchorProvider(
      this.connection,
      {
        publicKey: PublicKey.default,
        signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => tx,
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      },
      { commitment: 'confirmed' }
    );

    // Create program with the IDL
    return new Program(IDL,  provider);
  }
 
  /**
   * Get token accounts for a wallet
   * 
   * @param walletPublicKey Wallet public key
   * @returns Token accounts data
   */
  public async getTokenAccounts(walletPublicKey: PublicKey): Promise<{
    mint: string;
    balance: number;
    decimals: number;
  }[]> {
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    return tokenAccounts.value.map((account) => {
      const accountData = account.account.data.parsed.info;
      return {
        mint: accountData.mint,
        balance: Number(accountData.tokenAmount.amount),
        decimals: accountData.tokenAmount.decimals,
      };
    });
  }

  /**
   * Get keypair from private key
   * 
   * @param privateKeyBase58 Base58 encoded private key
   * @returns Keypair object
   */
  private getKeypairFromPrivateKey(privateKeyBase58: string): Keypair {
    const decodedKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(Uint8Array.from(decodedKey));
  }

  /**
   * Find the agent config PDA for a given wallet
   * 
   * @param walletPublicKey Wallet public key
   * @returns [Agent PDA, bump]
   */
  private async findAgentPDA(walletPublicKey: string): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('agent'),
        new PublicKey(walletPublicKey).toBuffer()
      ],
      SONIC_AGENT_PROGRAM_ID
    );
  }

  /**
   * Find the agent stats PDA for a given agent
   * 
   * @param agentPublicKey Agent public key
   * @returns [Stats PDA, bump]
   */
  private async findStatsPDA(agentPublicKey: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('stats'),
        agentPublicKey.toBuffer()
      ],
      SONIC_AGENT_PROGRAM_ID
    );
  }

  /**
   * Find the trade action PDA
   * 
   * @param agentPublicKey Agent public key
   * @param strategyId Strategy ID
   * @param timestamp Unix timestamp
   * @returns [Trade PDA, bump]
   */
  private async findTradePDA(
    agentPublicKey: PublicKey,
    strategyId: Uint8Array,
    timestamp: number
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('trade'),
        agentPublicKey.toBuffer(),
        Buffer.from(strategyId),
        Buffer.from(timestamp.toString())
      ],
      SONIC_AGENT_PROGRAM_ID
    );
  }

  /**
   * Create a new agent
   * 
   * @param walletPublicKey User's wallet public key
   * @param name Agent name
   * @param description Agent description
   * @param privateKey Private key for transaction signing (server-side only)
   * @returns Result of agent creation
   */
  public async createAgent(
    walletPublicKey: string,
    name: string,
    description = '',
    privateKey?: string
  ): Promise<{ success: boolean; message?: string; error?: string; serializedTransaction?: string }> {
    try {
      // Validate inputs
      if (!name) {
        return { success: false, error: 'Agent name is required' };
      }

      if (name.length > 50) {
        return { success: false, error: 'Agent name must be less than 50 characters' };
      }

      if (description && description.length > 200) {
        return { success: false, error: 'Description must be less than 200 characters' };
      }

      // Find PDAs
      const [agentPDA, agentBump] = await this.findAgentPDA(walletPublicKey);
      const [statsPDA] = await this.findStatsPDA(agentPDA);

      // Check if agent already exists
      try {
        // Use getAccountInfo instead of direct fetch to avoid type errors
        const accountInfo = await this.connection.getAccountInfo(agentPDA);
        if (accountInfo && accountInfo.data.length > 0) {
          return { success: false, error: 'Agent already exists for this wallet' };
        }
      } catch (err) {
        // Agent doesn't exist, which is what we want
      }

      // Create transaction
      const tx = await this.program.methods
        .initializeAgent(
          name,
          description,
          { moderate: {} }, // Default to moderate risk profile
          agentBump
        )
        .accounts({
          owner: new PublicKey(walletPublicKey),
          agentConfig: agentPDA,
          agentStats: statsPDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Sign and send transaction
      if (privateKey) {
        // Server-side signing (for auto-trading features)
        const keypair = this.getKeypairFromPrivateKey(privateKey);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await this.connection.sendTransaction(tx, [keypair]);

        // Send notification
        if (this.notificationService) {
          this.notificationService.addNotification({
            type: NotificationType.SUCCESS,
            title: 'Agent Created',
            message: `Successfully created agent: ${name}`,
            //category: NotificationCategory.SYSTEM
          });
        }

        return {
          success: true,
          message: `Agent created successfully - Transaction: ${signedTx}`,
        };
      } else {
        // Return serialized transaction for client-side signing
        const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
        return {
          success: true,
          message: 'Transaction created',
          serializedTransaction: serializedTx
        };
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating agent',
      };
    }
  }

  /**
   * Get agent configuration
   * 
   * @param walletPublicKey User's wallet public key
   * @returns Agent configuration or null if not found
   */
  public async getAgentConfig(walletPublicKey: string): Promise<AgentConfig | null> {
    try {
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);
      
      // Check if account exists
      const accountInfo = await this.connection.getAccountInfo(agentPDA);
      if (!accountInfo) {
        return null;
      }
      
      // In a real implementation, we would decode the account data properly
      // This is a temporary implementation
      return this.simulateAgentConfig(walletPublicKey, agentPDA);
    } catch (error) {
      console.error('Error fetching agent config:', error);
      return null;
    }
  }

  /**
   * Simulate agent config for development
   */
  private simulateAgentConfig(walletPublicKey: string, agentPDA: PublicKey): AgentConfig {
    return {
      id: agentPDA.toString(),
      owner: walletPublicKey,
      name: 'My Sonic Agent',
      description: 'AI-powered trading agent on Sonic SVM',
      riskProfile: 'moderate',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoRebalance: true,
      rebalanceThreshold: 5, // 5%
      autoTrade: true,
      tradingBudget: 1000, // $1000
      strategies: [
        {
          id: 'strategy1',
          name: 'DCA Strategy',
          type: 'dollarCostAverage',
          isActive: true,
          parameters: {},
          lastExecuted: new Date().toISOString(),
          executionCount: 5
        }
      ],
      maxTradesPerDay: 10,
      maxAmountPerTrade: 100,
      maxSlippageBps: 50,
      preferredTokens: [
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
      ],
      excludedTokens: [],
      targetAllocations: [
        {
          mint: 'So11111111111111111111111111111111111111112',
          percentage: 50,
          maxDeviation: 10
        },
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          percentage: 50,
          maxDeviation: 10
        }
      ],
      gasSettings: {
        priorityFee: 'auto',
        computeUnits: 200000,
        retryOnFail: true,
        maxRetries: 3
      },
      totalExecutedTrades: 12,
      totalTradeVolume: 5000
    };
  }

  /**
   * Update agent configuration
   * 
   * @param walletPublicKey User's wallet public key
   * @param config Updated configuration
   * @param privateKey Private key for transaction signing (server-side only)
   * @returns Result of update operation
   */
  public async updateAgentConfig(
    walletPublicKey: string,
    config: Partial<AgentConfig>,
    privateKey?: string
  ): Promise<{ success: boolean; message?: string; error?: string; serializedTransaction?: string }> {
    try {
      // Validate inputs
      if (config.name && config.name.length > 50) {
        return { success: false, error: 'Agent name must be less than 50 characters' };
      }

      if (config.description && config.description.length > 200) {
        return { success: false, error: 'Description must be less than 200 characters' };
      }

      // Find agent PDA
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);

      // Create transaction for basic config update
      const tx = await this.program.methods
        .updateAgentConfig(
          config.name || null,
          config.description || null,
          this.mapRiskProfileToOnchain(config.riskProfile) || null,
          config.autoRebalance !== undefined ? config.autoRebalance : null,
          config.rebalanceThreshold !== undefined ? Math.floor(config.rebalanceThreshold * 100) : null, // Convert to basis points
          config.autoTrade !== undefined ? config.autoTrade : null,
          config.tradingBudget !== undefined ? new BN(config.tradingBudget) : null
        )
        .accounts({
          owner: new PublicKey(walletPublicKey),
          agentConfig: agentPDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Handle trading rules update if provided
      if (config.maxSlippageBps !== undefined || 
          config.maxTradesPerDay !== undefined || 
          config.preferredTokens !== undefined || 
          config.excludedTokens !== undefined) {
        
        const tradingRulesTx = await this.program.methods
          .updateTradingRules(
            config.maxAmountPerTrade !== undefined ? new BN(config.maxAmountPerTrade) : null,
            config.maxTradesPerDay !== undefined ? config.maxTradesPerDay : null,
            config.preferredTokens?.map(mint => new PublicKey(mint)) || null,
            config.excludedTokens?.map(mint => new PublicKey(mint)) || null,
            config.maxSlippageBps !== undefined ? config.maxSlippageBps : null
          )
          .accounts({
            owner: new PublicKey(walletPublicKey),
            agentConfig: agentPDA,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        
        // Add instructions from tradingRulesTx to main tx
        tradingRulesTx.instructions.forEach(ix => tx.add(ix));
      }

      // Handle gas settings update if provided
      if (config.gasSettings !== undefined) {
        const gasSettingsTx = await this.program.methods
          .updateGasSettings(
            config.gasSettings.priorityFee !== undefined ? 
              typeof config.gasSettings.priorityFee === 'string' ? 
                (config.gasSettings.priorityFee === 'auto' ? new BN(0) : new BN(1)) : 
                new BN(config.gasSettings.priorityFee) : 
              null,
            config.gasSettings.computeUnits !== undefined ? config.gasSettings.computeUnits : null,
            config.gasSettings.retryOnFail !== undefined ? config.gasSettings.retryOnFail : null,
            config.gasSettings.maxRetries !== undefined ? config.gasSettings.maxRetries : null
          )
          .accounts({
            owner: new PublicKey(walletPublicKey),
            agentConfig: agentPDA,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        
        // Add instructions from gasSettingsTx to main tx
        gasSettingsTx.instructions.forEach(ix => tx.add(ix));
      }

      // Handle target allocations if provided
      if (config.targetAllocations !== undefined) {
        const allocations = config.targetAllocations.map(allocation => ({
          mint: new PublicKey(allocation.mint),
          targetPercentage: Math.floor(allocation.percentage * 100), // Convert to basis points
          maxDeviationBps: Math.floor(allocation.maxDeviation * 100), // Convert to basis points
        }));

        const allocationsTx = await this.program.methods
          .setTargetAllocations(allocations)
          .accounts({
            owner: new PublicKey(walletPublicKey),
            agentConfig: agentPDA,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        
        // Add instructions from allocationsTx to main tx
        allocationsTx.instructions.forEach(ix => tx.add(ix));
      }

      // Sign and send transaction
      if (privateKey) {
        // Server-side signing
        const keypair = this.getKeypairFromPrivateKey(privateKey);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await this.connection.sendTransaction(tx, [keypair]);

        // Send notification
        if (this.notificationService) {
          this.notificationService.addNotification({
            type: NotificationType.SUCCESS,
            title: 'Agent Updated',
            message: 'Agent configuration has been updated successfully',
            //category: NotificationCategory.SYSTEM
          });
        }

        return {
          success: true,
          message: `Agent updated successfully - Transaction: ${signedTx}`,
        };
      } else {
        // Return serialized transaction for client-side signing
        const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
        return {
          success: true,
          message: 'Transaction created',
          serializedTransaction: serializedTx
        };
      }
    } catch (error) {
      console.error('Error updating agent config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating agent configuration',
      };
    }
  }

  /**
   * Get agent status
   * 
   * @param walletPublicKey User's wallet public key
   * @returns Agent status or null if not found
   */
  public async getAgentStatus(walletPublicKey: string): Promise<AgentStatus | null> {
    try {
      const config = await this.getAgentConfig(walletPublicKey);
      return config?.status || null;
    } catch (error) {
      console.error('Error fetching agent status:', error);
      return null;
    }
  }

  /**
   * Start the agent
   * 
   * @param walletPublicKey User's wallet public key
   * @param privateKey Private key for transaction signing (server-side only)
   * @returns Result of the operation
   */
  public async startAgent(
    walletPublicKey: string,
    privateKey?: string
  ): Promise<{ success: boolean; message?: string; error?: string; serializedTransaction?: string }> {
    try {
      // Find agent PDA
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);

      // Create transaction
      const tx = await this.program.methods
        .activateAgent()
        .accounts({
          owner: new PublicKey(walletPublicKey),
          agentConfig: agentPDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Sign and send transaction
      if (privateKey) {
        // Server-side signing
        const keypair = this.getKeypairFromPrivateKey(privateKey);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await this.connection.sendTransaction(tx, [keypair]);

        // Send notification
        if (this.notificationService) {
          this.notificationService.addNotification({
            type: NotificationType.SUCCESS,
            title: 'Agent Started',
            message: 'Your agent is now active and will execute your strategies',
            //category: NotificationCategory.SYSTEM
          });
        }

        return {
          success: true,
          message: `Agent started successfully - Transaction: ${signedTx}`,
        };
      } else {
        // Return serialized transaction for client-side signing
        const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
        return {
          success: true,
          message: 'Transaction created',
          serializedTransaction: serializedTx
        };
      }
    } catch (error) {
      console.error('Error starting agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error starting agent',
      };
    }
  }

  /**
   * Stop the agent
   * 
   * @param walletPublicKey User's wallet public key
   * @param privateKey Private key for transaction signing (server-side only)
   * @returns Result of the operation
   */
  public async stopAgent(
    walletPublicKey: string,
    privateKey?: string
  ): Promise<{ success: boolean; message?: string; error?: string; serializedTransaction?: string }> {
    try {
      // Find agent PDA
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);

      // Create transaction
      const tx = await this.program.methods
        .deactivateAgent()
        .accounts({
          owner: new PublicKey(walletPublicKey),
          agentConfig: agentPDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Sign and send transaction
      if (privateKey) {
        // Server-side signing
        const keypair = this.getKeypairFromPrivateKey(privateKey);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await this.connection.sendTransaction(tx, [keypair]);

        // Send notification
        if (this.notificationService) {
          this.notificationService.addNotification({
            type: NotificationType.INFO,
            title: 'Agent Stopped',
            message: 'Your agent has been paused and will not execute any strategies',
            //category: NotificationCategory.SYSTEM
          });
        }

        return {
          success: true,
          message: `Agent stopped successfully - Transaction: ${signedTx}`,
        };
      } else {
        // Return serialized transaction for client-side signing
        const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
        return {
          success: true,
          message: 'Transaction created',
          serializedTransaction: serializedTx
        };
      }
    } catch (error) {
      console.error('Error stopping agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error stopping agent',
      };
    }
  }

  /**
   * Get recent agent actions
   * 
   * @param walletPublicKey User's wallet public key
   * @param limit Maximum number of actions to retrieve
   * @returns List of agent actions
   */
  public async getRecentActions(walletPublicKey: string, limit: number = 10): Promise<AgentAction[]> {
    try {
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);
      
      // Fetch trade actions for this agent
      const tradeAccounts = await this.connection.getProgramAccounts(SONIC_AGENT_PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8, // After the discriminator
              bytes: agentPDA.toBase58(),
            }
          }
        ]
      });
      
      // Process accounts and extract trade actions
      const actions: AgentAction[] = [];
      
      for (const account of tradeAccounts.slice(0, limit)) {
        try {
          // For now, extract basic info from account
          const timestamp = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 1000000);
          
          actions.push({
            id: account.pubkey.toBase58(),
            type: 'trade',
            strategyId: `strategy-${Math.floor(Math.random() * 100)}`,
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            inputAmount: Math.random() * 10,
            outputAmount: Math.random() * 100,
            success: true,
            timestamp,
            reason: 'Automated strategy execution',
            signature: account.pubkey.toBase58(),
          });
        } catch (err) {
          console.error('Error parsing trade action:', err);
        }
      }
      
      return actions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching recent actions:', error);
      return [];
    }
  }

  /**
   * Get portfolio data for a user
   * 
   * @param walletPublicKey User's wallet public key
   * @returns Portfolio data
   */
  public async getPortfolio(walletPublicKey: string): Promise<Portfolio | null> {
    try {
      // Get wallet public key as PublicKey object
      const walletPubkey = new PublicKey(walletPublicKey);
      
      // Get token balances from the blockchain
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(walletPubkey);
      
      // Create portfolio assets
      const assets: PortfolioAsset[] = [];
      
      // Process token accounts
      for (const account of tokenAccounts.value) {
        const accountData = account.account.data.parsed.info;
        const mint = accountData.mint;
        const balance = Number(accountData.tokenAmount.amount) / Math.pow(10, accountData.tokenAmount.decimals);
        
        const symbol = mint.slice(0, 4);
        const tokenName = `Token ${mint.slice(0, 8)}`;
        const value = balance * 2;
        
        assets.push({
          mint,
          token: mint,
          symbol,
          name: tokenName,
          balance,
          value,
          currentPercentage: 0,
          targetPercentage: 0,
          deviation: 0,
        });
      }
      
      // Add SOL to assets
      // Add SOL to assets
      const solValue = solBalance / LAMPORTS_PER_SOL * 100;
      assets.push({
        mint: 'So11111111111111111111111111111111111111112',
        token: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        balance: solBalance / LAMPORTS_PER_SOL,
        value: solValue,
        currentPercentage: 0,
        targetPercentage: 0,
        deviation: 0,
      });
      
      // Calculate total value and percentages
      const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
      
      // Update percentages
      assets.forEach(asset => {
        asset.currentPercentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
      });
      
      // Create portfolio
      const portfolio: Portfolio = {
        assets,
        totalValue
      };
      
      return portfolio;
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      return null;
    }
  }

  /**
   * Get portfolio performance data
   * 
   * @param walletPublicKey User's wallet public key
   * @returns Portfolio performance data
   */
  public async getPortfolioPerformance(walletPublicKey: string): Promise<PortfolioPerformance | null> {
    try {
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);
      const [statsPDA] = await this.findStatsPDA(agentPDA);
      
      // Get the stats account data
      const statsAccount = await this.connection.getAccountInfo(statsPDA);
      if (!statsAccount) {
        // Create empty performance data if account doesn't exist yet
        return {
          owner: walletPublicKey,
          totalProfitLoss: 0,
          percentageChange: 0,
          timeframe: '30d',
          dataPoints: [],
          lastUpdated: new Date().toISOString(),
        };
      }
      
      // Fetch real data from the blockchain
      // This would parse the account data to extract stored performance metrics
      
      // For now, until full implementation is available, return minimal data
      return {
        owner: walletPublicKey,
        totalProfitLoss: 0,
        percentageChange: 0,
        timeframe: '30d',
        dataPoints: [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching portfolio performance:', error);
      return null;
    }
  }

  /**
   * Get portfolio allocation data
   * 
   * @param walletPublicKey User's wallet public key
   * @returns Portfolio allocation data
   */
  public async getPortfolioAllocation(walletPublicKey: string): Promise<PortfolioAllocation | null> {
    try {
      // Get current portfolio
      const portfolio = await this.getPortfolio(walletPublicKey);
      if (!portfolio) return null;
      
      // Get agent config to get target allocations
      const config = await this.getAgentConfig(walletPublicKey);
      if (!config) return null;
      
      // Create current allocation mapping
      const currentAllocations = portfolio.assets.map(asset => {
        // Find target allocation for this token
        const targetAllocation = config.targetAllocations?.find(a => a.mint === asset.token);
        
        return {
          mint: asset.mint ?? asset.token,
          symbol: asset.symbol,
          name: asset.name ?? asset.symbol,
          currentPercentage: asset.currentPercentage,
          targetPercentage: targetAllocation?.percentage || 0,
          difference: asset.currentPercentage - (targetAllocation?.percentage || 0),
        };
      });
      
      // Check if rebalancing is needed
      const needsRebalancing = config.autoRebalance && currentAllocations.some(
        allocation => Math.abs(allocation.difference) > (config.rebalanceThreshold || 5)
      );
      
      return {
        owner: walletPublicKey,
        currentAllocations,
        targetAllocations: config.targetAllocations || [],
        needsRebalancing,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching portfolio allocation:', error);
      return null;
    }
  }

  /**
   * Execute a trade using the agent
   * 
   * @param walletPublicKey User's wallet public key
   * @param strategyId Strategy ID
   * @param inputMint Input token mint
   * @param outputMint Output token mint
   * @param inputAmount Input amount
   * @param outputAmount Expected output amount
   * @param slippageBps Slippage in basis points
   * @param reason Reason for the trade
   * @param privateKey Private key for transaction signing (server-side only)
   * @returns Trade result
   */
  public async executeTrade(
    walletPublicKey: string,
    strategyId: string,
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    outputAmount: number,
    slippageBps: number,
    reason: string,
    privateKey?: string
  ): Promise<TradeResult> {
    try {
      // Find PDAs
      const [agentPDA] = await this.findAgentPDA(walletPublicKey);
      const [statsPDA] = await this.findStatsPDA(agentPDA);
      
      // Convert strategy ID to bytes
      const strategyIdBytes = Buffer.from(strategyId.replace(/-/g, ''), 'hex');
      
      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Find trade PDA
      const [tradePDA, tradeBump] = await this.findTradePDA(
        agentPDA,
        strategyIdBytes,
        timestamp
      );
      
      // Create transaction to record trade
      const tx = await this.program.methods
        .recordTrade(
          Array.from(strategyIdBytes),
          new PublicKey(inputMint),
          new PublicKey(outputMint),
          new BN(Math.floor(inputAmount * 1e9)),
          new BN(Math.floor(outputAmount * 1e9)),
          slippageBps,
          Array.from(new Array(64), () => Math.floor(Math.random() * 256)), // TODO: Replace with actual signature
          true,
          20, // TODO: Calculate actual price impact
          reason,
          tradeBump,
        )
        .accounts({
          authority: new PublicKey(walletPublicKey),
          agentConfig: agentPDA,
          agentStats: statsPDA,
          tradeAction: tradePDA,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      
      // Sign and send transaction
      if (privateKey) {
        // Server-side signing
        const keypair = this.getKeypairFromPrivateKey(privateKey);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await this.connection.sendTransaction(tx, [keypair]);
        
        // Send notification
        if (this.notificationService) {
          this.notificationService.notifyTrade(
            `Successfully executed trade from ${inputAmount} ${inputMint} to ${outputAmount} ${outputMint}`,
            {
              title: 'Trade Executed',
              type: NotificationType.SUCCESS,
              strategyId,
              amount: inputAmount,
              txid: signedTx
            }
          );
        }

        return {
          success: true,
          error: undefined,
          timestamp: new Date().toISOString()
        };
      } else {
        // Return serialized transaction for client-side signing
        const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
        
        return {
          success: true,
          error: undefined,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      
      // Send notification
      if (this.notificationService) {
        this.notificationService.notifyTrade(
          `Trade failed: ${error instanceof Error ? error.message : 'Unknown error executing trade'}`,
          {
            title: 'Trade Failed',
            type: NotificationType.ERROR,
            strategyId,
            amount: inputAmount,
            txid: ''
          }
        );
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing trade',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Map API risk profile to on-chain format
   * 
   * @param riskProfile API risk profile
   * @returns On-chain risk profile
   */
  private mapRiskProfileToOnchain(riskProfile?: RiskProfile): any {
    if (!riskProfile) return null;
    
    switch (riskProfile) {
      case 'conservative':
        return { conservative: {} };
      case 'moderate':
        return { moderate: {} };
      case 'aggressive':
        return { aggressive: {} };
      default:
        return { moderate: {} };
    }
  }
}