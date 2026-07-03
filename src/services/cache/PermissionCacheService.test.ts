/**
 * Unit Tests for PermissionCacheService
 * 
 * Tests user permissions caching for fast access control checks.
 * 
 * Requirements: 17.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionCacheService, ROLE_PERMISSIONS } from './PermissionCacheService';
import { sessionCache } from './CacheService';
import type { User } from '../../types/models';

describe('PermissionCacheService', () => {
  let permissionCacheService: PermissionCacheService;
  let mockUser: User;

  beforeEach(() => {
    // Clear cache before each test
    sessionCache.clear();

    permissionCacheService = new PermissionCacheService();

    mockUser = {
      userId: 'user123',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'Manager',
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    };
  });

  describe('cacheUserSession', () => {
    it('should cache user session with permissions', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const session = permissionCacheService.getUserSession();

      expect(session).not.toBeNull();
      expect(session?.user.userId).toBe(mockUser.userId);
      expect(session?.user.email).toBe(mockUser.email);
      expect(session?.user.role).toBe(mockUser.role);
      expect(session?.permissions).toBeDefined();
    });

    it('should compute permissions based on role', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const session = permissionCacheService.getUserSession();
      const expectedPermissions = ROLE_PERMISSIONS[mockUser.role];

      expect(session?.permissions).toEqual(expectedPermissions);
    });
  });

  describe('getUserSession', () => {
    it('should return cached session', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const session = permissionCacheService.getUserSession();

      expect(session).not.toBeNull();
      expect(session?.user.userId).toBe(mockUser.userId);
    });

    it('should return null if no session cached', () => {
      const session = permissionCacheService.getUserSession();

      expect(session).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return cached user', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const user = permissionCacheService.getUser();

      expect(user).not.toBeNull();
      expect(user?.userId).toBe(mockUser.userId);
      expect(user?.email).toBe(mockUser.email);
      expect(user?.role).toBe(mockUser.role);
    });

    it('should return null if no user cached', () => {
      const user = permissionCacheService.getUser();

      expect(user).toBeNull();
    });
  });

  describe('getPermissions', () => {
    it('should return cached permissions', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const permissions = permissionCacheService.getPermissions();
      const expectedPermissions = ROLE_PERMISSIONS[mockUser.role];

      expect(permissions).toEqual(expectedPermissions);
    });

    it('should return empty array if no session cached', () => {
      const permissions = permissionCacheService.getPermissions();

      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true for permissions user has', () => {
      permissionCacheService.cacheUserSession(mockUser);

      // Manager should have these permissions
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(true);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(true);
    });

    it('should return false for permissions user does not have', () => {
      permissionCacheService.cacheUserSession(mockUser);

      // Manager should not have manage_users (admin only)
      expect(permissionCacheService.hasPermission('manage_users')).toBe(false);
    });

    it('should return false if no session cached', () => {
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const result = permissionCacheService.hasAnyPermission([
        'manage_users', // Manager does not have
        'manage_suppliers', // Manager has this
      ]);

      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const result = permissionCacheService.hasAnyPermission([
        'manage_users', // Manager does not have
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const result = permissionCacheService.hasAllPermissions([
        'manage_suppliers',
        'upload_pricelists',
      ]);

      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const result = permissionCacheService.hasAllPermissions([
        'manage_suppliers', // Has this
        'manage_users', // Does not have this
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasValidSession', () => {
    it('should return true if valid session exists', () => {
      permissionCacheService.cacheUserSession(mockUser);

      expect(permissionCacheService.hasValidSession()).toBe(true);
    });

    it('should return false if no session exists', () => {
      expect(permissionCacheService.hasValidSession()).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    it('should clear cached session', () => {
      permissionCacheService.cacheUserSession(mockUser);
      expect(permissionCacheService.hasValidSession()).toBe(true);

      permissionCacheService.invalidateSession();

      expect(permissionCacheService.hasValidSession()).toBe(false);
    });
  });

  describe('updateUserSession', () => {
    it('should update cached session with new user data', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const updatedUser: User = {
        ...mockUser,
        role: 'Administrator',
      };

      permissionCacheService.updateUserSession(updatedUser);

      const session = permissionCacheService.getUserSession();
      expect(session?.user.role).toBe('Administrator');

      // Permissions should also be updated
      const expectedPermissions = ROLE_PERMISSIONS['Administrator'];
      expect(session?.permissions).toEqual(expectedPermissions);
    });
  });

  describe('role-based permissions', () => {
    it('should have correct permissions for Administrator', () => {
      const adminUser: User = { ...mockUser, role: 'Administrator' };
      permissionCacheService.cacheUserSession(adminUser);

      expect(permissionCacheService.hasPermission('manage_users')).toBe(true);
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(true);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(true);
      expect(permissionCacheService.hasPermission('approve_matches')).toBe(true);
      expect(permissionCacheService.hasPermission('adjust_inventory')).toBe(true);
      expect(permissionCacheService.hasPermission('process_sales')).toBe(true);
      expect(permissionCacheService.hasPermission('generate_reports')).toBe(true);
    });

    it('should have correct permissions for Manager', () => {
      const managerUser: User = { ...mockUser, role: 'Manager' };
      permissionCacheService.cacheUserSession(managerUser);

      expect(permissionCacheService.hasPermission('manage_users')).toBe(false);
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(true);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(true);
      expect(permissionCacheService.hasPermission('approve_matches')).toBe(true);
      expect(permissionCacheService.hasPermission('adjust_inventory')).toBe(true);
      expect(permissionCacheService.hasPermission('process_sales')).toBe(true);
      expect(permissionCacheService.hasPermission('generate_reports')).toBe(true);
    });

    it('should have correct permissions for Analyst', () => {
      const analystUser: User = { ...mockUser, role: 'Analyst' };
      permissionCacheService.cacheUserSession(analystUser);

      expect(permissionCacheService.hasPermission('manage_users')).toBe(false);
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(false);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(true);
      expect(permissionCacheService.hasPermission('approve_matches')).toBe(true);
      expect(permissionCacheService.hasPermission('adjust_inventory')).toBe(false);
      expect(permissionCacheService.hasPermission('process_sales')).toBe(false);
      expect(permissionCacheService.hasPermission('generate_reports')).toBe(true);
    });

    it('should have correct permissions for Clerk', () => {
      const clerkUser: User = { ...mockUser, role: 'Clerk' };
      permissionCacheService.cacheUserSession(clerkUser);

      expect(permissionCacheService.hasPermission('manage_users')).toBe(false);
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(false);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(true);
      expect(permissionCacheService.hasPermission('approve_matches')).toBe(false);
      expect(permissionCacheService.hasPermission('adjust_inventory')).toBe(true);
      expect(permissionCacheService.hasPermission('process_sales')).toBe(false);
      expect(permissionCacheService.hasPermission('generate_reports')).toBe(false);
    });

    it('should have correct permissions for Sales_Associate', () => {
      const salesUser: User = { ...mockUser, role: 'Sales_Associate' };
      permissionCacheService.cacheUserSession(salesUser);

      expect(permissionCacheService.hasPermission('manage_users')).toBe(false);
      expect(permissionCacheService.hasPermission('manage_suppliers')).toBe(false);
      expect(permissionCacheService.hasPermission('upload_pricelists')).toBe(false);
      expect(permissionCacheService.hasPermission('approve_matches')).toBe(false);
      expect(permissionCacheService.hasPermission('adjust_inventory')).toBe(false);
      expect(permissionCacheService.hasPermission('process_sales')).toBe(true);
      expect(permissionCacheService.hasPermission('generate_reports')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return stats when session exists', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const stats = permissionCacheService.getStats();

      expect(stats.hasSession).toBe(true);
      expect(stats.userId).toBe(mockUser.userId);
      expect(stats.role).toBe(mockUser.role);
      expect(stats.permissionCount).toBeGreaterThan(0);
      expect(stats.cachedAt).toBeDefined();
    });

    it('should return empty stats when no session', () => {
      const stats = permissionCacheService.getStats();

      expect(stats.hasSession).toBe(false);
      expect(stats.permissionCount).toBe(0);
    });
  });

  describe('performance requirements', () => {
    it('should satisfy Requirement 17.1: permission check <500ms', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const start = Date.now();
      const hasPermission = permissionCacheService.hasPermission('manage_suppliers');
      const duration = Date.now() - start;

      expect(hasPermission).toBe(true);
      expect(duration).toBeLessThan(500);
      // Typically should be <5ms for cached permission check
      expect(duration).toBeLessThan(50);
    });

    it('should perform multiple permission checks quickly', () => {
      permissionCacheService.cacheUserSession(mockUser);

      const start = Date.now();

      // Perform multiple permission checks
      for (let i = 0; i < 100; i++) {
        permissionCacheService.hasPermission('manage_suppliers');
        permissionCacheService.hasPermission('upload_pricelists');
        permissionCacheService.hasPermission('generate_reports');
      }

      const duration = Date.now() - start;

      // 300 permission checks should complete very quickly
      expect(duration).toBeLessThan(500);
    });
  });
});
