import { SonicAgent } from '../services/SonicAgent';
// src/idl/sonic_agent.ts

export const SonicAgentIDL = {
    "version": "0.1.0",
    "name": "sonic_agent",
    "instructions": [
      {
        "name": "initializeAgent",
        "accounts": [
          {
            "name": "owner",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "agentStats",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "riskProfile",
            "type": {
              "defined": "RiskProfile"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      },
      {
        "name": "updateAgentConfig",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "name",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "description",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "riskProfile",
            "type": {
              "option": {
                "defined": "RiskProfile"
              }
            }
          },
          {
            "name": "autoRebalance",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "rebalanceThresholdBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "autoTrade",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "tradingBudget",
            "type": {
              "option": "u64"
            }
          }
        ]
      },
      {
        "name": "updateTradingRules",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "maxAmountPerTrade",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxTradesPerDay",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "allowedTokens",
            "type": {
              "option": {
                "vec": "publicKey"
              }
            }
          },
          {
            "name": "excludedTokens",
            "type": {
              "option": {
                "vec": "publicKey"
              }
            }
          },
          {
            "name": "maxSlippageBps",
            "type": {
              "option": "u16"
            }
          }
        ]
      },
      {
        "name": "updateGasSettings",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "priorityFee",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "computeUnits",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "retryOnFail",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "maxRetries",
            "type": {
              "option": "u8"
            }
          }
        ]
      },
      {
        "name": "setTargetAllocations",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "allocations",
            "type": {
              "vec": {
                "defined": "TokenAllocation"
              }
            }
          }
        ]
      },
      {
        "name": "addStrategy",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "id",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "strategyType",
            "type": {
              "defined": "StrategyType"
            }
          },
          {
            "name": "parameters",
            "type": {
              "array": ["u8", 512]
            }
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      },
      {
        "name": "updateStrategy",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "id",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "name",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "parameters",
            "type": {
              "option": {
                "array": ["u8", 512]
              }
            }
          },
          {
            "name": "isActive",
            "type": {
              "option": "bool"
            }
          }
        ]
      },
      {
        "name": "removeStrategy",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "id",
            "type": {
              "array": ["u8", 32]
            }
          }
        ]
      },
      {
        "name": "activateAgent",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": []
      },
      {
        "name": "deactivateAgent",
        "accounts": [
          {
            "name": "owner",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": []
      },
      {
        "name": "recordTrade",
        "accounts": [
          {
            "name": "authority",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "agentConfig",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "agentStats",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "tradeAction",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "strategyId",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "inputMint",
            "type": "publicKey"
          },
          {
            "name": "outputMint",
            "type": "publicKey"
          },
          {
            "name": "inputAmount",
            "type": "u64"
          },
          {
            "name": "outputAmount",
            "type": "u64"
          },
          {
            "name": "slippageBps",
            "type": "u16"
          },
          {
            "name": "transactionSignature",
            "type": {
              "array": ["u8", 64]
            }
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "priceImpactBps",
            "type": "u16"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "AgentConfig",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "owner",
              "type": "publicKey"
            },
            {
              "name": "name",
              "type": "string"
            },
            {
              "name": "description",
              "type": "string"
            },
            {
              "name": "riskProfile",
              "type": {
                "defined": "RiskProfile"
              }
            },
            {
              "name": "status",
              "type": {
                "defined": "AgentStatus"
              }
            },
            {
              "name": "createdAt",
              "type": "i64"
            },
            {
              "name": "updatedAt",
              "type": "i64"
            },
            {
              "name": "autoRebalance",
              "type": "bool"
            },
            {
              "name": "rebalanceThresholdBps",
              "type": "u16"
            },
            {
              "name": "autoTrade",
              "type": "bool"
            },
            {
              "name": "tradingBudget",
              "type": "u64"
            },
            {
              "name": "strategies",
              "type": {
                "vec": {
                  "defined": "Strategy"
                }
              }
            },
            {
              "name": "tradingRules",
              "type": {
                "defined": "TradingRules"
              }
            },
            {
              "name": "targetAllocations",
              "type": {
                "vec": {
                  "defined": "TokenAllocation"
                }
              }
            },
            {
              "name": "gasSettings",
              "type": {
                "defined": "GasSettings"
              }
            },
            {
              "name": "totalExecutedTrades",
              "type": "u64"
            },
            {
              "name": "totalTradeVolume",
              "type": "u64"
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "AgentStats",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "agent",
              "type": "publicKey"
            },
            {
              "name": "profitLoss",
              "type": "i64"
            },
            {
              "name": "performanceData",
              "type": {
                "vec": {
                  "defined": "PerformanceDataPoint"
                }
              }
            },
            {
              "name": "lastUpdatedAt",
              "type": "i64"
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "TradeAction",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "agent",
              "type": "publicKey"
            },
            {
              "name": "strategyId",
              "type": {
                "array": ["u8", 32]
              }
            },
            {
              "name": "inputMint",
              "type": "publicKey"
            },
            {
              "name": "outputMint",
              "type": "publicKey"
            },
            {
              "name": "inputAmount",
              "type": "u64"
            },
            {
              "name": "outputAmount",
              "type": "u64"
            },
            {
              "name": "slippageBps",
              "type": "u16"
            },
            {
              "name": "priceImpactBps",
              "type": "u16"
            },
            {
              "name": "transactionSignature",
              "type": {
                "array": ["u8", 64]
              }
            },
            {
              "name": "executedAt",
              "type": "i64"
            },
            {
              "name": "success",
              "type": "bool"
            },
            {
              "name": "reason",
              "type": "string"
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      }
    ],
    "types": [
      {
        "name": "GasSettings",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "priorityFee",
              "type": "u64"
            },
            {
              "name": "computeUnits",
              "type": "u32"
            },
            {
              "name": "retryOnFail",
              "type": "bool"
            },
            {
              "name": "maxRetries",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "PerformanceDataPoint",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "timestamp",
              "type": "i64"
            },
            {
              "name": "portfolioValue",
              "type": "u64"
            },
            {
              "name": "dailyProfitLoss",
              "type": "i64"
            }
          ]
        }
      },
      {
        "name": "Strategy",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "id",
              "type": {
                "array": ["u8", 32]
              }
            },
            {
              "name": "name",
              "type": "string"
            },
            {
              "name": "strategyType",
              "type": {
                "defined": "StrategyType"
              }
            },
            {
              "name": "parameters",
              "type": {
                "array": ["u8", 512]
              }
            },
            {
              "name": "isActive",
              "type": "bool"
            },
            {
              "name": "lastExecutedAt",
              "type": "i64"
            },
            {
              "name": "executionCount",
              "type": "u64"
            }
          ]
        }
      },
      {
        "name": "TokenAllocation",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "mint",
              "type": "publicKey"
            },
            {
              "name": "targetPercentage",
              "type": "u16"
            },
            {
              "name": "maxDeviationBps",
              "type": "u16"
            }
          ]
        }
      },
      {
        "name": "TradingRules",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "maxAmountPerTrade",
              "type": "u64"
            },
            {
              "name": "maxTradesPerDay",
              "type": "u8"
            },
            {
              "name": "allowedTokens",
              "type": {
                "vec": "publicKey"
              }
            },
            {
              "name": "excludedTokens",
              "type": {
                "vec": "publicKey"
              }
            },
            {
              "name": "maxSlippageBps",
              "type": "u16"
            }
          ]
        }
      },
      {
        "name": "AgentStatus",
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "Active"
            },
            {
              "name": "Paused"
            },
            {
              "name": "Inactive"
            }
          ]
        }
      },
      {
        "name": "RiskProfile",
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "Conservative"
            },
            {
              "name": "Moderate"
            },
            {
              "name": "Aggressive"
            }
          ]
        }
      },
      {
        "name": "StrategyType",
        "type": {
          "kind": "enum",
          "variants": [
            {
              "name": "DollarCostAverage"
            },
            {
              "name": "MomentumTrading"
            },
            {
              "name": "MeanReversion"
            },
            {
              "name": "TrendFollowing"
            },
            {
              "name": "Custom"
            }
          ]
        }
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "InvalidOwner",
        "msg": "Invalid owner"
      },
      {
        "code": 6001,
        "name": "InvalidName",
        "msg": "Name must be between 1 and 50 characters"
      },
      {
        "code": 6002,
        "name": "InvalidDescription",
        "msg": "Description must be less than 200 characters"
      },
      {
        "code": 6003,
        "name": "InvalidRiskProfile",
        "msg": "Invalid risk profile"
      },
      {
        "code": 6004,
        "name": "InvalidRebalanceThreshold",
        "msg": "Rebalance threshold must be between 1 and 5000 basis points"
      },
      {
        "code": 6005,
        "name": "InvalidTradingBudget",
        "msg": "Trading budget must be greater than 0"
      },
      {
        "code": 6006,
        "name": "InvalidMaxTradesPerDay",
        "msg": "Max trades per day must be between 1 and 100"
      },
      {
        "code": 6007,
        "name": "InvalidMaxSlippage",
        "msg": "Max slippage must be between 1 and 1000 basis points"
      },
      {
        "code": 6008,
        "name": "InvalidStrategyId",
        "msg": "Invalid strategy ID"
      },
      {
        "code": 6009,
        "name": "StrategyNotFound",
        "msg": "Strategy not found"
      },
      {
        "code": 6010,
        "name": "TooManyStrategies",
        "msg": "Too many strategies"
      },
      {
        "code": 6011,
        "name": "InvalidAllocation",
        "msg": "Invalid allocation"
      },
      {
        "code": 6012,
        "name": "TotalAllocationExceeds100Percent",
        "msg": "Total allocation exceeds 100%"
      },
      {
        "code": 6013,
        "name": "StrategiesNotConfigured",
        "msg": "No active strategies configured"
      },
      {
        "code": 6014,
        "name": "TradeLimitExceeded",
        "msg": "Daily trade limit exceeded"
      },
      {
        "code": 6015,
        "name": "InvalidTradeAmount",
        "msg": "Invalid trade amount"
      },
      {
        "code": 6016,
        "name": "SlippageExceeded",
        "msg": "Slippage exceeded"
      }
    ]
  };