// server/routes/priceAlertRoutes.ts

import express from 'express';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program, web3, BN } from '@coral-xyz/anchor';
import { verify } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Require authentication for all routes
router.use(verify);

// Load program IDL
const idlPath = path.join(__dirname, '../../idl/sonic_agent.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const programId = new PublicKey(process.env.PROGRAM_ID || '');

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

/**
 * Create a new price alert
 * POST /api/price-alerts
 */
router.post('/', async (req, res) => {
  try {
    const { token, threshold, direction, notifyEmail, notifyBrowser } = req.body;
    const walletAddress = req.user.walletAddress;

    // Validate required parameters
    if (!token || !threshold || direction === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Parse threshold to ensure it's a valid number
    const thresholdValue = parseFloat(threshold);
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid threshold value' 
      });
    }

    // Validate token is a valid Solana address
    let tokenAddress: PublicKey;
    try {
      tokenAddress = new PublicKey(token);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token address' 
      });
    }

    // Create keypair for the price alert account
    const alertKeypair = Keypair.generate();

    // Create provider with payer (this would be your server wallet in production)
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]'))
    );
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx: web3.Transaction) => {
        tx.partialSign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs: web3.Transaction[]) => {
        return txs.map(tx => {
          tx.partialSign(walletKeypair);
          return tx;
        });
      },
    };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    // Initialize program
    const program = new Program(idl, programId, provider);

    // Convert threshold to BN with appropriate decimals (assuming 9 decimals)
    const thresholdBN = new BN(Math.floor(thresholdValue * 1e9));

    // Find PDA for user's price alerts
    const [priceAlertsPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('price_alerts'),
        new PublicKey(walletAddress).toBuffer(),
      ],
      programId
    );

    // Check if PDA exists, if not, initialize it first
    let priceAlertsAccount;
    try {
      priceAlertsAccount = await program.account.userPriceAlerts.fetch(priceAlertsPDA);
    } catch (error) {
      // Initialize price alerts account
      await program.methods
        .initializePriceAlerts()
        .accounts({
          user: new PublicKey(walletAddress),
          priceAlerts: priceAlertsPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([walletKeypair])
        .rpc();
      
      // Fetch the newly created account
      priceAlertsAccount = await program.account.userPriceAlerts.fetch(priceAlertsPDA);
    }

    // Create price alert
    const createAlertTx = await program.methods
      .createPriceAlert(
        tokenAddress,
        thresholdBN,
        direction,
        notifyEmail || false,
        notifyBrowser || false
      )
      .accounts({
        user: new PublicKey(walletAddress),
        priceAlerts: priceAlertsPDA,
        priceAlert: alertKeypair.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([walletKeypair, alertKeypair])
      .rpc();

    // Return success response with transaction ID
    return res.status(201).json({
      success: true,
      message: 'Price alert created successfully',
      data: {
        alertId: alertKeypair.publicKey.toString(),
        transaction: createAlertTx,
      }
    });
  } catch (error) {
    console.error('Error creating price alert:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create price alert',
      error: error.toString()
    });
  }
});

/**
 * Get all price alerts for the authenticated user
 * GET /api/price-alerts
 */
router.get('/', async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress;

    // Find PDA for user's price alerts
    const [priceAlertsPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('price_alerts'),
        new PublicKey(walletAddress).toBuffer(),
      ],
      programId
    );

    // Initialize provider and program (read-only)
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: new PublicKey(walletAddress),
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      },
      { commitment: 'confirmed' }
    );
    
    const program = new Program(idl, programId, provider);

    // Check if the user has initialized price alerts
    let priceAlerts = [];
    try {
      const priceAlertsAccount = await program.account.userPriceAlerts.fetch(priceAlertsPDA);
      
      // Process alerts with additional token information if available
      if (priceAlertsAccount.alerts && priceAlertsAccount.alerts.length > 0) {
        // In a real app, you would fetch token metadata from a token registry
        // For simplicity, we're just returning the raw data
        priceAlerts = priceAlertsAccount.alerts.map(alert => ({
          id: alert.id.toString(),
          token: alert.token.toString(),
          threshold: (alert.threshold.toNumber() / 1e9).toString(), // Convert from smallest units
          direction: alert.direction,
          createdAt: alert.createdAt.toNumber(),
          triggered: alert.triggered,
          notifyEmail: alert.notifyEmail,
          notifyBrowser: alert.notifyBrowser
        }));
      }
    } catch (error) {
      // If account doesn't exist, return empty array
      console.log('User has no price alerts or account not initialized');
    }

    return res.status(200).json({
      success: true,
      data: priceAlerts
    });
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch price alerts',
      error: error.toString()
    });
  }
});

/**
 * Delete a price alert
 * DELETE /api/price-alerts/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const walletAddress = req.user.walletAddress;

    // Validate ID is a valid Solana address
    let alertId: PublicKey;
    try {
      alertId = new PublicKey(id);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid alert ID' 
      });
    }

    // Find PDA for user's price alerts
    const [priceAlertsPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('price_alerts'),
        new PublicKey(walletAddress).toBuffer(),
      ],
      programId
    );

    // Create provider with payer
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]'))
    );
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx: web3.Transaction) => {
        tx.partialSign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs: web3.Transaction[]) => {
        return txs.map(tx => {
          tx.partialSign(walletKeypair);
          return tx;
        });
      },
    };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    // Initialize program
    const program = new Program(idl, programId, provider);

    // Delete price alert
    const deleteTx = await program.methods
      .deletePriceAlert(alertId)
      .accounts({
        user: new PublicKey(walletAddress),
        priceAlerts: priceAlertsPDA,
      })
      .signers([walletKeypair])
      .rpc();

    return res.status(200).json({
      success: true,
      message: 'Price alert deleted successfully',
      data: {
        transaction: deleteTx
      }
    });
  } catch (error) {
    console.error('Error deleting price alert:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete price alert',
      error: error.toString()
    });
  }
});

export default router;