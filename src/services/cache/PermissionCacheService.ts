/**
 * User Permissions Caching Service
 * 
 * Caches user permissions on session creation to avoid repeated Firestore queries.
 * Ensures fast permission checks for UI responsiveness (Requirement 17.1).
 * 
 * Requirements: 17.1
 */

import { sessionCache } from './CacheService';
import type { User, Permission, UserRole } from '../../types/models';

/**
 * Cached user session data with permissions
 */
export interface CachedUserSession {
  user: User;
  permissions: Permission[];
  cachedAt: Date;
}

/**
 * Permission cache configuration
 */
const PERMISSION_CACHE_CONFIG = {
  // Cache TTL: Session lifetime (entire browser session)
  // Using session cache means permissions are cleared on browser close
  TTL: 24 * 60 * 60 * 1000, // 24 hours max (session storage will clear earlier)
  
  // Cache keys
  USER_SESSION_KEY: 'user_session',
  PERMISSIONS_KEY_PREFIX: 'permissions_',
  
  // Invalidation events
  PERMISSION_UPDATE_EVENT: 'permissions_updated',
  SESSION_END_EVENT: 'session_end',
};

/**
 * Role-based permissions mapping
 * 
 * Defines which permissions each role has access to.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Administrator: [
    'manage_users',
    'manage_suppliers',
    'upload_pricelists',
    'approve_matches',
    'adjust_inventory',
    'process_sales',
    'generate_reports',
  ],
  Manager: [
    'manage_suppliers',
    'upload_pricelists',
    'approve_matches',
    'adjust_inventory',
    'process_sales',
    'generate_reports',
  ],
  Analyst: [
    'upload_pricelists',
    'approve_matches',
    'generate_reports',
  ],
  Clerk: [
    'upload_pricelists',
    'adjust_inventory',
  ],
  Sales_Associate: [
    'process_sales',
  ],
};

/**
 * User Permissions Caching Service
 * 
 * Provides optimized caching for user permissions to enable fast
 * permission checks without repeated database queries.
 * 
 * Cached on session creation and invalidated on:
 * - Session end (logout)
 * - Permission/role changes
 */
export class PermissionCacheService {
  /**
   * Cache user session data with permissions
   * 
   * Call this immediately after successful login to cache
   * user information and computed permissions.
   * 
   * @param user - User object from authentication
   */
  cacheUserSession(user: User): void {
    const permissions = this.computePermissions(user.role);
    
    const sessionData: CachedUserSession = {
      user,
      permissions,
      cachedAt: new Date(),
    };

    sessionCache.set(
      PERMISSION_CACHE_CONFIG.USER_SESSION_KEY,
      sessionData,
      PERMISSION_CACHE_CONFIG.TTL
    );
  }

  /**
   * Get cached user session
   * 
   * Returns null if no session is cached or if session has expired.
   * 
   * @returns Cached user session or null
   */
  getUserSession(): CachedUserSession | null {
    return sessionCache.get<CachedUserSession>(
      PERMISSION_CACHE_CONFIG.USER_SESSION_KEY
    );
  }

  /**
   * Get cached user
   * 
   * @returns Cached user object or null
   */
  getUser(): User | null {
    const session = this.getUserSession();
    return session ? session.user : null;
  }

  /**
   * Get cached permissions for the current user
   * 
   * @returns Array of permissions or empty array if not cached
   */
  getPermissions(): Permission[] {
    const session = this.getUserSession();
    return session ? session.permissions : [];
  }

  /**
   * Check if user has a specific permission
   * 
   * Fast permission check using cached data.
   * Falls back to role-based lookup if cache miss.
   * 
   * @param permission - Permission to check
   * @returns true if user has permission, false otherwise
   * 
   * Requirement 17.1: UI response time <500ms
   */
  hasPermission(permission: Permission): boolean {
    const session = this.getUserSession();
    
    if (!session) {
      return false;
    }

    return session.permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   * 
   * @param permissions - Array of permissions to check
   * @returns true if user has at least one permission
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    const userPermissions = this.getPermissions();
    return permissions.some((p) => userPermissions.includes(p));
  }

  /**
   * Check if user has all of the specified permissions
   * 
   * @param permissions - Array of permissions to check
   * @returns true if user has all permissions
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    const userPermissions = this.getPermissions();
    return permissions.every((p) => userPermissions.includes(p));
  }

  /**
   * Check if cached session is valid (exists and not expired)
   * 
   * @returns true if valid session exists
   */
  hasValidSession(): boolean {
    return this.getUserSession() !== null;
  }

  /**
   * Invalidate user session cache
   * 
   * Call this on:
   * - Logout
   * - Session expiration
   * - User permission/role changes
   */
  invalidateSession(): void {
    sessionCache.remove(PERMISSION_CACHE_CONFIG.USER_SESSION_KEY);
  }

  /**
   * Update cached user session
   * 
   * Call this when user data changes (e.g., role update)
   * to refresh the cache without requiring re-login.
   * 
   * @param user - Updated user object
   */
  updateUserSession(user: User): void {
    this.cacheUserSession(user);
  }

  /**
   * Compute permissions from user role
   * 
   * @param role - User role
   * @returns Array of permissions for the role
   */
  private computePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Setup event-based cache invalidation
   * 
   * Register listeners for permission update events to automatically
   * invalidate cache when permissions change.
   */
  setupInvalidationListeners(): void {
    // Listen for permission update events
    sessionCache.onInvalidate(
      PERMISSION_CACHE_CONFIG.PERMISSION_UPDATE_EVENT,
      () => {
        this.invalidateSession();
      }
    );

    // Listen for session end events
    sessionCache.onInvalidate(
      PERMISSION_CACHE_CONFIG.SESSION_END_EVENT,
      () => {
        this.invalidateSession();
      }
    );
  }

  /**
   * Trigger permission update invalidation event
   * 
   * Call this from user management operations when permissions
   * or roles are modified.
   */
  triggerPermissionUpdate(): void {
    sessionCache.triggerInvalidation(PERMISSION_CACHE_CONFIG.PERMISSION_UPDATE_EVENT);
  }

  /**
   * Trigger session end invalidation event
   * 
   * Call this from logout operations to invalidate all session caches.
   */
  triggerSessionEnd(): void {
    sessionCache.triggerInvalidation(PERMISSION_CACHE_CONFIG.SESSION_END_EVENT);
  }

  /**
   * Get cache statistics
   * 
   * @returns Information about cached session
   */
  getStats(): {
    hasSession: boolean;
    userId?: string;
    role?: UserRole;
    permissionCount: number;
    cachedAt?: Date;
  } {
    const session = this.getUserSession();

    if (!session) {
      return {
        hasSession: false,
        permissionCount: 0,
      };
    }

    return {
      hasSession: true,
      userId: session.user.userId,
      role: session.user.role,
      permissionCount: session.permissions.length,
      cachedAt: session.cachedAt,
    };
  }
}

// Export singleton instance
export const permissionCacheService = new PermissionCacheService();
