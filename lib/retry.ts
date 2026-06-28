/**
 * Retry utility with exponential backoff
 * Provides configurable retry logic with exponential backoff for resilient operations
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  onRetry: () => {},
  shouldRetry: () => true,
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let attempts = 0;

  for (let i = 1; i <= opts.maxRetries + 1; i++) {
    attempts = i;
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // If this was the last attempt, don't delay
      if (i === opts.maxRetries + 1) {
        break;
      }

      // Calculate delay
      const delay = calculateDelay(i, opts.initialDelayMs, opts.maxDelayMs, opts.backoffMultiplier);

      // Call onRetry callback
      opts.onRetry(i, lastError);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
  };
}

/**
 * Retry with specific delays (1s, 5s, 15s, 60s, 5min)
 */
export async function retryWithStandardBackoff<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 300000,
    backoffMultiplier: 2,
    onRetry,
  });
}

/**
 * Retry with short delays for quick operations
 */
export async function retryWithShortBackoff<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    onRetry,
  });
}

/**
 * Retry with long delays for resilient operations
 */
export async function retryWithLongBackoff<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 7,
    initialDelayMs: 2000,
    maxDelayMs: 600000, // 10 minutes
    backoffMultiplier: 2,
    onRetry,
  });
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('ECONNREFUSED')) return true;
  if (error.message.includes('ETIMEDOUT')) return true;
  if (error.message.includes('ENOTFOUND')) return true;
  if (error.message.includes('ECONNRESET')) return true;
  
  // HTTP errors
  if (error.message.includes('503')) return true; // Service Unavailable
  if (error.message.includes('502')) return true; // Bad Gateway
  if (error.message.includes('504')) return true; // Gateway Timeout
  if (error.message.includes('429')) return true; // Too Many Requests
  
  // Database errors
  if (error.message.includes('Database temporarily unavailable')) return true;
  if (error.message.includes('Connection pool')) return true;
  
  return false;
}
