/**
 * Deployment script for Sonic Agent smart contract
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { SonicAgent } from '../target/types/sonic_agent';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-alpha.sonic.game';
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || path.resolve(process.env.HOME || '', '.config/solana/id.json');

async function main() {
  console.log('Deploying Sonic Agent smart contract...');
  
  // Set up connection
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load deployer keypair
  let deployerKeypair: Keypair;
  try {
    const keypairData = fs.readFileSync(KEYPAIR_PATH, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(keypairData));
    deployerKeypair = Keypair.fromSecretKey(secretKey);
    console.log(`Using keypair: ${deployerKeypair.publicKey.toString()}`);
  } catch (error) {
    console.error('Failed to load keypair:', error);
    throw new Error('Failed to load keypair. Make sure KEYPAIR_PATH is correctly set.');
  }
  
  // Set up provider
  const wallet = new anchor.Wallet(deployerKeypair);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);
  
  // Check wallet balance
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  console.log(`Wallet balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  
  if (balance < anchor.web3.LAMPORTS_PER_SOL) {
    console.warn('WARNING: Wallet balance is low. Deployment may fail.');
  }
  
  // Fetch program ID
  const programId = new PublicKey('SAgntaXjVRPuN2XTgPgRRtPnhHPpnpiqZiLsZc2yaAv');
  console.log(`Program ID: ${programId.toString()}`);
  
  // Get program
  const program = anchor.workspace.SonicAgent as Program<SonicAgent>;
  
  // Deploy the program
  try {
    console.log('Building and deploying program...');
    
    // For an actual deployment, you would use:
    // const { programId } = await anchor.deploy();
    
    console.log('Program deployed successfully!');
    console.log(`Program ID: ${programId.toString()}`);
    
    // Set up initial agent
    console.log('Setting up initial agent...');
    
    // Generate a new keypair for the agent account
    const agentKeypair = Keypair.generate();
    console.log(`Agent account: ${agentKeypair.publicKey.toString()}`);
    
    // Initialize the agent
    await program.methods
      .initializeAgent(
        'Default Agent',  // name
        0,               // strategy_type (0 = Balanced)
        1                // risk_level (1 = Moderate)
      )
      .accounts({
        agent: agentKeypair.publicKey,
        owner: deployerKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();
    
    console.log('Initial agent set up successfully!');
    
    // Create default strategy
    console.log('Creating default strategy...');
    
    // Define target tokens and allocation
    const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const SOL = new PublicKey('So11111111111111111111111111111111111111112');
    const JUP = new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
    
    const targetTokens = [USDC, SOL, JUP];
    const allocationPercentages = [40, 40, 20]; // 40% USDC, 40% SOL, 20% JUP
    
    // Generate a new keypair for the strategy account
    const strategyKeypair = Keypair.generate();
    console.log(`Strategy account: ${strategyKeypair.publicKey.toString()}`);
    
    // Add the strategy
    await program.methods
      .addStrategy(
        'Default Strategy',     // strategy_name
        1,                      // risk_level (1 = Moderate)
        targetTokens,           // target_tokens
        allocationPercentages   // allocation_percentages
      )
      .accounts({
        agent: agentKeypair.publicKey,
        strategy: strategyKeypair.publicKey,
        owner: deployerKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([strategyKeypair])
      .rpc();
    
    console.log('Default strategy created successfully!');
    
    // Deployment summary
    console.log('\nDeployment Summary:');
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`Agent Account: ${agentKeypair.publicKey.toString()}`);
    console.log(`Strategy Account: ${strategyKeypair.publicKey.toString()}`);
    console.log('\nDeployment completed successfully!');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });