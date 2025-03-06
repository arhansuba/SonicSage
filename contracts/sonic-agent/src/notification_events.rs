// contracts/sonic-agent/src/notification_events.rs

use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;

// Event types for notifications
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum NotificationEventType {
    // Market events
    PriceAlert,
    VolatilityAlert,
    TrendReversalDetected,
    MarketNewsAlert,
    
    // Trade events
    TradeExecuted,
    TradeCompleted,
    TradeFailed,
    SlippageExceeded,
    
    // Portfolio events
    PortfolioRebalanced,
    TokenThresholdReached,
    PositionLiquidated,
    HighExposureWarning,
    
    // System events
    AgentDeployed,
    StrategyUpdated,
    PermissionsChanged,
    MaintenanceAlert,
}

// Notification priority levels
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum NotificationPriority {
    Low,
    Medium,
    High,
    Critical,
}

// Notification event emitted by the contract
#[event]
pub struct NotificationEvent {
    // User associated with the notification
    pub user: Pubkey,
    
    // Type of notification
    pub event_type: NotificationEventType,
    
    // Priority level
    pub priority: NotificationPriority,
    
    // Title of the notification
    pub title: String,
    
    // Message content
    pub message: String,
    
    // Timestamp (Unix timestamp)
    pub timestamp: i64,
    
    // Additional JSON data (encoded as string)
    pub data: Option<String>,
    
    // Related strategy ID (if applicable)
    pub strategy_id: Option<u64>,
    
    // Related token address (if applicable)
    pub token_address: Option<Pubkey>,
    
    // Transaction signature (if applicable)
    pub tx_signature: Option<String>,
}

// Trade notification event - specialized for trade executions
#[event]
pub struct TradeNotificationEvent {
    // User who executed the trade
    pub user: Pubkey,
    
    // Trade notification type
    pub event_type: NotificationEventType,
    
    // Trade details
    pub from_token: Pubkey,
    pub to_token: Pubkey,
    pub from_amount: u64,
    pub to_amount: u64,
    pub price_impact: i32, // In basis points (e.g., 125 = 1.25%)
    pub success: bool,
    pub timestamp: i64,
    
    // Transaction signature
    pub tx_signature: String,
    
    // Strategy ID if this was executed by agent
    pub strategy_id: Option<u64>,
}

// Price alert notification
#[event]
pub struct PriceAlertEvent {
    // User who set the alert
    pub user: Pubkey,
    
    // Token address
    pub token_address: Pubkey,
    
    // Alert type (above/below threshold)
    pub alert_direction: bool, // true = above, false = below
    
    // Price threshold that was crossed
    pub threshold: u64,
    
    // Current price
    pub current_price: u64,
    
    // Timestamp
    pub timestamp: i64,
}

// Functions to emit notification events
pub fn emit_notification(
    ctx: Context<&impl Accounts>,
    user: Pubkey,
    event_type: NotificationEventType,
    priority: NotificationPriority,
    title: String,
    message: String,
    data: Option<String>,
    strategy_id: Option<u64>,
    token_address: Option<Pubkey>,
    tx_signature: Option<String>,
) {
    emit!(NotificationEvent {
        user,
        event_type,
        priority,
        title,
        message,
        timestamp: Clock::get().unwrap().unix_timestamp,
        data,
        strategy_id,
        token_address,
        tx_signature,
    });
}

pub fn emit_trade_notification(
    ctx: Context<&impl Accounts>,
    user: Pubkey,
    event_type: NotificationEventType,
    from_token: Pubkey,
    to_token: Pubkey,
    from_amount: u64,
    to_amount: u64,
    price_impact: i32,
    success: bool,
    tx_signature: String,
    strategy_id: Option<u64>,
) {
    emit!(TradeNotificationEvent {
        user,
        event_type,
        from_token,
        to_token,
        from_amount,
        to_amount,
        price_impact,
        success,
        timestamp: Clock::get().unwrap().unix_timestamp,
        tx_signature,
        strategy_id,
    });
}

pub fn emit_price_alert(
    ctx: Context<&impl Accounts>,
    user: Pubkey,
    token_address: Pubkey,
    alert_direction: bool,
    threshold: u64,
    current_price: u64,
) {
    emit!(PriceAlertEvent {
        user,
        token_address,
        alert_direction,
        threshold,
        current_price,
        timestamp: Clock::get().unwrap().unix_timestamp,
    });
}