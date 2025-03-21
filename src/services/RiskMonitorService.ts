// src/services/RiskMonitorService.ts

import { PublicKey } from '@solana/web3.js';
import { DeFiStrategy, UserPosition, DeFiRiskLevel, ProtocolType } from './DeFiStrategyService';
import { AIOptimizationService, MarketCondition } from './AIOptimizationService';
import { NotificationService } from './NotificationService';

// Import NotificationType from types file
import { NotificationType } from '@/types/notification';

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskType {
  LIQUIDATION = 'liquidation',
  IMPERMANENT_LOSS = 'impermanent_loss',
  PROTOCOL_RISK = 'protocol_risk',
  MARKET_VOLATILITY = 'market_volatility',
  POSITION_DECLINE = 'position_decline'
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  severity: RiskSeverity;
  type: RiskType;
  message: string;
  positionId?: string;
  strategyId?: string; 
  details: Record<string, any>;
  read: boolean;
  actions: Array<{
    label: string;
    action: string;
    params?: any;
  }>;
}

export interface PositionRiskMetrics {
  healthFactor: number; // For lending positions, < 1 means liquidation
  volatilityExposure: number; // 0-10 scale
  impermanentLossRisk: number; // 0-10 scale
  concentrationRisk: number; // 0-10 scale
  protocolRisk: number; // 0-10 scale
  overallRiskScore: number; // 0-100 scale
}

// Extend UserPosition interface to include positionData property
interface ExtendedUserPosition extends UserPosition {
  positionData?: {
    lendingInfo?: Array<{
      healthFactor?: number;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

export class RiskMonitorService {
  private static instance: RiskMonitorService;
  
  private alerts: Map<string, RiskAlert[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private aiService: AIOptimizationService;
  private notificationService: NotificationService;
  
  private constructor() {
    this.aiService = AIOptimizationService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): RiskMonitorService {
    if (!RiskMonitorService.instance) {
      RiskMonitorService.instance = new RiskMonitorService();
    }
    return RiskMonitorService.instance;
  }
  
  /**
   * Start monitoring positions for risk
   * @param wallet User's wallet address
   * @param positions User's DeFi positions
   * @param strategies All available strategies
   */
  public startMonitoring(
    wallet: PublicKey,
    positions: UserPosition[],
    strategies: DeFiStrategy[]
  ): void {
    const walletKey = wallet.toString();
    
    // Clear any existing monitoring for this wallet
    this.stopMonitoring(wallet);
    
    // Initialize alerts array for this wallet if not exists
    if (!this.alerts.has(walletKey)) {
      this.alerts.set(walletKey, []);
    }
    
    // Start periodic monitoring
    const interval = setInterval(async () => {
      try {
        // Get current market conditions
        const marketCondition = await this.aiService.analyzeMarketConditions();
        
        // Check each position for risks
        for (const position of positions) {
          const strategy = strategies.find(s => s.id === position.strategyId);
          if (!strategy) continue;
          
          await this.checkPositionRisks(wallet, position as ExtendedUserPosition, strategy, marketCondition);
        }
        
        // Check for portfolio-level risks
        await this.checkPortfolioRisks(wallet, positions, strategies, marketCondition);
        
      } catch (error) {
        console.error('Error in risk monitoring:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    this.monitoringIntervals.set(walletKey, interval);
    console.log(`Started risk monitoring for wallet ${walletKey}`);
  }
  
  /**
   * Stop monitoring a wallet
   * @param wallet User's wallet address
   */
  public stopMonitoring(wallet: PublicKey): void {
    const walletKey = wallet.toString();
    
    if (this.monitoringIntervals.has(walletKey)) {
      clearInterval(this.monitoringIntervals.get(walletKey) as NodeJS.Timeout);
      this.monitoringIntervals.delete(walletKey);
      console.log(`Stopped risk monitoring for wallet ${walletKey}`);
    }
  }
  
  /**
   * Get all risk alerts for a wallet
   * @param wallet User's wallet address
   */
  public getAlerts(wallet: PublicKey): RiskAlert[] {
    const walletKey = wallet.toString();
    return this.alerts.get(walletKey) || [];
  }
  
  /**
   * Mark an alert as read
   * @param wallet User's wallet address
   * @param alertId ID of the alert to mark as read
   */
  public markAlertAsRead(wallet: PublicKey, alertId: string): void {
    const walletKey = wallet.toString();
    const walletAlerts = this.alerts.get(walletKey) || [];
    
    const alertIndex = walletAlerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
      walletAlerts[alertIndex].read = true;
      this.alerts.set(walletKey, walletAlerts);
    }
  }
  
  /**
   * Get the number of unread alerts for a wallet
   * @param wallet User's wallet address
   */
  public getUnreadAlertCount(wallet: PublicKey): number {
    const walletKey = wallet.toString();
    const walletAlerts = this.alerts.get(walletKey) || [];
    
    return walletAlerts.filter(alert => !alert.read).length;
  }
  
  /**
   * Clear all alerts for a wallet
   * @param wallet User's wallet address
   */
  public clearAlerts(wallet: PublicKey): void {
    const walletKey = wallet.toString();
    this.alerts.set(walletKey, []);
  }
  
  /**
   * Check a specific position for risks
   * @param wallet User's wallet address
   * @param position User's DeFi position
   * @param strategy Strategy associated with the position
   * @param marketCondition Current market conditions
   */
  private async checkPositionRisks(
    wallet: PublicKey,
    position: ExtendedUserPosition,
    strategy: DeFiStrategy,
    marketCondition: MarketCondition
  ): Promise<void> {
    const walletKey = wallet.toString();
    const walletAlerts = this.alerts.get(walletKey) || [];
    
    // Check for position-specific risks
    const riskMetrics = this.calculatePositionRiskMetrics(position, strategy, marketCondition);
    
    // Check for liquidation risk in lending positions
    if (strategy.protocolType === ProtocolType.LENDING && riskMetrics.healthFactor < 1.25) {
      const severity = riskMetrics.healthFactor < 1.05 ? RiskSeverity.CRITICAL : 
                      riskMetrics.healthFactor < 1.15 ? RiskSeverity.HIGH : 
                      RiskSeverity.MEDIUM;
      
      // Create alert if doesn't already exist
      const existingAlert = walletAlerts.find(
        alert => alert.type === RiskType.LIQUIDATION && alert.strategyId === strategy.id && !alert.read
      );
      
      if (!existingAlert) {
        const alert: RiskAlert = {
          id: `liquidation_${strategy.id}_${Date.now()}`,
          timestamp: Date.now(),
          severity,
          type: RiskType.LIQUIDATION,
          message: `Liquidation risk detected in ${strategy.name} position. Health factor: ${riskMetrics.healthFactor.toFixed(2)}`,
          strategyId: strategy.id,
          positionId: position.strategyId,
          details: {
            healthFactor: riskMetrics.healthFactor,
            currentValue: position.investmentValue,
            strategy: strategy.name
          },
          read: false,
          actions: [
            {
              label: 'Add Collateral',
              action: 'add_collateral',
              params: { strategyId: strategy.id }
            },
            {
              label: 'Reduce Debt',
              action: 'reduce_debt',
              params: { strategyId: strategy.id }
            }
          ]
        };
        
        walletAlerts.push(alert);
        this.alerts.set(walletKey, walletAlerts);
        
        // Send notification to user
        this.notificationService.addNotification({
          type: severity === RiskSeverity.CRITICAL ? NotificationType.ERROR : NotificationType.WARNING,
          title: 'Liquidation Risk',
          message: `Your position in ${strategy.name} is at risk of liquidation. Health factor: ${riskMetrics.healthFactor.toFixed(2)}`
        });
      }
    }
    
    // Check for impermanent loss risk in liquidity positions
    if (
      strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING && 
      riskMetrics.impermanentLossRisk > 7 &&
      marketCondition.volatilityIndex > 6
    ) {
      const severity = riskMetrics.impermanentLossRisk > 8.5 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM;
      
      // Create alert if doesn't already exist
      const existingAlert = walletAlerts.find(
        alert => alert.type === RiskType.IMPERMANENT_LOSS && alert.strategyId === strategy.id && !alert.read
      );
      
      if (!existingAlert) {
        const alert: RiskAlert = {
          id: `impermanent_loss_${strategy.id}_${Date.now()}`,
          timestamp: Date.now(),
          severity,
          type: RiskType.IMPERMANENT_LOSS,
          message: `High risk of impermanent loss detected in ${strategy.name} position due to increased market volatility.`,
          strategyId: strategy.id,
          positionId: position.strategyId,
          details: {
            impermanentLossRisk: riskMetrics.impermanentLossRisk,
            marketVolatility: marketCondition.volatilityIndex,
            currentValue: position.investmentValue,
            strategy: strategy.name
          },
          read: false,
          actions: [
            {
              label: 'Reduce Exposure',
              action: 'reduce_exposure',
              params: { strategyId: strategy.id }
            },
            {
              label: 'Rebalance Position',
              action: 'rebalance_position',
              params: { strategyId: strategy.id }
            }
          ]
        };
        
        walletAlerts.push(alert);
        this.alerts.set(walletKey, walletAlerts);
        
        // Send notification to user
        this.notificationService.addNotification({
          type: NotificationType.WARNING,
          title: 'Impermanent Loss Risk',
          message: `Your position in ${strategy.name} has high impermanent loss risk due to market volatility.`
        });
      }
    }
    
    // Check for significant position decline
    const positionReturn = (position.investmentValue - position.initialInvestment) / position.initialInvestment;
    if (positionReturn < -0.15) {
      const severity = positionReturn < -0.25 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM;
      
      // Create alert if doesn't already exist
      const existingAlert = walletAlerts.find(
        alert => alert.type === RiskType.POSITION_DECLINE && alert.strategyId === strategy.id && !alert.read
      );
      
      if (!existingAlert) {
        const alert: RiskAlert = {
          id: `position_decline_${strategy.id}_${Date.now()}`,
          timestamp: Date.now(),
          severity,
          type: RiskType.POSITION_DECLINE,
          message: `Your position in ${strategy.name} has declined by ${Math.abs(positionReturn * 100).toFixed(1)}% from initial investment.`,
          strategyId: strategy.id,
          positionId: position.strategyId,
          details: {
            initialInvestment: position.initialInvestment,
            currentValue: position.investmentValue,
            declinePercentage: positionReturn * 100,
            strategy: strategy.name
          },
          read: false,
          actions: [
            {
              label: 'Analyze Performance',
              action: 'analyze_performance',
              params: { strategyId: strategy.id }
            },
            {
              label: 'Exit Position',
              action: 'exit_position',
              params: { strategyId: strategy.id }
            }
          ]
        };
        
        walletAlerts.push(alert);
        this.alerts.set(walletKey, walletAlerts);
        
        // Send notification to user
        this.notificationService.addNotification({
          type: NotificationType.WARNING,
          title: 'Position Decline',
          message: `Your position in ${strategy.name} has declined by ${Math.abs(positionReturn * 100).toFixed(1)}%.`
        });
      }
    }
  }
  
  /**
   * Check portfolio-level risks
   * @param wallet User's wallet address
   * @param positions User's DeFi positions
   * @param strategies All available strategies
   * @param marketCondition Current market conditions
   */
  private async checkPortfolioRisks(
    wallet: PublicKey,
    positions: UserPosition[],
    strategies: DeFiStrategy[],
    marketCondition: MarketCondition
  ): Promise<void> {
    const walletKey = wallet.toString();
    const walletAlerts = this.alerts.get(walletKey) || [];
    
    // Calculate portfolio metrics
    const totalValue = positions.reduce((sum, pos) => sum + pos.investmentValue, 0);
    if (totalValue === 0) return;
    
    // Check for high concentration risk
    const positionConcentration = positions.map(pos => ({
      strategyId: pos.strategyId,
      percentage: (pos.investmentValue / totalValue) * 100
    }));
    
    const highConcentrationPositions = positionConcentration.filter(p => p.percentage > 40);
    
    if (highConcentrationPositions.length > 0) {
      // For each high concentration position, create an alert if it doesn't exist
      for (const concPos of highConcentrationPositions) {
        const strategy = strategies.find(s => s.id === concPos.strategyId);
        if (!strategy) continue;
        
        const existingAlert = walletAlerts.find(
          alert => alert.type === RiskType.PROTOCOL_RISK && 
                  alert.details.riskType === 'concentration' && 
                  alert.strategyId === strategy.id && 
                  !alert.read
        );
        
        if (!existingAlert) {
          const alert: RiskAlert = {
            id: `concentration_${strategy.id}_${Date.now()}`,
            timestamp: Date.now(),
            severity: RiskSeverity.MEDIUM,
            type: RiskType.PROTOCOL_RISK,
            message: `High concentration risk: ${concPos.percentage.toFixed(1)}% of your portfolio is in ${strategy.name}.`,
            strategyId: strategy.id,
            details: {
              riskType: 'concentration',
              percentage: concPos.percentage,
              strategy: strategy.name,
              totalPortfolioValue: totalValue
            },
            read: false,
            actions: [
              {
                label: 'View Diversification Options',
                action: 'view_diversification',
                params: {}
              },
              {
                label: 'Rebalance Portfolio',
                action: 'rebalance_portfolio',
                params: {}
              }
            ]
          };
          
          walletAlerts.push(alert);
          this.alerts.set(walletKey, walletAlerts);
          
          // Send notification to user
          this.notificationService.addNotification({
            type: NotificationType.INFO,
            title: 'Concentration Risk',
            message: `${concPos.percentage.toFixed(1)}% of your portfolio is concentrated in a single strategy.`
          });
        }
      }
    }
    
    // Check for market volatility risk for aggressive strategies
    if (marketCondition.volatilityIndex > 7.5 && marketCondition.marketTrend === 'bear') {
      const aggressivePositions = positions.filter(pos => {
        const strategy = strategies.find(s => s.id === pos.strategyId);
        return strategy && (strategy.riskLevel === DeFiRiskLevel.AGGRESSIVE);
      });
      
      if (aggressivePositions.length > 0) {
        const aggressiveValue = aggressivePositions.reduce((sum, pos) => sum + pos.investmentValue, 0);
        const aggressivePercentage = (aggressiveValue / totalValue) * 100;
        
        if (aggressivePercentage > 30) {
          const existingAlert = walletAlerts.find(
            alert => alert.type === RiskType.MARKET_VOLATILITY && !alert.read
          );
          
          if (!existingAlert) {
            const alert: RiskAlert = {
              id: `market_volatility_${Date.now()}`,
              timestamp: Date.now(),
              severity: RiskSeverity.HIGH,
              type: RiskType.MARKET_VOLATILITY,
              message: `High market volatility detected. ${aggressivePercentage.toFixed(1)}% of your portfolio is in high-risk strategies.`,
              details: {
                volatilityIndex: marketCondition.volatilityIndex,
                marketTrend: marketCondition.marketTrend,
                aggressivePercentage,
                aggressiveValue,
                totalValue
              },
              read: false,
              actions: [
                {
                  label: 'Reduce Risk Exposure',
                  action: 'reduce_risk',
                  params: {}
                },
                {
                  label: 'View Safe Havens',
                  action: 'view_safe_havens',
                  params: {}
                }
              ]
            };
            
            walletAlerts.push(alert);
            this.alerts.set(walletKey, walletAlerts);
            
            // Send notification to user
            this.notificationService.addNotification({
              type: NotificationType.WARNING,
              title: 'Market Volatility Risk',
              message: `High market volatility detected with significant exposure to high-risk strategies.`
            });
          }
        }
      }
    }
  }
  
  /**
   * Calculate risk metrics for a position
   * @param position User's DeFi position
   * @param strategy Strategy associated with the position
   * @param marketCondition Current market conditions
   */
  private calculatePositionRiskMetrics(
    position: ExtendedUserPosition,
    strategy: DeFiStrategy,
    marketCondition: MarketCondition
  ): PositionRiskMetrics {
    // Calculate health factor for lending positions
    let healthFactor = 2.0; // Default healthy value
    
    // If position has lending components, calculate health factor
    if (strategy.protocolType === ProtocolType.LENDING) {
      // Check if position has any lending-related data
      const positionData = position.positionData || {};
      const lendingPositions = positionData.lendingInfo || [];
      
      if (lendingPositions.length > 0) {
        // If we have position-specific health factors, use the minimum
        const healthFactors: number[] = lendingPositions
          .map((p: { healthFactor?: number }) => p.healthFactor)
          .filter((h: number | undefined): h is number => h !== undefined);
          
        if (healthFactors.length > 0) {
          healthFactor = Math.min(...healthFactors);
        } else {
          // Generate simulated health factor
          const baseHealth = strategy.riskLevel === DeFiRiskLevel.CONSERVATIVE ? 2.0 :
                             strategy.riskLevel === DeFiRiskLevel.MODERATE ? 1.7 :
                             strategy.riskLevel === DeFiRiskLevel.AGGRESSIVE ? 1.4 : 1.2;
                            
          // Apply market adjustment
          const marketAdjustment = marketCondition.volatilityIndex > 7 ? -0.3 :
                                  marketCondition.volatilityIndex > 5 ? -0.15 : 0;
                                  
          healthFactor = Math.max(0.95, baseHealth + marketAdjustment);
        }
      }
    }
    
    // Calculate volatility exposure
    let volatilityExposure = 0;
    
    switch (strategy.riskLevel) {
      case DeFiRiskLevel.CONSERVATIVE:
        volatilityExposure = 2;
        break;
      case DeFiRiskLevel.MODERATE:
        volatilityExposure = 5;
        break;
      case DeFiRiskLevel.AGGRESSIVE:
        volatilityExposure = 7;
        break;
      default:
        volatilityExposure = 5; // Default to moderate
    }
    
    // Adjust volatility exposure based on market conditions
    volatilityExposure += (marketCondition.volatilityIndex - 5) * 0.2;
    volatilityExposure = Math.max(0, Math.min(10, volatilityExposure));
    
    // Calculate impermanent loss risk for liquidity providing positions
    let impermanentLossRisk = 0;
    if (strategy.protocolType === ProtocolType.LIQUIDITY_PROVIDING) {
      // Base risk level based on strategy risk
      if (strategy.riskLevel === DeFiRiskLevel.CONSERVATIVE) {
        impermanentLossRisk = 3;
      } else if (strategy.riskLevel === DeFiRiskLevel.MODERATE) {
        impermanentLossRisk = 5;
      } else if (strategy.riskLevel === DeFiRiskLevel.AGGRESSIVE) {
        impermanentLossRisk = 7;
      } else {
        impermanentLossRisk = 8; // Default for unknown risk levels
      }
                           
      // Adjust based on market volatility
      impermanentLossRisk += (marketCondition.volatilityIndex - 5) * 0.4;
      
      // Adjust based on market trend (higher in volatile markets)
      if (marketCondition.marketTrend === 'bull' || marketCondition.marketTrend === 'bear') {
        impermanentLossRisk += 1;
      }
    }
    impermanentLossRisk = Math.max(0, Math.min(10, impermanentLossRisk));
    
    // Calculate concentration risk
    const concentrationRisk = 5; // Default medium value
    
    // Calculate protocol risk based on protocols used
    let protocolRisk = 4; // Default medium-low risk
    
    // Calculate overall risk score (0-100)
    const overallRiskScore = Math.min(100, Math.max(0, 
      20 * (2 - healthFactor) + // Lower health factor = higher risk
      volatilityExposure * 3 +
      impermanentLossRisk * 2 +
      concentrationRisk * 2 +
      protocolRisk * 3
    ));
    
    return {
      healthFactor,
      volatilityExposure,
      impermanentLossRisk,
      concentrationRisk,
      protocolRisk,
      overallRiskScore
    };
  }
}