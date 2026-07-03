/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides automatic retry logic for transient failures with exponential backoff.
 * Designed for database operations and network requests.
 * 
 * Requirement 18.4: THE System SHALL implement automatic retry logic for transient
 * network failures with exponential backoff
 */

/**
 * Configuration options for retry logic
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (excluding the initial attempt)
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before the first retry
   * @default 1000 (1 second)
   */
  initialDelayMs?: number;

  /**
   * Multiplier for exponential backoff
   * Each retry will wait: initialDelayMs * (backoffMultiplier ^ attemptNumber)
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Maximum delay in milliseconds between retries
   * Prevents excessively long waits
   * @default 30000 (30 seconds)
   */
  maxDelayMs?: number;

  /**
   * Custom function to determine if an error is transient and should be retried
   * If not provided, uses the default isTransientError function
   */
  isTransient?: (error: unknown) => boolean;

  /**
   * Optional callback invoked before each retry attempt
   * Useful for logging retry attempts
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  isTransient: isTransientError,
};

/**
 * Firebase error codes that indicate transient failures
 */
const FIREBASE_TRANSIENT_ERROR_CODES = [
  'unavailable',           // Service temporarily unavailable
  'deadline-exceeded',     // Operation timeout
  'resource-exhausted',    // Quota exceeded (temporary)
  'aborted',              // Concurrent transaction conflict
  'internal',             // Internal server error (may be transient)
  'unknown',              // Unknown error (may be transient)
];

/**
 * Network error indicators that suggest transient failures
 */
const TRANSIENT_ERROR_MESSAGES = [
  'network error',
  'timeout',
  'timed out',
  'connection',
  'econnreset',
  'enotfound',
  'econnrefused',
  'etimedout',
  'fetch failed',
];

/**
 * Determines if an error is transient and should be retried
 * 
 * Transient errors are temporary failures that may succeed if retried,
 * such as network timeouts, service unavailability, or concurrent conflicts.
 * 
 * Permanent errors (invalid input, not found, permission denied) should NOT be retried.
 * 
 * @param error - The error to check
 * @returns true if the error is transient, false otherwise
 */
export function isTransientError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check Firebase error codes
  if (typeof error === 'object' && error !== null) {
    const err = error as any;

    // Firebase errors have a 'code' property
    if (err.code && typeof err.code === 'string') {
      const code = err.code.toLowerCase();
      
      // Check Firebase-specific error codes
      if (FIREBASE_TRANSIENT_ERROR_CODES.some(transientCode => code.includes(transientCode))) {
        return true;
      }

      // Permanent Firebase errors that should NOT be retried
      const permanentCodes = [
        'permission-denied',
        'unauthenticated',
        'invalid-argument',
        'not-found',
        'already-exists',
        'failed-precondition',
      ];
      
      if (permanentCodes.some(permanentCode => code.includes(permanentCode))) {
        return false;
      }
    }

    // Check error message for transient indicators
    if (err.message && typeof err.message === 'string') {
      const message = err.message.toLowerCase();
      if (TRANSIENT_ERROR_MESSAGES.some(indicator => message.includes(indicator))) {
        return true;
      }
    }

    // Check if it's a network error
    if (err.name === 'NetworkError' || err.name === 'TimeoutError') {
      return true;
    }
  }

  // Check if error is a string with transient indicators
  if (typeof error === 'string') {
    const errorStr = error.toLowerCase();
    if (TRANSIENT_ERROR_MESSAGES.some(indicator => errorStr.includes(indicator))) {
      return true;
    }
  }

  // Default to non-transient (don't retry by default)
  return false;
}

/**
 * Calculate delay for exponential backoff with jitter
 * 
 * Jitter helps prevent thundering herd problem when multiple clients
 * retry simultaneously
 * 
 * @param attempt - Current retry attempt number (0-indexed)
 * @param options - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'onRetry'>>): number {
  // Calculate exponential delay: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  
  // Add jitter (randomize between 50% and 100% of calculated delay)
  // This prevents synchronized retries from multiple clients
  const jitter = 0.5 + Math.random() * 0.5;
  
  return Math.floor(cappedDelay * jitter);
}

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with automatic retry logic and exponential backoff
 * 
 * This function will:
 * 1. Execute the operation
 * 2. If it fails with a transient error, wait and retry
 * 3. Use exponential backoff to increase wait time between retries
 * 4. Give up after maxRetries attempts
 * 
 * @template T - Return type of the operation
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * // Retry a Firestore write operation
 * await withRetry(
 *   async () => await setDoc(docRef, data),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * 
 * @example
 * // Retry with custom transient error detection
 * await withRetry(
 *   async () => await fetchExternalAPI(),
 *   {
 *     maxRetries: 5,
 *     isTransient: (error) => error.status === 503,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`);
 *     }
 *   }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Merge with defaults
  const config: Required<Omit<RetryOptions, 'onRetry'>> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: unknown;
  let attempt = 0;

  // Initial attempt + retries
  const totalAttempts = config.maxRetries + 1;

  for (let i = 0; i < totalAttempts; i++) {
    try {
      // Execute the operation
      return await operation();
    } catch (error) {
      lastError = error;
      attempt = i;

      // Check if this is the last attempt
      const isLastAttempt = i === config.maxRetries;
      
      if (isLastAttempt) {
        // No more retries, throw the error
        throw error;
      }

      // Check if error is transient
      const errorIsTransient = config.isTransient(error);
      
      if (!errorIsTransient) {
        // Permanent error, don't retry
        throw error;
      }

      // Calculate delay for next retry
      const delayMs = calculateDelay(attempt, config);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper function with pre-configured options
 * 
 * Useful when you want to apply the same retry configuration to multiple operations
 * 
 * @param options - Retry configuration options
 * @returns Function that wraps operations with retry logic
 * 
 * @example
 * const retryFirestore = createRetryWrapper({
 *   maxRetries: 5,
 *   initialDelayMs: 500,
 *   onRetry: (error, attempt, delay) => {
 *     console.log(`Firestore retry ${attempt} after ${delay}ms`);
 *   }
 * });
 * 
 * // Use the wrapper
 * await retryFirestore(() => setDoc(docRef, data));
 * await retryFirestore(() => updateDoc(docRef, updates));
 */
export function createRetryWrapper(options: RetryOptions) {
  return function <T>(operation: () => Promise<T>): Promise<T> {
    return withRetry(operation, options);
  };
}

/**
 * Pre-configured retry wrapper for Firebase/Firestore operations
 * 
 * Uses sensible defaults for database operations:
 * - 3 retries max
 * - 1 second initial delay
 * - 2x backoff multiplier
 * - 30 second max delay
 * 
 * @example
 * import { retryFirestore } from './retry';
 * 
 * // Wrap any Firestore operation
 * await retryFirestore(() => setDoc(docRef, data));
 * await retryFirestore(() => updateDoc(docRef, { field: value }));
 * await retryFirestore(() => deleteDoc(docRef));
 */
export const retryFirestore = createRetryWrapper({
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  onRetry: (error, attempt, delayMs) => {
    // Log retry attempts for monitoring
    console.warn(
      `[Retry] Firestore operation failed, attempt ${attempt}/${3}, ` +
      `retrying in ${delayMs}ms. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  },
});

/**
 * Pre-configured retry wrapper for network/API operations
 * 
 * Uses more aggressive retry settings for external services:
 * - 5 retries max
 * - 500ms initial delay
 * - 2x backoff multiplier
 * - 15 second max delay
 * 
 * @example
 * import { retryNetwork } from './retry';
 * 
 * // Wrap network requests
 * await retryNetwork(() => fetch(url));
 * await retryNetwork(() => axios.get(url));
 */
export const retryNetwork = createRetryWrapper({
  maxRetries: 5,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 15000,
  onRetry: (error, attempt, delayMs) => {
    console.warn(
      `[Retry] Network operation failed, attempt ${attempt}/${5}, ` +
      `retrying in ${delayMs}ms. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  },
});
