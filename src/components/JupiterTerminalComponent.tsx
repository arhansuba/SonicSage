// JupiterTerminalComponent.tsx - React component for Jupiter Terminal integration

import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// Jupiter Terminal types

type DisplayMode = 'modal' | 'integrated' | 'widget';

interface JupiterTerminalProps {
  // Display options
  displayMode?: DisplayMode;
  integratedTargetId?: string;
  widgetWidth?: string;
  widgetHeight?: string;
  
  // Swap configuration
  defaultInputMint?: string;
  defaultOutputMint?: string;
  fixedInputMint?: boolean;
  fixedOutputMint?: boolean;
  
  // Amount configuration
  defaultAmount?: string;
  fixedAmount?: boolean;
  
  // Jupiter Terminal styling
  containerClassName?: string;
  containerStyles?: React.CSSProperties;
  
  // Event handlers
  onSuccess?: (result: { txid: string; swapResult: any }) => void;
  onSwapError?: (error: any) => void;
}

const JupiterTerminalComponent: React.FC<JupiterTerminalProps> = ({
  displayMode = 'integrated',
  integratedTargetId = 'jupiter-terminal-target',
  widgetWidth = '450px',
  widgetHeight = '620px',
  defaultInputMint = 'So11111111111111111111111111111111111111112', // SOL
  defaultOutputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  fixedInputMint = false,
  fixedOutputMint = false,
  defaultAmount = '',
  fixedAmount = false,
  containerClassName = '',
  containerStyles = {},
  onSuccess,
  onSwapError
}) => {
  const { wallet, publicKey, signTransaction, signAllTransactions } = useWallet();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize Jupiter Terminal
  useEffect(() => {
    const initJupiterTerminal = async () => {
      if (typeof window === 'undefined' || !window.Jupiter || isInitialized) {
        return;
      }
      
      try {
        // Check if Jupiter Terminal instance already exists
        if (window.Jupiter._instance) {
          window.Jupiter.close();
        }
        
        // Create wallet adapter for Jupiter Terminal
        const walletPassthrough = wallet ? {
          publicKey: publicKey,
          signTransaction: signTransaction,
          signAllTransactions: signAllTransactions,
        } : undefined;
        
        // Initialize Jupiter Terminal
        window.Jupiter.init({
          displayMode,
          integratedTargetId: displayMode === 'integrated' ? integratedTargetId : undefined,
          endpoint: 'https://api.mainnet-alpha.sonic.game',
          strictTokenList: true, // Only show verified tokens
          
          // Form props for swap configuration
          formProps: {
            initialInputMint: defaultInputMint,
            initialOutputMint: defaultOutputMint,
            fixedInputMint,
            fixedOutputMint,
            initialAmount: defaultAmount,
            fixedAmount,
            swapMode: 'ExactIn',
          },
          
          // Style props
          containerStyles,
          containerClassName,
          
          // Wallet config
          walletPassthrough,
          
          // Event handlers
          onSuccess,
          onSwapError,
        });
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing Jupiter Terminal:', error);
      }
    };
    
    // Initialize Jupiter Terminal when wallet connection changes
    initJupiterTerminal();
    
    // Cleanup on unmount
    return () => {
      if (window.Jupiter && window.Jupiter.close) {
        window.Jupiter.close();
        setIsInitialized(false);
      }
    };
  }, [wallet, publicKey, displayMode, integratedTargetId]);
  
  // Handle wallet connection changes
  useEffect(() => {
    if (!isInitialized || !publicKey || !wallet) {
      return;
    }
    
    // Update wallet passthrough when wallet connection changes
    const walletPassthrough = {
      publicKey: publicKey,
      signTransaction: signTransaction,
      signAllTransactions: signAllTransactions,
    };
    
    if (window.Jupiter && window.Jupiter.updateWallet) {
      window.Jupiter.updateWallet(walletPassthrough);
    }
  }, [wallet, publicKey, isInitialized]);
  
  return (
    <>
      {displayMode === 'integrated' && (
        <div 
          id={integratedTargetId} 
          ref={containerRef} 
          style={{
            width: '100%',
            minHeight: '600px',
            ...containerStyles
          }}
          className={containerClassName}
        />
      )}
      
      {displayMode === 'widget' && (
        <div style={{ width: widgetWidth, height: widgetHeight }}>
          {/* Jupiter Terminal will be rendered here in widget mode */}
        </div>
      )}
      
      {displayMode === 'modal' && (
        <button
          onClick={() => {
            if (window.Jupiter && window.Jupiter.resume) {
              window.Jupiter.resume();
            }
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Open Swap Terminal
        </button>
      )}
    </>
  );
};

export default JupiterTerminalComponent;