// App.tsx - Main application component

import React from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter, BackpackWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { SonicAgentProvider } from './contexts/SonicAgentContext';
import SonicAgentDashboard from './components/SonicAgentDashboard';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Custom RPC endpoint - use Sonic SVM endpoints
const SONIC_RPC_URL = 'https://api.mainnet-alpha.sonic.game';

const App: React.FC = () => {
  // Set up wallet adapters
  const wallets = React.useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ], []);
  
  // Set up endpoint
  const endpoint = React.useMemo(() => SONIC_RPC_URL, []);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SonicAgentProvider>
            <SonicAgentDashboard />
          </SonicAgentProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;