import express, { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { HermesClient } from '@pythnetwork/hermes-client';
import { validateWalletAddress, validateTokenAddress } from '../utils/validation';
import { authenticateRequest } from '../middleware/auth';
import { ServiceFactory } from '@/services/ServiceFactory';

// Create a router
const router = express.Router();

// Initialize Hermes client for Pyth price feeds
const hermesClient = new HermesClient('https://hermes.pyth.network', {});

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
    const connection = req.connection;
    const recentPerformance = await connection.getRecentPerformance(10);
    const slot = await connection.getSlot();
    const blockHeight = await connection.getBlockHeight();

    res.json({
      tps: recentPerformance.reduce((sum, sample) => sum + sample.numTransactions / sample.samplePeriodSecs, 0) / recentPerformance.length,
      blockHeight,
      slot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching market stats:', error);
    res.status(500).json({ error: 'Failed to fetch market stats' });
  }
});

router.get('/market/prices', async (req: Request, res: Response) => {
  try {
    const feedIds = req.query.ids as string[];
    if (!feedIds || !Array.isArray(feedIds) || feedIds.length === 0) {
      return res.status(400).json({ error: 'No price feed IDs provided' });
    }

    const priceData = await hermesClient.getLatestPriceUpdates(feedIds);
    res.json({
      prices: priceData.parsed.map(feed => ({
        id: feed.id,
        price: feed.price.price,
        confidence: feed.price.conf,
        exponent: feed.price.expo,
        publishTime: feed.price.publish_time
      }))
    });
  } catch (error) {
    console.error('Error fetching price data:', error);
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
});

/**
 * Portfolio endpoints
 */
router.get('/portfolio/:walletAddress', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    if (!validateWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (req.user?.walletAddress !== walletAddress) {
      return res.status(403).json({ error: 'Unauthorized access to portfolio data' });
    }

    const connection = req.connection;
    const pubkey = new PublicKey(walletAddress);
    const solBalance = await connection.getBalance(pubkey);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });

    const tokens = tokenAccounts.value.map(account => {
      const { mint, tokenAmount } = account.account.data.parsed.info;
      return {
        mint,
        amount: tokenAmount.uiAmount,
        decimals: tokenAmount.decimals,
        uiAmountString: tokenAmount.uiAmountString
      };
    });

    res.json({
      address: walletAddress,
      solBalance: solBalance / 1e9,
      tokens
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

router.post('/portfolio/rebalance', authenticateRequest, async (req: Request, res: Response) => {
  try {
    res.status(501).json({ error: 'Portfolio rebalancing not implemented' });
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
    if (!validateWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (req.user?.walletAddress !== walletAddress) {
      return res.status(403).json({ error: 'Unauthorized access to recommendations' });
    }

    const recommendations = [
      {
        id: '1',
        type: 'TRADE',
        title: 'Consider diversifying into SOL',
        description: 'Based on your portfolio composition, you may benefit from increasing your SOL exposure.',
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        action: {
          type: 'SWAP',
          fromToken: 'USDC',
          toToken: 'SOL',
          suggestedAmount: '10'
        }
      }
    ];

    res.json({ recommendations });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

router.post('/trade/execute', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { fromToken, toToken, amount, slippage } = req.body;
    if (!validateTokenAddress(fromToken) || !validateTokenAddress(toToken)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    res.status(501).json({ error: 'Trade execution not implemented' });
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
    if (!validateTokenAddress(address)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    const connection = req.connection;
    const tokenMint = new PublicKey(address);
    const supply = await connection.getTokenSupply(tokenMint);

    res.json({
      address,
      supply: {
        amount: supply.value.amount,
        decimals: supply.value.decimals,
        uiAmount: supply.value.uiAmount,
        uiAmountString: supply.value.uiAmountString
      }
    });
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({ error: 'Failed to fetch token information' });
  }
});

router.get('/tokens/verified', async (req: Request, res: Response) => {
  try {
    const verifiedTokens = [
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
      }
    ];

    res.json({ tokens: verifiedTokens });
  } catch (error) {
    console.error('Error fetching verified tokens:', error);
    res.status(500).json({ error: 'Failed to fetch verified tokens' });
  }
});

export default router;