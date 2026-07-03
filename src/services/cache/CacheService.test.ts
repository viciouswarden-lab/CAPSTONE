/**
 * Unit Tests for CacheService
 * 
 * Tests caching functionality including TTL, invalidation, and storage operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from './CacheService';

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockStorage: Storage;

  beforeEach(() => {
    // Create mock storage
    const storage = new Map<string, string>();
    mockStorage = {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
      key: vi.fn((index: number) => {
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      }),
      get length() {
        return storage.size;
      },
    } as Storage;

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
    });

    cacheService = new CacheService({
      storageType: 'sessionStorage',
      defaultTTL: 1000, // 1 second for testing
      keyPrefix: 'test_',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const data = { value: 'test' };
      cacheService.set('key1', data);

      const retrieved = cacheService.get('key1');
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const retrieved = cacheService.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should use key prefix', () => {
      cacheService.set('key1', 'value');
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'test_key1',
        expect.any(String)
      );
    });

    it('should handle different data types', () => {
      const testCases = [
        { key: 'string', value: 'test string' },
        { key: 'number', value: 42 },
        { key: 'boolean', value: true },
        { key: 'array', value: [1, 2, 3] },
        { key: 'object', value: { nested: { data: 'value' } } },
      ];

      testCases.forEach(({ key, value }) => {
        cacheService.set(key, value);
        const retrieved = cacheService.get(key);
        expect(retrieved).toEqual(value);
      });
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entries', async () => {
      cacheService.set('key1', 'value', 50); // 50ms TTL

      // Immediately should be available
      expect(cacheService.get('key1')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cacheService.set('key1', 'value'); // Uses default 1000ms

      // Should be available
      expect(cacheService.get('key1')).toBe('value');
    });

    it('should remove expired entries on access', async () => {
      cacheService.set('key1', 'value', 50);
      await new Promise((resolve) => setTimeout(resolve, 100));

      cacheService.get('key1'); // Should trigger removal

      expect(mockStorage.removeItem).toHaveBeenCalledWith('test_key1');
    });
  });

  describe('remove', () => {
    it('should remove specific cache entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      cacheService.remove('key1');

      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBe('value2');
    });
  });

  describe('clear', () => {
    it('should clear all entries with prefix', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      cacheService.clear();

      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
    });

    it('should only clear entries with matching prefix', () => {
      // Add entries with our prefix
      cacheService.set('key1', 'value1');

      // Add entry with different prefix directly to storage
      mockStorage.setItem('other_key', JSON.stringify({
        data: 'other',
        timestamp: Date.now(),
        ttl: 10000,
      }));

      cacheService.clear();

      expect(cacheService.get('key1')).toBeNull();
      expect(mockStorage.getItem('other_key')).not.toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for valid cached entries', () => {
      cacheService.set('key1', 'value');
      expect(cacheService.has('key1')).toBe(true);
    });

    it('should return false for non-existent entries', () => {
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should return false for expired entries', async () => {
      cacheService.set('key1', 'value', 50);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cacheService.has('key1')).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if available', async () => {
      const factory = vi.fn(async () => 'generated');

      cacheService.set('key1', 'cached');
      const result = await cacheService.getOrSet('key1', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not cached', async () => {
      const factory = vi.fn(async () => 'generated');

      const result = await cacheService.getOrSet('key1', factory);

      expect(result).toBe('generated');
      expect(factory).toHaveBeenCalledOnce();
      expect(cacheService.get('key1')).toBe('generated');
    });

    it('should use custom TTL when provided', async () => {
      const factory = async () => 'generated';

      await cacheService.getOrSet('key1', factory, 5000);

      // Verify TTL is set (check storage directly)
      const stored = JSON.parse(mockStorage.getItem('test_key1')!);
      expect(stored.ttl).toBe(5000);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate all entries matching pattern', () => {
      cacheService.set('product_123', 'value1');
      cacheService.set('product_456', 'value2');
      cacheService.set('user_789', 'value3');

      cacheService.invalidatePattern('product_');

      expect(cacheService.get('product_123')).toBeNull();
      expect(cacheService.get('product_456')).toBeNull();
      expect(cacheService.get('user_789')).toBe('value3');
    });
  });

  describe('event-based invalidation', () => {
    it('should register and trigger invalidation listeners', () => {
      const callback = vi.fn();
      cacheService.onInvalidate('test_event', callback);

      cacheService.triggerInvalidation('test_event');

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should support multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      cacheService.onInvalidate('test_event', callback1);
      cacheService.onInvalidate('test_event', callback2);

      cacheService.triggerInvalidation('test_event');

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should handle errors in callbacks gracefully', () => {
      const callback1 = vi.fn(() => {
        throw new Error('Callback error');
      });
      const callback2 = vi.fn();

      cacheService.onInvalidate('test_event', callback1);
      cacheService.onInvalidate('test_event', callback2);

      // Should not throw
      expect(() => {
        cacheService.triggerInvalidation('test_event');
      }).not.toThrow();

      // Second callback should still be called
      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      const stats = cacheService.getStats();

      expect(stats.entryCount).toBe(2);
      expect(stats.estimatedSize).toBeGreaterThan(0);
    });

    it('should only count entries with matching prefix', () => {
      cacheService.set('key1', 'value1');
      mockStorage.setItem('other_key', 'value');

      const stats = cacheService.getStats();

      expect(stats.entryCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted cache data gracefully', () => {
      // Store invalid JSON
      mockStorage.setItem('test_key1', 'invalid json');

      const result = cacheService.get('key1');
      expect(result).toBeNull();
    });

    it('should handle storage errors gracefully', () => {
      // Mock storage to throw error
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => {
        cacheService.set('key1', 'value');
      }).not.toThrow();
    });
  });
});
