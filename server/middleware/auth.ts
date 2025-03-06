/**
 * Authentication middleware for API routes
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT secret from environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'sonic-agent-development-secret';

// Error class for authentication errors
export class AuthError extends Error {
  statusCode: number;
  code: string;
  
  constructor(message: string, statusCode = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AuthError';
  }
}

// Interface for JWT payload
interface JwtPayload {
  walletAddress: string;
  exp: number;
}

/**
 * Authentication middleware to verify JWT token
 */
export const authenticateRequest = (req: Request, res: Response, next: NextFunction) => {
  // Check if authentication is disabled for development
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    return next();
  }
  
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Authorization header missing or invalid');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AuthError('JWT token missing');
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // Add wallet address to request
    (req as any).walletAddress = decoded.walletAddress;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Generate JWT token for wallet address
 */
export const generateToken = (walletAddress: string, expiresIn = '24h'): string => {
  return jwt.sign({ walletAddress }, JWT_SECRET, { expiresIn });
};

/**
 * Verify wallet ownership using signed message
 * This would normally verify a signed message against the wallet address
 * For this example, we're just returning true
 */
export const verifyWalletOwnership = async (
  walletAddress: string,
  signedMessage: string,
  message: string
): Promise<boolean> => {
  // In a real implementation, this would verify the signature
  // For this example, we're just returning true
  return true;
};