//! SonicAgent Program
//!
//! A Solana program for managing AI trading agents on Sonic SVM.
//! This program allows users to create and manage AI-powered trading agents
//! that can execute trades, manage portfolio allocations, and implement
//! various trading strategies.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::program::{invoke, invoke_signed};
use solana_program::system_instruction;
use std::convert::TryFrom;
use std::mem::size_of;

// Declare program ID
declare_id!("Sonicxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

/// Risk profile types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum RiskProfile {
    Conservative,
    Moderate,
    Aggressive,
}

/// Agent status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum AgentStatus {
    Inactive,
    Active,
    Paused,
}

/// Strategy types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum StrategyType {
    DollarCostAverage,
    MomentumTrading,
    MeanReversion,
    TrendFollowing,
    Custom,
}

/// Gas settings configuration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct GasSettings {
    pub priority_fee: u64,
    pub compute_units: u32,
    pub retry_on_fail: bool,
    pub max_retries: u8,
}

/// Trading strategy
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Strategy {
    pub id: [u8; 16],
    pub name: String,
    pub strategy_type: StrategyType,
    pub is_active: bool,
    pub parameters: Vec<u8>, // JSON encoded strategy parameters
    pub last_executed_at: i64,
    pub execution_count: u64,
}

/// Trading rule
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradingRule {
    pub id: [u8; 16],
    pub max_amount_per_trade: u64,
    pub max_trades_per_day: u8,
    pub allowed_tokens: Vec<Pubkey>,
    pub excluded_tokens: Vec<Pubkey>,
    pub max_slippage_bps: u16,
}

/// Agent Configuration
#[account]
pub struct AgentConfig {
    pub owner: Pubkey,
    pub name: String,
    pub description: String,
    pub risk_profile: RiskProfile,
    pub status: AgentStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub auto_rebalance: bool,
    pub rebalance_threshold_bps: u16,
    pub auto_trade: bool,
    pub trading_budget: u64,
    pub strategies: Vec<Strategy>,
    pub trading_rules: TradingRule,
    pub gas_settings: GasSettings,
    pub target_allocations: Vec<TokenAllocation>,
    pub total_executed_trades: u64,
    pub total_trade_volume: u64,
    pub bump: u8,
}

/// Token allocation for portfolio balancing
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenAllocation {
    pub mint: Pubkey,
    pub target_percentage: u16, // Basis points (e.g., 2500 = 25%)
    pub max_deviation_bps: u16, // Maximum allowed deviation in basis points
}

/// Trade action record
#[account]
pub struct TradeAction {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub strategy_id: [u8; 16],
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_amount: u64,
    pub output_amount: u64,
    pub slippage_bps: u16,
    pub executed_at: i64,
    pub transaction_signature: [u8; 64],
    pub success: bool,
    pub price_impact_bps: u16,
    pub reason: String,
    pub bump: u8,
}

/// Agent statistics and performance metrics
#[account]
pub struct AgentStats {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub total_trades: u64,
    pub successful_trades: u64,
    pub failed_trades: u64,
    pub total_volume: u64,
    pub total_fees_paid: u64,
    pub profit_loss: i64, // Can be negative
    pub created_at: i64,
    pub last_updated_at: i64,
    pub performance_data: Vec<PerformancePoint>,
    pub bump: u8,
}

/// Performance data point
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PerformancePoint {
    pub timestamp: i64,
    pub portfolio_value: u64,
    pub daily_profit_loss: i64, // Can be negative
}

/// SonicAgent program
#[program]
pub mod sonic_agent {
    use super::*;

    /// Initialize a new agent with a configuration
    pub fn initialize_agent(
        ctx: Context<InitializeAgent>,
        name: String,
        description: String,
        risk_profile: RiskProfile,
        bump: u8,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let owner = ctx.accounts.owner.key();
        let clock = Clock::get()?;
        
        // Validate inputs
        require!(!name.is_empty(), ErrorCode::InvalidName);
        require!(name.len() <= 50, ErrorCode::NameTooLong);
        require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
        
        // Configure default trading rule
        let trading_rule = TradingRule {
            id: [0; 16], // Will be set by update_trading_rules instruction
            max_amount_per_trade: 1000_000_000, // 1000 USDC in smallest units
            max_trades_per_day: 5,
            allowed_tokens: vec![], // Empty means all tokens allowed
            excluded_tokens: vec![], // No excluded tokens by default
            max_slippage_bps: 100, // 1% max slippage
        };
        
        // Configure default gas settings
        let gas_settings = GasSettings {
            priority_fee: 0, // Auto priority fee
            compute_units: 200_000, // Default compute unit limit
            retry_on_fail: true,
            max_retries: 3,
        };
        
        // Initialize agent configuration
        agent_config.owner = owner;
        agent_config.name = name;
        agent_config.description = description;
        agent_config.risk_profile = risk_profile;
        agent_config.status = AgentStatus::Inactive;
        agent_config.created_at = clock.unix_timestamp;
        agent_config.updated_at = clock.unix_timestamp;
        agent_config.auto_rebalance = false;
        agent_config.rebalance_threshold_bps = 500; // 5% threshold
        agent_config.auto_trade = false;
        agent_config.trading_budget = 0;
        agent_config.strategies = vec![];
        agent_config.trading_rules = trading_rule;
        agent_config.gas_settings = gas_settings;
        agent_config.target_allocations = vec![];
        agent_config.total_executed_trades = 0;
        agent_config.total_trade_volume = 0;
        agent_config.bump = bump;
        
        // Initialize agent stats
        let agent_stats = &mut ctx.accounts.agent_stats;
        agent_stats.agent = agent_config.key();
        agent_stats.owner = owner;
        agent_stats.total_trades = 0;
        agent_stats.successful_trades = 0;
        agent_stats.failed_trades = 0;
        agent_stats.total_volume = 0;
        agent_stats.total_fees_paid = 0;
        agent_stats.profit_loss = 0;
        agent_stats.created_at = clock.unix_timestamp;
        agent_stats.last_updated_at = clock.unix_timestamp;
        agent_stats.performance_data = vec![];
        agent_stats.bump = bump;
        
        emit!(AgentInitializedEvent {
            agent: agent_config.key(),
            owner,
            name: agent_config.name.clone(),
            risk_profile: agent_config.risk_profile.clone(),
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Update agent configuration
    pub fn update_agent_config(
        ctx: Context<UpdateAgentConfig>,
        name: Option<String>,
        description: Option<String>,
        risk_profile: Option<RiskProfile>,
        auto_rebalance: Option<bool>,
        rebalance_threshold_bps: Option<u16>,
        auto_trade: Option<bool>,
        trading_budget: Option<u64>,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Update fields if provided
        if let Some(name) = name {
            require!(!name.is_empty(), ErrorCode::InvalidName);
            require!(name.len() <= 50, ErrorCode::NameTooLong);
            agent_config.name = name;
        }
        
        if let Some(description) = description {
            require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
            agent_config.description = description;
        }
        
        if let Some(risk_profile) = risk_profile {
            agent_config.risk_profile = risk_profile;
        }
        
        if let Some(auto_rebalance) = auto_rebalance {
            agent_config.auto_rebalance = auto_rebalance;
        }
        
        if let Some(rebalance_threshold_bps) = rebalance_threshold_bps {
            require!(rebalance_threshold_bps > 0 && rebalance_threshold_bps <= 5000, ErrorCode::InvalidThreshold);
            agent_config.rebalance_threshold_bps = rebalance_threshold_bps;
        }
        
        if let Some(auto_trade) = auto_trade {
            agent_config.auto_trade = auto_trade;
        }
        
        if let Some(trading_budget) = trading_budget {
            agent_config.trading_budget = trading_budget;
        }
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(AgentUpdatedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Update trading rules
    pub fn update_trading_rules(
        ctx: Context<UpdateAgentConfig>,
        max_amount_per_trade: Option<u64>,
        max_trades_per_day: Option<u8>,
        allowed_tokens: Option<Vec<Pubkey>>,
        excluded_tokens: Option<Vec<Pubkey>>,
        max_slippage_bps: Option<u16>,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Update trading rules if provided
        if let Some(max_amount) = max_amount_per_trade {
            agent_config.trading_rules.max_amount_per_trade = max_amount;
        }
        
        if let Some(max_trades) = max_trades_per_day {
            require!(max_trades <= 100, ErrorCode::InvalidTradeLimit);
            agent_config.trading_rules.max_trades_per_day = max_trades;
        }
        
        if let Some(allowed) = allowed_tokens {
            // Validate token mints
            for mint in &allowed {
                require!(is_valid_token_mint(mint), ErrorCode::InvalidTokenMint);
            }
            agent_config.trading_rules.allowed_tokens = allowed;
        }
        
        if let Some(excluded) = excluded_tokens {
            // Validate token mints
            for mint in &excluded {
                require!(is_valid_token_mint(mint), ErrorCode::InvalidTokenMint);
            }
            agent_config.trading_rules.excluded_tokens = excluded;
        }
        
        if let Some(slippage) = max_slippage_bps {
            require!(slippage <= 1000, ErrorCode::SlippageTooHigh); // Max 10%
            agent_config.trading_rules.max_slippage_bps = slippage;
        }
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(TradingRulesUpdatedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            max_amount_per_trade: agent_config.trading_rules.max_amount_per_trade,
            max_slippage_bps: agent_config.trading_rules.max_slippage_bps,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Update gas settings
    pub fn update_gas_settings(
        ctx: Context<UpdateAgentConfig>,
        priority_fee: Option<u64>,
        compute_units: Option<u32>,
        retry_on_fail: Option<bool>,
        max_retries: Option<u8>,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Update gas settings if provided
        if let Some(fee) = priority_fee {
            agent_config.gas_settings.priority_fee = fee;
        }
        
        if let Some(units) = compute_units {
            require!(units >= 100_000 && units <= 1_400_000, ErrorCode::InvalidComputeUnits);
            agent_config.gas_settings.compute_units = units;
        }
        
        if let Some(retry) = retry_on_fail {
            agent_config.gas_settings.retry_on_fail = retry;
        }
        
        if let Some(retries) = max_retries {
            require!(retries <= 10, ErrorCode::TooManyRetries);
            agent_config.gas_settings.max_retries = retries;
        }
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(GasSettingsUpdatedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Add or update a trading strategy
    pub fn add_strategy(
        ctx: Context<UpdateAgentConfig>,
        strategy_id: [u8; 16],
        name: String,
        strategy_type: StrategyType,
        parameters: Vec<u8>, // JSON encoded strategy parameters
        is_active: bool,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Validate
        require!(!name.is_empty(), ErrorCode::InvalidName);
        require!(name.len() <= 50, ErrorCode::NameTooLong);
        require!(parameters.len() <= 1024, ErrorCode::ParametersTooLarge);
        
        // Check if strategy with this ID already exists
        let strategy_index = agent_config.strategies.iter().position(|s| s.id == strategy_id);
        
        if let Some(index) = strategy_index {
            // Update existing strategy
            let strategy = &mut agent_config.strategies[index];
            strategy.name = name;
            strategy.strategy_type = strategy_type;
            strategy.is_active = is_active;
            strategy.parameters = parameters;
        } else {
            // Add new strategy
            // Limit the number of strategies
            require!(agent_config.strategies.len() < 10, ErrorCode::TooManyStrategies);
            
            let strategy = Strategy {
                id: strategy_id,
                name,
                strategy_type,
                is_active,
                parameters,
                last_executed_at: 0,
                execution_count: 0,
            };
            
            agent_config.strategies.push(strategy);
        }
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(StrategyUpdatedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            strategy_id,
            is_active,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Remove a trading strategy
    pub fn remove_strategy(
        ctx: Context<UpdateAgentConfig>,
        strategy_id: [u8; 16],
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Find strategy by ID
        let strategy_index = agent_config.strategies.iter().position(|s| s.id == strategy_id);
        
        if let Some(index) = strategy_index {
            // Remove strategy
            agent_config.strategies.remove(index);
            
            // Update timestamp
            agent_config.updated_at = clock.unix_timestamp;
            
            emit!(StrategyRemovedEvent {
                agent: agent_config.key(),
                owner: agent_config.owner,
                strategy_id,
                timestamp: clock.unix_timestamp,
            });
        } else {
            return Err(ErrorCode::StrategyNotFound.into());
        }
        
        Ok(())
    }
    
    /// Set target allocations for portfolio rebalancing
    pub fn set_target_allocations(
        ctx: Context<UpdateAgentConfig>,
        allocations: Vec<TokenAllocation>,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Validate allocations
        require!(!allocations.is_empty(), ErrorCode::EmptyAllocations);
        require!(allocations.len() <= 20, ErrorCode::TooManyAllocations);
        
        // Check that allocations sum to 10000 (100%)
        let total: u16 = allocations.iter().map(|a| a.target_percentage).sum();
        require!(total == 10000, ErrorCode::AllocationsMustSumTo100);
        
        // Validate token mints
        for allocation in &allocations {
            require!(is_valid_token_mint(&allocation.mint), ErrorCode::InvalidTokenMint);
            require!(allocation.target_percentage > 0, ErrorCode::InvalidAllocation);
            require!(allocation.max_deviation_bps <= 2000, ErrorCode::DeviationTooHigh); // Max 20% deviation
        }
        
        // Set allocations
        agent_config.target_allocations = allocations;
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(AllocationsUpdatedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Activate agent
    pub fn activate_agent(ctx: Context<UpdateAgentStatus>) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Set status to active
        agent_config.status = AgentStatus::Active;
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(AgentStatusChangedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            status: AgentStatus::Active,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Deactivate agent
    pub fn deactivate_agent(ctx: Context<UpdateAgentStatus>) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Set status to inactive
        agent_config.status = AgentStatus::Inactive;
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(AgentStatusChangedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            status: AgentStatus::Inactive,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Pause agent
    pub fn pause_agent(ctx: Context<UpdateAgentStatus>) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        let clock = Clock::get()?;
        
        // Set status to paused
        agent_config.status = AgentStatus::Paused;
        
        // Update timestamp
        agent_config.updated_at = clock.unix_timestamp;
        
        emit!(AgentStatusChangedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            status: AgentStatus::Paused,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Record a trade action
    pub fn record_trade(
        ctx: Context<RecordTrade>,
        strategy_id: [u8; 16],
        input_mint: Pubkey,
        output_mint: Pubkey,
        input_amount: u64,
        output_amount: u64,
        slippage_bps: u16,
        transaction_signature: [u8; 64],
        success: bool,
        price_impact_bps: u16,
        reason: String,
        bump: u8,
    ) -> Result<()> {
        let trade_action = &mut ctx.accounts.trade_action;
        let agent_config = &mut ctx.accounts.agent_config;
        let agent_stats = &mut ctx.accounts.agent_stats;
        let clock = Clock::get()?;
        
        // Validate inputs
        require!(is_valid_token_mint(&input_mint), ErrorCode::InvalidTokenMint);
        require!(is_valid_token_mint(&output_mint), ErrorCode::InvalidTokenMint);
        require!(input_amount > 0, ErrorCode::InvalidAmount);
        require!(reason.len() <= 200, ErrorCode::ReasonTooLong);
        
        // Check if strategy exists
        let strategy = agent_config.strategies.iter_mut().find(|s| s.id == strategy_id);
        require!(strategy.is_some(), ErrorCode::StrategyNotFound);
        
        // Record trade action
        trade_action.agent = agent_config.key();
        trade_action.owner = agent_config.owner;
        trade_action.strategy_id = strategy_id;
        trade_action.input_mint = input_mint;
        trade_action.output_mint = output_mint;
        trade_action.input_amount = input_amount;
        trade_action.output_amount = output_amount;
        trade_action.slippage_bps = slippage_bps;
        trade_action.executed_at = clock.unix_timestamp;
        trade_action.transaction_signature = transaction_signature;
        trade_action.success = success;
        trade_action.price_impact_bps = price_impact_bps;
        trade_action.reason = reason;
        trade_action.bump = bump;
        
        // Update agent statistics
        agent_stats.total_trades += 1;
        if success {
            agent_stats.successful_trades += 1;
            agent_stats.total_volume += input_amount;
            agent_config.total_trade_volume += input_amount;
            agent_config.total_executed_trades += 1;
            
            // Update strategy execution stats
            if let Some(s) = strategy {
                s.last_executed_at = clock.unix_timestamp;
                s.execution_count += 1;
            }
        } else {
            agent_stats.failed_trades += 1;
        }
        
        agent_stats.last_updated_at = clock.unix_timestamp;
        
        emit!(TradeExecutedEvent {
            agent: agent_config.key(),
            owner: agent_config.owner,
            strategy_id,
            input_mint,
            output_mint,
            input_amount,
            output_amount,
            success,
            trade_record: trade_action.key(),
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Record portfolio performance data point
    pub fn record_performance(
        ctx: Context<RecordPerformance>,
        portfolio_value: u64,
        daily_profit_loss: i64,
    ) -> Result<()> {
        let agent_stats = &mut ctx.accounts.agent_stats;
        let clock = Clock::get()?;
        
        // Create new performance data point
        let data_point = PerformancePoint {
            timestamp: clock.unix_timestamp,
            portfolio_value,
            daily_profit_loss,
        };
        
        // Add data point
        agent_stats.performance_data.push(data_point);
        
        // Limit the size of performance history (keep the last 30 days)
        if agent_stats.performance_data.len() > 30 {
            agent_stats.performance_data.remove(0);
        }
        
        // Update profit/loss
        agent_stats.profit_loss += daily_profit_loss;
        agent_stats.last_updated_at = clock.unix_timestamp;
        
        emit!(PerformanceRecordedEvent {
            agent: agent_stats.agent,
            owner: agent_stats.owner,
            portfolio_value,
            daily_profit_loss,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}

/// Accounts for initializing an agent
#[derive(Accounts)]
#[instruction(name: String, description: String, risk_profile: RiskProfile, bump: u8)]
pub struct InitializeAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + size_of::<AgentConfig>() + 200, // Extra space for vectors
        seeds = [b"agent", owner.key().as_ref()],
        bump = bump
    )]
    pub agent_config: Account<'info, AgentConfig>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + size_of::<AgentStats>() + 200, // Extra space for performance data
        seeds = [b"stats", agent_config.key().as_ref()],
        bump = bump
    )]
    pub agent_stats: Account<'info, AgentStats>,
    
    pub system_program: Program<'info, System>,
}

/// Accounts for updating agent configuration
#[derive(Accounts)]
pub struct UpdateAgentConfig<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref()],
        bump = agent_config.bump,
        constraint = agent_config.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub agent_config: Account<'info, AgentConfig>,
    
    pub system_program: Program<'info, System>,
}

/// Accounts for updating agent status
#[derive(Accounts)]
pub struct UpdateAgentStatus<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref()],
        bump = agent_config.bump,
        constraint = agent_config.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub agent_config: Account<'info, AgentConfig>,
    
    pub system_program: Program<'info, System>,
}

/// Accounts for recording a trade
#[derive(Accounts)]
#[instruction(
    strategy_id: [u8; 16],
    input_mint: Pubkey,
    output_mint: Pubkey,
    input_amount: u64,
    output_amount: u64,
    slippage_bps: u16,
    transaction_signature: [u8; 64],
    success: bool,
    price_impact_bps: u16,
    reason: String,
    bump: u8
)]
pub struct RecordTrade<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"agent", agent_config.owner.as_ref()],
        bump = agent_config.bump,
        constraint = agent_config.status == AgentStatus::Active @ ErrorCode::AgentNotActive
    )]
    pub agent_config: Account<'info, AgentConfig>,
    
    #[account(
        mut,
        seeds = [b"stats", agent_config.key().as_ref()],
        bump = agent_stats.bump,
        constraint = agent_stats.agent == agent_config.key() @ ErrorCode::InvalidAgentStats
    )]
    pub agent_stats: Account<'info, AgentStats>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + size_of::<TradeAction>() + reason.len(),
        seeds = [
            b"trade",
            agent_config.key().as_ref(),
            &strategy_id,
            &Clock::get()?.unix_timestamp.to_le_bytes()
        ],
        bump = bump
    )]
    pub trade_action: Account<'info, TradeAction>,
    
    pub system_program: Program<'info, System>,
}

/// Accounts for recording performance
#[derive(Accounts)]
pub struct RecordPerformance<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"agent", agent_stats.owner.as_ref()],
        bump,
        constraint = agent_config.status == AgentStatus::Active @ ErrorCode::AgentNotActive
    )]
    pub agent_config: Account<'info, AgentConfig>,
    
    #[account(
        mut,
        seeds = [b"stats", agent_config.key().as_ref()],
        bump = agent_stats.bump,
        constraint = agent_stats.agent == agent_config.key() @ ErrorCode::InvalidAgentStats
    )]
    pub agent_stats: Account<'info, AgentStats>,
    
    pub system_program: Program<'info, System>,
}

///