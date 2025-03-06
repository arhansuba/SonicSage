/**
 * SonicAgent API Server
 * Main entry point for the Express server
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { ServiceFactory } from '../src/services/ServiceFactory';
import apiRoutes from './routes/apiRoutes';

// Load environment variables
dotenv.config();

// Initialize the services
const serviceFactory = new ServiceFactory();

// Initialize Express app
const app: Express = express();
const port = process.env.PORT || 5000;

// Apply security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGIN || 'https://sonicagent.app' 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Apply rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Register API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Uncaught exception:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// Create HTTP server
const server = createServer(app);

// Initialize services before starting the server
serviceFactory.initialize().then(() => {
  // Start the server
  server.listen(port, () => {
    console.log(`⚡️ Server is running at http://localhost:${port}`);
    console.log(`✅ Health check available at http://localhost:${port}/health`);
    console.log(`🔒 API endpoints secured with authentication`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  function gracefulShutdown() {
    console.log('🛑 Shutting down server gracefully...');
    
    server.close(() => {
      console.log('👋 HTTP server closed');
      // Clean up resources
      serviceFactory.shutdown().then(() => {
        console.log('🧹 All services shut down properly');
        process.exit(0);
      }).catch(err => {
        console.error('❌ Error during service shutdown:', err);
        process.exit(1);
      });
    });
    
    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('⚠️ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
}).catch(err => {
  console.error('❌ Failed to initialize services:', err);
  process.exit(1);
});

export { app, serviceFactory };