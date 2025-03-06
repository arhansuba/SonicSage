// contracts/sonic-agent/src/strategy_manager.rs

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::notification_events::{emit_notification, NotificationEventType, NotificationPriority};

#[account]
#[derive(Default)]
pub struct StrategyRegistry {
    // Authority that manages the strategy registry
    pub authority: Pubkey,
    
    // Total number of registered strategies
    pub strategy_count: u64,
    
    // Protocol fee (in basis points, e.g. 50 = 0.5%)
    pub protocol_fee_bps: u16,
    
    // Protocol fee recipient
    pub fee_recipient: Pubkey,
    
    // Bump seed for PDA
    pub bump: u8,
}

#[account]
pub struct AIStrategy {
    // Unique identifier
    pub id: String,
    
    // Strategy creator address
    pub creator: Pubkey,
    
    // Strategy name
    pub name: String,
    
    // Strategy description hash (IPFS CID or other content identifier)
    pub description_hash: String,
    
    // Risk level (0 = Low, 1 = Medium, 2 = High, 3 = Very High)
    pub risk_level: u8,
    
    // Time horizon (0 = Short Term, 1 = Medium Term, 2 = Long Term)
    pub time_horizon: u8,
    
    // AI model types (bitmap)
    pub ai_models: u32,
    
    // Token support type (0 = Major Only, 1 = Major & Medium, 2 = Wide Coverage, 3 = Custom Basket)
    pub token_support: u8,
    
    // Management fee in basis points (e.g. 150 = 1.5%)
    pub management_fee_bps: u16,
    
    // Performance fee in basis points (e.g. 2000 = 20%)
    pub performance_fee_bps: u16,
    
    // Minimum investment in lamports
    pub min_investment: u64,
    
    // Total value locked in lamports
    pub tvl: u64,
    
    // Number of active subscribers
    pub subscriber_count: u64,
    
    // Total cumulative returns in basis points (for statistical purposes)
    pub total_returns_bps: i32,
    
    // Strategy creation timestamp
    pub created_at: i64,
    
    // Last updated timestamp
    pub updated_at: i64,
    
    // Strategy status (0 = Active, 1 = Paused, 2 = Deprecated)
    pub status: u8,
    
    // Verification status (true = verified)
    pub verified: bool,
    
    // Bump seed for PDA
    pub bump: u8,
}

#[account]
pub struct StrategySubscription {
    // Strategy ID
    pub strategy: Pubkey,
    
    // Subscriber wallet address
    pub subscriber: Pubkey,
    
    // Investment amount in lamports
    pub investment_amount: u64,
    
    // Current value in lamports
    pub current_value: u64,
    
    // Subscription timestamp
    pub subscribed_at: i64,
    
    // Last fee collection timestamp
    pub last_fee_collection: i64,
    
    // High water mark for performance fee calculation
    pub high_water_mark: u64,
    
    // Bump seed for PDA
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 2 + 32 + 1, // discriminator + authority + strategy_count + protocol_fee_bps + fee_recipient + bump
        seeds = [b"strategy-registry"],
        bump
    )]
    pub registry: Account<'info, StrategyRegistry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"strategy-registry"],
        bump = registry.bump
    )]
    pub registry: Account<'info, StrategyRegistry>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + 64 + 32 + 64 + 64 + 1 + 1 + 4 + 1 + 2 + 2 + 8 + 8 + 8 + 4 + 8 + 8 + 1 + 1 + 1, // Add space for all fields
        seeds = [b"strategy", creator.key().as_ref(), registry.strategy_count.to_le_bytes().as_ref()],
        bump
    )]
    pub strategy: Account<'info, AIStrategy>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"strategy", creator.key().as_ref(), strategy.id.as_bytes()],
        bump = strategy.bump,
        constraint = creator.key() == strategy.creator @ ErrorCode::Unauthorized
    )]
    pub strategy: Account<'info, AIStrategy>,
}

#[derive(Accounts)]
pub struct VerifyStrategy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [b"strategy-registry"],
        bump = registry.bump,
        constraint = authority.key() == registry.authority @ ErrorCode::Unauthorized
    )]
    pub registry: Account<'info, StrategyRegistry>,
    
    #[account(mut)]
    pub strategy: Account<'info, AIStrategy>,
}

#[derive(Accounts)]
pub struct SubscribeToStrategy<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    
    #[account(
        mut,
        constraint = strategy.status == 0 @ ErrorCode::StrategyNotActive
    )]
    pub strategy: Account<'info, AIStrategy>,
    
    #[account(
        init,
        payer = subscriber,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1, // Add space for all fields
        seeds = [b"subscription", strategy.key().as_ref(), subscriber.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, StrategySubscription>,
    
    #[account(mut)]
    pub subscriber_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnsubscribeFromStrategy<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    
    pub strategy: Account<'info, AIStrategy>,
    
    #[account(
        mut,
        close = subscriber,
        seeds = [b"subscription", strategy.key().as_ref(), subscriber.key().as_ref()],
        bump = subscription.bump,
        constraint = subscriber.key() == subscription.subscriber @ ErrorCode::Unauthorized
    )]
    pub subscription: Account<'info, StrategySubscription>,
    
    #[account(mut)]
    pub subscriber_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub strategy_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateStrategyValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [b"strategy-registry"],
        bump = registry.bump,
        constraint = authority.key() == registry.authority @ ErrorCode::Unauthorized
    )]
    pub registry: Account<'info, StrategyRegistry>,
    
    #[account(mut)]
    pub strategy: Account<'info, AIStrategy>,
    
    #[account(
        mut,
        seeds = [b"subscription", strategy.key().as_ref(), subscription.subscriber.as_ref()],
        bump = subscription.bump
    )]
    pub subscription: Account<'info, StrategySubscription>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid parameter")]
    InvalidParameter,
    
    #[msg("Strategy not active")]
    StrategyNotActive,
    
    #[msg("Investment below minimum")]
    BelowMinimumInvestment,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
}

// Initialize the strategy registry
pub fn initialize_registry(
    ctx: Context<InitializeRegistry>, 
    protocol_fee_bps: u16,
    fee_recipient: Pubkey
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    
    // Validate input
    require!(protocol_fee_bps <= 1000, ErrorCode::InvalidParameter); // Max 10%
    
    registry.authority = ctx.accounts.authority.key();
    registry.strategy_count = 0;
    registry.protocol_fee_bps = protocol_fee_bps;
    registry.fee_recipient = fee_recipient;
    registry.bump = *ctx.bumps.get("registry").unwrap();
    
    Ok(())
}

// Create a new AI strategy
pub fn create_strategy(
    ctx: Context<CreateStrategy>,
    id: String,
    name: String,
    description_hash: String,
    risk_level: u8,
    time_horizon: u8,
    ai_models: u32,
    token_support: u8,
    management_fee_bps: u16,
    performance_fee_bps: u16,
    min_investment: u64
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let registry = &mut ctx.accounts.registry;
    
    // Validate inputs
    require!(risk_level <= 3, ErrorCode::InvalidParameter);
    require!(time_horizon <= 2, ErrorCode::InvalidParameter);
    require!(token_support <= 3, ErrorCode::InvalidParameter);
    require!(management_fee_bps <= 500, ErrorCode::InvalidParameter); // Max 5%
    require!(performance_fee_bps <= 3000, ErrorCode::InvalidParameter); // Max 30%
    
    // Set strategy data
    strategy.id = id;
    strategy.creator = ctx.accounts.creator.key();
    strategy.name = name;
    strategy.description_hash = description_hash;
    strategy.risk_level = risk_level;
    strategy.time_horizon = time_horizon;
    strategy.ai_models = ai_models;
    strategy.token_support = token_support;
    strategy.management_fee_bps = management_fee_bps;
    strategy.performance_fee_bps = performance_fee_bps;
    strategy.min_investment = min_investment;
    strategy.tvl = 0;
    strategy.subscriber_count = 0;
    strategy.total_returns_bps = 0;
    strategy.created_at = Clock::get()?.unix_timestamp;
    strategy.updated_at = Clock::get()?.unix_timestamp;
    strategy.status = 0; // Active
    strategy.verified = false;
    strategy.bump = *ctx.bumps.get("strategy").unwrap();
    
    // Increment strategy count in registry
    registry.strategy_count += 1;
    
    // Emit notification
    emit_notification(
        ctx.to_account_infos(),
        ctx.accounts.creator.key(),
        NotificationEventType::StrategyUpdated,
        NotificationPriority::Low,
        "Strategy Created".to_string(),
        format!("Your strategy '{}' has been created successfully", strategy.name),
        Some(format!("{{\"strategyId\":\"{}\"}}", strategy.id)),
        None,
        None,
        None
    );
    
    Ok(())
}

// Update an existing strategy
pub fn update_strategy(
    ctx: Context<UpdateStrategy>,
    name: Option<String>,
    description_hash: Option<String>,
    risk_level: Option<u8>,
    time_horizon: Option<u8>,
    ai_models: Option<u32>,
    token_support: Option<u8>,
    management_fee_bps: Option<u16>,
    performance_fee_bps: Option<u16>,
    min_investment: Option<u64>,
    status: Option<u8>
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    
    // Validate inputs
    if let Some(risk) = risk_level {
        require!(risk <= 3, ErrorCode::InvalidParameter);
        strategy.risk_level = risk;
    }
    
    if let Some(horizon) = time_horizon {
        require!(horizon <= 2, ErrorCode::InvalidParameter);
        strategy.time_horizon = horizon;
    }
    
    if let Some(models) = ai_models {
        strategy.ai_models = models;
    }
    
    if let Some(support) = token_support {
        require!(support <= 3, ErrorCode::InvalidParameter);
        strategy.token_support = support;
    }
    
    if let Some(fee) = management_fee_bps {
        require!(fee <= 500, ErrorCode::InvalidParameter); // Max 5%
        strategy.management_fee_bps = fee;
    }
    
    if let Some(fee) = performance_fee_bps {
        require!(fee <= 3000, ErrorCode::InvalidParameter); // Max 30%
        strategy.performance_fee_bps = fee;
    }
    
    if let Some(min) = min_investment {
        strategy.min_investment = min;
    }
    
    if let Some(new_status) = status {
        require!(new_status <= 2, ErrorCode::InvalidParameter);
        strategy.status = new_status;
    }
    
    if let Some(new_name) = name {
        strategy.name = new_name;
    }
    
    if let Some(new_desc) = description_hash {
        strategy.description_hash = new_desc;
    }
    
    // Update the timestamp
    strategy.updated_at = Clock::get()?.unix_timestamp;
    
    // Emit notification
    emit_notification(
        ctx.to_account_infos(),
        ctx.accounts.creator.key(),
        NotificationEventType::StrategyUpdated,
        NotificationPriority::Low,
        "Strategy Updated".to_string(),
        format!("Your strategy '{}' has been updated successfully", strategy.name),
        Some(format!("{{\"strategyId\":\"{}\"}}", strategy.id)),
        None,
        None,
        None
    );
    
    Ok(())
}

// Verify a strategy (admin only)
pub fn verify_strategy(ctx: Context<VerifyStrategy>, verified: bool) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    
    strategy.verified = verified;
    strategy.updated_at = Clock::get()?.unix_timestamp;
    
    // Emit notification to strategy creator
    emit_notification(
        ctx.to_account_infos(),
        strategy.creator,
        NotificationEventType::StrategyUpdated,
        NotificationPriority::Medium,
        "Strategy Verification Update".to_string(),
        format!(
            "Your strategy '{}' has been {} verification", 
            strategy.name, 
            if verified { "granted" } else { "denied" }
        ),
        Some(format!("{{\"strategyId\":\"{}\", \"verified\":{}}}", strategy.id, verified)),
        None,
        None,
        None
    );
    
    Ok(())
}

// Subscribe to a strategy
pub fn subscribe_to_strategy(
    ctx: Context<SubscribeToStrategy>,
    investment_amount: u64
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    
    // Verify minimum investment
    require!(
        investment_amount >= strategy.min_investment,
        ErrorCode::BelowMinimumInvestment
    );
    
    // Set subscription data
    subscription.strategy = ctx.accounts.strategy.key();
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.investment_amount = investment_amount;
    subscription.current_value = investment_amount; // Initially same as investment
    subscription.subscribed_at = Clock::get()?.unix_timestamp;
    subscription.last_fee_collection = Clock::get()?.unix_timestamp;
    subscription.high_water_mark = investment_amount;
    subscription.bump = *ctx.bumps.get("subscription").unwrap();
    
    // Update strategy stats
    strategy.tvl = strategy.tvl.checked_add(investment_amount).unwrap();
    strategy.subscriber_count = strategy.subscriber_count.checked_add(1).unwrap();
    
    // Transfer funds from subscriber to strategy account
    let transfer_instruction = Transfer {
        from: ctx.accounts.subscriber_token_account.to_account_info(),
        to: ctx.accounts.strategy_token_account.to_account_info(),
        authority: ctx.accounts.subscriber.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
    );
    
    token::transfer(cpi_ctx, investment_amount)?;
    
    // Emit notification
    emit_notification(
        ctx.to_account_infos(),
        ctx.accounts.subscriber.key(),
        NotificationEventType::StrategyUpdated,
        NotificationPriority::Medium,
        "Strategy Subscription".to_string(),
        format!("You have successfully subscribed to '{}' strategy", strategy.name),
        Some(format!(
            "{{\"strategyId\":\"{}\", \"investmentAmount\":{}}}", 
            strategy.id, 
            investment_amount
        )),
        Some(strategy.id.parse::<u64>().unwrap_or(0)),
        None,
        None
    );
    
    Ok(())
}

// Unsubscribe from a strategy
pub fn unsubscribe_from_strategy(ctx: Context<UnsubscribeFromStrategy>) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let subscription = &ctx.accounts.subscription;
    
    // Calculate current value (in a real implementation, this would be based on actual strategy performance)
    let current_value = subscription.current_value;
    
    // Update strategy stats
    strategy.tvl = strategy.tvl.checked_sub(current_value).unwrap_or(0);
    strategy.subscriber_count = strategy.subscriber_count.checked_sub(1).unwrap_or(0);
    
    // Transfer funds from strategy to subscriber account
    let transfer_instruction = Transfer {
        from: ctx.accounts.strategy_token_account.to_account_info(),
        to: ctx.accounts.subscriber_token_account.to_account_info(),
        authority: strategy.to_account_info(),
    };
    
    // This would normally require a PDA signer, simplified for this example
    // In a real implementation, we would create a proper PDA signer for the strategy
    let seeds = &[
        b"strategy",
        strategy.creator.as_ref(),
        strategy.id.as_bytes(),
        &[strategy.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_instruction,
        signer,
    );
    
    token::transfer(cpi_ctx, current_value)?;
    
    // Emit notification
    emit_notification(
        ctx.to_account_infos(),
        ctx.accounts.subscriber.key(),
        NotificationEventType::StrategyUpdated,
        NotificationPriority::Medium,
        "Strategy Unsubscription".to_string(),
        format!("You have successfully unsubscribed from '{}' strategy", strategy.name),
        Some(format!(
            "{{\"strategyId\":\"{}\", \"withdrawnAmount\":{}}}", 
            strategy.id, 
            current_value
        )),
        Some(strategy.id.parse::<u64>().unwrap_or(0)),
        None,
        None
    );
    
    Ok(())
}

// Update a strategy's value (simulating AI trading performance)
pub fn update_strategy_value(
    ctx: Context<UpdateStrategyValue>,
    new_value: u64,
    returns_bps: i32
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    
    // Update subscription value
    let old_value = subscription.current_value;
    subscription.current_value = new_value;
    
    // Update high water mark if necessary
    if new_value > subscription.high_water_mark {
        subscription.high_water_mark = new_value;
    }
    
    // Update strategy TVL
    strategy.tvl = strategy.tvl.checked_sub(old_value).unwrap_or(0);
    strategy.tvl = strategy.tvl.checked_add(new_value).unwrap();
    
    // Update strategy returns (simple average for demo purposes)
    // In real implementation, this would be a weighted average based on TVL
    strategy.total_returns_bps = ((strategy.total_returns_bps as i64 + returns_bps as i64) / 2) as i32;
    
    // Calculate if notification should be sent
    let value_change_pct = if old_value > 0 {
        ((new_value as f64 - old_value as f64) / old_value as f64) * 100.0
    } else {
        0.0
    };
    
    // Send notification only for significant changes (>= 5%)
    if value_change_pct.abs() >= 5.0 {
        let (notification_type, priority) = if value_change_pct >= 0.0 {
            (NotificationEventType::PortfolioRebalanced, NotificationPriority::Low)
        } else {
            (NotificationEventType::HighExposureWarning, NotificationPriority::Medium)
        };
        
        emit_notification(
            ctx.to_account_infos(),
            subscription.subscriber,
            notification_type,
            priority,
            "Strategy Performance Update".to_string(),
            format!(
                "Your investment in '{}' strategy has changed by {:.2}%", 
                strategy.name, 
                value_change_pct
            ),
            Some(format!(
                "{{\"strategyId\":\"{}\", \"changePercent\":{}, \"newValue\":{}}}", 
                strategy.id, 
                value_change_pct, 
                new_value
            )),
            Some(strategy.id.parse::<u64>().unwrap_or(0)),
            None,
            None
        );
    }
    
    Ok(())
}

// Collect management fees (simplified implementation)
pub fn collect_management_fees(
    ctx: Context<UpdateStrategyValue>
) -> Result<()> {
    let strategy = &ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    
    // Calculate time elapsed since last fee collection
    let now = Clock::get()?.unix_timestamp;
    let seconds_elapsed = now - subscription.last_fee_collection;
    
    // Only collect fees if at least a day has passed
    if seconds_elapsed < 86400 {
        return Ok(());
    }
    
    // Calculate annual fee pro-rated by time
    let fee_ratio = (strategy.management_fee_bps as f64) / 10000.0; // Convert basis points to ratio
    let time_ratio = (seconds_elapsed as f64) / (365.0 * 86400.0); // Fraction of a year
    let fee_amount = (subscription.current_value as f64 * fee_ratio * time_ratio) as u64;
    
    // Update subscription value and last fee collection timestamp
    subscription.current_value = subscription.current_value.checked_sub(fee_amount).unwrap_or(subscription.current_value);
    subscription.last_fee_collection = now;
    
    Ok(())
}

// Collect performance fees (simplified implementation)
pub fn collect_performance_fees(
    ctx: Context<UpdateStrategyValue>
) -> Result<()> {
    let strategy = &ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    
    // Check if current value exceeds high water mark
    if subscription.current_value <= subscription.high_water_mark {
        return Ok(());
    }
    
    // Calculate profit above high water mark
    let profit = subscription.current_value - subscription.high_water_mark;
    
    // Calculate performance fee
    let fee_ratio = (strategy.performance_fee_bps as f64) / 10000.0; // Convert basis points to ratio
    let fee_amount = (profit as f64 * fee_ratio) as u64;
    
    // Update subscription value and high water mark
    subscription.current_value = subscription.current_value.checked_sub(fee_amount).unwrap_or(subscription.current_value);
    subscription.high_water_mark = subscription.current_value;
    
    Ok(())
}

// Update protocol fees
pub fn update_protocol_fees(
    ctx: Context<InitializeRegistry>,
    protocol_fee_bps: u16,
    fee_recipient: Option<Pubkey>
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    
    // Only authority can update fees
    require!(
        ctx.accounts.authority.key() == registry.authority,
        ErrorCode::Unauthorized
    );
    
    // Validate input
    require!(protocol_fee_bps <= 1000, ErrorCode::InvalidParameter); // Max 10%
    
    registry.protocol_fee_bps = protocol_fee_bps;
    
    if let Some(recipient) = fee_recipient {
        registry.fee_recipient = recipient;
    }
    
    Ok(())
}

// Transfer strategy ownership
pub fn transfer_strategy_ownership(
    ctx: Context<UpdateStrategy>,
    new_owner: Pubkey
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    
    // Only current owner can transfer ownership
    require!(
        ctx.accounts.creator.key() == strategy.creator,
        ErrorCode::Unauthorized
    );
    
    // Update creator
    strategy.creator = new_owner;
    
    // Emit notification
    emit_notification(
        ctx.to_account_infos(),
        ctx.accounts.creator.key(),
        NotificationEventType::PermissionsChanged,
        NotificationPriority::High,
        "Strategy Ownership Transferred".to_string(),
        format!("Ownership of '{}' strategy has been transferred", strategy.name),
        Some(format!("{{\"strategyId\":\"{}\", \"newOwner\":\"{}\"}}", strategy.id, new_owner)),
        Some(strategy.id.parse::<u64>().unwrap_or(0)),
        None,
        None
    );
    
    // Also notify the new owner
    emit_notification(
        ctx.to_account_infos(),
        new_owner,
        NotificationEventType::PermissionsChanged,
        NotificationPriority::High,
        "Strategy Ownership Received".to_string(),
        format!("You are now the owner of '{}' strategy", strategy.name),
        Some(format!("{{\"strategyId\":\"{}\"}}", strategy.id)),
        Some(strategy.id.parse::<u64>().unwrap_or(0)),
        None,
        None
    );
    
    Ok(())
}