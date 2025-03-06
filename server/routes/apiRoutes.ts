// apiRoutes.ts - API routes for the server-side implementation

import express, { Request, Response } from 'express';
import { ServiceFactory } from '../services/ServiceFactory';
import { authenticateRequest } from '../middleware/auth';

// Create a router
const router = express.Router();

// Create service factory instance
const serviceFactory = ServiceFactory.create({
  privateKey: process.env.SERVICE_WALLET_PRIVATE_KEY,
  rpcUrl: process.env.SONIC_RPC_URL || 'https://api.mainnet-alpha.sonic.game',
  openAiApiKey: process.env.OPENAI_API_KEY
});

// Initialize services on startup
(async () => {
  try {
    await serviceFactory.initialize();
    console.log('API services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize API services:', error);
  }
})();

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Market data endpoints
 */
router.get('/market/stats', async (req: Request, res: Response) => {
  try {
    const marketDataService = serviceFactory.getMarketDataService();
    const stats = marketDataService.getMarketStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching market stats:', error);
    res.status(500).json({ error: 'Failed to fetch market stats' });
  }
});

router.get('/market/prices', async (req: Request, res: Response) => {
  try {
    const { addresses } = req.query;
    const marketDataService = serviceFactory.getMarketDataService();
    
    if (addresses && typeof addresses === 'string') {
      // Get prices for specific tokens
      const addressList = addresses.split(',');
      const prices = marketDataService.getTokenPrices(addressList);
      res.status(200).json(prices);
    } else {
      // Get all prices
      const allPrices = marketDataService.getAllTokenPrices();
      res.status(200).json(allPrices);
    }
  } catch (error) {
    console.error('Error fetching token prices:', error);
    res.status(500).json({ error: 'Failed to fetch token prices' });
  }
});

/**
 * Portfolio endpoints
 */
router.get('/portfolio/:walletAddress', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { riskProfile = 'moderate' } = req.query;
    
    const portfolioRebalancer = serviceFactory.getPortfolioRebalancer();
    
    // Get target allocation based on risk profile
    const targetAllocation = await portfolioRebalancer.getDefaultAllocation(
      riskProfile as 'conservative' | 'moderate' | 'aggressive'
    );
    
    // Get current portfolio
    const portfolio = await portfolioRebalancer.getCurrentPortfolio(targetAllocation);
    
    res.status(200).json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.post('/portfolio/rebalance', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { walletAddress, riskProfile = 'moderate', useAI = true, threshold = 5 } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const portfolioRebalancer = serviceFactory.getPortfolioRebalancer();
    
    // Execute portfolio rebalance
    const result = await portfolioRebalancer.rebalancePortfolio(
      riskProfile as 'conservative' | 'moderate' | 'aggressive',
      useAI,
      threshold
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error rebalancing portfolio:', error);
    res.status(500).json({ error: 'Failed to rebalance portfolio' });
  }
});

/**
 * Trading recommendation endpoints
 */
router.get('/recommendations/:walletAddress', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { riskProfile = 'moderate' } = req.query;
    
    const tradingStrategy = serviceFactory.getTradingStrategy();
    
    // Get trade recommendation
    const recommendation = await tradingStrategy.getTradeRecommendation(
      riskProfile as 'conservative' | 'moderate' | 'aggressive'
    );
    
    res.status(200).json(recommendation);
  } catch (error) {
    console.error('Error getting trade recommendations:', error);
    res.status(500).json({ error: 'Failed to get trade recommendations' });
  }
});

router.post('/trade/execute', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { inputToken, outputToken, amount, walletAddress } = req.body;
    
    if (!inputToken || !outputToken || !amount || !walletAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const tradingStrategy = serviceFactory.getTradingStrategy();
    
    // Execute trade
    const signature = await tradingStrategy.executeTrade({
      inputToken,
      outputToken,
      amount,
      expectedOutput: '0', // Will be calculated by Jupiter
      confidence: 1,
      reasoning: 'Manual trade execution'
    });
    
    res.status(200).json({ success: true, signature });
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

/**
 * Token information endpoints
 */
router.get('/tokens/info/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const jupiterService = serviceFactory.getJupiterService();
    
    const tokenInfo = await jupiterService.getTokenInfo(address);
    res.status(200).json(tokenInfo);
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({ error: 'Failed to fetch token info' });
  }
});

router.get('/tokens/verified', async (req: Request, res: Response) => {
  try {
    const jupiterService = serviceFactory.getJupiterService();
    const verifiedTokens = await jupiterService.getVerifiedTokens();
    res.status(200).json(verifiedTokens);
  } catch (error) {
    console.error('Error fetching verified tokens:', error);
    res.status(500).json({ error: 'Failed to fetch verified tokens' });
  }
});

export default router;