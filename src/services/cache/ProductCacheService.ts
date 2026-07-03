/**
 * Product Catalog Caching Service
 * 
 * Caches product catalog data for fast POS lookups.
 * Ensures product lookup completes within 1 second (Requirement 13.1).
 * 
 * Requirements: 13.1, 17.1
 */

import { sessionCache } from './CacheService';
import type { ProductPOS } from '../../types/models';

/**
 * Product catalog cache configuration
 */
const PRODUCT_CACHE_CONFIG = {
  // Cache TTL: 10 minutes (balance between freshness and performance)
  TTL: 10 * 60 * 1000,
  
  // Cache key patterns
  PRODUCT_KEY_PREFIX: 'product_',
  CATALOG_KEY: 'product_catalog_all',
  
  // Invalidation events
  PRODUCT_UPDATE_EVENT: 'product_updated',
  CATALOG_REFRESH_EVENT: 'catalog_refresh',
};

/**
 * Product Catalog Caching Service
 * 
 * Provides optimized caching for product lookups in POS interface.
 * Reduces Firestore queries and ensures sub-second response times.
 */
export class ProductCacheService {
  /**
   * Get product by SKU from cache or fetch function
   * 
   * This method ensures product lookup completes within 1 second
   * by serving from cache when available.
   * 
   * @param sku - Product SKU to lookup
   * @param fetchFn - Function to fetch product if not cached
   * @returns Promise resolving to product data
   * 
   * Requirement 13.1: Product lookup within 1 second
   */
  async getProduct(
    sku: string,
    fetchFn: () => Promise<ProductPOS>
  ): Promise<ProductPOS> {
    const cacheKey = this.getProductCacheKey(sku);

    // Use cache-or-fetch pattern
    return sessionCache.getOrSet(cacheKey, fetchFn, PRODUCT_CACHE_CONFIG.TTL);
  }

  /**
   * Cache a product explicitly
   * 
   * Useful when batch-loading products or after updates.
   * 
   * @param product - Product to cache
   */
  cacheProduct(product: ProductPOS): void {
    const cacheKey = this.getProductCacheKey(product.sku);
    sessionCache.set(cacheKey, product, PRODUCT_CACHE_CONFIG.TTL);
  }

  /**
   * Cache multiple products at once
   * 
   * Useful for preloading frequently accessed products.
   * 
   * @param products - Array of products to cache
   */
  cacheProducts(products: ProductPOS[]): void {
    products.forEach((product) => {
      this.cacheProduct(product);
    });
  }

  /**
   * Get full product catalog from cache or fetch function
   * 
   * Caches the entire catalog for scenarios where multiple products
   * need to be accessed quickly (e.g., POS product selection UI).
   * 
   * @param fetchFn - Function to fetch all products if not cached
   * @returns Promise resolving to array of all products
   */
  async getCatalog(fetchFn: () => Promise<ProductPOS[]>): Promise<ProductPOS[]> {
    return sessionCache.getOrSet(
      PRODUCT_CACHE_CONFIG.CATALOG_KEY,
      fetchFn,
      PRODUCT_CACHE_CONFIG.TTL
    );
  }

  /**
   * Invalidate cache for a specific product
   * 
   * Call this when a product is updated or deleted.
   * 
   * @param sku - SKU of product to invalidate
   */
  invalidateProduct(sku: string): void {
    const cacheKey = this.getProductCacheKey(sku);
    sessionCache.remove(cacheKey);
    
    // Also invalidate full catalog cache since it contains this product
    this.invalidateCatalog();
  }

  /**
   * Invalidate the entire product catalog cache
   * 
   * Call this when:
   * - Bulk product updates occur
   * - New products are added
   * - Product data structure changes
   */
  invalidateCatalog(): void {
    sessionCache.remove(PRODUCT_CACHE_CONFIG.CATALOG_KEY);
  }

  /**
   * Invalidate all product-related caches
   * 
   * Nuclear option - clears all product cache entries.
   * Use sparingly, typically only after major data migrations.
   */
  invalidateAll(): void {
    sessionCache.invalidatePattern(PRODUCT_CACHE_CONFIG.PRODUCT_KEY_PREFIX);
    this.invalidateCatalog();
  }

  /**
   * Preload frequently accessed products into cache
   * 
   * Call this during application initialization or POS session start
   * to ensure fast lookups for common products.
   * 
   * @param skus - Array of SKUs to preload
   * @param fetchFn - Function to fetch products by SKUs
   */
  async preloadProducts(
    skus: string[],
    fetchFn: (skus: string[]) => Promise<ProductPOS[]>
  ): Promise<void> {
    try {
      const products = await fetchFn(skus);
      this.cacheProducts(products);
    } catch (error) {
      console.error('Failed to preload products:', error);
      // Non-critical - caching is an optimization
    }
  }

  /**
   * Check if a product is cached and valid
   * 
   * @param sku - Product SKU to check
   * @returns true if product is cached and not expired
   */
  isCached(sku: string): boolean {
    const cacheKey = this.getProductCacheKey(sku);
    return sessionCache.has(cacheKey);
  }

  /**
   * Get cache statistics for monitoring
   * 
   * @returns Cache hit/miss metrics
   */
  getStats(): { cachedProducts: number } {
    const stats = sessionCache.getStats();
    
    // Count product-specific cache entries
    let cachedProducts = 0;
    try {
      const storage = window.sessionStorage;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.includes(PRODUCT_CACHE_CONFIG.PRODUCT_KEY_PREFIX)) {
          cachedProducts++;
        }
      }
    } catch (error) {
      console.error('Failed to get product cache stats:', error);
    }

    return { cachedProducts };
  }

  /**
   * Get product cache key
   */
  private getProductCacheKey(sku: string): string {
    return `${PRODUCT_CACHE_CONFIG.PRODUCT_KEY_PREFIX}${sku}`;
  }

  /**
   * Setup event-based cache invalidation
   * 
   * Register listeners for product update events to automatically
   * invalidate cache when data changes.
   */
  setupInvalidationListeners(): void {
    // Listen for product update events
    sessionCache.onInvalidate(
      PRODUCT_CACHE_CONFIG.PRODUCT_UPDATE_EVENT,
      () => {
        // Invalidate all product caches on update event
        this.invalidateAll();
      }
    );

    // Listen for catalog refresh events
    sessionCache.onInvalidate(
      PRODUCT_CACHE_CONFIG.CATALOG_REFRESH_EVENT,
      () => {
        this.invalidateCatalog();
      }
    );
  }

  /**
   * Trigger product update invalidation event
   * 
   * Call this from product update operations to invalidate cache
   * across all components.
   * 
   * @param sku - Optional SKU of updated product (invalidates specific product)
   */
  triggerProductUpdate(sku?: string): void {
    if (sku) {
      this.invalidateProduct(sku);
    } else {
      sessionCache.triggerInvalidation(PRODUCT_CACHE_CONFIG.PRODUCT_UPDATE_EVENT);
    }
  }
}

// Export singleton instance
export const productCacheService = new ProductCacheService();
