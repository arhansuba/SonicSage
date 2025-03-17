# SonicSage

> AI-Powered Trading Companion for Sonic Network

SonicSage is an intelligent trading assistant built on the Sonic Virtual Machine (SVM) that combines real-time market data, AI-driven strategy optimization, and seamless trading execution to help users make informed trading decisions.

## 🚀 Features

- **Real-time Price Oracles**: Integration with Pyth Network for accurate, up-to-date price feeds
- **AI Strategy Generation**: Custom trading strategies created and optimized using machine learning
- **Portfolio Analytics**: In-depth analysis of your holdings with risk assessment and performance metrics
- **Automated Trading**: Set up rule-based trading with configurable parameters
- **Price Alerts**: Customizable notifications for price movements
- **DeFi Strategy Manager**: Implement and monitor various DeFi strategies including liquidity provision and yield farming
- **Jupiter Integration**: Seamless swap functionality via Jupiter's high-performance liquidity aggregator

## 🔧 Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Node.js, TypeScript
- **Blockchain**: Sonic SVM (Solana Virtual Machine)
- **AI/ML**: TensorFlow.js for strategy optimization
- **Data Feeds**: Pyth Network oracles
- **DEX Integration**: Jupiter API

## 📋 Prerequisites

- Node.js >= 16.x
- Sonic Wallet (Backpack, Nightly, OKX, or Bybit)
- (Optional) API keys for additional data sources

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/arhansuba/sonicsage.git
cd sonicsage

# Install dependencies
npm install

# Create a .env file following the .env.example template
cp .env.example .env

# Start the development server
npm run dev
```

## 🔗 API Endpoints

SonicSage interacts with several endpoints:

### Sonic SVM RPC Endpoints
- Mainnet: `https://api.mainnet-alpha.sonic.game`
- Secondary Mainnet: `https://rpc.mainnet-alpha.sonic.game`
- Helius: `https://sonic.helius-rpc.com/`
- Testnet: `https://api.testnet.sonic.game/`

### Jupiter API Endpoints
- Swap Quote: `https://api.jup.ag/swap/v1/quote`
- Swap: `https://api.jup.ag/swap/v1/swap`
- Swap Instructions: `https://api.jup.ag/swap/v1/swap-instructions`
- Ultra Order: `https://api.jup.ag/ultra/v1/order`
- Ultra Execute: `https://api.jup.ag/ultra/v1/execute`
- Price API: `https://api.jup.ag/price/v2`

### Pyth Price Feed
- Integration with Pyth Network for real-time price data

## 🧠 AI Strategy Generation

SonicSage uses machine learning to generate and optimize trading strategies based on:

1. Historical market data analysis
2. Current market conditions
3. User risk preferences
4. Portfolio composition

The AI component continuously learns from market movements and strategy performance to improve recommendations over time.

## 📊 Portfolio Analytics

Get comprehensive insights into your portfolio:

- Asset allocation visualization
- Performance tracking
- Risk assessment
- Correlation analysis
- Historic returns comparison

## 🔔 Price Alerts

Configure custom alerts based on:

- Price thresholds
- Percentage changes
- Moving average crossovers
- Volume spikes
- Relative strength indicators

## 🌐 DeFi Strategies

Implement various DeFi strategies:

- Yield farming optimizers
- Liquidity pool management
- Automated position rebalancing
- Dollar-cost averaging
- Risk-adjusted staking

## 🚢 Deployment

### Deploying Contracts to Sonic Mainnet

```bash
# 1. Build your contract
cd contracts
cargo build-bpf

# 2. Configure your Solana CLI to point to Sonic Mainnet
solana config set --url https://api.mainnet-alpha.sonic.game

# 3. Ensure your wallet has enough SOL for deployment
solana balance

# 4. Deploy your contracts
# For the DeFi Strategy contract
solana program deploy target/deploy/defi_strategy.so --program-id ./defi_strategy-keypair.json

# For the Price Alerts contract  
solana program deploy target/deploy/price_alerts.so --program-id ./price_alerts-keypair.json

# For the Strategy Manager contract
solana program deploy target/deploy/strategy_manager.so --program-id ./strategy_manager-keypair.json
```

### Verify Deployment

```bash
# Verify the deployment was successful
solana program show --programs

# Get program account information
solana program show <PROGRAM_ID>

# Test the deployed program 
cd scripts
ts-node test.ts --network mainnet
```

### Update Deployed Contracts

```bash
# Build the updated contract
cargo build-bpf

# Deploy the upgraded version  
solana program deploy target/deploy/updated_contract.so --program-id <EXISTING_PROGRAM_ID>
```

## 💻 Development

### Project Structure

```
sonic-agent/
├── contracts/        # Smart contract code
├── docs/             # Documentation
├── public/           # Static assets
├── server/           # Backend server code
├── src/              # Frontend source code
│   ├── app/          # Next.js app directory
│   ├── components/   # React components
│   ├── constants/    # Application constants
│   ├── context/      # React context providers
│   ├── hooks/        # Custom React hooks
│   ├── services/     # Service integrations
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
└── tests/            # Test suite
```

### Contributing

We welcome contributions to SonicSage! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Resources

- [Sonic SVM Documentation](https://docs.sonic.game)
- [Jupiter Documentation](https://docs.jup.ag/)
- [Pyth Network Documentation](https://docs.pyth.network/)
- [Sonic Agent Kit](https://github.com/sendaifun/sonic-agent-kit)

## 🛠️ Environment Configuration

Create a `.env` file with the following configuration:

```env
# Environment (development, production, test)
NODE_ENV=development

# Sonic RPC URL 
REACT_APP_RPC_URL=https://api.mainnet-alpha.sonic.game

# Jupiter API Key (optional)
REACT_APP_JUPITER_API_KEY=your_jupiter_api_key

# Helius API Key (optional, for enhanced RPC)
REACT_APP_HELIUS_API_KEY=your_helius_api_key

# OpenAI API Key (for AI strategy generation)
REACT_APP_OPENAI_API_KEY=your_openai_api_key
```

## 🔒 Security Considerations

- Never commit private keys or API keys to your repository
- Use environment variables for sensitive information
- Implement proper wallet connection security for transaction signing
- Consider rate limiting for API endpoints
- Perform thorough testing of all contracts on testnet before mainnet deployment
- Follow best practices for Solana program security
