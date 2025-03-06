/**
 * Jupiter API type definitions
 */

// Global Jupiter Terminal type
declare global {
    interface Window {
      Jupiter: JupiterTerminal;
    }
  }
  
  // Jupiter Terminal interfaces
  export interface JupiterTerminal {
    init: (params: JupiterTerminalParams) => void;
    resume: () => void;
    close: () => void;
    updateWallet: (wallet: any) => void;
    _instance?: any;
  }
  
  // Jupiter Terminal initialization parameters
  export interface JupiterTerminalParams {
    // Display options
    displayMode: 'integrated' | 'widget' | 'modal';
    integratedTargetId?: string;
    
    // Connection options
    endpoint?: string;
    
    // Form props
    formProps?: {
      initialInputMint?: string;
      initialOutputMint?: string;
      fixedInputMint?: boolean;
      fixedOutputMint?: boolean;
      initialAmount?: string;
      fixedAmount?: boolean;
      swapMode?: 'ExactIn' | 'ExactOut';
      initialSlippageBps?: number;
    };
    
    // Wallet passthrough
    walletPassthrough?: any;
    
    // Visual customization
    containerClassName?: string;
    containerStyles?: Record<string, any>;
    
    // Fee settings
    platformFeeAndAccounts?: {
      feeBps: number;
      feeAccount: string;
    };
    
    // Token list settings
    strictTokenList?: boolean;
    
    // Callbacks
    onSuccess?: (result: { txid: string; swapResult: any }) => void;
    onSwapError?: (params: { error: Error }) => void;
  }
  
  // Jupiter Quote API interfaces
  export interface JupiterQuoteParams {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    platformFeeBps?: number;
    onlyDirectRoutes?: boolean;
    asLegacyTransaction?: boolean;
    maxAccounts?: number;
    restrictIntermediateTokens?: boolean;
    swapMode?: 'ExactIn' | 'ExactOut';
  }
  
  export interface JupiterQuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: 'ExactIn' | 'ExactOut';
    slippageBps: number;
    platformFee?: {
      amount: string;
      feeBps: number;
    };
    priceImpactPct: string;
    routePlan: Array<{
      swapInfo: {
        ammKey: string;
        label: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
      };
      percent: number;
    }>;
    contextSlot: number;
    timeTaken: number;
  }
  
  // Jupiter Swap API interfaces
  export interface JupiterSwapParams {
    quoteResponse: JupiterQuoteResponse;
    userPublicKey: string;
    destinationTokenAccount?: string;
    dynamicComputeUnitLimit?: boolean;
    dynamicSlippage?: boolean;
    prioritizationFeeLamports?: {
      priorityLevelWithMaxLamports?: {
        maxLamports: number;
        priorityLevel: 'medium' | 'high' | 'veryHigh';
        global?: boolean;
      };
      jitoTipLamports?: number;
    };
    wrapAndUnwrapSol?: boolean;
    useTokenLedger?: boolean;
    feeAccount?: string;
  }
  
  export interface JupiterSwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
    prioritizationFeeLamports: number;
    computeUnitLimit: number;
    prioritizationType: {
      computeBudget?: {
        microLamports: number;
        estimatedMicroLamports: number;
      };
    };
    dynamicSlippageReport?: {
      slippageBps: number;
      otherAmount: number | null;
      simulatedIncurredSlippageBps: number | null;
      amplificationRatio: string | null;
      categoryName: string;
      heuristicMaxSlippageBps: number;
    };
    simulationError: string | null;
  }
  
  // Jupiter Ultra API interfaces
  export interface JupiterOrderParams {
    inputMint: string;
    outputMint: string;
    amount: string;
    taker?: string;
  }
  
  export interface JupiterOrderResponse {
    swapType: 'aggregator' | 'rfq';
    environment: string;
    requestId: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: 'ExactIn' | 'ExactOut';
    slippageBps: number;
    priceImpactPct: string;
    routePlan: Array<{
      swapInfo: {
        ammKey: string;
        label: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
      };
      percent: number;
    }>;
    inputMint: string;
    outputMint: string;
    feeBps: number;
    taker: string | null;
    gasless: boolean;
    transaction: string;
    prioritizationType: string;
    prioritizationFeeLamports: number;
    lastValidBlockHeight: number;
    dynamicSlippageReport?: {
      slippageBps: number;
      otherAmount: number | null;
      simulatedIncurredSlippageBps: number | null;
      amplificationRatio: string | null;
      categoryName: string;
      heuristicMaxSlippageBps: number;
      rtseSlippageBps: number;
      failedTxnEstSlippage: number;
      priceMovementEstSlippage: number;
      emaEstSlippage: number;
    };
    totalTime: number;
  }
  
  export interface JupiterExecuteParams {
    signedTransaction: string;
    requestId: string;
  }
  
  export interface JupiterExecuteResponse {
    status: 'Success' | 'Failed';
    signature?: string;
    error?: string;
    code?: number;
    slot?: string;
    inputAmountResult?: string;
    outputAmountResult?: string;
    swapEvents?: Array<{
      inputMint: string;
      inputAmount: string;
      outputMint: string;
      outputAmount: string;
    }>;
  }
  
  // Jupiter Price API interfaces
  export interface JupiterPriceParams {
    ids: string | string[];
    vsToken?: string;
    showExtraInfo?: boolean;
  }
  
  export interface JupiterPriceResponse {
    data: {
      [key: string]: {
        id: string;
        type: string;
        price: string;
        extraInfo?: {
          lastSwappedPrice?: {
            lastJupiterSellAt?: number;
            lastJupiterSellPrice?: string;
            lastJupiterBuyAt?: number;
            lastJupiterBuyPrice?: string;
          };
          quotedPrice?: {
            buyPrice?: string;
            buyAt?: number;
            sellPrice?: string;
            sellAt?: number;
          };
          confidenceLevel?: 'high' | 'medium' | 'low';
          depth?: {
            buyPriceImpactRatio?: {
              depth?: {
                '10'?: number;
                '100'?: number;
                '1000'?: number;
              };
              timestamp?: number;
            };
            sellPriceImpactRatio?: {
              depth?: {
                '10'?: number;
                '100'?: number;
                '1000'?: number;
              };
              timestamp?: number;
            };
          };
        };
      };
    };
    timeTaken: number;
  }
  
  // Jupiter Token API interfaces
  export interface JupiterTokenInfo {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    tags?: string[];
    daily_volume?: number;
    created_at?: string;
    freeze_authority?: string | null;
    mint_authority?: string | null;
    permanent_delegate?: string | null;
    minted_at?: string | null;
    extensions?: {
      coingeckoId?: string;
      [key: string]: any;
    };
  }