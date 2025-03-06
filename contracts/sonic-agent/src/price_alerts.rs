// contracts/sonic-agent/src/price_alerts.rs

use anchor_lang::prelude::*;
use crate::notification_events::{emit_notification, emit_price_alert, NotificationEventType, NotificationPriority};

#[account]
#[derive(Default)]
pub struct UserPriceAlerts {
    // User that owns these price alerts
    pub user: Pubkey,
    
    // List of active price alerts
    pub alerts: Vec<PriceAlert>,
    
    // Total number of alerts created (used for ID generation)
    pub alert_count: u64,
    
    // Maximum number of active alerts
    pub max_alerts: u8,
    
    // Bump used for PDA
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct PriceAlert {
    // Unique ID for this alert
    pub id: Pubkey,
    
    // Token address being monitored
    pub token: Pubkey,
    
    // Price threshold (in token's smallest units)
    pub threshold: u64,
    
    // Direction: true = above threshold, false = below threshold
    pub direction: bool,
    
    // Timestamp when alert was created
    pub created_at: i64,
    
    // Has this alert been triggered yet?
    pub triggered: bool,
    
    // Notification preferences
    pub notify_email: bool,
    pub notify_browser: bool,
}

// Space calculation for UserPriceAlerts account
impl UserPriceAlerts {
    pub const BASE_SIZE: usize = 8 + // discriminator
                                 32 + // user pubkey
                                 4 + // vec len
                                 8 + // alert_count
                                 1 + // max_alerts
                                 1;  // bump
    
    pub const ALERT_SIZE: usize = 32 + // id
                                  32 + // token
                                  8 + // threshold
                                  1 + // direction
                                  8 + // created_at
                                  1 + // triggered
                                  1 + // notify_email
                                  1;  // notify_browser
    
    pub const MAX_ALERTS: usize = 10;
    
    pub const MAX_SIZE: usize = Self::BASE_SIZE + (Self::ALERT_SIZE * Self::MAX_ALERTS);
}

#[derive(Accounts)]
pub struct InitializePriceAlerts<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = UserPriceAlerts::MAX_SIZE,
        seeds = [b"price_alerts", user.key().as_ref()],
        bump
    )]
    pub price_alerts: Account<'info, UserPriceAlerts>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePriceAlert<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"price_alerts", user.key().as_ref()],
        bump = price_alerts.bump,
        constraint = price_alerts.user == user.key(),
        constraint = price_alerts.alerts.len() < price_alerts.max_alerts as usize @ ErrorCode::MaxAlertsExceeded
    )]
    pub price_alerts: Account<'info, UserPriceAlerts>,
    
    #[account(init, payer = user, space = 8)]
    pub price_alert: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeletePriceAlert<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"price_alerts", user.key().as_ref()],
        bump = price_alerts.bump,
        constraint = price_alerts.user == user.key()
    )]
    pub price_alerts: Account<'info, UserPriceAlerts>,
}

#[derive(Accounts)]
pub struct TriggerPriceAlert<'info> {
    // The oracle or price feed authority
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"price_alerts", user.key().as_ref()],
        bump = price_alerts.bump
    )]
    pub price_alerts: Account<'info, UserPriceAlerts>,
    
    /// CHECK: This is not a contract account
    pub user: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Maximum number of alerts exceeded")]
    MaxAlertsExceeded,
    
    #[msg("Alert not found")]
    AlertNotFound,
    
    #[msg("Unauthorized")]
    Unauthorized,
}

// Initialize price alerts account for a user
pub fn initialize_price_alerts(ctx: Context<InitializePriceAlerts>) -> Result<()> {
    let price_alerts = &mut ctx.accounts.price_alerts;
    let bump = *ctx.bumps.get("price_alerts").unwrap();
    
    price_alerts.user = ctx.accounts.user.key();
    price_alerts.alerts = Vec::new();
    price_alerts.alert_count = 0;
    price_alerts.max_alerts = UserPriceAlerts::MAX_ALERTS as u8;
    price_alerts.bump = bump;
    
    // Emit notification for account creation
    emit_notification(
        ctx.to_account_infos(), 
        ctx.accounts.user.key(), 
        NotificationEventType::AgentDeployed, 
        NotificationPriority::Low, 
        "Price Alerts Initialized".to_string(), 
        "Your price alert system has been set up successfully.".to_string(), 
        None, 
        None, 
        None, 
        None
    );
    
    Ok(())
}

// Create a new price alert
pub fn create_price_alert(
    ctx: Context<CreatePriceAlert>,
    token: Pubkey,
    threshold: u64,
    direction: bool,
    notify_email: bool,
    notify_browser: bool,
) -> Result<()> {
    let price_alerts = &mut ctx.accounts.price_alerts;
    let alert_id = ctx.accounts.price_alert.key();
    
    let alert = PriceAlert {
        id: alert_id,
        token,
        threshold,
        direction,
        created_at: Clock::get()?.unix_timestamp,
        triggered: false,
        notify_email,
        notify_browser,
    };
    
    price_alerts.alerts.push(alert);
    price_alerts.alert_count += 1;
    
    // Emit notification for alert creation
    let direction_str = if direction { "above" } else { "below" };
    
    emit_notification(
        ctx.to_account_infos(), 
        ctx.accounts.user.key(), 
        NotificationEventType::PriceAlert, 
        NotificationPriority::Low, 
        "Price Alert Created".to_string(), 
        format!("You will be notified when price goes {} {}", direction_str, threshold), 
        Some(format!(r#"{{"token":"{}", "threshold":{}, "direction":{}}}"#, token, threshold, direction)),
        None, 
        Some(token), 
        None
    );
    
    Ok(())
}

// Delete a price alert
pub fn delete_price_alert(ctx: Context<DeletePriceAlert>, alert_id: Pubkey) -> Result<()> {
    let price_alerts = &mut ctx.accounts.price_alerts;
    
    // Find the index of the alert to delete
    let alert_index = price_alerts.alerts
        .iter()
        .position(|alert| alert.id == alert_id)
        .ok_or(ErrorCode::AlertNotFound)?;
    
    // Remove the alert from the vector
    let alert = price_alerts.alerts.remove(alert_index);
    
    // Emit notification for alert deletion
    emit_notification(
        ctx.to_account_infos(), 
        ctx.accounts.user.key(), 
        NotificationEventType::PriceAlert, 
        NotificationPriority::Low, 
        "Price Alert Deleted".to_string(), 
        format!("Your price alert for token {} has been deleted", alert.token), 
        Some(format!(r#"{{"token":"{}"}}"#, alert.token)),
        None, 
        Some(alert.token), 
        None
    );
    
    Ok(())
}

// Trigger a price alert (called by oracle or price feed)
pub fn trigger_price_alert(
    ctx: Context<TriggerPriceAlert>, 
    token: Pubkey, 
    current_price: u64,
    oracle_authority: Pubkey,
) -> Result<()> {
    // Verify the caller is an authorized oracle
    require!(ctx.accounts.authority.key() == oracle_authority, ErrorCode::Unauthorized);
    
    let price_alerts = &mut ctx.accounts.price_alerts;
    let user = ctx.accounts.user.key();
    
    // Find alerts to trigger
    let mut triggered_indices = Vec::new();
    
    for (i, alert) in price_alerts.alerts.iter().enumerate() {
        if alert.token == token && !alert.triggered {
            let should_trigger = if alert.direction {
                // Alert for price above threshold
                current_price >= alert.threshold
            } else {
                // Alert for price below threshold
                current_price <= alert.threshold
            };
            
            if should_trigger {
                triggered_indices.push(i);
                
                // Emit price alert event
                emit_price_alert(
                    ctx.to_account_infos(),
                    user,
                    token,
                    alert.direction,
                    alert.threshold,
                    current_price
                );
            }
        }
    }
    
    // Mark triggered alerts
    for &index in triggered_indices.iter().rev() {
        price_alerts.alerts[index].triggered = true;
    }
    
    Ok(())
}