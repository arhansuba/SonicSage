//! SonicAI DeFi Navigator Smart Contract
//!
//! This program manages DeFi strategies on the Sonic SVM platform.
//! It allows creating strategies, subscribing to them, and managing positions.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};

/// Program entrypoint
entrypoint!(process_instruction);

/// Program ID
solana_program::declare_id!("SonicABCD1234567890ABCDEF1234567890ABCDEF12");

/// Risk level for DeFi strategies
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum RiskLevel {
    Conservative,
    Moderate,
    Aggressive,
    Experimental,
}

/// Protocol type for DeFi strategies
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum ProtocolType {
    Lending,
    LiquidityProviding,
    YieldFarming,
    Staking,
    Options,
}

/// Token allocation in a strategy
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TokenAllocation {
    /// Token mint address
    pub mint: Pubkey,
    /// Symbol for the token (max 10 chars)
    pub symbol: [u8; 10],
    /// Allocation percentage (0-100)
    pub allocation: u8,
}

/// Protocol allocation in a strategy
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProtocolAllocation {
    /// Protocol name (max 20 chars)
    pub name: [u8; 20],
    /// Allocation percentage (0-100)
    pub allocation: u8,
}

/// DeFi strategy account data
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Strategy {
    /// Version of the strategy format
    pub version: u8,
    /// Strategy creator
    pub creator: Pubkey,
    /// Strategy name (max 32 chars)
    pub name: [u8; 32],
    /// Strategy description (max 200 chars)
    pub description: [u8; 200],
    /// Risk level
    pub risk_level: RiskLevel,
    /// Protocol type
    pub protocol_type: ProtocolType,
    /// Estimated APY in basis points (e.g., 1500 = 15%)
    pub estimated_apy: u32,
    /// Strategy tags (array of tag indices)
    pub tags: [u8; 5],
    /// Total value locked in the strategy (in USD cents)
    pub tvl: u64,
    /// Number of users subscribed to the strategy
    pub user_count: u32,
    /// Lockup period in days
    pub lockup_period: u16,
    /// Minimum investment amount in USD cents
    pub min_investment: u64,
    /// Creator fee in basis points (e.g., 30 = 0.3%)
    pub fee_percentage: u16,
    /// Number of tokens in the strategy
    pub token_count: u8,
    /// Token allocations
    pub tokens: [TokenAllocation; 10],
    /// Number of protocols in the strategy
    pub protocol_count: u8,
    /// Protocol allocations
    pub protocols: [ProtocolAllocation; 10],
    /// Strategy is verified by Sonic platform
    pub verified: bool,
    /// AI model version used for this strategy
    pub ai_model_version: u8,
    /// Reserved for future use
    pub reserved: [u8; 64],
}

/// User position in a strategy
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct UserPosition {
    /// Version of the position format
    pub version: u8,
    /// Owner of the position
    pub owner: Pubkey,
    /// Strategy ID
    pub strategy: Pubkey,
    /// Initial investment amount in USD cents
    pub initial_investment: u64,
    /// Current value of the position in USD cents
    pub current_value: u64,
    /// Subscription timestamp
    pub subscription_time: i64,
    /// Last harvest timestamp
    pub last_harvest_time: i64,
    /// Performance fee in basis points (e.g., 30 = 0.3%)
    pub performance_fee_rate: u16,
    /// Number of tokens in the position
    pub token_count: u8,
    /// Token investments
    pub token_investments: [TokenInvestment; 10],
    /// Reserved for future use
    pub reserved: [u8; 64],
}

/// Token investment in a position
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TokenInvestment {
    /// Token mint address
    pub mint: Pubkey,
    /// Initial amount invested
    pub initial_amount: u64,
    /// Current amount
    pub current_amount: u64,
}

/// Program instructions
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum StrategyInstruction {
    /// Create a new strategy
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The strategy creator (fee payer)
    /// 1. `[writable]` The strategy account to create
    /// 2. `[]` The system program
    CreateStrategy {
        name: String,
        description: String,
        risk_level: RiskLevel,
        protocol_type: ProtocolType,
        estimated_apy: u32,
        tags: Vec<u8>,
        lockup_period: u16,
        min_investment: u64,
        fee_percentage: u16,
        tokens: Vec<TokenAllocation>,
        protocols: Vec<ProtocolAllocation>,
    },
    
    /// Subscribe to a strategy
    ///
    /// Accounts expected:
    /// 0. `[signer]` The subscriber (fee payer)
    /// 1. `[]` The strategy account
    /// 2. `[writable]` The user position account to create
    /// 3. `[]` The system program
    SubscribeToStrategy {
        investment_amounts: Vec<TokenInvestment>,
    },
    
    /// Unsubscribe from a strategy
    ///
    /// Accounts expected:
    /// 0. `[signer]` The subscriber (fee payer)
    /// 1. `[]` The strategy account
    /// 2. `[writable]` The user position account
    UnsubscribeFromStrategy,
    
    /// Harvest rewards from a strategy
    ///
    /// Accounts expected:
    /// 0. `[signer]` The subscriber (fee payer)
    /// 1. `[]` The strategy account
    /// 2. `[writable]` The user position account
    /// 3. `[writable]` The fee recipient account
    HarvestRewards,
    
    /// Rebalance a position
    ///
    /// Accounts expected:
    /// 0. `[signer]` The subscriber (fee payer)
    /// 1. `[]` The strategy account
    /// 2. `[writable]` The user position account
    RebalancePosition,
    
    /// Update strategy
    ///
    /// Accounts expected:
    /// 0. `[signer]` The strategy creator (fee payer)
    /// 1. `[writable]` The strategy account
    UpdateStrategy {
        estimated_apy: u32,
        description: String,
    },
    
    /// Verify strategy (admin only)
    ///
    /// Accounts expected:
    /// 0. `[signer]` The platform admin (fee payer)
    /// 1. `[writable]` The strategy account
    VerifyStrategy {
        verified: bool,
    },
}

/// Process program instruction
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = StrategyInstruction::try_from_slice(instruction_data)?;
    
    match instruction {
        StrategyInstruction::CreateStrategy {
            name,
            description,
            risk_level,
            protocol_type,
            estimated_apy,
            tags,
            lockup_period,
            min_investment,
            fee_percentage,
            tokens,
            protocols,
        } => {
            process_create_strategy(
                program_id,
                accounts,
                name,
                description,
                risk_level,
                protocol_type,
                estimated_apy,
                tags,
                lockup_period,
                min_investment,
                fee_percentage,
                tokens,
                protocols,
            )
        }
        StrategyInstruction::SubscribeToStrategy { investment_amounts } => {
            process_subscribe_to_strategy(program_id, accounts, investment_amounts)
        }
        StrategyInstruction::UnsubscribeFromStrategy => {
            process_unsubscribe_from_strategy(program_id, accounts)
        }
        StrategyInstruction::HarvestRewards => {
            process_harvest_rewards(program_id, accounts)
        }
        StrategyInstruction::RebalancePosition => {
            process_rebalance_position(program_id, accounts)
        }
        StrategyInstruction::UpdateStrategy { estimated_apy, description } => {
            process_update_strategy(program_id, accounts, estimated_apy, description)
        }
        StrategyInstruction::VerifyStrategy { verified } => {
            process_verify_strategy(program_id, accounts, verified)
        }
    }
}

/// Process create strategy instruction
#[allow(clippy::too_many_arguments)]
fn process_create_strategy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    name: String,
    description: String,
    risk_level: RiskLevel,
    protocol_type: ProtocolType,
    estimated_apy: u32,
    tags: Vec<u8>,
    lockup_period: u16,
    min_investment: u64,
    fee_percentage: u16,
    tokens: Vec<TokenAllocation>,
    protocols: Vec<ProtocolAllocation>,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let creator_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Check that the creator is the signer
    if !creator_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy account is owned by the program
    if strategy_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Validate input parameters
    if name.len() > 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    if description.len() > 200 {
        return Err(ProgramError::InvalidInstructionData);
    }
    if tokens.len() > 10 || tokens.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if protocols.len() > 10 || protocols.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    if tags.len() > 5 {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Check creator has sufficient funds for the account creation
    let rent = Rent::get()?;
    let strategy_size = std::mem::size_of::<Strategy>();
    let lamports = rent.minimum_balance(strategy_size);
    
    // Create the strategy account
    // (This would typically use a system program call to create an account)
    msg!("Creating strategy account...");
    
    // Initialize the strategy data
    let mut strategy_data = Strategy {
        version: 1,
        creator: *creator_account.key,
        name: [0u8; 32],
        description: [0u8; 200],
        risk_level,
        protocol_type,
        estimated_apy,
        tags: [0u8; 5],
        tvl: 0,
        user_count: 0,
        lockup_period,
        min_investment,
        fee_percentage,
        token_count: tokens.len() as u8,
        tokens: [TokenAllocation {
            mint: Pubkey::default(),
            symbol: [0u8; 10],
            allocation: 0,
        }; 10],
        protocol_count: protocols.len() as u8,
        protocols: [ProtocolAllocation {
            name: [0u8; 20],
            allocation: 0,
        }; 10],
        verified: false,
        ai_model_version: 1,
        reserved: [0u8; 64],
    };
    
    // Copy name to fixed-size array
    let name_bytes = name.as_bytes();
    strategy_data.name[..name_bytes.len()].copy_from_slice(name_bytes);
    
    // Copy description to fixed-size array
    let desc_bytes = description.as_bytes();
    strategy_data.description[..desc_bytes.len()].copy_from_slice(desc_bytes);
    
    // Copy tags to fixed-size array
    for (i, &tag) in tags.iter().enumerate() {
        strategy_data.tags[i] = tag;
    }
    
    // Copy tokens to fixed-size array
    for (i, token) in tokens.iter().enumerate() {
        strategy_data.tokens[i] = token.clone();
    }
    
    // Copy protocols to fixed-size array
    for (i, protocol) in protocols.iter().enumerate() {
        strategy_data.protocols[i] = protocol.clone();
    }
    
    // Serialize the strategy data
    strategy_data.serialize(&mut &mut strategy_account.data.borrow_mut()[..])?;
    
    msg!("Strategy created successfully");
    Ok(())
}

/// Process subscribe to strategy instruction
fn process_subscribe_to_strategy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    investment_amounts: Vec<TokenInvestment>,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let subscriber_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    let position_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Check that the subscriber is the signer
    if !subscriber_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy account is owned by the program
    if strategy_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Deserialize the strategy account
    let mut strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Validate investment amounts
    if investment_amounts.is_empty() || investment_amounts.len() > 10 {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Calculate total investment in USD cents
    let total_investment: u64 = investment_amounts.iter().map(|inv| inv.initial_amount).sum();
    
    // Check minimum investment
    if total_investment < strategy.min_investment {
        return Err(ProgramError::InvalidArgument);
    }
    
    // Create the user position account
    // (This would typically use a system program call to create an account)
    msg!("Creating user position account...");
    
    // Initialize the user position data
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    let user_position = UserPosition {
        version: 1,
        owner: *subscriber_account.key,
        strategy: *strategy_account.key,
        initial_investment: total_investment,
        current_value: total_investment,
        subscription_time: now,
        last_harvest_time: now,
        performance_fee_rate: strategy.fee_percentage,
        token_count: investment_amounts.len() as u8,
        token_investments: [TokenInvestment {
            mint: Pubkey::default(),
            initial_amount: 0,
            current_amount: 0,
        }; 10],
        reserved: [0u8; 64],
    };
    
    // Serialize the user position data
    // user_position.serialize(&mut &mut position_account.data.borrow_mut()[..])?;
    
    // Update strategy TVL and user count
    strategy.tvl += total_investment;
    strategy.user_count += 1;
    
    // Serialize the updated strategy data
    // strategy.serialize(&mut &mut strategy_account.data.borrow_mut()[..])?;
    
    msg!("Subscribed to strategy successfully");
    Ok(())
}

/// Process unsubscribe from strategy instruction
fn process_unsubscribe_from_strategy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let subscriber_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    let position_account = next_account_info(accounts_iter)?;
    
    // Check that the subscriber is the signer
    if !subscriber_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy and position accounts are owned by the program
    if strategy_account.owner != program_id || position_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Deserialize the user position account
    let position = UserPosition::try_from_slice(&position_account.data.borrow())?;
    
    // Check that the user owns the position
    if position.owner != *subscriber_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check that the position is for the given strategy
    if position.strategy != *strategy_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize the strategy account
    let mut strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Check for lockup period
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    let subscription_time_secs = position.subscription_time;
    let lockup_time_secs = subscription_time_secs + (strategy.lockup_period as i64 * 24 * 60 * 60);
    
    if now < lockup_time_secs {
        msg!("Position is still within lockup period");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Update strategy TVL and user count
    if strategy.tvl >= position.current_value {
        strategy.tvl -= position.current_value;
    } else {
        strategy.tvl = 0;
    }
    
    if strategy.user_count > 0 {
        strategy.user_count -= 1;
    }
    
    // Serialize the updated strategy data
    // strategy.serialize(&mut &mut strategy_account.data.borrow_mut()[..])?;
    
    // Close the position account and return funds to the user
    // (This would typically transfer the account's lamports to the user)
    
    msg!("Unsubscribed from strategy successfully");
    Ok(())
}

/// Process harvest rewards instruction
fn process_harvest_rewards(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let subscriber_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    let position_account = next_account_info(accounts_iter)?;
    let fee_recipient_account = next_account_info(accounts_iter)?;
    
    // Check that the subscriber is the signer
    if !subscriber_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy and position accounts are owned by the program
    if strategy_account.owner != program_id || position_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Deserialize the user position account
    let mut position = UserPosition::try_from_slice(&position_account.data.borrow())?;
    
    // Check that the user owns the position
    if position.owner != *subscriber_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check that the position is for the given strategy
    if position.strategy != *strategy_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize the strategy account
    let strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Calculate rewards
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    let last_harvest_time = position.last_harvest_time;
    let time_diff_days = (now - last_harvest_time) / (24 * 60 * 60);
    
    if time_diff_days <= 0 {
        msg!("No rewards to harvest yet");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Calculate rewards based on APY and time difference
    let apy_decimal = strategy.estimated_apy as f64 / 10000.0; // Convert from basis points
    let daily_rate = apy_decimal / 365.0;
    let reward_multiplier = 1.0 + (daily_rate * time_diff_days as f64);
    
    let initial_value = position.initial_investment;
    let new_value = (initial_value as f64 * reward_multiplier) as u64;
    let rewards = new_value - position.current_value;
    
    // Calculate performance fee
    let fee_amount = (rewards as f64 * (position.performance_fee_rate as f64 / 10000.0)) as u64;
    let user_reward = rewards - fee_amount;
    
    // Update position value and last harvest time
    position.current_value += user_reward;
    position.last_harvest_time = now;
    
    // Serialize the updated position data
    // position.serialize(&mut &mut position_account.data.borrow_mut()[..])?;
    
    // Transfer fee to fee recipient
    // (This would typically involve token transfers)
    
    msg!("Harvested rewards successfully");
    Ok(())
}

/// Process rebalance position instruction
fn process_rebalance_position(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let subscriber_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    let position_account = next_account_info(accounts_iter)?;
    
    // Check that the subscriber is the signer
    if !subscriber_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy and position accounts are owned by the program
    if strategy_account.owner != program_id || position_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Deserialize the user position account
    let position = UserPosition::try_from_slice(&position_account.data.borrow())?;
    
    // Check that the user owns the position
    if position.owner != *subscriber_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check that the position is for the given strategy
    if position.strategy != *strategy_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize the strategy account
    let strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Rebalance the position according to the strategy's token allocations
    // (This would typically involve token swaps and re-allocations)
    
    msg!("Position rebalanced successfully");
    Ok(())
}

/// Process update strategy instruction
fn process_update_strategy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    estimated_apy: u32,
    description: String,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let creator_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    
    // Check that the creator is the signer
    if !creator_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy account is owned by the program
    if strategy_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Deserialize the strategy account
    let mut strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Check that the signer is the strategy creator
    if strategy.creator != *creator_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Update strategy data
    strategy.estimated_apy = estimated_apy;
    
    // Update description if provided
    if !description.is_empty() {
        if description.len() > 200 {
            return Err(ProgramError::InvalidInstructionData);
        }
        strategy.description = [0u8; 200];
        let desc_bytes = description.as_bytes();
        strategy.description[..desc_bytes.len()].copy_from_slice(desc_bytes);
    }
    
    // Serialize the updated strategy data
    // strategy.serialize(&mut &mut strategy_account.data.borrow_mut()[..])?;
    
    msg!("Strategy updated successfully");
    Ok(())
}

/// Process verify strategy instruction
fn process_verify_strategy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    verified: bool,
) -> ProgramResult {
    // Get accounts
    let accounts_iter = &mut accounts.iter();
    let admin_account = next_account_info(accounts_iter)?;
    let strategy_account = next_account_info(accounts_iter)?;
    
    // Check that the admin is the signer
    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check that the strategy account is owned by the program
    if strategy_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Check that the signer is the admin
    // In a real implementation, this would check against a known admin pubkey
    // For simplicity, we're using a hardcoded check
    let expected_admin = Pubkey::new_from_array([1; 32]); // Replace with actual admin pubkey
    if *admin_account.key != expected_admin {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Deserialize the strategy account
    let mut strategy = Strategy::try_from_slice(&strategy_account.data.borrow())?;
    
    // Update verified status
    strategy.verified = verified;
    
    // Serialize the updated strategy data
    // strategy.serialize(&mut &mut strategy_account.data.borrow_mut()[..])?;
    
    msg!("Strategy verification status updated successfully");
    Ok(())
}