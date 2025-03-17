import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, BN, Program, Idl } from '@coral-xyz/anchor';
import { HermesClient } from '@pythnetwork/hermes-client';
import { PythSolanaReceiver, InstructionWithEphemeralSigners } from '@pythnetwork/pyth-solana-receiver';
import { 
  TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
  createTransferInstruction,
  getMint,
  getAccount
} from '@solana/spl-token';
import axios from 'axios';
import { NotificationService } from './NotificationService';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

// Define notification type if missing from NotificationService
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// Define IDL types instead of importing JSON files
// These would typically be imported from compiled IDL files
const solendIdl: Idl = {
  //version: "0.1.0",
  //name: "solend",
  instructions: [],
  accounts: [],
  address: '',
  metadata: {
    name: '',
    version: '',
    spec: '',
    description: undefined,
    repository: undefined,
    dependencies: undefined,
    contact: undefined,
    deployments: undefined
  }
};

const marinadeIdl: Idl = {
  instructions: [],
  accounts: [],
  address: '',
  metadata: {
    name: '',
    version: '',
    spec: '',
    description: undefined,
    repository: undefined,
    dependencies: undefined,
    contact: undefined,
    deployments: undefined
  }
};

const raydiumIdl: Idl = {
  instructions: [],
  accounts: [],
  address: '',
  metadata: {
    name: '',
    version: '',
    spec: '',
    description: undefined,
    repository: undefined,
    dependencies: undefined,
    contact: undefined,
    deployments: undefined
  }
};

const orcaIdl: Idl = {
  instructions: [],
  accounts: [],
  address: '',
  metadata: {
    name: '',
    version: '',
    spec: '',
    description: undefined,
    repository: undefined,
    dependencies: undefined,
    contact: undefined,
    deployments: undefined
  }
};

// Define custom account types for Marinade and Solend
interface MarinadeState {
  mSolMint: PublicKey;
  mSolMintAuthority: PublicKey;
  liqPool: {
    solLegPda: PublicKey;
    msolLeg: PublicKey;
  };
  msolPrice: BN;
}

interface SolendObligation {
  deposits: Array<{
    depositReserve: PublicKey;
    depositedAmount: BN;
  }>;
  borrows: Array<{
    borrowReserve: PublicKey;
    borrowedAmountWads: BN;
  }>;
  depositedValue: number;
  borrowedValue: number;
  lastUpdateTimestamp: number;
  creationTimestamp: number;
}

// Enum for protocol types
export enum ProtocolType {
  LENDING = 'lending',
  YIELD_FARMING = 'yield_farming',
  LIQUIDITY_PROVIDING = 'liquidity_providing',
  STAKING = 'staking'
}

// Enum for risk levels
export enum DeFiRiskLevel {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive'
}

// Protocol configuration interfaces
export interface ProtocolBaseConfig {
  platform: string;
  programId: string;
  priceFeedIds: { [tokenSymbol: string]: string };
}

export interface LendingProtocolConfig extends ProtocolBaseConfig {
  collateralFactor: number;
  maxUtilization: number;
  autoCompound: boolean;
  autoRebalance: boolean;
  liquidationBuffer: number;
}

export interface YieldFarmingProtocolConfig extends ProtocolBaseConfig {
  poolAddress: string;
  harvestFrequency: number;
  autoCompound: boolean;
  maxSlippage: number;
}

export interface LiquidityProvidingProtocolConfig extends ProtocolBaseConfig {
  poolAddress: string;
  rebalanceThreshold: number;
  maxSlippage: number;
  autoCompound: boolean;
}

export interface StakingProtocolConfig extends ProtocolBaseConfig {
  validator?: string;
  autoCompound: boolean;
  unstakeCooldown?: number;
}

export type ProtocolConfig = 
  | LendingProtocolConfig 
  | YieldFarmingProtocolConfig 
  | LiquidityProvidingProtocolConfig
  | StakingProtocolConfig;

// DeFi Strategy interface
export interface DeFiStrategy {
  id: string;
  name: string;
  description: string;
  protocolType: ProtocolType;
  riskLevel: DeFiRiskLevel;
  tokens: Array<{
    mint: string;
    symbol: string;
    allocation: number;
  }>;
  estimatedApy: number;
  tvl: number;
  userCount: number;
  creatorAddress: string;
  protocolConfig: ProtocolConfig;
  feePercentage: number;
  minInvestment: number; // Add this line
}

// User position interface
export interface UserPosition {
  strategyId: string;
  positionAddress: string;
  investmentValue: number;
  initialInvestment: number;
  returns: number;
  apy: number;
  tokenPositions: Array<{
    mint: string;
    symbol: string;
    amount: number;
    value: number;
  }>;
  borrowPositions?: Array<{
    mint: string;
    symbol: string;
    amount: number;
    value: number;
    interestRate: number;
  }>;
  healthFactor?: number;
  lastHarvestTime: number;
  createdAt: number;
}

// Analytics interface
export interface PositionAnalytics {
  dailyReturns: Array<{
    date: string;
    value: number;
    yield: number;
  }>;
  totalReturnRate: number;
  impermanentLoss?: number;
  fees: {
    earned: number;
    paid: number;
  };
  rebalanceEvents: Array<{
    timestamp: number;
    cost: number;
    description: string;
  }>;
  priceRanges: Array<{
    token: string;
    min: number;
    max: number;
    current: number;
  }>;
}

// Market data interface
export interface MarketData {
  lendingRates: { [platform: string]: { [token: string]: { supply: number, borrow: number } } };
  farmingApys: { [platform: string]: { [pool: string]: number } };
  liquidityPools: { [platform: string]: { [pool: string]: { tvl: number, volume24h: number, fee: number } } };
}

// Price data interface
export interface TokenPrice {
  symbol: string;
  mint: string;
  price: number;
  confidence: number;
  timestamp: number;
}

// Program addresses
const PROGRAM_IDS = {
  SOLEND: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
  MANGO: '4skJ85cdxQAFVKbcGgfun8iZPL7BadVYXG3kGEGkufqA',
  RAYDIUM: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr',
  ORCA: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  MARINADE: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
  PYTH_RECEIVER: 'rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ',
  WORMHOLE_RECEIVER: 'HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ'
};

// Pyth price feed IDs
const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'MSOL/USD': '0xc2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4',
  'WBTC/USD': '0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33',
  'ORCA/USD': '0x37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c',
  'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
};

// Token mint addresses
const TOKEN_MINTS: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  'ETH': '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
  'MSOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

// Mapping from token symbol to mint address
const TOKEN_MINT_MAP: Record<string, string> = TOKEN_MINTS;

// Mapping from mint address to token symbol 
const MINT_TOKEN_MAP: Record<string, string> = Object.entries(TOKEN_MINTS).reduce(
  (acc, [symbol, mint]) => ({ ...acc, [mint]: symbol }), 
  {} as Record<string, string>
);

// Helper function to safely get price feed ID for a token
function getPriceFeedId(symbol: string): string | undefined {
  const key = `${symbol}/USD`;
  return key in PYTH_PRICE_FEED_IDS ? PYTH_PRICE_FEED_IDS[key] : undefined;
}

// Helper function to convert feed ID from hex string to Uint8Array
function getFeedIdFromHex(hexString: string): Uint8Array {
  hexString = hexString.startsWith('0x') ? hexString.substring(2) : hexString;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Protocol adapter interface
interface ProtocolAdapter {
  platform: string;
  programId: PublicKey;
  program?: Program;
  initialize(connection: Connection, provider: AnchorProvider): Promise<void>;
  getAPY(): Promise<{ [tokenSymbol: string]: number }>;
  getLendingRates?(): Promise<{ [tokenSymbol: string]: { supply: number, borrow: number } }>;
  getPoolInfo?(poolAddress: string): Promise<{ tvl: number, volume24h: number, fee: number }>;
  executeDeposit(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string>;
  executeWithdraw(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string>;
  executeHarvest?(params: { strategyId: string }): Promise<string>;
  executeRebalance?(params: { strategyId: string }): Promise<string>;
  getUserPositions(walletAddress: string): Promise<UserPosition[]>;
}

// Solend Protocol Adapter Implementation
class SolendAdapter implements ProtocolAdapter {
  platform: string = 'solend';
  programId: PublicKey;
  program?: Program;
  connection: Connection | null = null;
  provider: AnchorProvider | null = null;

  constructor() {
    this.programId = new PublicKey(PROGRAM_IDS.SOLEND);
  }

  async initialize(connection: Connection, provider: AnchorProvider): Promise<void> {
    this.connection = connection;
    this.provider = provider;
    // Fix: Pass provider correctly
    this.program = new Program(solendIdl,  provider);
    console.log("Solend adapter initialized with program", this.program.programId.toString());
  }

  async getAPY(): Promise<{ [tokenSymbol: string]: number }> {
    try {
      const response = await axios.get('https://api.solend.fi/v1/markets/main/reserves');
      const result: { [tokenSymbol: string]: number } = {};
      
      // Fix: Type assertion for API response
      const reserves = response.data as any[];
      for (const reserve of reserves) {
        result[reserve.symbol] = reserve.supplyInterest?.apr ? reserve.supplyInterest.apr * 100 : 0;
      }
      
      return result;
    } catch (error) {
      console.error("Error fetching Solend APY:", error);
      throw error;
    }
  }

  async getLendingRates(): Promise<{ [tokenSymbol: string]: { supply: number, borrow: number } }> {
    try {
      const response = await axios.get('https://api.solend.fi/v1/markets/main/reserves');
      const result: { [tokenSymbol: string]: { supply: number, borrow: number } } = {};
      
      // Fix: Type assertion for API response
      const reserves = response.data as any[];
      for (const reserve of reserves) {
        result[reserve.symbol] = {
          supply: reserve.supplyInterest?.apr ? reserve.supplyInterest.apr * 100 : 0,
          borrow: reserve.borrowInterest?.apr ? reserve.borrowInterest.apr * 100 : 0
        };
      }
      
      return result;
    } catch (error) {
      console.error("Error fetching Solend lending rates:", error);
      throw error;
    }
  }

  async executeDeposit(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string> {
    if (!this.program || !this.provider) {
      throw new Error("Solend adapter not initialized");
    }

    try {
      const { strategyId, amount, tokenMint } = params;
      
      // Extract the market name from the strategy ID (e.g., solend-main -> main)
      const marketName = strategyId.split('-')[1];
      
      // Fetch market information to get the reserve
      const marketsResponse = await axios.get('https://api.solend.fi/v1/markets/configs');
      // Fix: Type assertion for market response
      const markets = marketsResponse.data as any[];
      const market = markets.find((m: any) => m.name.toLowerCase() === marketName);
      
      if (!market) {
        throw new Error(`Market ${marketName} not found`);
      }
      
      // Find the reserve for the token
      const reserve = market.reserves.find((r: any) => r.mintAddress === tokenMint);
      if (!reserve) {
        throw new Error(`Reserve for token ${tokenMint} not found in market ${marketName}`);
      }
      
      // Calculate the lamports amount based on decimals
      const mint = await getMint(this.connection!, new PublicKey(tokenMint));
      const tokenAmount = new BN(amount * Math.pow(10, mint.decimals));
      
      // Get the user's token account
      const userTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        this.provider.wallet.publicKey
      );
      
      // Check if the token account exists
      try {
        await getAccount(this.connection!, userTokenAccount);
      } catch (error) {
        // If the account doesn't exist, create it
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          userTokenAccount,
          this.provider.wallet.publicKey,
          new PublicKey(tokenMint)
        );
        
        const tx = new Transaction().add(createAtaIx);
        await this.provider.sendAndConfirm(tx);
      }
      
      // Find reserve accounts
      const reserveAccountInfo = await this.connection!.getProgramAccounts(
        this.programId,
        {
          filters: [
            { dataSize: 619 }, // Size of Reserve account data
            {
              memcmp: {
                offset: 10, // Offset of the mint in the reserve data structure
                bytes: tokenMint
              }
            }
          ]
        }
      );
      
      if (reserveAccountInfo.length === 0) {
        throw new Error(`Reserve account for token ${tokenMint} not found`);
      }
      
      const reserveAccount = reserveAccountInfo[0].pubkey;
      
      // Create the lending program's deposit instruction
      const depositInstruction = await this.program.methods
        .depositReserveLiquidity(tokenAmount)
        .accounts({
          source: userTokenAccount,
          destination: new PublicKey(reserve.supplyTokenAccount),
          reserve: reserveAccount,
          reserveLiquiditySupply: new PublicKey(reserve.liquiditySupplyTokenAccount),
          reserveCollateralMint: new PublicKey(reserve.collateralMintAddress),
          lendingMarket: new PublicKey(market.address),
          lendingMarketAuthority: new PublicKey(market.authorityAddress),
          transferAuthority: this.provider.wallet.publicKey,
          clock: SystemProgram.programId, // Solana's clock sysvar
        })
        .instruction();
      
      // Create and sign the transaction
      const transaction = new Transaction().add(depositInstruction);
      
      const signature = await this.provider.sendAndConfirm(transaction);
      return signature;
    } catch (error) {
      console.error("Error executing Solend deposit:", error);
      throw error;
    }
  }

  async executeWithdraw(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string> {
    if (!this.program || !this.provider) {
      throw new Error("Solend adapter not initialized");
    }

    try {
      const { strategyId, amount, tokenMint } = params;
      
      // Extract the market name from the strategy ID
      const marketName = strategyId.split('-')[1];
      
      // Fetch market information
      const marketsResponse = await axios.get('https://api.solend.fi/v1/markets/configs');
      // Fix: Type assertion for market response
      const markets = marketsResponse.data as any[];
      const market = markets.find((m: any) => m.name.toLowerCase() === marketName);
      
      if (!market) {
        throw new Error(`Market ${marketName} not found`);
      }
      
      // Find the reserve for the token
      const reserve = market.reserves.find((r: any) => r.mintAddress === tokenMint);
      if (!reserve) {
        throw new Error(`Reserve for token ${tokenMint} not found in market ${marketName}`);
      }
      
      // Calculate the amount of cTokens to withdraw
      const mint = await getMint(this.connection!, new PublicKey(tokenMint));
      const withdrawAmount = new BN(amount * Math.pow(10, mint.decimals));
      
      // Get the user's token account
      const userTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        this.provider.wallet.publicKey
      );
      
      // Check if account exists
      try {
        await getAccount(this.connection!, userTokenAccount);
      } catch (error) {
        // Create token account if it doesn't exist
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          userTokenAccount,
          this.provider.wallet.publicKey,
          new PublicKey(tokenMint)
        );
        
        const tx = new Transaction().add(createAtaIx);
        await this.provider.sendAndConfirm(tx);
      }
      
      // Get the user's collateral token account
      const userCollateralTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(reserve.collateralMintAddress),
        this.provider.wallet.publicKey
      );
      
      // Find reserve accounts
      const reserveAccountInfo = await this.connection!.getProgramAccounts(
        this.programId,
        {
          filters: [
            { dataSize: 619 }, // Size of Reserve account data
            {
              memcmp: {
                offset: 10,
                bytes: tokenMint
              }
            }
          ]
        }
      );
      
      if (reserveAccountInfo.length === 0) {
        throw new Error(`Reserve account for token ${tokenMint} not found`);
      }
      
      const reserveAccount = reserveAccountInfo[0].pubkey;
      
      // Create the lending program's withdraw instruction
      const withdrawInstruction = await this.program.methods
        .redeemReserveCollateral(withdrawAmount)
        .accounts({
          source: userCollateralTokenAccount,
          destination: userTokenAccount,
          reserve: reserveAccount,
          reserveCollateralMint: new PublicKey(reserve.collateralMintAddress),
          reserveLiquiditySupply: new PublicKey(reserve.liquiditySupplyTokenAccount),
          lendingMarket: new PublicKey(market.address),
          lendingMarketAuthority: new PublicKey(market.authorityAddress),
          transferAuthority: this.provider.wallet.publicKey,
          clock: SystemProgram.programId,
        })
        .instruction();
      
      // Create and sign the transaction
      const transaction = new Transaction().add(withdrawInstruction);
      
      const signature = await this.provider.sendAndConfirm(transaction);
      return signature;
    } catch (error) {
      console.error("Error executing Solend withdraw:", error);
      throw error;
    }
  }

  async getUserPositions(walletAddress: string): Promise<UserPosition[]> {
    if (!this.connection) {
      throw new Error("Solend adapter not initialized");
    }

    try {
      const walletPublicKey = new PublicKey(walletAddress);
      const positions: UserPosition[] = [];
      
      // Fetch all Solend markets
      const marketsResponse = await axios.get('https://api.solend.fi/v1/markets/configs');
      // Fix: Type assertion for market response
      const markets = marketsResponse.data as any[];
      
      // For each market, fetch the user's positions
      for (const market of markets) {
        // Find all obligation accounts owned by the user for this market
        const obligationAccounts = await this.connection.getProgramAccounts(
          this.programId,
          {
            filters: [
              { dataSize: 1300 }, // Size of Obligation account data
              {
                memcmp: {
                  offset: 8, // Offset of the owner in the obligation data structure
                  bytes: walletPublicKey.toBase58()
                }
              },
              {
                memcmp: {
                  offset: 40, // Offset of the lending market in the obligation data structure
                  bytes: market.address
                }
              }
            ]
          }
        );
        
        // Process each obligation
        for (const { pubkey, account } of obligationAccounts) {
          // Fix: Add type assertion for obligation data
          const obligation = this.program!.coder.accounts.decode(
            'Obligation',
            account.data
          ) as unknown as SolendObligation;
          
          // Get token prices for value calculation
          const tokenSymbols = [
            ...new Set([
              ...obligation.deposits.map((d: any) => {
                const mintKey = d.depositReserve.toBase58();
                return MINT_TOKEN_MAP[mintKey] || null;
              }),
              ...obligation.borrows.map((b: any) => {
                const mintKey = b.borrowReserve.toBase58();
                return MINT_TOKEN_MAP[mintKey] || null;
              })
            ])
          ].filter(Boolean) as string[];
          
          // Fetch current token prices
          const tokenPrices = await this.fetchTokenPrices(tokenSymbols);
          
          // Calculate total position value
          let depositValue = 0;
          let borrowValue = 0;
          
          const tokenPositions = [];
          const borrowPositions = [];
          
          // Process deposits
          for (const deposit of obligation.deposits) {
            const reserveAddress = deposit.depositReserve.toBase58();
            
            // Find the reserve details
            const reserve = market.reserves.find((r: any) => r.address === reserveAddress);
            if (!reserve) continue;
            
            const symbol = MINT_TOKEN_MAP[reserve.mintAddress];
            if (!symbol) continue;
            
            const price = tokenPrices[symbol]?.price || 0;
            
            // Calculate token amount and value
            const mint = await getMint(this.connection, new PublicKey(reserve.mintAddress));
            const amount = deposit.depositedAmount.toNumber() / Math.pow(10, mint.decimals);
            const value = amount * price;
            
            tokenPositions.push({
              mint: reserve.mintAddress,
              symbol,
              amount,
              value
            });
            
            depositValue += value;
          }
          
          // Process borrows
          for (const borrow of obligation.borrows) {
            const reserveAddress = borrow.borrowReserve.toBase58();
            
            // Find the reserve details
            const reserve = market.reserves.find((r: any) => r.address === reserveAddress);
            if (!reserve) continue;
            
            const symbol = MINT_TOKEN_MAP[reserve.mintAddress];
            if (!symbol) continue;
            
            const price = tokenPrices[symbol]?.price || 0;
            
            // Calculate token amount and value
            const mint = await getMint(this.connection, new PublicKey(reserve.mintAddress));
            const amount = borrow.borrowedAmountWads.toNumber() / Math.pow(10, mint.decimals);
            const value = amount * price;
            
            borrowPositions.push({
              mint: reserve.mintAddress,
              symbol,
              amount,
              value,
              interestRate: reserve.borrowInterest?.apr ? reserve.borrowInterest.apr * 100 : 0
            });
            
            borrowValue += value;
          }
          
          // Calculate health factor
          const healthFactor = borrowValue > 0 ? depositValue / borrowValue : Infinity;
          
          // Calculate returns and APY
          const returns = depositValue - borrowValue - obligation.depositedValue + obligation.borrowedValue;
          const apy = obligation.depositedValue > 0 ? 
            (returns / obligation.depositedValue) * (365 / ((Date.now() / 1000 - obligation.lastUpdateTimestamp) / 86400)) * 100 : 
            0;
          
          positions.push({
            strategyId: `solend-${market.name.toLowerCase()}`,
            positionAddress: pubkey.toBase58(),
            investmentValue: depositValue,
            initialInvestment: obligation.depositedValue,
            returns,
            apy,
            tokenPositions,
            borrowPositions,
            healthFactor,
            lastHarvestTime: obligation.lastUpdateTimestamp,
            createdAt: obligation.creationTimestamp
          });
        }
      }
      
      return positions;
    } catch (error) {
      console.error("Error getting Solend positions:", error);
      throw error;
    }
  }

  private async fetchTokenPrices(tokenSymbols: string[]): Promise<Record<string, { price: number, confidence: number }>> {
    try {
      const priceFeedIds = tokenSymbols
        .map(symbol => {
          // Fix: Safely get price feed ID
          const feedId = getPriceFeedId(symbol);
          return feedId ? { symbol, feedId } : null;
        })
        .filter((item): item is { symbol: string, feedId: string } => item !== null);
      
      if (priceFeedIds.length === 0) {
        return {};
      }
      
      const hermesClient = new HermesClient("https://hermes.pyth.network/", {});
      const priceUpdates = await hermesClient.getLatestPriceUpdates(
        priceFeedIds.map(({ feedId }) => feedId)
      );
      
      const result: Record<string, { price: number, confidence: number }> = {};
      
      // Fix: Add null check for parsed data
      if (priceUpdates.parsed) {
        for (const priceData of priceUpdates.parsed) {
          // Find which token this price feed belongs to
          for (const { symbol, feedId } of priceFeedIds) {
            if (feedId === priceData.id) {
              // Fix: Add null checks for price calculations
              const price = priceData.price && typeof priceData.price.price === 'number' && 
                typeof priceData.price.expo === 'number' ? 
                priceData.price.price * Math.pow(10, priceData.price.expo) : 0;
                
              const confidence = priceData.price && typeof priceData.price.conf === 'number' && 
                typeof priceData.price.expo === 'number' ? 
                priceData.price.conf * Math.pow(10, priceData.price.expo) : 0;
              
              result[symbol] = { price, confidence };
              break;
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error("Error fetching token prices:", error);
      return {};
    }
  }
}

// Marinade Protocol Adapter Implementation
class MarinadeAdapter implements ProtocolAdapter {
  platform: string = 'marinade';
  programId: PublicKey;
  program?: Program;
  connection: Connection | null = null;
  provider: AnchorProvider | null = null;

  constructor() {
    this.programId = new PublicKey(PROGRAM_IDS.MARINADE);
  }

  async initialize(connection: Connection, provider: AnchorProvider): Promise<void> {
    this.connection = connection;
    this.provider = provider;
    // Fix: Pass provider correctly
    this.program = new Program(marinadeIdl,  provider);
    console.log("Marinade adapter initialized with program", this.program.programId.toString());
  }

  async getAPY(): Promise<{ [tokenSymbol: string]: number }> {
    try {
      // Fetch current Marinade APY
      const response = await axios.get('https://api.marinade.finance/public/apy');
      // Fix: Add type assertion for API response
      const data = response.data as { overall: number };
      return {
        'SOL': data.overall * 100, // Convert to percentage
        'mSOL': data.overall * 100  // mSOL earns the same APY
      };
    } catch (error) {
      console.error("Error fetching Marinade APY:", error);
      throw error;
    }
  }

  async executeDeposit(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string> {
    if (!this.program || !this.provider) {
      throw new Error("Marinade adapter not initialized");
    }

    try {
      const { amount, tokenMint } = params;
      
      // Ensure the token is SOL
      if (tokenMint !== TOKEN_MINTS.SOL) {
        throw new Error("Marinade staking only supports SOL");
      }
      
      // Get Marinade state account
      const marinadeStateAccounts = await this.connection!.getProgramAccounts(
        this.programId,
        {
          filters: [
            { dataSize: 395 }, // Size of Marinade state account data
          ]
        }
      );
      
      if (marinadeStateAccounts.length === 0) {
        throw new Error("Marinade state account not found");
      }
      
      const marinadeStateAccount = marinadeStateAccounts[0].pubkey;
      
      // Get mSOL mint from Marinade state
      // Fix: Add type assertion for Marinade state
      const accountInfo = await this.connection!.getAccountInfo(marinadeStateAccount);
if (!accountInfo) throw new Error("Account not found");
const marinadeState = this.program!.coder.accounts.decode(
  'marinadeState', // Account name in your IDL
  accountInfo.data
) as unknown as MarinadeState;
      
      const mSolMint = marinadeState.mSolMint;
      
      // Get the user's mSOL token account
      const userMSolAccount = await getAssociatedTokenAddress(
        mSolMint,
        this.provider.wallet.publicKey
      );
      
      // Check if the mSOL account exists
      try {
        await getAccount(this.connection!, userMSolAccount);
      } catch (error) {
        // If the account doesn't exist, create it
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          userMSolAccount,
          this.provider.wallet.publicKey,
          mSolMint
        );
        
        const tx = new Transaction().add(createAtaIx);
        await this.provider.sendAndConfirm(tx);
      }
      
      // Calculate the lamports amount
      const lamports = amount * 1e9; // SOL has 9 decimals
      
      // Create the deposit instruction
      const [reservePDA] = await PublicKey.findProgramAddress(
        [Buffer.from("reserve")],
        this.programId
      );
      
      const depositInstruction = await this.program.methods
        .deposit(new BN(lamports))
        .accounts({
          state: marinadeStateAccount,
          msolMint: mSolMint,
          liqPoolSolLegPda: reservePDA,
          getTokenOwnerAccount: userMSolAccount,
          transferFrom: this.provider.wallet.publicKey,
          mintTo: userMSolAccount,
          msolMintAuthority: marinadeState.mSolMintAuthority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      
      // Create and sign the transaction
      const transaction = new Transaction().add(depositInstruction);
      transaction.feePayer = this.provider.wallet.publicKey;
      transaction.recentBlockhash = (await this.connection!.getLatestBlockhash()).blockhash;
      
      const signature = await this.provider.sendAndConfirm(transaction);
      return signature;
    } catch (error) {
      console.error("Error executing Marinade deposit:", error);
      throw error;
    }
  }

  async executeWithdraw(params: { strategyId: string, amount: number, tokenMint: string }): Promise<string> {
    if (!this.program || !this.provider) {
      throw new Error("Marinade adapter not initialized");
    }

    try {
      const { amount, tokenMint } = params;
      
      // Ensure the token is mSOL
      if (tokenMint !== TOKEN_MINTS.MSOL) {
        throw new Error("Marinade withdrawal only supports mSOL");
      }
      
      // Get Marinade state account
      const marinadeStateAccounts = await this.connection!.getProgramAccounts(
        this.programId,
        {
          filters: [
            { dataSize: 395 }, // Size of Marinade state account data
          ]
        }
      );
      
      if (marinadeStateAccounts.length === 0) {
        throw new Error("Marinade state account not found");
      }
      
      const marinadeStateAccount = marinadeStateAccounts[0].pubkey;
      
      // Get mSOL mint from Marinade state
      // Fix: Add type assertion for Marinade state
      const accountInfo = await this.connection!.getAccountInfo(marinadeStateAccount);
if (!accountInfo) throw new Error("Account not found");
const marinadeState = this.program!.coder.accounts.decode(
  'marinadeState', // Account name in your IDL
  accountInfo.data
) as unknown as MarinadeState;
      
      const mSolMint = marinadeState.mSolMint;
      
      // Get the user's mSOL token account
      const userMSolAccount = await getAssociatedTokenAddress(
        mSolMint,
        this.provider.wallet.publicKey
      );
      
      // Calculate the token amount
      const tokenAmount = new BN(amount * 1e9); // mSOL has 9 decimals
      
      // Create the withdraw instruction
      const withdrawInstruction = await this.program.methods
        .liquidUnstake(tokenAmount)
        .accounts({
          state: marinadeStateAccount,
          msolMint: mSolMint,
          liqPoolSolLegPda: marinadeState.liqPool.solLegPda,
          liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
          getMsolFrom: userMSolAccount,
          getMsolFromAuthority: this.provider.wallet.publicKey,
          transferSolTo: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      
      // Create and sign the transaction
      const transaction = new Transaction().add(withdrawInstruction);
      
      const signature = await this.provider.sendAndConfirm(transaction);
      return signature;
    } catch (error) {
      console.error("Error executing Marinade withdraw:", error);
      throw error;
    }
  }

  async getUserPositions(walletAddress: string): Promise<UserPosition[]> {
    if (!this.connection) {
      throw new Error("Marinade adapter not initialized");
    }

    try {
      const walletPublicKey = new PublicKey(walletAddress);
      
      // Get Marinade state account
      const marinadeStateAccounts = await this.connection.getProgramAccounts(
        this.programId,
        {
          filters: [
            { dataSize: 395 }, // Size of Marinade state account data
          ]
        }
      );
      
      if (marinadeStateAccounts.length === 0) {
        return []; // No Marinade state found
      }
      
      const marinadeStateAccount = marinadeStateAccounts[0].pubkey;
      // Fix: Add type assertion for Marinade state
      const accountInfo = await this.connection!.getAccountInfo(marinadeStateAccount);
if (!accountInfo) throw new Error("Account not found");
const marinadeState = this.program!.coder.accounts.decode(
  'marinadeState', // Account name in your IDL
  accountInfo.data
) as unknown as MarinadeState;
      
      // Get the user's mSOL token account
      const userMSolAccount = await getAssociatedTokenAddress(
        marinadeState.mSolMint,
        walletPublicKey
      );
      
      // Check if the mSOL account exists
      let mSolBalance = 0;
      let initialStakeValue = 0;
      let creationTimestamp = 0;
      
      try {
        const account = await getAccount(this.connection, userMSolAccount);
        mSolBalance = Number(account.amount) / 1e9; // mSOL has 9 decimals
        
        // Get account creation time
        const accountInfo = await this.connection.getAccountInfo(userMSolAccount);
        if (accountInfo) {
          // Fix: Add null check for rentEpoch
          const rentEpoch = accountInfo.rentEpoch || 0;
          creationTimestamp = Math.floor(Date.now() / 1000) - Math.floor(rentEpoch * 432000); // Approximate
        }
        
        // Query historical price data to estimate initial investment
        // In a real implementation, you would track deposits/withdrawals
        initialStakeValue = mSolBalance; // Simplified
      } catch (error) {
        // Account doesn't exist, no position
        return [];
      }
      
      if (mSolBalance === 0) {
        return []; // No position
      }
      
      // Fetch SOL and mSOL prices
      const hermesClient = new HermesClient("https://hermes.pyth.network/", {});
      const priceUpdates = await hermesClient.getLatestPriceUpdates([
        PYTH_PRICE_FEED_IDS['SOL/USD'],
        PYTH_PRICE_FEED_IDS['MSOL/USD']
      ]);
      
      let solPrice = 0;
      let mSolPrice = 0;
      
      // Fix: Add null check for parsed data
      if (priceUpdates.parsed) {
        for (const priceData of priceUpdates.parsed) {
          if (priceData.id === PYTH_PRICE_FEED_IDS['SOL/USD']) {
            // Fix: Add null checks for price calculations
            solPrice = priceData.price && typeof priceData.price.price === 'number' && 
              typeof priceData.price.expo === 'number' ? 
              priceData.price.price * Math.pow(10, priceData.price.expo) : 0;
          } else if (priceData.id === PYTH_PRICE_FEED_IDS['MSOL/USD']) {
            // Fix: Add null checks for price calculations
            mSolPrice = priceData.price && typeof priceData.price.price === 'number' && 
              typeof priceData.price.expo === 'number' ? 
              priceData.price.price * Math.pow(10, priceData.price.expo) : 0;
          }
        }
      }
      
      // If mSOL price not available, use mSOL/SOL rate and SOL price
      if (mSolPrice === 0 && solPrice > 0) {
        mSolPrice = solPrice * marinadeState.msolPrice.toNumber() / Math.pow(10, 9);
      }
      
      // Calculate position value
      const positionValue = mSolBalance * mSolPrice;
      
      // Get the APY
      let apy = 0;
      try {
        const apyResponse = await axios.get('https://api.marinade.finance/public/apy');
        // Fix: Add type assertion for API response
        const apyData = apyResponse.data as { overall: number };
        apy = apyData.overall * 100; // Convert to percentage
      } catch (error) {
        console.error("Error fetching Marinade APY:", error);
      }
      
      // Calculate returns
      const initialInvestment = initialStakeValue * solPrice;
      const returns = positionValue - initialInvestment;
      
      return [{
        strategyId: 'marinade-sol-staking',
        positionAddress: userMSolAccount.toBase58(),
        investmentValue: positionValue,
        initialInvestment,
        returns,
        apy,
        tokenPositions: [{
          mint: marinadeState.mSolMint.toBase58(),
          symbol: 'MSOL',
          amount: mSolBalance,
          value: positionValue
        }],
        lastHarvestTime: Math.floor(Date.now() / 1000), // mSOL automatically compounds
        createdAt: creationTimestamp
      }];
    } catch (error) {
      console.error("Error getting Marinade positions:", error);
      throw error;
    }
  }
}

export class DeFiStrategyService {
  private static instance: DeFiStrategyService;
  private connection: Connection;
  private provider: AnchorProvider | null = null;
  private notificationService: NotificationService;
  private hermesClient: HermesClient;
  private pythSolanaReceiver: PythSolanaReceiver | null = null;
  
  // Protocol adapters
  private protocolAdapters: Map<string, ProtocolAdapter> = new Map();
  
  private constructor(connection: Connection) {
    this.connection = connection;
    this.notificationService = NotificationService.getInstance();
    this.hermesClient = new HermesClient("https://hermes.pyth.network/", {});
  }
  
  public static getInstance(connection?: Connection): DeFiStrategyService {
    if (!DeFiStrategyService.instance && connection) {
      DeFiStrategyService.instance = new DeFiStrategyService(connection);
    }
    return DeFiStrategyService.instance;
  }
  
  /**
   * Initialize the service with a wallet provider
   */
  public async initialize(provider: AnchorProvider): Promise<void> {
    this.provider = provider;
    // Fix: Create a proper PyhtSolanaReceiver configuration
    this.pythSolanaReceiver = new PythSolanaReceiver({ 
      connection: this.connection, 
      wallet: provider.wallet as unknown as NodeWallet,  // Cast to NodeWallet
      receiverProgramId: new PublicKey(PROGRAM_IDS.PYTH_RECEIVER),
      wormholeProgramId: new PublicKey(PROGRAM_IDS.WORMHOLE_RECEIVER)
    });
    
    // Initialize protocol adapters
    await this.initializeProtocolAdapters();
    
    console.log("DeFiStrategyService initialized");
  }
  
  /**
   * Initialize protocol adapters
   */
  private async initializeProtocolAdapters(): Promise<void> {
    // Solend Adapter
    const solendAdapter = new SolendAdapter();
    
    // Marinade Adapter for staking
    const marinadeAdapter = new MarinadeAdapter();
    
    // Register the adapters
    this.protocolAdapters.set('solend', solendAdapter);
    this.protocolAdapters.set('marinade', marinadeAdapter);
    
    // Initialize each adapter
    if (this.provider) {
      for (const adapter of this.protocolAdapters.values()) {
        await adapter.initialize(this.connection, this.provider);
      }
    }
  }
  
  /**
   * Get token prices using Pyth
   */
  public async getTokenPrices(tokenSymbols: string[]): Promise<TokenPrice[]> {
    try {
      // Collect all relevant price feed IDs
      const priceFeedIds: string[] = [];
      for (const symbol of tokenSymbols) {
        // Fix: Safely get price feed ID
        const feedId = getPriceFeedId(symbol);
        if (feedId) {
          priceFeedIds.push(feedId);
        }
      }
      
      if (priceFeedIds.length === 0) {
        throw new Error("No price feed IDs found for the requested tokens");
      }
      
      // Fetch latest price updates from Pyth
      const priceUpdates = await this.hermesClient.getLatestPriceUpdates(priceFeedIds);
      
      // Convert to our token price format
      const tokenPrices: TokenPrice[] = [];
      
      // Fix: Add null check for parsed data
      if (priceUpdates.parsed) {
        for (const priceData of priceUpdates.parsed) {
          // Find which token this price feed belongs to
          let symbol = '';
          for (const [key, value] of Object.entries(PYTH_PRICE_FEED_IDS)) {
            if (value === priceData.id) {
              symbol = key.split('/')[0]; // Get symbol from "SYMBOL/USD"
              break;
            }
          }
          
          if (symbol && tokenSymbols.includes(symbol)) {
            // Fix: Add null checks for price calculations
            const price = priceData.price && typeof priceData.price.price === 'number' && 
              typeof priceData.price.expo === 'number' ? 
              priceData.price.price * Math.pow(10, priceData.price.expo) : 0;
              
            const confidence = priceData.price && typeof priceData.price.conf === 'number' && 
              typeof priceData.price.expo === 'number' ? 
              priceData.price.conf * Math.pow(10, priceData.price.expo) : 0;
            
            const timestamp = priceData.price?.publish_time || Math.floor(Date.now() / 1000);
            
            tokenPrices.push({
              symbol,
              mint: TOKEN_MINT_MAP[symbol] || '',
              price,
              confidence,
              timestamp
            });
          }
        }
      }
      
      return tokenPrices;
    } catch (error) {
      console.error("Error fetching token prices from Pyth:", error);
      throw error;
    }
  }
  
  /**
   * Post price updates to Solana
   */
  public async postPriceUpdates(priceFeedIds: string[]): Promise<string> {
    try {
      if (!this.pythSolanaReceiver) {
        throw new Error("Pyth Solana Receiver not initialized");
      }
      
      // Fetch latest price updates from Hermes
      const priceUpdateData = (
        await this.hermesClient.getLatestPriceUpdates(
          priceFeedIds,
          { encoding: "base64" }
        )
      ).binary.data;
      
      // Create a transaction builder to post price updates
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder({
        closeUpdateAccounts: false,
      });
      
      // Add instructions to post price updates
      await transactionBuilder.addPostPriceUpdates(priceUpdateData);
      
      // Build and send the transaction
      const transactions = await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      });
      
      const results = await this.pythSolanaReceiver.provider.sendAll(
        transactions,
        { skipPreflight: true }
      );
      
      // Fix: Extract signature from the first result
      return Array.isArray(results) && results.length > 0 ? 
        typeof results[0] === 'string' ? results[0] : (results[0] as { signature: string }).signature || '' : '';
    } catch (error) {
      console.error("Error posting price updates to Solana:", error);
      throw error;
    }
  }
  
  /**
   * Execute a strategy with Pyth price updates in a single transaction
   */
  public async executeStrategyWithPriceUpdate(
    strategyId: string,
    action: 'deposit' | 'withdraw' | 'harvest' | 'rebalance',
    params: any
  ): Promise<string> {
    try {
      if (!this.pythSolanaReceiver || !this.provider) {
        throw new Error("Service not properly initialized");
      }
      
      // Get the strategy to find which tokens we need prices for
      const strategies = await this.getStrategies();
      const strategy = strategies.find(s => s.id === strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }
      
      // Get protocol adapter
      const platformId = strategy.protocolConfig.platform;
      const adapter = this.protocolAdapters.get(platformId);
      
      if (!adapter) {
        throw new Error(`No adapter found for platform ${platformId}`);
      }
      
      // Get price feed IDs from the strategy
      const priceFeedIds = Object.values(strategy.protocolConfig.priceFeedIds);
      
      // Fetch latest price updates from Hermes
      const priceUpdateData = (
        await this.hermesClient.getLatestPriceUpdates(
          priceFeedIds,
          { encoding: "base64" }
        )
      ).binary.data;
      
      // Create a transaction builder to post price updates and execute strategy
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder({
        closeUpdateAccounts: true, // Close the price update accounts to reclaim rent
      });
      
      // Add instructions to post price updates
      await transactionBuilder.addPostPartiallyVerifiedPriceUpdates(priceUpdateData);
      
      // Add instructions for the strategy action
      await transactionBuilder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
        // Create instructions for the strategy action
        const instructions: InstructionWithEphemeralSigners[] = [];
        
        // Execute the appropriate action
        let actionPromise: Promise<string>;
        
        if (action === 'deposit') {
          actionPromise = adapter.executeDeposit({
            strategyId,
            amount: params.amount,
            tokenMint: params.tokenMint
          });
        } else if (action === 'withdraw') {
          actionPromise = adapter.executeWithdraw({
            strategyId,
            amount: params.amount,
            tokenMint: params.tokenMint
          });
        } else if (action === 'harvest' && adapter.executeHarvest) {
          actionPromise = adapter.executeHarvest({ strategyId });
        } else if (action === 'rebalance' && adapter.executeRebalance) {
          actionPromise = adapter.executeRebalance({ strategyId });
        } else {
          throw new Error(`Unsupported action ${action} for platform ${platformId}`);
        }
        
        // For a real implementation, we would extract the instructions from the action
        // and add them to the instructions array
        
        return instructions;
      });
      
      // Build and send the transaction
      const transactions = await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      });
      
      const results = await this.pythSolanaReceiver.provider.sendAll(
        transactions,
        { skipPreflight: true }
      );
      
      // Notify the user
      this.notificationService.addNotification({
        type: NotificationType.SUCCESS,
        title: `Strategy ${action} executed`,
        message: `Successfully executed ${action} for strategy ${strategy.name}`,
        timestamp: Date.now()
      });
      
      // Fix: Extract signature from the first result
      return Array.isArray(results) && results.length > 0 ? 
        typeof results[0] === 'string' ? results[0] : (results[0] as { signature: string }).signature || '' : '';
    } catch (error) {
      console.error(`Error executing strategy with price update:`, error);
      
      // Notify the user of the error
      this.notificationService.addNotification({
        type: NotificationType.ERROR,
        title: `Strategy execution failed`,
        message: `Failed to execute strategy: ${(error as Error).message}`,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Get market data from various protocols
   */
  public async getMarketData(): Promise<MarketData> {
    try {
      // Initialize result structure
      const marketData: MarketData = {
        lendingRates: {},
        farmingApys: {},
        liquidityPools: {}
      };
      
      // Fetch lending rates from Solend
      const solendAdapter = this.protocolAdapters.get('solend');
      if (solendAdapter && solendAdapter.getLendingRates) {
        marketData.lendingRates['solend'] = await solendAdapter.getLendingRates();
      }
      
      // Fetch Raydium pools and APYs
      try {
        const raydiumResponse = await axios.get('https://api.raydium.io/v2/main/pairs');
        marketData.farmingApys['raydium'] = {};
        marketData.liquidityPools['raydium'] = {};
        
        // Fix: Add type assertion for API response
        const pools = raydiumResponse.data as any[];
        for (const pool of pools) {
          const poolName = `${pool.name}`;
          
          // APY data if available
          if (pool.apr) {
            marketData.farmingApys['raydium'][poolName] = pool.apr * 100; // Convert to percentage
          }
          
          // Pool info
          marketData.liquidityPools['raydium'][poolName] = {
            tvl: pool.liquidity || 0,
            volume24h: pool.volume24h || 0,
            fee: pool.fee || 0
          };
        }
      } catch (error) {
        console.error("Error fetching Raydium data:", error);
      }
      
      // Fetch Orca pools and APYs
      try {
        const orcaResponse = await axios.get('https://api.orca.so/pools');
        marketData.farmingApys['orca'] = {};
        marketData.liquidityPools['orca'] = {};
        
        // Fix: Add type assertion for API response
        const pools = orcaResponse.data as any[];
        for (const pool of pools) {
          const poolName = `${pool.name}`;
          
          // APY data if available
          if (pool.apy) {
            marketData.farmingApys['orca'][poolName] = pool.apy;
          }
          
          // Pool info
          marketData.liquidityPools['orca'][poolName] = {
            tvl: pool.liquidity || 0,
            volume24h: pool.volume24h || 0,
            fee: pool.fee || 0
          };
        }
      } catch (error) {
        console.error("Error fetching Orca data:", error);
      }
      
      return marketData;
    } catch (error) {
      console.error("Error fetching market data:", error);
      throw error;
    }
  }
  
  /**
   * Get strategies available from all protocols
   */
  public async getStrategies(): Promise<DeFiStrategy[]> {
    try {
      const strategies: DeFiStrategy[] = [];
      
      // Fetch Solend lending strategies
      try {
        const solendResponse = await axios.get('https://api.solend.fi/v1/markets/configs');
        
        // Fix: Add type assertion for API response
        const markets = solendResponse.data as any[];
        for (const market of markets) {
          const strategy: DeFiStrategy = {
            id: `solend-${market.address}`,
            name: `Solend ${market.name} Lending`,
            description: `Lend on Solend's ${market.name} market to earn interest`,
            protocolType: ProtocolType.LENDING,
            riskLevel: DeFiRiskLevel.CONSERVATIVE,
            tokens: market.reserves.map((reserve: any) => ({
              mint: reserve.mintAddress,
              symbol: reserve.symbol,
              allocation: 100 / market.reserves.length // Equal allocation for now
            })),
            estimatedApy: 0, // Will be populated later
            tvl: market.totalSupply || 0,
            userCount: market.numberOfAccounts || 0,
            creatorAddress: market.owner,
            protocolConfig: {
              platform: 'solend',
              programId: PROGRAM_IDS.SOLEND,
              collateralFactor: market.maxLoanToValueRatio || 0.8,
              maxUtilization: 0.9,
              autoCompound: true,
              autoRebalance: true,
              liquidationBuffer: 0.05,
              priceFeedIds: {} // Will populate below
            } as LendingProtocolConfig,
            feePercentage: 0.1,
            minInvestment: 0.01 // Add this line
          };
          
          // Add price feed IDs
          for (const reserve of market.reserves) {
            // Fix: Safely get price feed ID
            const feedId = getPriceFeedId(reserve.symbol);
            if (feedId) {
              strategy.protocolConfig.priceFeedIds[reserve.symbol] = feedId;
            }
          }
          
          // Get APY data
          try {
            const solendAdapter = this.protocolAdapters.get('solend');
            if (solendAdapter) {
              const apyData = await solendAdapter.getAPY();
              
              // Calculate average APY across all tokens
              let totalApy = 0;
              let tokenCount = 0;
              for (const token of strategy.tokens) {
                if (apyData[token.symbol]) {
                  totalApy += apyData[token.symbol] * (token.allocation / 100);
                  tokenCount++;
                }
              }
              
              strategy.estimatedApy = tokenCount > 0 ? totalApy : 0;
            }
          } catch (error) {
            console.error("Error fetching Solend APY for strategy:", error);
          }
          
          strategies.push(strategy);
        }
      } catch (error) {
        console.error("Error fetching Solend strategies:", error);
      }
      
      // Add Marinade staking strategy
      try {
        const marinadeAdapter = this.protocolAdapters.get('marinade');
        if (marinadeAdapter) {
          const apyData = await marinadeAdapter.getAPY();
          
          strategies.push({
            id: 'marinade-sol-staking',
            name: 'Marinade SOL Staking',
            description: 'Stake SOL with Marinade to earn staking rewards and get liquid mSOL',
            protocolType: ProtocolType.STAKING,
            riskLevel: DeFiRiskLevel.CONSERVATIVE,
            tokens: [{
              mint: TOKEN_MINTS.SOL,
              symbol: 'SOL',
              allocation: 100
            }],
            estimatedApy: apyData['SOL'] || 0,
            tvl: 0, // Would need to query Marinade program
            userCount: 0, // Would need to query Marinade program
            creatorAddress: PROGRAM_IDS.MARINADE,
            protocolConfig: {
              platform: 'marinade',
              programId: PROGRAM_IDS.MARINADE,
              autoCompound: true,
              unstakeCooldown: 86400, // 1 day in seconds
              priceFeedIds: {
                'SOL': PYTH_PRICE_FEED_IDS['SOL/USD'],
                'MSOL': PYTH_PRICE_FEED_IDS['MSOL/USD']
              }
            } as StakingProtocolConfig,
            feePercentage: 0.3,
            minInvestment: 0.01 // Add this line
          });
        }
      } catch (error) {
        console.error("Error creating Marinade strategy:", error);
      }
      
      return strategies;
    } catch (error) {
      console.error("Error fetching strategies:", error);
      throw error;
    }
  }
  
  /**
   * Get user positions across all protocols
   */
  public async getUserPositions(walletAddress: string): Promise<UserPosition[]> {
    try {
      let positions: UserPosition[] = [];
      
      // Get positions from each protocol adapter
      for (const adapter of this.protocolAdapters.values()) {
        try {
          const adapterPositions = await adapter.getUserPositions(walletAddress);
          positions = [...positions, ...adapterPositions];
        } catch (error) {
          console.error(`Error fetching positions from ${adapter.platform}:`, error);
        }
      }
      
      return positions;
    } catch (error) {
      console.error("Error fetching user positions:", error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific position
   */
  public async getPositionAnalytics(positionAddress: string): Promise<PositionAnalytics> {
    try {
      if (!this.connection) {
        throw new Error("Connection not initialized");
      }

      // Find which protocol this position belongs to
      let position: UserPosition | null = null;
      let protocol: string = '';
      
      // Check all adapters to find this position
      for (const [adapterName, adapter] of this.protocolAdapters.entries()) {
        try {
          if (this.provider) {
            const userPositions = await adapter.getUserPositions(this.provider.wallet.publicKey.toString());
            const foundPosition = userPositions.find(p => p.positionAddress === positionAddress);
            if (foundPosition) {
              position = foundPosition;
              protocol = adapterName;
              break;
            }
          }
        } catch (error) {
          console.error(`Error checking positions in ${adapterName}:`, error);
        }
      }
      
      if (!position) {
        throw new Error(`Position ${positionAddress} not found`);
      }
      
      // Get transaction history for this position
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(positionAddress),
        { limit: 100 }
      );
      
      // Get transaction details
      const transactions = await Promise.all(
        signatures.map(sig => this.connection.getTransaction(sig.signature, { maxSupportedTransactionVersion: 0 }))
      );
      
      // Group transactions by date (daily)
      const txsByDate = new Map<string, any[]>();
      transactions.forEach(tx => {
        if (tx && tx.blockTime) {
          const date = new Date(tx.blockTime * 1000);
          const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
          
          if (!txsByDate.has(dateString)) {
            txsByDate.set(dateString, []);
          }
          txsByDate.get(dateString)!.push(tx);
        }
      });
      
      // Collect token mint addresses in this position
      const tokenMints = position.tokenPositions.map(tp => tp.mint);
      if (position.borrowPositions) {
        tokenMints.push(...position.borrowPositions.map(bp => bp.mint));
      }
      
      // Get token symbols from mints
      const tokenSymbols = tokenMints.map(mint => {
        return MINT_TOKEN_MAP[mint] || 'UNKNOWN';
      });
      
      // Get historical price data for these tokens
      // For this implementation, we'll use price history available from CoinGecko
      // In a production app, you'd likely use a service like Pyth History API or another provider
      const priceHistory = await this.fetchHistoricalPrices(tokenSymbols, 30); // Last 30 days
      
      // Calculate daily returns based on transactions and price history
      const dailyReturns: Array<{ date: string; value: number; yield: number }> = [];
      const sortedDates = Array.from(txsByDate.keys()).sort();
      
      // Initialize with first day
      if (sortedDates.length > 0) {
        const firstDate = sortedDates[0];
        dailyReturns.push({
          date: firstDate,
          value: 0, // Initial day has no return yet
          yield: 0
        });
      }
      
      // Calculate returns for subsequent days
      let cumulativeValue = 0;
      let initialInvestment = position.initialInvestment;
      
      // Calculate fees earned and paid
      let feesEarned = 0;
      let feesPaid = 0;
      
      // Track rebalancing events
      const rebalanceEvents: Array<{ timestamp: number; cost: number; description: string }> = [];
      
      // Analyze transactions for fees and rebalancing
      for (const tx of transactions) {
        if (!tx || !tx.meta) continue;
        
        // Look for fee events in transaction logs
        for (const log of tx.meta.logMessages || []) {
          if (log.includes('Fee:')) {
            const feeAmount = this.extractFeeFromLog(log);
            if (feeAmount > 0) {
              feesPaid += feeAmount;
            }
          } else if (log.includes('Harvest') || log.includes('Reward')) {
            const harvestAmount = this.extractHarvestFromLog(log);
            if (harvestAmount > 0) {
              feesEarned += harvestAmount;
            }
          } else if (log.includes('Rebalance')) {
            rebalanceEvents.push({
              timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
              cost: tx.meta.fee || 0,
              description: this.extractRebalanceDescriptionFromLogs(tx.meta.logMessages || [])
            });
          }
        }
      }
      
      // Process each date with transactions
      for (let i = 1; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const prevDate = sortedDates[i-1];
        
        // Calculate the daily value change
        let dailyValue = 0;
        
        // For each token in the position
        for (const token of position.tokenPositions) {
          const symbol = MINT_TOKEN_MAP[token.mint] || 'UNKNOWN';
          const priceOnDate = priceHistory[symbol]?.[date] || 0;
          const prevPriceOnDate = priceHistory[symbol]?.[prevDate] || 0;
          
          if (priceOnDate && prevPriceOnDate) {
            const priceChange = priceOnDate - prevPriceOnDate;
            dailyValue += token.amount * priceChange;
          }
        }
        
        // Subtract borrow value changes if applicable
        if (position.borrowPositions) {
          for (const borrow of position.borrowPositions) {
            const symbol = MINT_TOKEN_MAP[borrow.mint] || 'UNKNOWN';
            const priceOnDate = priceHistory[symbol]?.[date] || 0;
            const prevPriceOnDate = priceHistory[symbol]?.[prevDate] || 0;
            
            if (priceOnDate && prevPriceOnDate) {
              const priceChange = priceOnDate - prevPriceOnDate;
              dailyValue -= borrow.amount * priceChange;
            }
          }
        }
        
        // Add transaction effects
        for (const tx of txsByDate.get(date) || []) {
          // Analyze token transfers to determine value changes
          if (tx.meta?.preTokenBalances && tx.meta?.postTokenBalances) {
            // Calculate net token value change from this transaction
            for (const token of position.tokenPositions) {
              const preBalance = tx.meta.preTokenBalances.find(
                (b: any) => b.mint === token.mint && b.owner === this.provider?.wallet.publicKey.toString()
              );
              const postBalance = tx.meta.postTokenBalances.find(
                (b: any) => b.mint === token.mint && b.owner === this.provider?.wallet.publicKey.toString()
              );
              
              if (preBalance && postBalance) {
                const balanceChange = (postBalance.uiTokenAmount.uiAmount || 0) - (preBalance.uiTokenAmount.uiAmount || 0);
                const symbol = MINT_TOKEN_MAP[token.mint] || 'UNKNOWN';
                const tokenPrice = priceHistory[symbol]?.[date] || 0;
                
                if (balanceChange < 0) {
                  // Withdrawal reduces daily return
                  dailyValue -= Math.abs(balanceChange) * tokenPrice;
                } else if (balanceChange > 0) {
                  // Deposit increases investment but doesn't affect return
                  initialInvestment += balanceChange * tokenPrice;
                }
              }
            }
          }
        }
        
        cumulativeValue += dailyValue;
        const yieldValue = initialInvestment > 0 ? (dailyValue / initialInvestment) * 100 : 0;
        
        dailyReturns.push({
          date,
          value: dailyValue,
          yield: yieldValue
        });
      }
      
      // Calculate price ranges for tokens in the position
      const priceRanges: Array<{ token: string; min: number; max: number; current: number }> = [];
      
      for (const token of position.tokenPositions) {
        const symbol = MINT_TOKEN_MAP[token.mint] || 'UNKNOWN';
        const priceData = priceHistory[symbol];
        
        if (priceData) {
          const prices = Object.values(priceData);
          if (prices.length > 0) {
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            const current = prices[prices.length - 1];
            
            priceRanges.push({
              token: symbol,
              min,
              max,
              current
            });
          }
        }
      }
      
      // Calculate impermanent loss if it's a liquidity pool
      let impermanentLoss: number | undefined = undefined;
      
      if (protocol === 'raydium' || protocol === 'orca') {
        impermanentLoss = this.calculateImpermanentLoss(position, priceHistory);
      }
      
      // Calculate total return rate
      const totalReturnRate = initialInvestment > 0 ? 
        ((position.investmentValue - initialInvestment) / initialInvestment) * 100 : 0;
      
      // Compile and return analytics
      return {
        dailyReturns,
        totalReturnRate,
        impermanentLoss,
        fees: {
          earned: feesEarned,
          paid: feesPaid
        },
        rebalanceEvents,
        priceRanges
      };
    } catch (error) {
      console.error("Error fetching position analytics:", error);
      throw error;
    }
  }
  
  /**
   * Fetch historical prices for multiple tokens
   */
  private async fetchHistoricalPrices(
    tokenSymbols: string[], 
    days: number
  ): Promise<Record<string, Record<string, number>>> {
    try {
      const result: Record<string, Record<string, number>> = {};
      
      // For each token, fetch historical prices
      for (const symbol of tokenSymbols) {
        // Convert symbol to CoinGecko ID format if needed
        const geckoId = this.getGeckoId(symbol);
        if (!geckoId) continue;
        
        // Fetch from CoinGecko API
        try {
          const response = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart`, 
            {
              params: {
                vs_currency: 'usd',
                days: days,
                interval: 'daily'
              }
            }
          );
          
          // Process and store the price data
          const priceData: Record<string, number> = {};
          
          // Fix: Add type assertion for API response
          const prices = (response.data as { prices: [number, number][] }).prices || [];
          for (const [timestamp, price] of prices) {
            const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
            priceData[date] = price;
          }
          
          result[symbol] = priceData;
        } catch (error) {
          console.error(`Error fetching price history for ${symbol}:`, error);
          // Continue with other tokens
        }
      }
      
      return result;
    } catch (error) {
      console.error("Error fetching historical prices:", error);
      return {};
    }
  }
  
  /**
   * Calculate impermanent loss for a liquidity pool position
   */
  private calculateImpermanentLoss(
    position: UserPosition,
    priceHistory: Record<string, Record<string, number>>
  ): number | undefined {
    try {
      // Impermanent loss only applies to positions with exactly 2 tokens
      if (position.tokenPositions.length !== 2) {
        return undefined;
      }
      
      const token0 = position.tokenPositions[0];
      const token1 = position.tokenPositions[1];
      
      const symbol0 = MINT_TOKEN_MAP[token0.mint] || 'UNKNOWN';
      const symbol1 = MINT_TOKEN_MAP[token1.mint] || 'UNKNOWN';
      
      // Get initial prices (from when position was created)
      // For simplicity, we'll use the earliest available price
      const creationDate = new Date(position.createdAt * 1000).toISOString().split('T')[0];
      
      let initialPrice0 = 0;
      let initialPrice1 = 0;
      let currentPrice0 = 0;
      let currentPrice1 = 0;
      
      // Find initial prices
      for (const [date, price] of Object.entries(priceHistory[symbol0] || {})) {
        if (date >= creationDate) {
          initialPrice0 = price;
          break;
        }
      }
      
      for (const [date, price] of Object.entries(priceHistory[symbol1] || {})) {
        if (date >= creationDate) {
          initialPrice1 = price;
          break;
        }
      }
      
      // Find current prices
      const prices0 = Object.values(priceHistory[symbol0] || {});
      const prices1 = Object.values(priceHistory[symbol1] || {});
      
      if (prices0.length > 0) currentPrice0 = prices0[prices0.length - 1];
      if (prices1.length > 0) currentPrice1 = prices1[prices1.length - 1];
      
      // If we don't have all prices, we can't calculate IL
      if (!initialPrice0 || !initialPrice1 || !currentPrice0 || !currentPrice1) {
        return undefined;
      }
      
      // Calculate price ratios
      const price0Ratio = currentPrice0 / initialPrice0;
      const price1Ratio = currentPrice1 / initialPrice1;
      
      // Formula for impermanent loss: 
      // IL = 2 * sqrt(price0Ratio * price1Ratio) / (price0Ratio + price1Ratio) - 1
      const impermanentLoss = (2 * Math.sqrt(price0Ratio * price1Ratio) / (price0Ratio + price1Ratio)) - 1;
      
      // IL is typically negative (a loss), but we'll return it as a positive percentage
      return Math.abs(impermanentLoss) * 100;
    } catch (error) {
      console.error("Error calculating impermanent loss:", error);
      return undefined;
    }
  }
  
  /**
   * Extract fee amount from transaction log
   */
  private extractFeeFromLog(log: string): number {
    try {
      // Example: "Fee: 0.001 SOL"
      const feeMatch = log.match(/Fee:\s+([\d.]+)/);
      if (feeMatch && feeMatch[1]) {
        return parseFloat(feeMatch[1]);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Extract harvest amount from transaction log
   */
  private extractHarvestFromLog(log: string): number {
    try {
      // Example: "Harvested: 10.5 USDC"
      const harvestMatch = log.match(/Harvest(?:ed)?:?\s+([\d.]+)/);
      if (harvestMatch && harvestMatch[1]) {
        return parseFloat(harvestMatch[1]);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Extract rebalance description from transaction logs
   */
  private extractRebalanceDescriptionFromLogs(logs: string[]): string {
    try {
      // Join all logs and look for rebalance information
      const rebalanceLog = logs.find(log => log.includes('Rebalance'));
      if (rebalanceLog) {
        return rebalanceLog.trim();
      }
      return "Position rebalanced";
    } catch (error) {
      return "Position rebalanced";
    }
  }
  
  /**
   * Map token symbol to CoinGecko ID
   */
  private getGeckoId(symbol: string): string | null {
    // This would be a complete mapping in a real implementation
    const geckoMap: Record<string, string> = {
      'SOL': 'solana',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'MSOL': 'marinade-staked-sol',
      'JUP': 'jupiter',
      'BONK': 'bonk',
      'RAY': 'raydium',
      'ORCA': 'orca'
    };
    
    return geckoMap[symbol] || null;
  }
}