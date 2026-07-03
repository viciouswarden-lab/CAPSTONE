/**
 * Cache Services Module
 * 
 * Provides caching infrastructure for frequently accessed data.
 * 
 * Exports:
 * - CacheService: Generic caching service with TTL and invalidation
 * - ProductCacheService: Product catalog caching for POS
 * - PermissionCacheService: User permissions caching
 * 
 * Requirements: 13.1, 17.1
 */

export {
  CacheService,
  sessionCache,
  persistentCache,
  InvalidationStrategy,
  type CacheConfig,
} from './CacheService';

export {
  ProductCacheService,
  productCacheService,
} from './ProductCacheService';

export {
  PermissionCacheService,
  permissionCacheService,
  ROLE_PERMISSIONS,
  type CachedUserSession,
} from './PermissionCacheService';
