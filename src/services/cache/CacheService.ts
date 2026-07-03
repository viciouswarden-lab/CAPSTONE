/**
 * Caching Service Implementation
 * 
 * Provides client-side caching for frequently accessed data to improve performance.
 * Uses browser storage (localStorage/sessionStorage) with TTL-based invalidation.
 * 
 * Requirements: 13.1, 17.1
 */

/**
 * Cache entry with expiration metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  storageType: 'localStorage' | 'sessionStorage';
  defaultTTL: number; // Default TTL in milliseconds
  keyPrefix: string; // Prefix for cache keys to avoid collisions
}

/**
 * Cache invalidation strategies
 */
export enum InvalidationStrategy {
  /** Time-based: Cache expires after TTL */
  TTL = 'ttl',
  /** Event-based: Cache invalidated on specific events */
  EVENT = 'event',
  /** Manual: Cache must be manually invalidated */
  MANUAL = 'manual',
}

/**
 * Generic caching service with TTL and invalidation support
 * 
 * This service provides:
 * - Fast retrieval of cached data (<500ms for UI response - Requirement 17.1)
 * - Automatic TTL-based expiration
 * - Event-based and manual cache invalidation
 * - Browser storage persistence (localStorage/sessionStorage)
 */
export class CacheService {
  private storage: Storage;
  private config: CacheConfig;
  private eventListeners: Map<string, Set<() => void>>;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      storageType: config?.storageType || 'sessionStorage',
      defaultTTL: config?.defaultTTL || 5 * 60 * 1000, // 5 minutes default
      keyPrefix: config?.keyPrefix || 'pro_synapse_cache_',
    };

    // Use appropriate storage based on configuration
    this.storage =
      this.config.storageType === 'localStorage'
        ? window.localStorage
        : window.sessionStorage;

    this.eventListeners = new Map();
  }

  /**
   * Get a cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Set a value in cache with optional TTL
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time-to-live in milliseconds (optional, uses default if not provided)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
      };

      const cacheKey = this.getCacheKey(key);
      this.storage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error(`Failed to cache data for key ${key}:`, error);
      // Silently fail - caching is an optimization, not critical
    }
  }

  /**
   * Get a value from cache
   * 
   * Returns null if:
   * - Key does not exist
   * - Cache entry has expired (TTL exceeded)
   * - Data is corrupted/invalid
   * 
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    try {
      const cacheKey = this.getCacheKey(key);
      const item = this.storage.getItem(cacheKey);

      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;

      // Check if cache entry has expired
      if (age > entry.ttl) {
        // Remove expired entry
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Failed to retrieve cached data for key ${key}:`, error);
      // Remove corrupted entry
      this.remove(key);
      return null;
    }
  }

  /**
   * Remove a specific cache entry
   * 
   * @param key - Cache key to remove
   */
  remove(key: string): void {
    try {
      const cacheKey = this.getCacheKey(key);
      this.storage.removeItem(cacheKey);
    } catch (error) {
      console.error(`Failed to remove cache key ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries with the configured prefix
   * 
   * This invalidates all cached data managed by this service instance.
   */
  clear(): void {
    try {
      const keysToRemove: string[] = [];

      // Find all keys with our prefix
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.config.keyPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all matching keys
      keysToRemove.forEach((key) => {
        this.storage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Check if a cache entry exists and is valid (not expired)
   * 
   * @param key - Cache key to check
   * @returns true if valid cached data exists, false otherwise
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get or set cached data using a factory function
   * 
   * If cached data exists and is valid, returns it.
   * Otherwise, calls the factory function to generate data,
   * caches it, and returns it.
   * 
   * @param key - Cache key
   * @param factory - Async function to generate data if not cached
   * @param ttl - Optional TTL for the cached data
   * @returns Promise resolving to cached or generated data
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate data using factory
    const data = await factory();

    // Cache the generated data
    this.set(key, data, ttl);

    return data;
  }

  /**
   * Invalidate cache based on a pattern
   * 
   * Removes all cache entries whose keys match the pattern.
   * Pattern matching uses simple string inclusion.
   * 
   * @param pattern - Pattern to match against cache keys
   */
  invalidatePattern(pattern: string): void {
    try {
      const keysToRemove: string[] = [];

      // Find all keys matching the pattern
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (
          key &&
          key.startsWith(this.config.keyPrefix) &&
          key.includes(pattern)
        ) {
          keysToRemove.push(key);
        }
      }

      // Remove all matching keys
      keysToRemove.forEach((key) => {
        this.storage.removeItem(key);
      });
    } catch (error) {
      console.error(`Failed to invalidate cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Register an event listener for cache invalidation
   * 
   * When the event is triggered, all associated cache keys are invalidated.
   * 
   * @param eventName - Name of the event
   * @param callback - Callback to execute on invalidation
   */
  onInvalidate(eventName: string, callback: () => void): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }

    this.eventListeners.get(eventName)!.add(callback);
  }

  /**
   * Trigger event-based cache invalidation
   * 
   * @param eventName - Name of the event to trigger
   */
  triggerInvalidation(eventName: string): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error(
            `Error in cache invalidation callback for event ${eventName}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Object containing cache size and entry count
   */
  getStats(): { entryCount: number; estimatedSize: number } {
    let entryCount = 0;
    let estimatedSize = 0;

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.config.keyPrefix)) {
          entryCount++;
          const value = this.storage.getItem(key);
          if (value) {
            estimatedSize += value.length;
          }
        }
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    return { entryCount, estimatedSize };
  }
}

// Export singleton instances for different cache scopes
export const sessionCache = new CacheService({
  storageType: 'sessionStorage',
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  keyPrefix: 'pro_synapse_session_',
});

export const persistentCache = new CacheService({
  storageType: 'localStorage',
  defaultTTL: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'pro_synapse_persistent_',
});
