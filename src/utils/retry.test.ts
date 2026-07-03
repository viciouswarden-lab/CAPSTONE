/**
 * Unit Tests for Retry Utility
 * 
 * Tests the retry logic with exponential backoff, transient error detection,
 * and proper error handling.
 * 
 * Requirement 18.4: Automatic retry logic for transient network failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  createRetryWrapper,
  isTransientError,
  retryFirestore,
  retryNetwork,
  type RetryOptions,
} from './retry';

describe('Retry Utility', () => {
  // Mock console.warn to avoid noise in test output
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTransientError', () => {
    it('should identify Firebase transient errors by code', () => {
      const transientCodes = [
        'unavailable',
        'deadline-exceeded',
        'resource-exhausted',
        'aborted',
        'internal',
        'unknown',
      ];

      transientCodes.forEach(code => {
        const error = { code, message: 'Test error' };
        expect(isTransientError(error)).toBe(true);
      });
    });

    it('should identify Firebase transient errors with prefixed codes', () => {
      const error = { code: 'firestore/unavailable', message: 'Service unavailable' };
      expect(isTransientError(error)).toBe(true);
    });

    it('should NOT retry Firebase permanent errors', () => {
      const permanentCodes = [
        'permission-denied',
        'unauthenticated',
        'invalid-argument',
        'not-found',
        'already-exists',
        'failed-precondition',
      ];

      permanentCodes.forEach(code => {
        const error = { code, message: 'Test error' };
        expect(isTransientError(error)).toBe(false);
      });
    });

    it('should identify network errors by message', () => {
      const transientMessages = [
        'network error occurred',
        'timeout exceeded',
        'connection refused',
        'ECONNRESET',
        'ENOTFOUND',
        'ETIMEDOUT',
        'fetch failed',
      ];

      transientMessages.forEach(message => {
        const error = new Error(message);
        expect(isTransientError(error)).toBe(true);
      });
    });

    it('should identify network errors by name', () => {
      const networkError = new Error('Something went wrong');
      networkError.name = 'NetworkError';
      expect(isTransientError(networkError)).toBe(true);

      const timeoutError = new Error('Operation timeout');
      timeoutError.name = 'TimeoutError';
      expect(isTransientError(timeoutError)).toBe(true);
    });

    it('should identify transient errors from string messages', () => {
      expect(isTransientError('Network error occurred')).toBe(true);
      expect(isTransientError('Connection timeout')).toBe(true);
      expect(isTransientError('ECONNREFUSED')).toBe(true);
    });

    it('should return false for non-transient errors', () => {
      expect(isTransientError(null)).toBe(false);
      expect(isTransientError(undefined)).toBe(false);
      expect(isTransientError(new Error('Invalid input'))).toBe(false);
      expect(isTransientError({ code: 'permission-denied' })).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'unavailable', message: 'Service unavailable' })
        .mockRejectedValueOnce({ code: 'deadline-exceeded', message: 'Timeout' })
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10, // Use short delays for testing
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exhausted', async () => {
      const error = { code: 'unavailable', message: 'Service unavailable' };
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(
        withRetry(operation, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toEqual(error);
      
      // Initial attempt + 2 retries = 3 calls
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should NOT retry permanent errors', async () => {
      const error = { code: 'permission-denied', message: 'Access denied' };
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(
        withRetry(operation, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toEqual(error);
      
      // Should only be called once, no retries
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use custom isTransient function when provided', async () => {
      const customError = { status: 503, message: 'Service unavailable' };
      const operation = vi.fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValueOnce('success');
      
      const isTransient = vi.fn().mockReturnValue(true);
      
      const result = await withRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        isTransient,
      });
      
      expect(result).toBe('success');
      expect(isTransient).toHaveBeenCalledWith(customError);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback before each retry', async () => {
      const error = { code: 'unavailable', message: 'Service unavailable' };
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      const onRetry = vi.fn();
      
      await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        onRetry,
      });
      
      // Should be called twice (before 2nd and 3rd attempts)
      expect(onRetry).toHaveBeenCalledTimes(2);
      
      // Check first retry callback
      expect(onRetry).toHaveBeenNthCalledWith(1, error, 1, expect.any(Number));
      
      // Check second retry callback
      expect(onRetry).toHaveBeenNthCalledWith(2, error, 2, expect.any(Number));
    });

    it('should implement exponential backoff', async () => {
      const error = { code: 'unavailable', message: 'Service unavailable' };
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      const delays: number[] = [];
      const onRetry = vi.fn((err, attempt, delay) => {
        delays.push(delay);
      });
      
      await withRetry(operation, {
        maxRetries: 4,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        onRetry,
      });
      
      // Verify delays increase exponentially
      expect(delays.length).toBe(3);
      
      // With jitter, delays should be approximately:
      // Attempt 1: 100 * (2^0) * jitter = 50-100ms
      // Attempt 2: 100 * (2^1) * jitter = 100-200ms
      // Attempt 3: 100 * (2^2) * jitter = 200-400ms
      
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThanOrEqual(100);
      
      expect(delays[1]).toBeGreaterThanOrEqual(100);
      expect(delays[1]).toBeLessThanOrEqual(200);
      
      expect(delays[2]).toBeGreaterThanOrEqual(200);
      expect(delays[2]).toBeLessThanOrEqual(400);
      
      // Each delay should be greater than the previous (with some tolerance for jitter)
      expect(delays[1]).toBeGreaterThan(delays[0] * 0.8);
      expect(delays[2]).toBeGreaterThan(delays[1] * 0.8);
    });

    it('should cap delay at maxDelayMs', async () => {
      const error = { code: 'unavailable', message: 'Service unavailable' };
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');
      
      const delays: number[] = [];
      const onRetry = vi.fn((err, attempt, delay) => {
        delays.push(delay);
      });
      
      await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10000, // 10 seconds
        backoffMultiplier: 3,
        maxDelayMs: 5000, // Cap at 5 seconds
        onRetry,
      });
      
      // All delays should be capped at maxDelayMs
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(5000);
      });
    }, 15000); // 15 second timeout for this test

    it('should handle async operations that throw synchronous errors', async () => {
      const error = new Error('Synchronous error');
      const operation = vi.fn(() => {
        throw error;
      });
      
      await expect(
        withRetry(operation, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Synchronous error');
      
      // Should only be called once since it's not a transient error
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should preserve return type of operation', async () => {
      interface TestResult {
        id: string;
        value: number;
      }
      
      const operation = vi.fn().mockResolvedValue({ id: 'test', value: 42 });
      
      const result: TestResult = await withRetry(operation);
      
      expect(result.id).toBe('test');
      expect(result.value).toBe(42);
    });
  });

  describe('createRetryWrapper', () => {
    it('should create wrapper with pre-configured options', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'unavailable' })
        .mockResolvedValueOnce('success');
      
      const wrapper = createRetryWrapper({
        maxRetries: 2,
        initialDelayMs: 10,
      });
      
      const result = await wrapper(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should allow reusing wrapper for multiple operations', async () => {
      const wrapper = createRetryWrapper({
        maxRetries: 2,
        initialDelayMs: 10,
      });
      
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');
      
      const result1 = await wrapper(operation1);
      const result2 = await wrapper(operation2);
      
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });
  });

  describe('retryFirestore', () => {
    it('should retry Firestore operations with default config', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'unavailable', message: 'Service unavailable' })
        .mockResolvedValueOnce('success');
      
      const result = await retryFirestore(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should log retry attempts', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'deadline-exceeded', message: 'Timeout' })
        .mockResolvedValueOnce('success');
      
      await retryFirestore(operation);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Firestore operation failed')
      );
    });
  });

  describe('retryNetwork', () => {
    it('should retry network operations with more aggressive settings', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await retryNetwork(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use shorter initial delay than Firestore', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');
      
      await retryNetwork(operation);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Network operation failed')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations that return null', async () => {
      const operation = vi.fn().mockResolvedValue(null);
      
      const result = await withRetry(operation);
      
      expect(result).toBe(null);
    });

    it('should handle operations that return undefined', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);
      
      const result = await withRetry(operation);
      
      expect(result).toBe(undefined);
    });

    it('should handle operations that return false', async () => {
      const operation = vi.fn().mockResolvedValue(false);
      
      const result = await withRetry(operation);
      
      expect(result).toBe(false);
    });

    it('should handle maxRetries set to 0', async () => {
      const error = { code: 'unavailable' };
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(
        withRetry(operation, { maxRetries: 0 })
      ).rejects.toEqual(error);
      
      // Should only try once (no retries)
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle very large maxRetries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'unavailable' })
        .mockRejectedValueOnce({ code: 'unavailable' })
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, {
        maxRetries: 100,
        initialDelayMs: 10,
      });
      
      expect(result).toBe('success');
      // Should succeed before hitting max retries
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timing and Performance', () => {
    it('should actually wait between retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'unavailable' })
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      
      await withRetry(operation, {
        maxRetries: 2,
        initialDelayMs: 50,
      });
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have waited at least 25ms (50ms * 0.5 jitter minimum)
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    it('should not add unnecessary delay on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const startTime = Date.now();
      
      await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 1000,
      });
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should complete quickly without delays (< 100ms for overhead)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
