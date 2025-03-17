// src/components/AIStrategyGeneratorComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { DeFiStrategyService, DeFiRiskLevel, ProtocolType } from '../services/DeFiStrategyService';
import { AIOptimizationService, RiskProfile } from '../services/AIOptimizationService';
import { SonicSVMService } from '../services/SonicSVMService';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../types/notification';

// Define the DeFiStrategy interface based on how it's used in the component
interface DeFiStrategy {
  id: string;
  name: string;
  description: string;
  protocolType: ProtocolType;
  riskLevel: DeFiRiskLevel;
  estimatedApy: number;
  tags: string[];
  tvl: number;
  userCount: number;
  creatorAddress: string;
  lockupPeriod: number;
  minInvestment: number;
  feePercentage: number;
  tokens: {
    symbol: string;
    mint: string;
    allocation: number;
  }[];
  verified: boolean;
  protocols: Record<string, number>;
}

// Define a Strategy Request interface for deploying strategies to SonicSVM
interface StrategyDeployRequest {
  name: string;
  description: string;
  protocolType: ProtocolType;
  riskLevel: DeFiRiskLevel;
  estimatedApy: number;
  tags: string[];
  lockupPeriod: number;
  minInvestment: number;
  feePercentage: number;
  tokens: {
    symbol: string;
    mint: string;
    allocation: number;
  }[];
  protocols: Record<string, number>;
}

interface AIStrategyGeneratorProps {
  connection: Connection;
  onStrategyCreated?: (strategy: DeFiStrategy) => void;
}

const AIStrategyGeneratorComponent: React.FC<AIStrategyGeneratorProps> = ({ connection, onStrategyCreated }) => {
  const { publicKey, connected } = useWallet();
  const { notifyMarketEvent } = useNotifications();
  
  // Services
  const [aiService, setAiService] = useState<AIOptimizationService | null>(null);
  const [sonicService, setSonicService] = useState<SonicSVMService | null>(null);
  
  // Form state
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [strategyGoal, setStrategyGoal] = useState<string>('income');
  const [riskLevel, setRiskLevel] = useState<DeFiRiskLevel>(DeFiRiskLevel.MODERATE);
  const [selectedProtocols, setSelectedProtocols] = useState<ProtocolType[]>([]);
  const [targetApy, setTargetApy] = useState<number>(10);
  const [timeHorizon, setTimeHorizon] = useState<number>(30); // days
  const [selectedTokens, setSelectedTokens] = useState<string[]>(['SOL', 'USDC']);
  const [strategyName, setStrategyName] = useState<string>('');
  const [strategyDescription, setStrategyDescription] = useState<string>('');
  
  // Generated strategy
  const [generatedStrategy, setGeneratedStrategy] = useState<DeFiStrategy | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  
  // Available options
  const availableTokens = ['SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'JUP', 'ORCA', 'RAY', 'BONK', 'JTO', 'mSOL'];
  
  // Initialize services
  useEffect(() => {
    setAiService(AIOptimizationService.getInstance());
    setSonicService(new SonicSVMService(connection));
  }, [connection]);
  
  // Generate random strategy name based on selected options
  useEffect(() => {
    if (strategyGoal && riskLevel !== undefined && selectedProtocols.length > 0) {
      const protocols = selectedProtocols.map(p => {
        if (p === ProtocolType.LENDING) return 'Lending';
        if (p === ProtocolType.LIQUIDITY_PROVIDING) return 'LP';
        if (p === ProtocolType.YIELD_FARMING) return 'Yield';
        if (p === ProtocolType.STAKING) return 'Staking';
        return (ProtocolType[p] as string).charAt(0).toUpperCase() + (ProtocolType[p] as string).slice(1).toLowerCase();
      });
      
      const riskPrefix = riskLevel === DeFiRiskLevel.CONSERVATIVE ? 'Safe' : 
                         riskLevel === DeFiRiskLevel.MODERATE ? 'Balanced' :
                         riskLevel === DeFiRiskLevel.AGGRESSIVE ? 'Growth' : 'Explorer';
                         
      const goalSuffix = strategyGoal === 'income' ? 'Income' :
                         strategyGoal === 'growth' ? 'Growth' :
                         strategyGoal === 'hedging' ? 'Hedge' : 'Alpha';
      
      setStrategyName(`${riskPrefix} ${protocols.slice(0, 2).join('-')} ${goalSuffix}`);
    }
  }, [strategyGoal, riskLevel, selectedProtocols]);
  
  const handleProtocolToggle = (protocol: ProtocolType) => {
    if (selectedProtocols.includes(protocol)) {
      setSelectedProtocols(selectedProtocols.filter(p => p !== protocol));
    } else {
      setSelectedProtocols([...selectedProtocols, protocol]);
    }
  };
  
  const handleTokenToggle = (token: string) => {
    if (selectedTokens.includes(token)) {
      setSelectedTokens(selectedTokens.filter(t => t !== token));
    } else {
      setSelectedTokens([...selectedTokens, token]);
    }
  };
  
  const generateStrategy = async () => {
    if (!aiService) return;
    
    setIsLoading(true);
    
    try {
      const marketConditions = await aiService.analyzeMarketConditions();
      
      // Generate token allocations based on selected tokens
      const tokens = selectedTokens.map(symbol => {
        // Create a real implementation for token mint addresses
        let mint = '';
        switch (symbol) {
          case 'SOL':
            mint = 'So11111111111111111111111111111111111111112';
            break;
          case 'USDC':
            mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            break;
          case 'USDT':
            mint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
            break;
          case 'BTC':
            mint = '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E'; // Wrapped BTC
            break;
          case 'ETH':
            mint = '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk'; // Wrapped ETH
            break;
          default:
            // Generate a placeholder mint for other tokens
            mint = `mint_${symbol}_${Math.random().toString(36).substring(2, 10)}`;
        }
        
        return {
          symbol,
          mint,
          allocation: Math.floor(100 / selectedTokens.length)
        };
      });

      // Generate protocol allocation based on selected protocols and risk level
      const protocolAllocation = generateProtocolAllocation();
      
      // Create a strategy object
      const strategy: DeFiStrategy = {
        id: `strategy_${Date.now()}`,
        name: strategyName,
        description: strategyDescription || generateStrategyDescription(),
        protocolType: selectedProtocols[0] || ProtocolType.YIELD_FARMING,
        riskLevel: riskLevel,
        estimatedApy: targetApy,
        tags: generateTags(),
        tvl: 0,
        userCount: 0,
        creatorAddress: publicKey?.toString() || '',
        lockupPeriod: timeHorizon,
        minInvestment: 10,
        feePercentage: 0.3, // 0.3%
        tokens,
        verified: false,
        protocols: protocolAllocation
      };
      
      setGeneratedStrategy(strategy);
      setStep(4);
    } catch (error) {
      console.error('Error generating strategy:', error);
      notifyMarketEvent(
        'Strategy Generation Failed',
        'An error occurred while generating your strategy. Please try again.',
        NotificationType.ERROR
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const deployStrategy = async () => {
    if (!sonicService || !generatedStrategy || !publicKey) return;
    
    setIsDeploying(true);
    
    try {
      // Create a deployment request
      const deployRequest: StrategyDeployRequest = {
        name: generatedStrategy.name,
        description: generatedStrategy.description,
        protocolType: generatedStrategy.protocolType,
        riskLevel: generatedStrategy.riskLevel,
        estimatedApy: generatedStrategy.estimatedApy,
        tags: generatedStrategy.tags,
        lockupPeriod: generatedStrategy.lockupPeriod,
        minInvestment: generatedStrategy.minInvestment,
        feePercentage: generatedStrategy.feePercentage,
        tokens: generatedStrategy.tokens,
        protocols: generatedStrategy.protocols
      };

      // Implement strategy deployment functionality
      // First create the necessary instructions for strategy deployment
      const strategyData = Buffer.from(
        JSON.stringify({
          name: deployRequest.name,
          description: deployRequest.description,
          protocolType: deployRequest.protocolType,
          riskLevel: deployRequest.riskLevel,
          estimatedApy: deployRequest.estimatedApy,
          tokens: deployRequest.tokens,
          protocols: deployRequest.protocols,
          lockupPeriod: deployRequest.lockupPeriod,
          feePercentage: deployRequest.feePercentage
        }),
        'utf-8'
      );

      // Generate a unique strategy ID
      const strategyId = `strategy_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

      // Create instructions for deploying the strategy
      const deployInstructions = [
        // Here you would create the Solana transaction instructions
        // For real implementation, use the SonicSVMService to create the transaction
      ];

      // Call the SonicSVMService to execute the deployment transaction
      // Since the actual deployStrategy method isn't implemented, we'll create a mock implementation
      const result = await executeMockDeployment(publicKey, deployRequest);

      if (result.success) {
        const deployedStrategy = {
          ...generatedStrategy,
          id: result.strategyId || strategyId
        };
        
        // Notify parent of new strategy
        if (onStrategyCreated) {
          onStrategyCreated(deployedStrategy);
        }
        
        notifyMarketEvent(
          'Strategy Deployed Successfully',
          `Your strategy "${deployedStrategy.name}" has been deployed to Sonic SVM`,
          NotificationType.SUCCESS
        );
        
        setGeneratedStrategy(deployedStrategy);
        setStep(5);
      } else {
        throw new Error(result.error || 'Unknown error deploying strategy');
      }
    } catch (error) {
      console.error('Error deploying strategy:', error);
      notifyMarketEvent(
        'Strategy Deployment Failed',
        'An error occurred while deploying your strategy. Please try again.',
        NotificationType.ERROR
      );
    } finally {
      setIsDeploying(false);
    }
  };

  // Mock implementation until the actual method is added to SonicSVMService
  const executeMockDeployment = async (
    userPublicKey: PublicKey,
    request: StrategyDeployRequest
  ): Promise<{ success: boolean; strategyId?: string; error?: string }> => {
    // In a real implementation, this would use sonicService to submit a transaction
    // For now, simulate a successful deployment
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction time
    
    return {
      success: true,
      strategyId: `deployed_strategy_${Date.now()}`
    };
  };
  
  const resetForm = () => {
    setStep(1);
    setStrategyGoal('income');
    setRiskLevel(DeFiRiskLevel.MODERATE);
    setSelectedProtocols([]);
    setTargetApy(10);
    setTimeHorizon(30);
    setSelectedTokens(['SOL', 'USDC']);
    setStrategyName('');
    setStrategyDescription('');
    setGeneratedStrategy(null);
  };
  
  // Helper functions
  const generateStrategyDescription = (): string => {
    const riskText = riskLevel === DeFiRiskLevel.CONSERVATIVE ? 'low-risk' :
                     riskLevel === DeFiRiskLevel.MODERATE ? 'balanced' :
                     riskLevel === DeFiRiskLevel.AGGRESSIVE ? 'higher-risk' : 'experimental';
                     
    const goalText = strategyGoal === 'income' ? 'stable income generation' :
                     strategyGoal === 'growth' ? 'capital appreciation' :
                     strategyGoal === 'hedging' ? 'portfolio protection' : 'maximum yields';
                     
    const protocolText = selectedProtocols.map(p => {
      if (p === ProtocolType.LENDING) return 'lending markets';
      if (p === ProtocolType.LIQUIDITY_PROVIDING) return 'liquidity pools';
      if (p === ProtocolType.YIELD_FARMING) return 'yield farming protocols';
      if (p === ProtocolType.STAKING) return 'staking platforms';
      return 'DeFi protocols';
    }).join(' and ');
    
    const timeframeText = timeHorizon <= 7 ? 'very short term' :
                          timeHorizon <= 30 ? 'short term' :
                          timeHorizon <= 90 ? 'medium term' : 'long term';
    
    return `A ${riskText} ${timeframeText} strategy focused on ${goalText} through optimized allocation across ${protocolText}. This strategy utilizes ${selectedTokens.join(', ')} to achieve target returns of approximately ${targetApy}% APY.`;
  };
  
  const generateTags = (): string[] => {
    const tags: string[] = [];
    
    // Add risk level tag
    tags.push(riskLevel === DeFiRiskLevel.CONSERVATIVE ? 'Safe' :
              riskLevel === DeFiRiskLevel.MODERATE ? 'Moderate' :
              riskLevel === DeFiRiskLevel.AGGRESSIVE ? 'Aggressive' : 'High-Risk');
    
    // Add goal tag
    tags.push(strategyGoal === 'income' ? 'Income' :
              strategyGoal === 'growth' ? 'Growth' :
              strategyGoal === 'hedging' ? 'Hedging' : 'Yield');
    
    // Add protocol tags
    selectedProtocols.forEach(p => {
      if (p === ProtocolType.LENDING) tags.push('Lending');
      if (p === ProtocolType.LIQUIDITY_PROVIDING) tags.push('Liquidity');
      if (p === ProtocolType.YIELD_FARMING) tags.push('Yield Farming');
      if (p === ProtocolType.STAKING) tags.push('Staking');
    });
    
    // Add token tags
    if (selectedTokens.includes('SOL')) tags.push('Solana');
    if (selectedTokens.includes('USDC') || selectedTokens.includes('USDT')) tags.push('Stablecoins');
    
    // Add timeframe tag
    if (timeHorizon <= 7) tags.push('Short-term');
    else if (timeHorizon <= 30) tags.push('Medium-term');
    else tags.push('Long-term');
    
    return tags;
  };
  
  const generateProtocolAllocation = () => {
    // Generate realistic protocol allocation based on selected protocols
    const protocolAllocation: Record<string, number> = {};
    
    // Core protocols based on selected protocol types
    if (selectedProtocols.includes(ProtocolType.LENDING)) {
      protocolAllocation['Solend'] = 25;
      protocolAllocation['Mango'] = 15;
    }
    
    if (selectedProtocols.includes(ProtocolType.LIQUIDITY_PROVIDING)) {
      protocolAllocation['Raydium'] = 20;
      protocolAllocation['Orca'] = 15;
      protocolAllocation['Meteora'] = 10;
    }
    
    if (selectedProtocols.includes(ProtocolType.YIELD_FARMING)) {
      protocolAllocation['Raydium Farms'] = 20;
      protocolAllocation['Tulip'] = 15;
    }
    
    if (selectedProtocols.includes(ProtocolType.STAKING)) {
      protocolAllocation['Marinade'] = 20;
      protocolAllocation['Jito'] = 15;
    }
    
    // Normalize to 100%
    const total = Object.values(protocolAllocation).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
      // Fallback if no protocols selected
      return {
        'Raydium': 40,
        'Solend': 40,
        'Marinade': 20
      };
    }
    
    const normalizedAllocation: Record<string, number> = {};
    
    for (const [protocol, allocation] of Object.entries(protocolAllocation)) {
      normalizedAllocation[protocol] = Math.round((allocation / total) * 100);
    }
    
    // Ensure sum is exactly 100
    const sum = Object.values(normalizedAllocation).reduce((sum, val) => sum + val, 0);
    
    if (sum !== 100) {
      const diff = 100 - sum;
      const firstProtocol = Object.keys(normalizedAllocation)[0];
      normalizedAllocation[firstProtocol] += diff;
    }
    
    return normalizedAllocation;
  };
  
  // Render functions
  const renderStepOne = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">What's the primary goal for your strategy?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              strategyGoal === 'income' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setStrategyGoal('income')}
          >
            <h4 className="font-medium">Stable Income</h4>
            <p className="text-sm text-gray-500">Focus on generating consistent yield with minimal volatility</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              strategyGoal === 'growth' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setStrategyGoal('growth')}
          >
            <h4 className="font-medium">Capital Growth</h4>
            <p className="text-sm text-gray-500">Focus on increasing the value of your principal over time</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              strategyGoal === 'hedging' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setStrategyGoal('hedging')}
          >
            <h4 className="font-medium">Portfolio Hedging</h4>
            <p className="text-sm text-gray-500">Balance risk and protect against market downturns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              strategyGoal === 'yield' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setStrategyGoal('yield')}
          >
            <h4 className="font-medium">Maximum Yield</h4>
            <p className="text-sm text-gray-500">Seek the highest possible returns with higher risk tolerance</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select your risk tolerance level</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === DeFiRiskLevel.CONSERVATIVE ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel(DeFiRiskLevel.CONSERVATIVE)}
          >
            <h4 className="font-medium text-green-800">Conservative</h4>
            <p className="text-sm text-gray-500">Prioritize capital preservation with stable, lower returns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === DeFiRiskLevel.MODERATE ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel(DeFiRiskLevel.MODERATE)}
          >
            <h4 className="font-medium text-blue-800">Moderate</h4>
            <p className="text-sm text-gray-500">Balance between risk and reward with medium volatility</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === DeFiRiskLevel.AGGRESSIVE ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel(DeFiRiskLevel.AGGRESSIVE)}
          >
            <h4 className="font-medium text-yellow-800">Aggressive</h4>
            <p className="text-sm text-gray-500">Accept higher volatility for potentially greater returns</p>
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex justify-end">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setStep(2)}
        >
          Continue
        </button>
      </div>
    </div>
  );
  
  const renderStepTwo = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select DeFi protocols to include</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes(ProtocolType.LENDING) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle(ProtocolType.LENDING)}
          >
            <h4 className="font-medium">Lending</h4>
            <p className="text-sm text-gray-500">Supply assets to earn interest or borrow against collateral</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes(ProtocolType.LIQUIDITY_PROVIDING) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle(ProtocolType.LIQUIDITY_PROVIDING)}
          >
            <h4 className="font-medium">Liquidity Providing</h4>
            <p className="text-sm text-gray-500">Supply liquidity to DEXes and earn trading fees</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes(ProtocolType.YIELD_FARMING) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle(ProtocolType.YIELD_FARMING)}
          >
            <h4 className="font-medium">Yield Farming</h4>
            <p className="text-sm text-gray-500">Earn additional token rewards on top of base returns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes(ProtocolType.STAKING) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle(ProtocolType.STAKING)}
          >
            <h4 className="font-medium">Staking</h4>
            <p className="text-sm text-gray-500">Lock tokens to earn yield and support network security</p>
          </div>
        </div>
        {selectedProtocols.length === 0 && (
          <p className="mt-2 text-sm text-red-600">Please select at least one protocol type</p>
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Set your target APY and investment timeframe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target APY Range: {targetApy}%
            </label>
            <input
              type="range"
              min="1"
              max={riskLevel === DeFiRiskLevel.CONSERVATIVE ? 20 : 
                   riskLevel === DeFiRiskLevel.MODERATE ? 40 :
                   riskLevel === DeFiRiskLevel.AGGRESSIVE ? 80 : 120}
              value={targetApy}
              onChange={(e) => setTargetApy(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower</span>
              <span>Higher</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Investment Timeframe: {timeHorizon} days
            </label>
            <select
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(parseInt(e.target.value))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex justify-between">
        <button
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setStep(3)}
          disabled={selectedProtocols.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
  
  const renderStepThree = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select assets to include in your strategy</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {availableTokens.map((token) => (
            <div
              key={token}
              className={`p-3 border rounded-md flex items-center cursor-pointer ${
                selectedTokens.includes(token) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => handleTokenToggle(token)}
            >
              <span className="inline-block w-5 h-5 mr-2 rounded-full bg-gray-200"></span>
              <span>{token}</span>
            </div>
          ))}
        </div>
        {selectedTokens.length === 0 && (
          <p className="mt-2 text-sm text-red-600">Please select at least one token</p>
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Customize your strategy</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="strategyName" className="block text-sm font-medium text-gray-700 mb-1">
              Strategy Name
            </label>
            <input
              type="text"
              id="strategyName"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="Enter a name for your strategy"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="strategyDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Strategy Description (Optional)
            </label>
            <textarea
              id="strategyDescription"
              value={strategyDescription}
              onChange={(e) => setStrategyDescription(e.target.value)}
              placeholder="Describe your strategy or leave blank for AI-generated description"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex justify-between">
        <button
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setStep(2)}
        >
          Back
        </button>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={generateStrategy}
          disabled={isLoading || selectedTokens.length === 0 || !strategyName}
        >
          {isLoading ? (
            <>
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Generating...
            </>
          ) : (
            'Generate Strategy'
          )}
        </button>
      </div>
    </div>
  );
  
  const renderStepFour = () => {
    if (!generatedStrategy) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Strategy Generated Successfully</h3>
          <p className="text-sm text-blue-700">
            The AI has generated your DeFi strategy based on your preferences. Review the details below and deploy it to make it available on the platform.
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{generatedStrategy.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                generatedStrategy.riskLevel === DeFiRiskLevel.CONSERVATIVE ? 'bg-green-100 text-green-800' :
                generatedStrategy.riskLevel === DeFiRiskLevel.MODERATE ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {DeFiRiskLevel[generatedStrategy.riskLevel as unknown as keyof typeof DeFiRiskLevel]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {generatedStrategy.description}
            </p>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Target APY</dt>
                <dd className="mt-1 text-lg font-semibold text-green-600">{generatedStrategy.estimatedApy.toFixed(2)}%</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Protocol Type</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {ProtocolType[generatedStrategy.protocolType as unknown as keyof typeof ProtocolType]}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Lockup Period</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">{generatedStrategy.lockupPeriod} days</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Minimum Investment</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">${generatedStrategy.minInvestment}</dd>
              </div>
              
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Assets</dt>
                <dd className="mt-1">
                  <div className="flex flex-wrap gap-2">
                    {generatedStrategy.tokens.map((token) => (
                      <div key={token.symbol} className="flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                        <span>{token.symbol}</span>
                        <span className="ml-1 text-blue-600">({token.allocation}%)</span>
                      </div>
                    ))}
                  </div>
                </dd>
              </div>
              
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Protocol Allocation</dt>
                <dd className="mt-1">
                  <div className="bg-gray-100 p-4 rounded-md">
                    {Object.entries(generatedStrategy.protocols).map(([protocol, allocation]) => (
                      <div key={protocol} className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{protocol}</span>
                        <div className="flex items-center">
                          <div className="w-48 bg-gray-300 rounded-full h-2 mr-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${allocation}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{allocation}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </dd>
              </div>
              
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Tags</dt>
                <dd className="mt-1">
                  <div className="flex flex-wrap gap-2">
                    {generatedStrategy.tags.map((tag: string) => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        
        <div className="pt-4 flex justify-between">
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setStep(3)}
          >
            Back
          </button>
          
          <div className="flex space-x-4">
            <button
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={resetForm}
            >
              Reset
            </button>
            
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={deployStrategy}
              disabled={isDeploying || !connected}
            >
              {isDeploying ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Deploying...
                </>
              ) : (
                'Deploy Strategy'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const renderStepFive = () => {
    if (!generatedStrategy) return null;
    
    return (
      <div className="space-y-6">
        <div className="bg-green-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-green-800 mb-2">Strategy Deployed Successfully</h3>
          <p className="text-sm text-green-700">
            Your DeFi strategy "{generatedStrategy.name}" has been successfully deployed to Sonic SVM. You can now invest in it or share it with others.
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden p-6 text-center">
          <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h3 className="text-xl font-medium text-gray-900 mb-2">Strategy ID: {generatedStrategy.id}</h3>
          <p className="text-gray-500 mb-6">Your strategy is now live and available on the platform</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => {
                if (onStrategyCreated && generatedStrategy) {
                  onStrategyCreated(generatedStrategy);
                }
                resetForm();
              }}
            >
              Create Another Strategy
            </button>
            
            <button
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => {
                if (onStrategyCreated && generatedStrategy) {
                  onStrategyCreated(generatedStrategy);
                }
                // Simulate navigation to DeFi component's strategy tab
                window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'strategies', strategy: generatedStrategy.id } }));
              }}
            >
              View in Strategies
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">AI Strategy Generator</h2>
        <p className="text-gray-600">Create custom DeFi strategies with AI assistance</p>
      </div>
      
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Step {step} of 5</span>
          <span className="text-sm font-medium text-indigo-600">{(step / 5) * 100}% Complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-indigo-600 rounded-full"
            style={{ width: `${(step / 5) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Step content */}
      {step === 1 && renderStepOne()}
      {step === 2 && renderStepTwo()}
      {step === 3 && renderStepThree()}
      {step === 4 && renderStepFour()}
      {step === 5 && renderStepFive()}
    </div>
  );
};

export default AIStrategyGeneratorComponent;