import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import { ValidationError } from './errorHandlers';

// Schema validation using JSON schema format
const schemas: Record<string, Record<string, any>> = {
  // Schema for creating a new agent
  createAgent: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
    },
  },

  // Schema for updating agent config
  updateAgentConfig: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      description: { type: 'string', maxLength: 500 },
      autoRebalance: { type: 'boolean' },
      rebalanceThreshold: { type: 'number', minimum: 1, maximum: 50 },
      maxSlippageBps: { type: 'number', minimum: 1, maximum: 1000 },
      riskProfile: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
      activeStrategies: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      autoTrade: { type: 'boolean' },
      tradingBudget: { type: 'number', minimum: 0 },
      maxTradesPerDay: { type: 'number', minimum: 0, maximum: 100 },
      preferredTokens: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      excludedTokens: { 
        type: 'array', 
        items: { type: 'string' } 
      },
    },
  },

  // Schema for setting an active strategy
  setStrategy: {
    type: 'object',
    required: ['strategyId'],
    properties: {
      strategyId: { type: 'string', minLength: 1 },
    },
  },

  // Schema for executing a trade
  executeTrade: {
    type: 'object',
    required: ['recommendationId'],
    properties: {
      recommendationId: { type: 'string', minLength: 1 },
    },
  },

  // Schema for Jupiter quote parameters
  jupiterQuote: {
    type: 'object',
    required: ['inputMint', 'outputMint', 'amount'],
    properties: {
      inputMint: { type: 'string', minLength: 32, maxLength: 44 },
      outputMint: { type: 'string', minLength: 32, maxLength: 44 },
      amount: { type: 'string', pattern: '^[0-9]+$' },
      slippageBps: { type: 'string', pattern: '^[0-9]+$' },
    },
  },

  // Schema for Jupiter swap execution
  jupiterSwap: {
    type: 'object',
    required: ['quoteResponse'],
    properties: {
      quoteResponse: { 
        type: 'object',
        required: ['inputMint', 'outputMint', 'inAmount', 'outAmount', 'otherAmountThreshold'],
        properties: {
          inputMint: { type: 'string' },
          outputMint: { type: 'string' },
          inAmount: { type: 'string' },
          outAmount: { type: 'string' },
          otherAmountThreshold: { type: 'string' },
          swapMode: { type: 'string' },
          slippageBps: { type: 'number' },
          platformFee: { type: 'object' },
          priceImpactPct: { type: 'string' },
        }
      },
    },
  },
};

/**
 * Validate a Solana public key
 */
export const isValidPublicKey = (key: string): boolean => {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate an object against a schema
 */
export const validateObject = (data: any, schema: any): { valid: boolean; errors: string[] } => {
  // Simple validation function - in production you'd use a library like Joi, Zod, or Ajv
  const errors: string[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check property constraints
  if (schema.properties) {
    for (const [field, constraints] of Object.entries(schema.properties) as any) {
      const value = data[field];

      // Skip validation if field is not provided and not required
      if (value === undefined) continue;

      const fieldErrors = validateField(field, value, constraints);
      errors.push(...fieldErrors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

  return errors;
};

/**
 * Express middleware for validating request body against a schema
 * 
 * @param schemaName Name of the schema to validate against
 * @returns Express middleware function
 */
export const validate = (schemaName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return next(new Error(`Validation schema not found: ${schemaName}`));
    }
    
    // Determine what to validate based on the request method
    let dataToValidate: any;
    
    if (req.method === 'GET') {
      dataToValidate = req.query;
    } else {
      dataToValidate = req.body;
    }
    
    const { valid, errors } = validateObject(dataToValidate, schema);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: errors
      });
    }
    
    next();
  };
};

/**
 * Validate a field against constraints
 */
/**
 * Validate a single field against constraints
 */
const validateField = (field: string, value: any, constraints: any): string[] => {
  const errors: string[] = [];

  // Type checks
  if (constraints.type) {
    if (constraints.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (constraints.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
    } else if (constraints.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    } else if (constraints.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    } else if (constraints.type === 'object' && (typeof value !== 'object' || value === null)) {
      errors.push(`${field} must be an object`);
    }
  }

  // String-specific constraints
  if (typeof value === 'string') {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      errors.push(`${field} must be at least ${constraints.minLength} characters`);
    }
    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      errors.push(`${field} must be at most ${constraints.maxLength} characters`);
    }
    if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
      errors.push(`${field} has an invalid format`);
    }
    if (constraints.enum && !constraints.enum.includes(value)) {
      errors.push(`${field} must be one of: ${constraints.enum.join(', ')}`);
    }
  }

  // Number-specific constraints
  if (typeof value === 'number') {
    if (constraints.minimum !== undefined && value < constraints.minimum) {
      errors.push(`${field} must be at least ${constraints.minimum}`);
    }
    if (constraints.maximum !== undefined && value > constraints.maximum) {
      errors.push(`${field} must be at most ${constraints.maximum}`);
    }
  }

  // Array-specific constraints
  if (Array.isArray(value)) {
    if (constraints.minItems !== undefined && value.length < constraints.minItems) {
      errors.push(`${field} must contain at least ${constraints.minItems} items`);
    }
    if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
      errors.push(`${field} must contain at most ${constraints.maxItems} items`);
    }
    if (constraints.items && value.length > 0) {
      value.forEach((item, index) => {
        const itemErrors = validateField(`${field}[${index}]`, item, constraints.items);
        errors.push(...itemErrors);
      });
    }
  }

  // Object-specific constraints
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && constraints.properties) {
    for (const [propName, propConstraints] of Object.entries(constraints.properties)) {
      if (value[propName] !== undefined) {
        const propErrors = validateField(`${field}.${propName}`, value[propName], propConstraints);
        errors.push(...propErrors);
      } else if (constraints.required && constraints.required.includes(propName)) {
        errors.push(`${field}.${propName} is required`);
      }
    }
  }