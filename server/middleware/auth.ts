import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import { validateSignature } from '../utils/validation';

/**
 * Authentication middleware for Solana wallet-based authentication
 * Verifies that the request contains a valid signature from the wallet
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    // Format: "Bearer {walletAddress}:{signature}:{message}"
    const [bearer, authData] = authHeader.split(' ');
    
    if (bearer !== 'Bearer' || !authData) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }
    
    const [walletAddress, signature, message] = authData.split(':');
    
    if (!walletAddress || !signature || !message) {
      return res.status(401).json({ error: 'Invalid authorization data format' });
    }
    
    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid wallet address' });
    }
    
    // Verify signature
    const isValid = await validateSignature(walletAddress, signature, message);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Attach user data to request for use in route handlers
    req.user = {
      walletAddress
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};