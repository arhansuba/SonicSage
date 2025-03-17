import { ConfirmOptions, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { API, RPC_URL } from '../constants/endpoints';
import { Program, AnchorProvider, web3, BN } from '@project-serum/anchor';
import { SonicAgentIDL } from '../idl/sonic_agent';
import { ServiceResponse, Nullable } from '../types/index';
import * as borsh from 'borsh';
import * as spl from '@solana/spl-token';

/**
 * Service for interacting with Sonic SVM
 */
export class SonicSVMService {
  private connection: Connection;
  private programId: PublicKey;
  private program: Program;
  private provider: AnchorProvider;

  constructor(connection: Connection) {
    this.connection = connection;
    this.programId = new PublicKey('SVMAgntPgmd1V2k1eZRx6d7w6RVKR3cdxzZZ3Qcx1M9');
    
    // Create provider from connection
    const wallet = window.solana;
    const opts: ConfirmOptions = {
      preflightCommitment: 'processed',
      commitment: 'processed' as web3.Commitment,
    };
    this.provider = new AnchorProvider(connection, wallet, opts);
    
    // Initialize program
    this.program = new Program(SonicAgentIDL as any, this.programId, this.provider);
  }

  /**
   * Get the account data for a given user or token account
   */
  public async getAccountData(accountPublicKey: PublicKey): Promise<ServiceResponse<any>> {
    try {
      const accountInfo = await this.connection.getAccountInfo(accountPublicKey);
      
      if (!accountInfo) {
        return {
          success: false,
          error: 'Account not found',
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        data: accountInfo,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching account data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching account data',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get a user's token balances on Sonic SVM
   */
  public async getUserTokenBalances(userPublicKey: PublicKey): Promise<ServiceResponse<any>> {
    try {
      // Fetch token accounts for the user
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        userPublicKey,
        { programId: spl.TOKEN_PROGRAM_ID }
      );

      // Process token balances and get additional data
      const balancesPromises = tokenAccounts.value.map(async (account) => {
        const { mint, tokenAmount } = account.account.data.parsed.info;
        const mintPublicKey = new PublicKey(mint);
        
        // Get token metadata
        let symbol = 'Unknown';
        let logoURI = undefined;
        let priceUsd = 0;
        let priceChangePercentage24h = 0;
        
        try {
          // Fetch price data from a service like CoinGecko or a custom API
          const priceResponse = await fetch(`${API.server.market.prices}?mint=${mint}`);
          const priceData = await priceResponse.json();
          
          if (priceData.success) {
            symbol = priceData.data.symbol;
            priceUsd = priceData.data.priceUsd;
            priceChangePercentage24h = priceData.data.priceChangePercentage24h;
            logoURI = priceData.data.logoURI;
          }
        } catch (e) {
          console.error(`Error fetching price data for ${mint}:`, e);
        }
        
        // Calculate USD value
        const usdValue = tokenAmount.uiAmount * priceUsd;
        
        return {
          mint,
          symbol,
          balance: tokenAmount.uiAmount,
          decimals: tokenAmount.decimals,
          usdValue,
          priceUsd,
          priceChangePercentage24h,
          logoURI
        };
      });
      
      const balances = await Promise.all(balancesPromises);

      return {
        success: true,
        data: balances,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching user token balances:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching user token balances',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute a transaction on Sonic SVM
   */
  public async executeTransaction(instructions: TransactionInstruction[], signers: any[]): Promise<ServiceResponse<string>> {
    try {
      // Create a new transaction
      const transaction = new Transaction();
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.provider.wallet.publicKey;
      
      // Add instructions
      instructions.forEach(instruction => {
        transaction.add(instruction);
      });
      
      // Sign transaction
      if (signers.length > 0) {
        transaction.partialSign(...signers);
      }
      
      // Send transaction
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      
      const signedTransaction = await this.provider.wallet.signTransaction(transaction);
      const txid = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txid,
      });
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
      }
      
      return {
        success: true,
        data: txid,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing transaction',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get transaction details
   */
  public async getTransactionDetails(signature: string): Promise<ServiceResponse<any>> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found',
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        data: transaction,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching transaction details',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Create a new Sonic agent for a user
   */
  public async createAgent(userPublicKey: PublicKey, name: string): Promise<ServiceResponse<string>> {
    try {
      // Generate a new keypair for the agent account
      const agentKeypair = web3.Keypair.generate();
      
      // Calculate the space needed for the account
      const nameBuffer = Buffer.from(name);
      const space = 8 + // discriminator
                   32 + // owner pubkey
                   4 + nameBuffer.length + // name string
                   8 + // createdAt
                   8 + // updatedAt
                   4 + 8 * 10; // notification preferences array
      
      // Calculate rent exemption
      const rent = await this.connection.getMinimumBalanceForRentExemption(space);
      
      // Create account instruction
      const createAccountIx = SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: agentKeypair.publicKey,
        lamports: rent,
        space,
        programId: this.programId
      });
      
      // Initialize agent instruction
      const initAgentIx = await this.program.methods.initialize(name)
        .accounts({
          agent: agentKeypair.publicKey,
          owner: userPublicKey,
          systemProgram: SystemProgram.programId
        })
        .instruction();
      
      // Execute transaction
      const result = await this.executeTransaction(
        [createAccountIx, initAgentIx],
        [agentKeypair]
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create agent');
      }
      
      return {
        success: true,
        data: agentKeypair.publicKey.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error creating Sonic agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating Sonic agent',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Deposit tokens to a Sonic agent
   */
  public async depositToAgent(
    userPublicKey: PublicKey,
    agentPublicKey: PublicKey,
    tokenMint: PublicKey,
    amount: number
  ): Promise<ServiceResponse<string>> {
    try {
      // Find associated token accounts
      const userTokenAccount = await spl.getAssociatedTokenAddress(
        tokenMint,
        userPublicKey
      );
      
      const agentTokenAccount = await spl.getAssociatedTokenAddress(
        tokenMint,
        agentPublicKey,
        true // allowOwnerOffCurve
      );
      
      // Check if agent token account exists
      const agentTokenAccountInfo = await this.connection.getAccountInfo(agentTokenAccount);
      
      let instructions: TransactionInstruction[] = [];
      
      // If agent token account doesn't exist, create it
      if (!agentTokenAccountInfo) {
        instructions.push(
          spl.createAssociatedTokenAccountInstruction(
            userPublicKey,
            agentTokenAccount,
            agentPublicKey,
            tokenMint
          )
        );
      }
      
      // Create deposit instruction
      const depositIx = await this.program.methods.deposit(new BN(amount))
        .accounts({
          agent: agentPublicKey,
          owner: userPublicKey,
          tokenMint,
          userTokenAccount,
          agentTokenAccount,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .instruction();
      
      instructions.push(depositIx);
      
      // Execute transaction
      const result = await this.executeTransaction(instructions, []);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to deposit to agent');
      }
      
      return result;
    } catch (error) {
      console.error('Error depositing to Sonic agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error depositing to Sonic agent',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Withdraw tokens from a Sonic agent
   */
  public async withdrawFromAgent(
    userPublicKey: PublicKey,
    agentPublicKey: PublicKey,
    tokenMint: PublicKey,
    amount: number
  ): Promise<ServiceResponse<string>> {
    try {
      // Find associated token accounts
      const userTokenAccount = await spl.getAssociatedTokenAddress(
        tokenMint,
        userPublicKey
      );
      
      const agentTokenAccount = await spl.getAssociatedTokenAddress(
        tokenMint,
        agentPublicKey,
        true // allowOwnerOffCurve
      );
      
      // Create withdraw instruction
      const withdrawIx = await this.program.methods.withdraw(new BN(amount))
        .accounts({
          agent: agentPublicKey,
          owner: userPublicKey,
          tokenMint,
          userTokenAccount,
          agentTokenAccount,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .instruction();
      
      // Execute transaction
      const result = await this.executeTransaction([withdrawIx], []);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to withdraw from agent');
      }
      
      return result;
    } catch (error) {
      console.error('Error withdrawing from Sonic agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error withdrawing from Sonic agent',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute a strategy using a Sonic agent
   */
  public async executeStrategy(
    userPublicKey: PublicKey,
    agentPublicKey: PublicKey,
    strategyPublicKey: PublicKey
  ): Promise<ServiceResponse<string>> {
    try {
      // Create execute strategy instruction
      const executeStrategyIx = await this.program.methods.executeStrategy()
        .accounts({
          strategy: strategyPublicKey,
          agent: agentPublicKey,
          owner: userPublicKey,
          systemProgram: SystemProgram.programId
        })
        .instruction();
      
      // Execute transaction
      const result = await this.executeTransaction([executeStrategyIx], []);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to execute strategy');
      }
      
      return result;
    } catch (error) {
      console.error('Error executing strategy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing strategy',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Create a price alert
   */
  public async createPriceAlert(
    userPublicKey: PublicKey,
    agentPublicKey: PublicKey,
    tokenMint: PublicKey,
    triggerType: 'above' | 'below',
    triggerPrice: number
  ): Promise<ServiceResponse<string>> {
    try {
      // Generate a new keypair for the price alert account
      const priceAlertKeypair = web3.Keypair.generate();
      
      // Calculate the space needed for the account
      const space = 8 + // discriminator
                   32 + // owner pubkey
                   32 + // agent pubkey
                   32 + // token mint
                   1 + // trigger type enum
                   8 + // trigger price
                   1 + // is active
                   1 + // triggered
                   8 + // triggered at
                   8; // created at
      
      // Calculate rent exemption
      const rent = await this.connection.getMinimumBalanceForRentExemption(space);
      
      // Create account instruction
      const createAccountIx = SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: priceAlertKeypair.publicKey,
        lamports: rent,
        space,
        programId: this.programId
      });
      
      // Determine trigger type enum variant
      const triggerTypeEnum = triggerType === 'above' ? { above: {} } : { below: {} };
      
      // Create price alert instruction
      const createPriceAlertIx = await this.program.methods.createPriceAlert(
        triggerTypeEnum,
        new BN(triggerPrice)
      )
        .accounts({
          priceAlert: priceAlertKeypair.publicKey,
          agent: agentPublicKey,
          owner: userPublicKey,
          tokenMint,
          systemProgram: SystemProgram.programId
        })
        .instruction();
      
      // Execute transaction
      const result = await this.executeTransaction(
        [createAccountIx, createPriceAlertIx],
        [priceAlertKeypair]
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create price alert');
      }
      
      return {
        success: true,
        data: priceAlertKeypair.publicKey.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error creating price alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating price alert',
        timestamp: Date.now()
      };
    }
  }
}

export default SonicSVMService;