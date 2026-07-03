/**
 * Unit Tests for ProductCacheService
 * 
 * Tests product catalog caching for POS operations.
 * 
 * Requirements: 13.1, 17.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductCacheService } from './ProductCacheService';
import { sessionCache } from './CacheService';
import type { ProductPOS } from '../../types/models';

describe('ProductCacheService', () => {
  let productCacheService: ProductCacheService;
  let mockProduct: ProductPOS;

  beforeEach(() => {
    // Clear cache before each test
    sessionCache.clear();

    productCacheService = new ProductCacheService();

    mockProduct = {
      sku: 'TEST-001',
      description: 'Test Product',
      price: 19.99,
      availableQuantity: 100,
      category: 'Test Category',
    };
  });

  describe('getProduct', () => {
    it('should fetch product if not cached', async () => {
      const fetchFn = vi.fn(async () => mockProduct);

      const result = await productCacheService.getProduct('TEST-001', fetchFn);

      expect(result).toEqual(mockProduct);
      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should return cached product without fetching', async () => {
      const fetchFn = vi.fn(async () => mockProduct);

      // First call - should fetch
      await productCacheService.getProduct('TEST-001', fetchFn);

      // Second call - should use cache
      const result = await productCacheService.getProduct('TEST-001', fetchFn);

      expect(result).toEqual(mockProduct);
      expect(fetchFn).toHaveBeenCalledOnce(); // Only called once
    });

    it('should cache product for fast subsequent lookups', async () => {
      const fetchFn = async () => {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockProduct;
      };

      // First call
      const start1 = Date.now();
      await productCacheService.getProduct('TEST-001', fetchFn);
      const duration1 = Date.now() - start1;

      // Second call (cached) - should be faster
      const start2 = Date.now();
      await productCacheService.getProduct('TEST-001', fetchFn);
      const duration2 = Date.now() - start2;

      // Cached call should be faster (with some tolerance for timing variability)
      // First call includes async delay (>10ms), cached should be much faster
      expect(duration1).toBeGreaterThanOrEqual(10);
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('cacheProduct', () => {
    it('should cache a single product', () => {
      productCacheService.cacheProduct(mockProduct);

      expect(productCacheService.isCached('TEST-001')).toBe(true);
    });

    it('should allow retrieval after caching', async () => {
      productCacheService.cacheProduct(mockProduct);

      const fetchFn = vi.fn(async () => mockProduct);
      const result = await productCacheService.getProduct('TEST-001', fetchFn);

      expect(result).toEqual(mockProduct);
      expect(fetchFn).not.toHaveBeenCalled(); // Should not fetch
    });
  });

  describe('cacheProducts', () => {
    it('should cache multiple products at once', () => {
      const products: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
        { ...mockProduct, sku: 'TEST-002' },
        { ...mockProduct, sku: 'TEST-003' },
      ];

      productCacheService.cacheProducts(products);

      expect(productCacheService.isCached('TEST-001')).toBe(true);
      expect(productCacheService.isCached('TEST-002')).toBe(true);
      expect(productCacheService.isCached('TEST-003')).toBe(true);
    });
  });

  describe('getCatalog', () => {
    it('should fetch catalog if not cached', async () => {
      const mockCatalog: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
        { ...mockProduct, sku: 'TEST-002' },
      ];

      const fetchFn = vi.fn(async () => mockCatalog);

      const result = await productCacheService.getCatalog(fetchFn);

      expect(result).toEqual(mockCatalog);
      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should return cached catalog without fetching', async () => {
      const mockCatalog: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
      ];

      const fetchFn = vi.fn(async () => mockCatalog);

      // First call - should fetch
      await productCacheService.getCatalog(fetchFn);

      // Second call - should use cache
      const result = await productCacheService.getCatalog(fetchFn);

      expect(result).toEqual(mockCatalog);
      expect(fetchFn).toHaveBeenCalledOnce();
    });
  });

  describe('invalidateProduct', () => {
    it('should invalidate specific product cache', () => {
      productCacheService.cacheProduct(mockProduct);
      expect(productCacheService.isCached('TEST-001')).toBe(true);

      productCacheService.invalidateProduct('TEST-001');

      expect(productCacheService.isCached('TEST-001')).toBe(false);
    });

    it('should not affect other cached products', () => {
      const products: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
        { ...mockProduct, sku: 'TEST-002' },
      ];

      productCacheService.cacheProducts(products);

      productCacheService.invalidateProduct('TEST-001');

      expect(productCacheService.isCached('TEST-001')).toBe(false);
      expect(productCacheService.isCached('TEST-002')).toBe(true);
    });
  });

  describe('invalidateCatalog', () => {
    it('should invalidate catalog cache', async () => {
      const mockCatalog: ProductPOS[] = [mockProduct];
      const fetchFn = async () => mockCatalog;

      await productCacheService.getCatalog(fetchFn);
      productCacheService.invalidateCatalog();

      // Catalog should not be cached anymore
      // (We can verify by checking if fetch is called again)
      const fetchFn2 = vi.fn(async () => mockCatalog);
      await productCacheService.getCatalog(fetchFn2);

      expect(fetchFn2).toHaveBeenCalledOnce();
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all product caches', () => {
      const products: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
        { ...mockProduct, sku: 'TEST-002' },
      ];

      productCacheService.cacheProducts(products);

      productCacheService.invalidateAll();

      expect(productCacheService.isCached('TEST-001')).toBe(false);
      expect(productCacheService.isCached('TEST-002')).toBe(false);
    });
  });

  describe('preloadProducts', () => {
    it('should preload multiple products into cache', async () => {
      const skus = ['TEST-001', 'TEST-002', 'TEST-003'];
      const products: ProductPOS[] = skus.map((sku) => ({
        ...mockProduct,
        sku,
      }));

      const fetchFn = vi.fn(async (fetchSkus: string[]) => {
        return products.filter((p) => fetchSkus.includes(p.sku));
      });

      await productCacheService.preloadProducts(skus, fetchFn);

      // All products should be cached
      expect(productCacheService.isCached('TEST-001')).toBe(true);
      expect(productCacheService.isCached('TEST-002')).toBe(true);
      expect(productCacheService.isCached('TEST-003')).toBe(true);
    });

    it('should handle preload errors gracefully', async () => {
      const fetchFn = vi.fn(async () => {
        throw new Error('Fetch failed');
      });

      // Should not throw
      await expect(
        productCacheService.preloadProducts(['TEST-001'], fetchFn)
      ).resolves.not.toThrow();
    });
  });

  describe('isCached', () => {
    it('should return true for cached products', () => {
      productCacheService.cacheProduct(mockProduct);
      expect(productCacheService.isCached('TEST-001')).toBe(true);
    });

    it('should return false for non-cached products', () => {
      expect(productCacheService.isCached('TEST-001')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const products: ProductPOS[] = [
        { ...mockProduct, sku: 'TEST-001' },
        { ...mockProduct, sku: 'TEST-002' },
      ];

      productCacheService.cacheProducts(products);

      const stats = productCacheService.getStats();

      expect(stats.cachedProducts).toBeGreaterThanOrEqual(2);
    });
  });

  describe('performance requirements', () => {
    it('should satisfy Requirement 13.1: product lookup within 1 second', async () => {
      const fetchFn = async () => {
        // Simulate slow Firestore query
        await new Promise((resolve) => setTimeout(resolve, 200));
        return mockProduct;
      };

      // First call - fetch from Firestore
      const start1 = Date.now();
      await productCacheService.getProduct('TEST-001', fetchFn);
      const duration1 = Date.now() - start1;

      // Second call - from cache (should be much faster)
      const start2 = Date.now();
      await productCacheService.getProduct('TEST-001', fetchFn);
      const duration2 = Date.now() - start2;

      // Cached lookup should be well under 1 second
      expect(duration2).toBeLessThan(1000);

      // Should be significantly faster than original fetch
      expect(duration2).toBeLessThan(duration1 / 10);
    });

    it('should satisfy Requirement 17.1: UI response time <500ms', async () => {
      // Preload product
      productCacheService.cacheProduct(mockProduct);

      // Cached lookup should be very fast
      const start = Date.now();
      await productCacheService.getProduct('TEST-001', async () => mockProduct);
      const duration = Date.now() - start;

      // Should be well under 500ms (typically <10ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('event-based invalidation', () => {
    it('should setup invalidation listeners', () => {
      const setupSpy = vi.spyOn(sessionCache, 'onInvalidate');

      productCacheService.setupInvalidationListeners();

      expect(setupSpy).toHaveBeenCalled();
    });

    it('should trigger product update invalidation', () => {
      productCacheService.cacheProduct(mockProduct);

      productCacheService.triggerProductUpdate('TEST-001');

      expect(productCacheService.isCached('TEST-001')).toBe(false);
    });
  });
});
