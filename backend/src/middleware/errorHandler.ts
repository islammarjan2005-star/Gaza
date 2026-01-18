import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found error
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApiError {
  details: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends ApiError {
  retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      statusCode,
    });
  } else if (statusCode >= 400) {
    logger.warn('Client error', {
      error: err.message,
      path: req.path,
      method: req.method,
      statusCode,
    });
  }

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'An unexpected error occurred';
    code = 'INTERNAL_ERROR';
  }

  // Send response
  const response: any = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // Include details for validation errors
  if (err instanceof ValidationError && err.details) {
    response.error.details = err.details;
  }

  // Include retry-after for rate limit errors
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', err.retryAfter);
    response.error.retryAfter = err.retryAfter;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async functions
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
