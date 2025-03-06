// src/components/AIStrategyGeneratorComponent.tsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { DeFiStrategy, DeFiRiskLevel, ProtocolType } from '../services/DeFiStrategyService';
import { AIOptimizationService, RiskProfile } from '../services/AIOptimizationService';
import { SonicSVMService } from '../services/SonicSVMService';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationType } from '../services/NotificationService';

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
  const [riskLevel, setRiskLevel] = useState<DeFiRiskLevel>('moderate');
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
    setSonicService(SonicSVMService.getInstance(connection));
  }, [connection]);
  
  // Generate random strategy name based on selected options
  useEffect(() => {
    if (strategyGoal && riskLevel && selectedProtocols.length > 0) {
      const protocols = selectedProtocols.map(p => {
        if (p === 'lending') return 'Lending';
        if (p === 'liquidity_providing') return 'LP';
        if (p === 'yield_farming') return 'Yield';
        if (p === 'staking') return 'Staking';
        return p.charAt(0).toUpperCase() + p.slice(1);
      });
      
      const riskPrefix = riskLevel === 'conservative' ? 'Safe' : 
                         riskLevel === 'moderate' ? 'Balanced' :
                         riskLevel === 'aggressive' ? 'Growth' : 'Explorer';
                         
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate AI generation of strategy
      const strategy: DeFiStrategy = {
        id: `strategy_${Date.now()}`,
        name: strategyName,
        description: strategyDescription || generateStrategyDescription(),
        protocolType: selectedProtocols[0] || 'yield_farming',
        riskLevel: riskLevel,
        estimatedApy: targetApy * 100, // Convert to basis points
        tags: generateTags(),
        tvl: 0,
        userCount: 0,
        creatorAddress: publicKey?.toString() || '',
        lockupPeriod: timeHorizon,
        minInvestment: 10,
        feePercentage: 30, // 0.3%
        tokens: selectedTokens.map(symbol => ({
          symbol,
          mint: `mint_${symbol}_${Math.random().toString(36).substring(2, 10)}`,
          allocation: Math.floor(100 / selectedTokens.length)
        })),
        verified: false,
        protocols: generateProtocolAllocation()
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
      // Deploy to Sonic SVM
      const { success, strategyId, error } = await sonicService.deployStrategy(
        publicKey,
        {
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
        }
      );
      
      if (success && strategyId) {
        const deployedStrategy = {
          ...generatedStrategy,
          id: strategyId
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
        throw new Error(error || 'Unknown error deploying strategy');
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
  
  const resetForm = () => {
    setStep(1);
    setStrategyGoal('income');
    setRiskLevel('moderate');
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
    const riskText = riskLevel === 'conservative' ? 'low-risk' :
                     riskLevel === 'moderate' ? 'balanced' :
                     riskLevel === 'aggressive' ? 'higher-risk' : 'experimental';
                     
    const goalText = strategyGoal === 'income' ? 'stable income generation' :
                     strategyGoal === 'growth' ? 'capital appreciation' :
                     strategyGoal === 'hedging' ? 'portfolio protection' : 'maximum yields';
                     
    const protocolText = selectedProtocols.map(p => {
      if (p === 'lending') return 'lending markets';
      if (p === 'liquidity_providing') return 'liquidity pools';
      if (p === 'yield_farming') return 'yield farming protocols';
      if (p === 'staking') return 'staking platforms';
      if (p === 'options') return 'options protocols';
      return p;
    }).join(' and ');
    
    const timeframeText = timeHorizon <= 7 ? 'very short term' :
                          timeHorizon <= 30 ? 'short term' :
                          timeHorizon <= 90 ? 'medium term' : 'long term';
    
    return `A ${riskText} ${timeframeText} strategy focused on ${goalText} through optimized allocation across ${protocolText}. This strategy utilizes ${selectedTokens.join(', ')} to achieve target returns of approximately ${targetApy}% APY.`;
  };
  
  const generateTags = (): string[] => {
    const tags: string[] = [];
    
    // Add risk level tag
    tags.push(riskLevel === 'conservative' ? 'Safe' :
              riskLevel === 'moderate' ? 'Moderate' :
              riskLevel === 'aggressive' ? 'Aggressive' : 'Experimental');
    
    // Add goal tag
    tags.push(strategyGoal === 'income' ? 'Income' :
              strategyGoal === 'growth' ? 'Growth' :
              strategyGoal === 'hedging' ? 'Hedging' : 'Yield');
    
    // Add protocol tags
    selectedProtocols.forEach(p => {
      if (p === 'lending') tags.push('Lending');
      if (p === 'liquidity_providing') tags.push('Liquidity');
      if (p === 'yield_farming') tags.push('Yield Farming');
      if (p === 'staking') tags.push('Staking');
      if (p === 'options') tags.push('Options');
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
    if (selectedProtocols.includes('lending')) {
      protocolAllocation['Solend'] = 25;
      protocolAllocation['Mango'] = 15;
    }
    
    if (selectedProtocols.includes('liquidity_providing')) {
      protocolAllocation['Raydium'] = 20;
      protocolAllocation['Orca'] = 15;
      protocolAllocation['Meteora'] = 10;
    }
    
    if (selectedProtocols.includes('yield_farming')) {
      protocolAllocation['Raydium Farms'] = 20;
      protocolAllocation['Tulip'] = 15;
    }
    
    if (selectedProtocols.includes('staking')) {
      protocolAllocation['Marinade'] = 20;
      protocolAllocation['Jito'] = 15;
    }
    
    if (selectedProtocols.includes('options')) {
      protocolAllocation['Friktion'] = 10;
      protocolAllocation['PsyOptions'] = 10;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === 'conservative' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel('conservative')}
          >
            <h4 className="font-medium text-green-800">Conservative</h4>
            <p className="text-sm text-gray-500">Prioritize capital preservation with stable, lower returns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === 'moderate' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel('moderate')}
          >
            <h4 className="font-medium text-blue-800">Moderate</h4>
            <p className="text-sm text-gray-500">Balance between risk and reward with medium volatility</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === 'aggressive' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel('aggressive')}
          >
            <h4 className="font-medium text-yellow-800">Aggressive</h4>
            <p className="text-sm text-gray-500">Accept higher volatility for potentially greater returns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              riskLevel === 'experimental' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setRiskLevel('experimental')}
          >
            <h4 className="font-medium text-red-800">Experimental</h4>
            <p className="text-sm text-gray-500">High-risk strategies with potential for significant returns</p>
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
              selectedProtocols.includes('lending') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle('lending')}
          >
            <h4 className="font-medium">Lending</h4>
            <p className="text-sm text-gray-500">Supply assets to earn interest or borrow against collateral</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes('liquidity_providing') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle('liquidity_providing')}
          >
            <h4 className="font-medium">Liquidity Providing</h4>
            <p className="text-sm text-gray-500">Supply liquidity to DEXes and earn trading fees</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes('yield_farming') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle('yield_farming')}
          >
            <h4 className="font-medium">Yield Farming</h4>
            <p className="text-sm text-gray-500">Earn additional token rewards on top of base returns</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes('staking') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle('staking')}
          >
            <h4 className="font-medium">Staking</h4>
            <p className="text-sm text-gray-500">Lock tokens to earn yield and support network security</p>
          </div>
          <div
            className={`p-4 border rounded-md cursor-pointer ${
              selectedProtocols.includes('options') ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => handleProtocolToggle('options')}
          >
            <h4 className="font-medium">Options</h4>
            <p className="text-sm text-gray-500">Generate income or hedge with option writing/buying</p>
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
              max={riskLevel === 'conservative' ? 20 : 
                   riskLevel === 'moderate' ? 40 :
                   riskLevel === 'aggressive' ? 80 : 150}
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
                generatedStrategy.riskLevel === 'conservative' ? 'bg-green-100 text-green-800' :
                generatedStrategy.riskLevel === 'moderate' ? 'bg-blue-100 text-blue-800' :
                generatedStrategy.riskLevel === 'aggressive' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {generatedStrategy.riskLevel.charAt(0).toUpperCase() + generatedStrategy.riskLevel.slice(1)}
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
                <dd className="mt-1 text-lg font-semibold text-green-600">{(generatedStrategy.estimatedApy / 100).toFixed(2)}%</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Protocol Type</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {generatedStrategy.protocolType === 'lending' ? 'Lending' :
                   generatedStrategy.protocolType === 'liquidity_providing' ? 'Liquidity Providing' :
                   generatedStrategy.protocolType === 'yield_farming' ? 'Yield Farming' :
                   generatedStrategy.protocolType === 'staking' ? 'Staking' : 'Options'}
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
                    {generatedStrategy.tags.map((tag) => (
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