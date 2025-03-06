import { Request, Response, NextFunction } from 'express';

/**
 * Request handler wrapper to standardize error handling for async routes
 * 
 * @param fn The async route handler function to wrap
 * @returns Wrapped function with standardized error handling
 */
export const tryCatchHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Custom error for validation failures
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error for unauthorized actions
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error for not found resources
 */
export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Map error status codes
 * 
 * @param error Error to get status code for
 * @returns HTTP status code
 */
export const getErrorStatusCode = (error: Error): number => {
  switch (error.name) {
    case 'ValidationError':
      return 400;
    case 'UnauthorizedError':
      return 401;
    case 'NotFoundError':
      return 404;
    case 'RateLimitError':
      return 429;
    default:
      return 500;
  }
};

/**
 * Generate a standardized error response
 * 
 * @param error Error object
 * @param includeStack Whether to include stack trace (only in development)
 * @returns Standardized error response object
 */
export const formatErrorResponse = (error: Error, includeStack: boolean = false): any => {
  const response: any = {
    success: false,
    error: error.name,
    message: error.message,
  };

  if (includeStack && process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  return response;
};
