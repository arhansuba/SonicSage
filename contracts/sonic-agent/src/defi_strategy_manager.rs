// contracts/sonic-agent/src/defi_strategy_manager.rs

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::notification_events::{emit_notification, NotificationEventType, NotificationPriority};
use std::collections::HashMap;

// Protocol types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProtocolType {
    Lending,
    YieldFarming,
    LiquidityProviding,
    Staking,
    Options,
}

// Risk levels
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    Conservative,
    Moderate,
    Aggressive,
    Experimental,
}

// Strategy status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum StrategyStatus {
    Active,
    Paused,
    Deprecated,
}

// Token allocation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct TokenAllocation {
    pub mint: Pubkey,
    pub allocation_percentage: u8,  // out of 100
}

// Protocol-specific configurations
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum ProtocolConfig {
    Lending {
        platform: String,
        collateral_factor: u8,  // in percentage (e.g. 80 for 80%)
        max_utilization: u8,    // in percentage
        auto_compound: bool,
        auto_rebalance: bool,
        liquidation_buffer: u8, // in percentage
        enable_leverage: bool,
        max_leverage: u8,       // in tenths (e.g. 15 for 1.5x)
    },
    YieldFarming {
        platform: String,
        pool_address: Pubkey,
        harvest_frequency: u64, // in seconds
        auto_compound: bool,
        reinvest_threshold: u64, // in lamports
        max_slippage: u8,       // in basis points
        min_apr: u8,            // in percentage
    },
    LiquidityProviding {
        platform: String,
        pool_address: Pubkey,
        range_width: Option<u16>,  // for concentrated liquidity (in basis points)
        rebalance_threshold: u16,  // in basis points
        max_slippage: u16,         // in basis points
        auto_compound: bool,
        impermanent_loss_protection: bool,
    },
    Staking {
        platform: String,
        auto_compound: bool,
        lockup_period: Option<u64>, // in seconds
        unstake_cooldown: Option<u64>, // in seconds
        validator: Option<Pubkey>,
    },
    Options {
        platform: String,
        strategy_type: String,  // covered_call, cash_secured_put, etc.
        expiry_target_days: u16,
        strike_selection_method: String, // delta, percentage_otm, etc.
        strike_selection_value: u16,     // in percentage or basis points
        roll_days_before_expiry: u8,
        max_notional_value: u64, // in lamports
    },
}

// DeFi Strategy Registry
#[account]
#[derive(Default)]
pub struct DeFiStrategyRegistry {
    pub authority: Pubkey,
    pub strategy_count: u64,
    pub protocol_fee_bps: u16,  // in basis points
    pub fee_recipient: Pubkey,
    pub bump: u8,
}

// DeFi Strategy Definition
#[account]
pub struct DeFiStrategy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub protocol_type: ProtocolType,
    pub risk_level: RiskLevel,
    pub token_allocations: Vec<TokenAllocation>,
    pub estimated_apy: u16,     // in basis points (e.g. 580 for 5.8%)
    pub tvl: u64,               // in lamports
    pub user_count: u32,
    pub creator: Pubkey,
    pub creator_name: String,
    pub verified: bool,
    pub protocol_config: ProtocolConfig,
    pub fee_percentage: u16,    // in basis points
    pub min_investment: u64,    // in lamports
    pub created_at: i64,
    pub updated_at: i64,
    pub status: StrategyStatus,
    pub tags: Vec<String>,
    pub bump: u8,
}

// User's DeFi Strategy Subscription
#[account]
pub struct DeFiSubscription {
    pub user: Pubkey,
    pub strategy: Pubkey,
    pub investment_values: Vec<TokenInvestment>,
    pub initial_investment_value: u64, // Total in lamports
    pub current_value: u64,            // Total in lamports
    pub last_harvest_time: i64,
    pub subscribed_at: i64,
    pub auto_compound: bool,
    pub active_position_ids: Vec<Pubkey>, // References to protocol-specific positions
    pub custom_settings: HashMap<String, Vec<u8>>, // Custom setting overrides
    pub bump: u8,
}

// Token investment in a strategy
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenInvestment {
    pub mint: Pubkey,
    pub amount: u64,       // Amount in token's smallest units
    pub usd_value: u64,    // USD value in cents
}

// DCA (Dollar Cost Averaging) Setup
#[account]
pub struct DCAConfig {
    pub user: Pubkey,
    pub strategy: Pubkey,
    pub amount: u64,        // Amount in source token's smallest units
    pub frequency: u64,     // in seconds
    pub source_token: Pubkey,
    pub next_execution: i64,
    pub active: bool,
    pub last_execution: i64,
    pub execution_count: u32,
    pub bump: u8,
}

// Position Health Check Parameters
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct HealthCheckParams {
    pub health_factor_threshold: u16, // in basis points (e.g. 1200 for 1.2)
    pub liquidation_threshold: u16,   // in basis points
    pub warning_notification_enabled: bool,
    pub critical_notification_enabled: bool,
    pub auto_deleverage_enabled: bool,
}

// Strategy Creation/Management Accounts
#[derive(Accounts)]
pub struct InitializeDeFiRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 2 + 32 + 1, // discriminator + authority + strategy_count + protocol_fee_bps + fee_recipient + bump
        seeds = [b"defi-registry"],
        bump
    )]
    pub registry: Account<'info, DeFiStrategyRegistry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: String)]
pub struct CreateDeFiStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"defi-registry"],
        bump = registry.bump
    )]
    pub registry: Account<'info, DeFiStrategyRegistry>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 64 + 100 + 255 + 1 + 1 + 100 + 2 + 8 + 4 + 32 + 50 + 1 + 500 + 2 + 8 + 8 + 8 + 1 + 200 + 1, // Approximate space
        seeds = [b"defi-strategy", id.as_bytes()],
        bump
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateDeFiStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump,
        constraint = strategy.creator == creator.key() @ ErrorCode::Unauthorized
    )]
    pub strategy: Account<'info, DeFiStrategy>,
}

#[derive(Accounts)]
pub struct VerifyDeFiStrategy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [b"defi-registry"],
        bump = registry.bump,
        constraint = authority.key() == registry.authority @ ErrorCode::Unauthorized
    )]
    pub registry: Account<'info, DeFiStrategyRegistry>,
    
    #[account(mut)]
    pub strategy: Account<'info, DeFiStrategy>,
}

#[derive(Accounts)]
pub struct SubscribeToDeFiStrategy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump,
        constraint = strategy.status == StrategyStatus::Active @ ErrorCode::StrategyNotActive
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 200 + 8 + 8 + 8 + 8 + 1 + 200 + 100 + 1, // Approximate space
        seeds = [b"defi-subscription", strategy.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, DeFiSubscription>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnsubscribeFromDeFiStrategy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    #[account(
        mut,
        close = user,
        seeds = [b"defi-subscription", strategy.key().as_ref(), user.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.user == user.key() @ ErrorCode::Unauthorized
    )]
    pub subscription: Account<'info, DeFiSubscription>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct HarvestRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    #[account(
        mut,
        seeds = [b"defi-subscription", strategy.key().as_ref(), user.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.user == user.key() @ ErrorCode::Unauthorized
    )]
    pub subscription: Account<'info, DeFiSubscription>,
    
    #[account(mut)]
    pub reward_source: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RebalancePosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    #[account(
        mut,
        seeds = [b"defi-subscription", strategy.key().as_ref(), user.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.user == user.key() @ ErrorCode::Unauthorized
    )]
    pub subscription: Account<'info, DeFiSubscription>,
}

#[derive(Accounts)]
pub struct SetupDCA<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [b"defi-strategy", strategy.id.as_bytes()],
        bump = strategy.bump,
        constraint = strategy.status == StrategyStatus::Active @ ErrorCode::StrategyNotActive
    )]
    pub strategy: Account<'info, DeFiStrategy>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 32 + 8 + 1 + 8 + 4 + 1, // Approximate space
        seeds = [b"dca-config", strategy.key().as_ref(), user.key().