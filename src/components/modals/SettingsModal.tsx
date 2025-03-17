import React, { useState, useEffect, useMemo } from 'react';
import { useSonicAgent, useMarketData, useWallet } from '../../hooks';
import { AgentConfig, RiskProfile, TradingStrategy } from '../../types/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableStrategies?: TradingStrategy[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  availableStrategies = [],
}) => {
  const { 
    config: agentConfig, 
    updateAgentConfig,
    loading,
    isInitialized,
    initializeAgent
  } = useSonicAgent();
  
  const { publicKey, formatAddress } = useWallet();
  const { topTokens } = useMarketData();
  
  const [activeTab, setActiveTab] = useState<'general' | 'trading' | 'portfolio' | 'advanced'>('general');
  const [initModalOpen, setInitModalOpen] = useState<boolean>(false);
  const [agentName, setAgentName] = useState<string>('');
  const [agentDescription, setAgentDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [formValues, setFormValues] = useState<Partial<AgentConfig>>({
    name: '',
    description: '',
    autoRebalance: false,
    rebalanceThreshold: 5,
    maxSlippageBps: 50,
    riskProfile: 'moderate',
    activeStrategies: [],
    autoTrade: false,
    tradingBudget: 0,
    maxTradesPerDay: 5,
    preferredTokens: [],
    excludedTokens: [],
    gasSettings: {
      priorityFee: 'auto',
      retryOnFail: true,
      maxRetries: 3
    },
    notifications: {
      email: false,
      push: true,
      tradeExecuted: true,
      priceAlerts: false,
      rebalanceAlerts: true
    }
  });

  // Initialize form with current config when modal opens or config changes
  useEffect(() => {
    if (agentConfig) {
      setFormValues({
        name: agentConfig.name,
        description: agentConfig.description,
        autoRebalance: agentConfig.autoRebalance,
        rebalanceThreshold: agentConfig.rebalanceThreshold,
        maxSlippageBps: agentConfig.maxSlippageBps,
        riskProfile: agentConfig.riskProfile,
        activeStrategies: agentConfig.activeStrategies,
        autoTrade: agentConfig.autoTrade,
        tradingBudget: agentConfig.tradingBudget,
        maxTradesPerDay: agentConfig.maxTradesPerDay,
        preferredTokens: agentConfig.preferredTokens,
        excludedTokens: agentConfig.excludedTokens,
        gasSettings: agentConfig.gasSettings || {
          priorityFee: 'auto',
          retryOnFail: true,
          maxRetries: 3
        },
        notifications: agentConfig.notifications || {
          email: false,
          push: true,
          tradeExecuted: true,
          priceAlerts: false,
          rebalanceAlerts: true
        }
      });
    }
  }, [agentConfig, isOpen]);
  
  // Check if agent is initialized
  useEffect(() => {
    if (isOpen && !isInitialized && publicKey) {
      setInitModalOpen(true);
    }
  }, [isOpen, isInitialized, publicKey]);

  // Handle form input changes
  const handleChange = (field: keyof AgentConfig, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value
    }));
  export default SettingsModal;

  // Handle nested object changes
  const handleNestedChange = (parent: string, field: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof AgentConfig],
        [field]: value
      }
    }));
  };

  // Set up risk profiles with descriptions
  const riskProfiles = useMemo(() => [
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Focus on capital preservation with stable assets and lower returns. Lower risk, lower reward.'
    },
    {
      value: 'moderate',
      label: 'Moderate',
      description: 'Balanced approach with a mix of stable and growth assets. Medium risk, medium reward.'
    },
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Focus on growth with higher volatility assets. Higher risk, higher potential reward.'
    }
  ], []);

  // Filter tokens for selection dropdown
  const filteredTokens = useMemo(() => {
    return topTokens.filter(token => 
      !formValues.excludedTokens?.includes(token.mint) && 
      !formValues.preferredTokens?.includes(token.mint)
    );
  }, [topTokens, formValues.excludedTokens, formValues.preferredTokens]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      const success = await updateAgentConfig(formValues);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle agent initialization
  const handleInitAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agentName) return;
    
    try {
      setIsSubmitting(true);
      const success = await initializeAgent(agentName, agentDescription);
      if (success) {
        setInitModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render initialization modal if needed
  const renderInitializationModal = () => {
    if (!initModalOpen) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black bg-opacity-70">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">Initialize Your Agent</h2>
          <p className="text-gray-300 mb-4">
            Create your first AI trading agent to get started. You can customize its settings after initialization.
          </p>
          
          <form onSubmit={handleInitAgent} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1">Agent Name (required)</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder="My Trading Agent"
              />
            </div>
            
            <div>
              <label className="block text-gray-400 mb-1">Description (optional)</label>
              <textarea
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="This agent will help manage my DeFi portfolio"
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              {publicKey && (
                <button
                  type="button"
                  className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  onClick={() => {
                    setInitModalOpen(false);
                    onClose();
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                disabled={isSubmitting || !agentName}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Agent'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return null;
  }
  
  if (!publicKey) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
            <button
              className="text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          
          <p className="text-gray-300 mb-6">
            Please connect your wallet to access agent settings.
          </p>
          
          <button
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Agent Settings</h2>
          <button
            className="text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'general' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'trading' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('trading')}
          >
            Trading
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'portfolio' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            Portfolio
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'advanced' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-gray-400 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="My Trading Agent"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Description</label>
                <textarea
                  value={formValues.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Describe the purpose of this agent"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 mb-3">Risk Profile</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {riskProfiles.map((profile) => (
                    <div 
                      key={profile.value} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formValues.riskProfile === profile.value
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                      onClick={() => handleChange('riskProfile', profile.value)}
                    >
                      <div className="flex items-center mb-2">
                        <input
                          type="radio"
                          name="riskProfile"
                          checked={formValues.riskProfile === profile.value}
                          onChange={() => handleChange('riskProfile', profile.value)}
                          className="mr-2"
                        />
                        <span className="text-white font-medium capitalize">{profile.label}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{profile.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Notifications</label>
                <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white">Email Notifications</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formValues.notifications?.email} 
                        onChange={(e) => handleNestedChange('notifications', 'email', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white">Push Notifications</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formValues.notifications?.push} 
                        onChange={(e) => handleNestedChange('notifications', 'push', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white">Trade Execution Alerts</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formValues.notifications?.tradeExecuted} 
                        onChange={(e) => handleNestedChange('notifications', 'tradeExecuted', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-white">Price Alerts</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formValues.notifications?.priceAlerts} 
                        onChange={(e) => handleNestedChange('notifications', 'priceAlerts', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Trading Settings */}
          {activeTab === 'trading' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Automated Trading</h3>
                  <p className="text-gray-400 text-sm">Allow the agent to execute trades on your behalf</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formValues.autoTrade} 
                    onChange={(e) => handleChange('autoTrade', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all"></div>
                </label>
              </div>
              
              {formValues.autoTrade && (
                <>
                  <div>
                    <label className="block text-gray-400 mb-1">
                      Trading Budget (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formValues.tradingBudget}
                        onChange={(e) => handleChange('tradingBudget', parseFloat(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Maximum amount the agent can use for trading</p>
                  </div>
                  
                  <div>
                    <label className="block text-gray-400 mb-1">
                      Maximum Trades Per Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formValues.maxTradesPerDay}
                      onChange={(e) => handleChange('maxTradesPerDay', parseInt(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-gray-500 text-xs mt-1">Limit the number of trades per day</p>
                  </div>
                  
                  <div>
                    <label className="block text-gray-400 mb-1">
                      Maximum Slippage (%)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={formValues.maxSlippageBps ? formValues.maxSlippageBps / 100 : 0.5}
                      onChange={(e) => handleChange('maxSlippageBps', parseFloat(e.target.value) * 100)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-gray-500 text-xs mt-1">Maximum allowed price slippage for trades</p>
                  </div>
                  
                  <div>
                    <label className="block text-gray-400 mb-1">
                      Active Trading Strategies
                    </label>
                    <div className="bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                      {availableStrategies.length > 0 ? (
                        <div className="space-y-2">
                          {availableStrategies.map((strategy) => (
                            <div key={strategy.id} className="flex items-start">
                              <input
                                type="checkbox"
                                id={`strategy-${strategy.id}`}
                                checked={formValues.activeStrategies?.includes(strategy.id)}
                                onChange={(e) => {
                                  const updatedStrategies = e.target.checked
                                    ? [...(formValues.activeStrategies || []), strategy.id]
                                    : (formValues.activeStrategies || []).filter(id => id !== strategy.id);
                                  
                                  handleChange('activeStrategies', updatedStrategies);
                                }}
                                className="mt-1 mr-2"
                              />
                              <label htmlFor={`strategy-${strategy.id}`} className="cursor-pointer">
                                <div className="text-white font-medium">{strategy.name}</div>
                                <div className="text-gray-400 text-sm">{strategy.description}</div>
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center py-4">
                          No trading strategies available
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Portfolio Settings */}
          {activeTab === 'portfolio' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Auto-Rebalance Portfolio</h3>
                  <p className="text-gray-400 text-sm">Automatically rebalance your portfolio when assets deviate from target allocation</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formValues.autoRebalance} 
                    onChange={(e) => handleChange('autoRebalance', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all"></div>
                </label>
              </div>
              
              {formValues.autoRebalance && (
                <div>
                  <label className="block text-gray-400 mb-1">
                    Rebalance Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formValues.rebalanceThreshold}
                    onChange={(e) => handleChange('rebalanceThreshold', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Portfolio will be rebalanced when any asset deviates from target by this percentage
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-gray-400 mb-1">Preferred Tokens</label>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formValues.preferredTokens?.map((mint) => {
                      const token = topTokens.find(t => t.mint === mint) || { symbol: mint.slice(0, 5) + '...', logoURI: '' };
                      return (
                        <div 
                          key={mint}
                          className="flex items-center bg-gray-600 rounded-full pl-2 pr-1 py-1"
                        >
                          {token.logoURI && (
                            <img 
                              src={token.logoURI} 
                              alt={token.symbol} 
                              className="w-4 h-4 mr-1 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="text-white text-sm mr-1">{token.symbol}</span>
                          <button
                            type="button"
                            className="w-5 h-5 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center text-white"
                            onClick={() => handleChange(
                              'preferredTokens', 
                              formValues.preferredTokens?.filter(t => t !== mint) || []
                            )}
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  
                  <select
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleChange(
                          'preferredTokens', 
                          [...(formValues.preferredTokens || []), e.target.value]
                        );
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Add preferred token...</option>
                    {filteredTokens.map((token) => (
                      <option key={token.mint} value={token.mint}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-1">
                    Agent will prioritize these tokens in its strategies
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Excluded Tokens</label>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formValues.excludedTokens?.map((mint) => {
                      const token = topTokens.find(t => t.mint === mint) || { symbol: mint.slice(0, 5) + '...', logoURI: '' };
                      return (
                        <div 
                          key={mint}
                          className="flex items-center bg-gray-600 rounded-full pl-2 pr-1 py-1"
                        >
                          {token.logoURI && (
                            <img 
                              src={token.logoURI} 
                              alt={token.symbol} 
                              className="w-4 h-4 mr-1 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="text-white text-sm mr-1">{token.symbol}</span>
                          <button
                            type="button"
                            className="w-5 h-5 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center text-white"
                            onClick={() => handleChange(
                              'excludedTokens', 
                              formValues.excludedTokens?.filter(t => t !== mint) || []
                            )}
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  
                  <select
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleChange(
                          'excludedTokens', 
                          [...(formValues.excludedTokens || []), e.target.value]
                        );
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Add excluded token...</option>
                    {filteredTokens.map((token) => (
                      <option key={token.mint} value={token.mint}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-1">
                    Agent will never trade or hold these tokens
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Advanced Settings */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-3">Transaction Settings</h3>
                <div className="bg-gray-700 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-gray-400 mb-1">
                      Priority Fee
                    </label>
                    <select
                      value={formValues.gasSettings?.priorityFee || 'auto'}
                      onChange={(e) => handleNestedChange('gasSettings', 'priorityFee', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">Auto (Recommended)</option>
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="max">Maximum Priority</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="retryOnFail"
                      checked={formValues.gasSettings?.retryOnFail}
                      onChange={(e) => handleNestedChange('gasSettings', 'retryOnFail', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="retryOnFail" className="text-white cursor-pointer">
                      Retry failed transactions
                    </label>
                  </div>
                  
                  {formValues.gasSettings?.retryOnFail && (
                    <div>
                      <label className="block text-gray-400 mb-1">
                        Maximum Retries
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formValues.gasSettings?.maxRetries || 3}
                        onChange={(e) => handleNestedChange('gasSettings', 'maxRetries', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-3">Wallet Information</h3>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Connected Wallet:</span>
                    <span className="text-white font-mono">{publicKey && formatAddress(publicKey.toString())}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Network:</span>
                    <span className="text-white">Sonic SVM Mainnet</span>
                  </div>
                </div>
                <p className="text-yellow-500 text-xs mt-2">
                  Important: The agent will only have access to tokens you've approved. You can revoke access at any time.
                </p>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-3">Data Export</h3>
                <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                  <button
                    type="button"
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors flex items-center justify-center"
                    onClick={() => {
                      // Data export functionality would go here
                      alert('Export functionality would be implemented here');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Trading History (CSV)
                  </button>
                  
                  <button
                    type="button"
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors flex items-center justify-center"
                    onClick={() => {
                      // Data export functionality would go here
                      alert('Export functionality would be implemented here');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Portfolio Snapshot (JSON)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              onClick={onClose}
              disabled={loading || isSubmitting}
            >
              Cancel
            </button>  
            <button
              type="submit"
              className={`py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center ${
                loading || isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* Agent initialization modal */}
      {renderInitializationModal()}
    </div>
  );
};