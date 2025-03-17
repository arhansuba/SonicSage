/**
 * Sonic SVM AI Trading Contract
 * This is a Rust implementation of a trading contract for Sonic SVM
 * using Anchor framework
 */

 use anchor_lang::prelude::*;
 use anchor_spl::token::{self, TokenAccount, Token, Mint, Transfer};
 use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2};
 
 declare_id!("Ai8gzqrzgndFtswn9BXgHZcVaXZ5UHgqwBF8ZrgqNHZn");
 
 #[program]
 pub mod sonic_ai_trading {
     use super::*;
 
     /**
      * Initialize the trading system
      */
     pub fn initialize(
         ctx: Context<Initialize>,
         authority: Pubkey,
         max_position_size: u64,
         risk_level: u8,
     ) -> Result<()> {
         let trading_state = &mut ctx.accounts.trading_state;
         trading_state.authority = authority;
         trading_state.max_position_size = max_position_size;
         trading_state.risk_level = risk_level;
         trading_state.initialized = true;
         trading_state.paused = false;
         trading_state.total_trades = 0;
         trading_state.successful_trades = 0;
         trading_state.total_profit_loss = 0;
         
         msg!("SonicAI Trading system initialized");
         msg!("Max position size: {}", max_position_size);
         msg!("Risk level: {}", risk_level);
         
         Ok(())
     }
 
     /**
      * Execute a trade based on AI signal
      */
     pub fn execute_trade(
         ctx: Context<ExecuteTrade>,
         amount: u64,
         side: TradeSide,
         confidence: u8,
         strategy_id: u8
     ) -> Result<()> {
         let trading_state = &mut ctx.accounts.trading_state;
         let price_update = &ctx.accounts.price_update;
         
         // Ensure trading is not paused
         require!(!trading_state.paused, ErrorCode::TradingPaused);
         
         // Ensure the caller is the authorized authority
         require!(
             ctx.accounts.authority.key() == trading_state.authority,
             ErrorCode::Unauthorized
         );
         
         // For simplicity, we'll use SOL/USD price feed ID
         // In a real implementation, you'd validate the asset specifically
         let sol_usd_feed_id = get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")?;
         
         // Get the price from Pyth with a maximum age of 30 seconds
         let price_info = price_update.get_price_no_older_than(
             &Clock::get()?, 
             30,  // 30 seconds max age
             &sol_usd_feed_id
         )?;
         
         // Calculate scaled price (handle Pyth exponent)
         let price = price_info.price;
         let confidence_interval = price_info.conf;
         let exponent = price_info.exponent;
         
         // Log the price information
         msg!("Current price: {} ± {} * 10^{}", price, confidence_interval, exponent);
         
         // Validate the trade based on risk parameters
         // Higher confidence should be required for higher risk trades
         let min_confidence = match trading_state.risk_level {
             1..=3 => 80,   // Low risk: require high confidence
             4..=7 => 65,   // Medium risk
             _ => 50,       // High risk: accept lower confidence
         };
         
         require!(
             confidence >= min_confidence,
             ErrorCode::InsufficientConfidence
         );
         
         // Check if amount is within max position size
         require!(
             amount <= trading_state.max_position_size,
             ErrorCode::PositionTooLarge
         );
         
         // Record the trade
         trading_state.total_trades += 1;
         
         // Execute the trade logic based on side
         match side {
             TradeSide::Buy => {
                 msg!("Executing BUY trade for {} tokens", amount);
                 // Transfer tokens from source to destination
                 token::transfer(
                     CpiContext::new(
                         ctx.accounts.token_program.to_account_info(),
                         Transfer {
                             from: ctx.accounts.source_account.to_account_info(),
                             to: ctx.accounts.destination_account.to_account_info(),
                             authority: ctx.accounts.authority.to_account_info(),
                         },
                     ),
                     amount,
                 )?;
             },
             TradeSide::Sell => {
                 msg!("Executing SELL trade for {} tokens", amount);
                 // Transfer tokens from destination to source
                 token::transfer(
                     CpiContext::new(
                         ctx.accounts.token_program.to_account_info(),
                         Transfer {
                             from: ctx.accounts.destination_account.to_account_info(),
                             to: ctx.accounts.source_account.to_account_info(),
                             authority: ctx.accounts.authority.to_account_info(),
                         },
                     ),
                     amount,
                 )?;
             },
         }
         
         // Store trade record in account
         let trade_record = &mut ctx.accounts.trade_record;
         trade_record.authority = ctx.accounts.authority.key();
         trade_record.timestamp = Clock::get()?.unix_timestamp;
         trade_record.amount = amount;
         trade_record.side = side;
         trade_record.price = price;
         trade_record.confidence = confidence;
         trade_record.strategy_id = strategy_id;
         
         msg!("Trade executed successfully");
         Ok(())
     }
 
     /**
      * Update trading parameters
      */
     pub fn update_parameters(
         ctx: Context<UpdateParameters>,
         max_position_size: Option<u64>,
         risk_level: Option<u8>,
         paused: Option<bool>,
     ) -> Result<()> {
         let trading_state = &mut ctx.accounts.trading_state;
         
         // Ensure the caller is the authorized authority
         require!(
             ctx.accounts.authority.key() == trading_state.authority,
             ErrorCode::Unauthorized
         );
         
         // Update parameters if provided
         if let Some(size) = max_position_size {
             trading_state.max_position_size = size;
             msg!("Updated max position size: {}", size);
         }
         
         if let Some(level) = risk_level {
             require!(level <= 10, ErrorCode::InvalidRiskLevel);
             trading_state.risk_level = level;
             msg!("Updated risk level: {}", level);
         }
         
         if let Some(pause_state) = paused {
             trading_state.paused = pause_state;
             msg!("Trading {} paused", if pause_state { "is now" } else { "is no longer" });
         }
         
         Ok(())
     }
 
     /**
      * Update trade outcome
      */
     pub fn update_trade_outcome(
         ctx: Context<UpdateTradeOutcome>,
         trade_id: Pubkey,
         successful: bool,
         profit_loss: i64,
     ) -> Result<()> {
         let trading_state = &mut ctx.accounts.trading_state;
         let trade_record = &mut ctx.accounts.trade_record;
         
         // Ensure the caller is the authorized authority
         require!(
             ctx.accounts.authority.key() == trading_state.authority,
             ErrorCode::Unauthorized
         );
         
         // Ensure the trade record matches the provided ID
         require!(
             trade_record.key() == trade_id,
             ErrorCode::InvalidTradeRecord
         );
         
         // Update trade success status and profit/loss
         trade_record.successful = successful;
         trade_record.profit_loss = profit_loss;
         
         // Update trading state metrics
         if successful {
             trading_state.successful_trades += 1;
         }
         trading_state.total_profit_loss += profit_loss;
         
         msg!("Updated trade outcome: successful={}, profit/loss={}", successful, profit_loss);
         Ok(())
     }
 }
 
 /**
  * Context for initializing the trading system
  */
 #[derive(Accounts)]
 pub struct Initialize<'info> {
     #[account(
         init,
         payer = payer,
         space = 8 + TradingState::LEN
     )]
     pub trading_state: Account<'info, TradingState>,
     
     #[account(mut)]
     pub payer: Signer<'info>,
     
     pub system_program: Program<'info, System>,
 }
 
 /**
  * Context for executing a trade
  */
 #[derive(Accounts)]
 pub struct ExecuteTrade<'info> {
     #[account(mut)]
     pub trading_state: Account<'info, TradingState>,
     
     #[account(
         init,
         payer = authority,
         space = 8 + TradeRecord::LEN
     )]
     pub trade_record: Account<'info, TradeRecord>,
     
     #[account(mut)]
     pub source_account: Account<'info, TokenAccount>,
     
     #[account(mut)]
     pub destination_account: Account<'info, TokenAccount>,
     
     #[account(mut)]
     pub authority: Signer<'info>,
     
     /// Price update account from Pyth
     pub price_update: Account<'info, PriceUpdateV2>,
     
     pub token_program: Program<'info, Token>,
     pub system_program: Program<'info, System>,
 }
 
 /**
  * Context for updating trading parameters
  */
 #[derive(Accounts)]
 pub struct UpdateParameters<'info> {
     #[account(mut)]
     pub trading_state: Account<'info, TradingState>,
     
     #[account(mut)]
     pub authority: Signer<'info>,
     
     pub system_program: Program<'info, System>,
 }
 
 /**
  * Context for updating trade outcomes
  */
 #[derive(Accounts)]
 pub struct UpdateTradeOutcome<'info> {
     #[account(mut)]
     pub trading_state: Account<'info, TradingState>,
     
     #[account(mut)]
     pub trade_record: Account<'info, TradeRecord>,
     
     #[account(mut)]
     pub authority: Signer<'info>,
     
     pub system_program: Program<'info, System>,
 }
 
 /**
  * Trading state account data structure
  */
 #[account]
 pub struct TradingState {
     pub authority: Pubkey,           // Authority allowed to manage trading
     pub initialized: bool,           // Whether the system is initialized
     pub paused: bool,                // Whether trading is paused
     pub max_position_size: u64,      // Maximum position size in tokens
     pub risk_level: u8,              // Risk level (1-10)
     pub total_trades: u64,           // Total number of trades executed
     pub successful_trades: u64,      // Number of successful trades
     pub total_profit_loss: i64,      // Total profit/loss in basis points
 }
 
 impl TradingState {
     pub const LEN: usize = 32 + 1 + 1 + 8 + 1 + 8 + 8 + 8;
 }
 
 /**
  * Trade record account data structure
  */
 #[account]
 pub struct TradeRecord {
     pub authority: Pubkey,           // The authority that executed the trade
     pub timestamp: i64,              // Timestamp of the trade
     pub amount: u64,                 // Amount of tokens in the trade
     pub side: TradeSide,             // Buy or sell
     pub price: i64,                  // Price at execution
     pub confidence: u8,              // AI confidence level
     pub strategy_id: u8,             // ID of the strategy used
     pub successful: bool,            // Whether the trade was successful
     pub profit_loss: i64,            // Profit/loss from the trade in basis points
 }
 
 impl TradeRecord {
     pub const LEN: usize = 32 + 8 + 8 + 1 + 8 + 1 + 1 + 1 + 8;
 }
 
 /**
  * Trade side enum
  */
 #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
 pub enum TradeSide {
     Buy,
     Sell,
 }
 
 /**
  * Error codes
  */
 #[error_code]
 pub enum ErrorCode {
     #[msg("Trading is currently paused")]
     TradingPaused,
     
     #[msg("Unauthorized: only the authority can perform this action")]
     Unauthorized,
     
     #[msg("AI confidence is insufficient for trading")]
     InsufficientConfidence,
     
     #[msg("Position size exceeds the maximum allowed")]
     PositionTooLarge,
     
     #[msg("Risk level must be between 1 and 10")]
     InvalidRiskLevel,
     
     #[msg("Invalid trade record")]
     InvalidTradeRecord,
 }
 
 /**
  * Helper function to parse a hex string price feed ID
  */
 fn get_feed_id_from_hex(hex_string: &str) -> Result<[u8; 32]> {
     let hex_string = hex_string.strip_prefix("0x").unwrap_or(hex_string);
     let mut result = [0u8; 32];
     
     for (i, byte) in hex::decode(hex_string)
         .map_err(|_| error!(ErrorCode::InvalidTradeRecord))?
         .into_iter()
         .enumerate()
         .take(32)
     {
         result[i] = byte;
     }
     
     Ok(result)
 }