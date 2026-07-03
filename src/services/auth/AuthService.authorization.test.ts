/**
 * Authorization and Access Control Tests - Task 44.2
 * 
 * Tests role-based permissions enforcement, Firestore security rules behavior,
 * and unauthorized access attempts.
 * 
 * Requirements validated:
 * - Requirement 1.3: IF a user attempts to access a protected resource without authentication,
 *   THEN THE System SHALL redirect the user to the login page
 * - Requirement 1.4: THE System SHALL enforce role-based permissions for all protected operations
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { FirebaseAuthService } from './AuthService';
import type { User, Permission } from '../../types/models';
import type { UserRole } from '../../types/firestore';

// Mock Firebase modules
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}));

// Import mocked modules
import * as auth from 'firebase/auth';
import * as firestore from 'firebase/firestore';

const mockGetAuth = auth.getAuth as Mock;
const mockSignInWithEmailAndPassword = auth.signInWithEmailAndPassword as Mock;
const mockSignOut = auth.signOut as Mock;

const mockGetFirestore = firestore.getFirestore as Mock;
const mockCollection = firestore.collection as Mock;
const mockDoc = firestore.doc as Mock;
const mockGetDoc = firestore.getDoc as Mock;
const mockGetDocs = firestore.getDocs as Mock;
const mockSetDoc = firestore.setDoc as Mock;
const mockUpdateDoc = firestore.updateDoc as Mock;
const mockQuery = firestore.query as Mock;
const mockWhere = firestore.where as Mock;
const mockServerTimestamp = firestore.serverTimestamp as Mock;

describe('Authorization and Access Control Tests - Task 44.2', () => {
  let authService: FirebaseAuthService;
  let mockAuthInstance: any;
  let mockFirestoreInstance: any;

  // Test data
  const testUserId = 'test-user-123';
  const testEmail = 'test@example.com';

  // Mock Firebase user
  const mockFirebaseUser = {
    uid: testUserId,
    email: testEmail,
    getIdToken: vi.fn().mockResolvedValue('mock-token'),
    getIdTokenResult: vi.fn().mockResolvedValue({
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Firebase Auth instance
    mockAuthInstance = {
      getAuth: vi.fn(() => ({
        currentUser: null,
      })),
      signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
      signOut: mockSignOut,
    };

    // Mock Firestore instance
    mockFirestoreInstance = {
      getFirestore: mockGetFirestore,
      collection: mockCollection,
      doc: mockDoc,
      getDoc: mockGetDoc,
      getDocs: mockGetDocs,
      setDoc: mockSetDoc,
      updateDoc: mockUpdateDoc,
      query: mockQuery,
      where: mockWhere,
      serverTimestamp: mockServerTimestamp,
      Timestamp: firestore.Timestamp,
    };

    mockGetAuth.mockReturnValue(mockAuthInstance.getAuth());
    mockGetFirestore.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});

    authService = new FirebaseAuthService(mockAuthInstance, mockFirestoreInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test Suite 1: Role-Based Permission Enforcement
   * Validates Requirement 1.4
   */
  describe('Role-Based Permission Enforcement', () => {
    /**
     * Test all permissions for Administrator role
     */
    it('should grant all permissions to Administrator role', () => {
      // Arrange: Administrator user
      const adminUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Admin User',
        role: 'Administrator',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Administrator should have all permissions
      const allPermissions: Permission[] = [
        'manage_users',
        'manage_suppliers',
        'upload_pricelists',
        'approve_matches',
        'adjust_inventory',
        'process_sales',
        'generate_reports',
      ];

      for (const permission of allPermissions) {
        const hasPermission = authService.checkPermission(adminUser, permission);
        expect(hasPermission).toBe(true);
      }
    });

    /**
     * Test Manager role permissions
     */
    it('should grant correct permissions to Manager role', () => {
      // Arrange: Manager user
      const managerUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Manager User',
        role: 'Manager',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Manager should have specific permissions
      const shouldHave: Permission[] = [
        'manage_suppliers',
        'upload_pricelists',
        'approve_matches',
        'adjust_inventory',
        'process_sales',
        'generate_reports',
      ];

      const shouldNotHave: Permission[] = ['manage_users'];

      for (const permission of shouldHave) {
        expect(authService.checkPermission(managerUser, permission)).toBe(true);
      }

      for (const permission of shouldNotHave) {
        expect(authService.checkPermission(managerUser, permission)).toBe(false);
      }
    });

    /**
     * Test Analyst role permissions
     */
    it('should grant correct permissions to Analyst role', () => {
      // Arrange: Analyst user
      const analystUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Analyst User',
        role: 'Analyst',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Analyst should have limited permissions
      const shouldHave: Permission[] = [
        'upload_pricelists',
        'approve_matches',
        'generate_reports',
      ];

      const shouldNotHave: Permission[] = [
        'manage_users',
        'manage_suppliers',
        'adjust_inventory',
        'process_sales',
      ];

      for (const permission of shouldHave) {
        expect(authService.checkPermission(analystUser, permission)).toBe(true);
      }

      for (const permission of shouldNotHave) {
        expect(authService.checkPermission(analystUser, permission)).toBe(false);
      }
    });

    /**
     * Test Clerk role permissions
     */
    it('should grant correct permissions to Clerk role', () => {
      // Arrange: Clerk user
      const clerkUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Clerk User',
        role: 'Clerk',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Clerk should have specific permissions
      const shouldHave: Permission[] = ['upload_pricelists', 'adjust_inventory'];

      const shouldNotHave: Permission[] = [
        'manage_users',
        'manage_suppliers',
        'approve_matches',
        'process_sales',
        'generate_reports',
      ];

      for (const permission of shouldHave) {
        expect(authService.checkPermission(clerkUser, permission)).toBe(true);
      }

      for (const permission of shouldNotHave) {
        expect(authService.checkPermission(clerkUser, permission)).toBe(false);
      }
    });

    /**
     * Test Sales_Associate role permissions
     */
    it('should grant correct permissions to Sales_Associate role', () => {
      // Arrange: Sales Associate user
      const salesUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Sales User',
        role: 'Sales_Associate',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Sales Associate should only have process_sales
      const shouldHave: Permission[] = ['process_sales'];

      const shouldNotHave: Permission[] = [
        'manage_users',
        'manage_suppliers',
        'upload_pricelists',
        'approve_matches',
        'adjust_inventory',
        'generate_reports',
      ];

      for (const permission of shouldHave) {
        expect(authService.checkPermission(salesUser, permission)).toBe(true);
      }

      for (const permission of shouldNotHave) {
        expect(authService.checkPermission(salesUser, permission)).toBe(false);
      }
    });

    /**
     * Test permission enforcement across all roles systematically
     */
    it('should correctly enforce all permission boundaries across all roles', () => {
      // Arrange: Define permission matrix
      const permissionMatrix: Record<UserRole, Permission[]> = {
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
        Analyst: ['upload_pricelists', 'approve_matches', 'generate_reports'],
        Clerk: ['upload_pricelists', 'adjust_inventory'],
        Sales_Associate: ['process_sales'],
      };

      const allPermissions: Permission[] = [
        'manage_users',
        'manage_suppliers',
        'upload_pricelists',
        'approve_matches',
        'adjust_inventory',
        'process_sales',
        'generate_reports',
      ];

      const allRoles: UserRole[] = [
        'Administrator',
        'Manager',
        'Analyst',
        'Clerk',
        'Sales_Associate',
      ];

      // Act & Assert: Check each role against each permission
      for (const role of allRoles) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const rolePermissions = permissionMatrix[role];

        for (const permission of allPermissions) {
          const hasPermission = authService.checkPermission(user, permission);
          const shouldHavePermission = rolePermissions.includes(permission);
          
          expect(hasPermission).toBe(shouldHavePermission);
        }
      }
    });
  });

  /**
   * Test Suite 2: Unauthorized Access Attempts - Unauthenticated Users
   * Validates Requirement 1.3
   */
  describe('Unauthorized Access - Unauthenticated Users', () => {
    /**
     * Test that unauthenticated users cannot access protected resources
     */
    it('should return null for getCurrentUser when not authenticated', async () => {
      // Arrange: No authenticated user
      mockAuthInstance.getAuth.mockReturnValue({
        currentUser: null,
      });

      // Act: Attempt to get current user
      const currentUser = await authService.getCurrentUser();

      // Assert: No user returned (Requirement 1.3)
      expect(currentUser).toBeNull();
    });

    /**
     * Test that login is required before accessing protected resources
     */
    it('should require authentication before granting access', async () => {
      // Arrange: User not logged in
      mockAuthInstance.getAuth.mockReturnValue({
        currentUser: null,
      });

      // Act: Multiple attempts to access protected resources
      const user1 = await authService.getCurrentUser();
      const user2 = await authService.getCurrentUser();

      // Assert: All attempts should fail (Requirement 1.3)
      expect(user1).toBeNull();
      expect(user2).toBeNull();
    });

    /**
     * Test that session expiration requires re-authentication
     */
    it('should deny access when session token expires', async () => {
      // Arrange: User with expired token
      const expiredFirebaseUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() - 1000).toISOString(), // Expired
        }),
      };

      mockAuthInstance.getAuth.mockReturnValue({
        currentUser: expiredFirebaseUser,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act: Attempt to access protected resource with expired session
      const currentUser = await authService.getCurrentUser();

      // Assert: Access denied, user signed out (Requirement 1.3, 1.7)
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  /**
   * Test Suite 3: Unauthorized Access - Insufficient Permissions
   * Validates Requirement 1.4
   */
  describe('Unauthorized Access - Insufficient Permissions', () => {
    /**
     * Test that users cannot perform actions outside their role permissions
     */
    it('should deny user management to non-Administrator roles', () => {
      // Arrange: Non-administrator users
      const nonAdminRoles: UserRole[] = ['Manager', 'Analyst', 'Clerk', 'Sales_Associate'];

      // Act & Assert: All non-admin roles should be denied manage_users
      for (const role of nonAdminRoles) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'manage_users');
        expect(hasPermission).toBe(false);
      }
    });

    /**
     * Test that Sales_Associate cannot access inventory or supplier management
     */
    it('should deny inventory and supplier operations to Sales_Associate', () => {
      // Arrange: Sales Associate user
      const salesUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Sales User',
        role: 'Sales_Associate',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Sales Associate should not have these permissions
      expect(authService.checkPermission(salesUser, 'manage_suppliers')).toBe(false);
      expect(authService.checkPermission(salesUser, 'adjust_inventory')).toBe(false);
      expect(authService.checkPermission(salesUser, 'upload_pricelists')).toBe(false);
      expect(authService.checkPermission(salesUser, 'approve_matches')).toBe(false);
    });

    /**
     * Test that Clerk cannot process sales or manage suppliers
     */
    it('should deny sales and supplier management to Clerk', () => {
      // Arrange: Clerk user
      const clerkUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Clerk User',
        role: 'Clerk',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Clerk should not have these permissions
      expect(authService.checkPermission(clerkUser, 'process_sales')).toBe(false);
      expect(authService.checkPermission(clerkUser, 'manage_suppliers')).toBe(false);
      expect(authService.checkPermission(clerkUser, 'manage_users')).toBe(false);
    });

    /**
     * Test that Analyst cannot manage users or adjust inventory
     */
    it('should deny user management and inventory adjustments to Analyst', () => {
      // Arrange: Analyst user
      const analystUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Analyst User',
        role: 'Analyst',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act & Assert: Analyst should not have these permissions
      expect(authService.checkPermission(analystUser, 'manage_users')).toBe(false);
      expect(authService.checkPermission(analystUser, 'adjust_inventory')).toBe(false);
      expect(authService.checkPermission(analystUser, 'manage_suppliers')).toBe(false);
      expect(authService.checkPermission(analystUser, 'process_sales')).toBe(false);
    });
  });

  /**
   * Test Suite 4: Account Status and Access Control
   * Validates additional access control scenarios
   */
  describe('Account Status and Access Control', () => {
    /**
     * Test that inactive users cannot access protected resources
     */
    it('should deny access to inactive users', async () => {
      // Arrange: Inactive user authenticated
      const inactiveUserData = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Inactive User',
        role: 'Manager',
        isActive: false,
        createdAt: { toDate: () => new Date() },
        lastLoginAt: { toDate: () => new Date() },
        failedLoginAttempts: 0,
      };

      mockAuthInstance.getAuth.mockReturnValue({
        currentUser: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => inactiveUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act: Attempt to access protected resource
      const currentUser = await authService.getCurrentUser();

      // Assert: Access denied, user signed out (Requirement 1.4)
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    /**
     * Test that locked accounts cannot login
     */
    it('should deny login to locked accounts', async () => {
      // Arrange: User with active lock
      const lockedUserData = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Locked User',
        role: 'Manager',
        isActive: true,
        createdAt: { toDate: () => new Date() },
        lastLoginAt: { toDate: () => new Date() },
        failedLoginAttempts: 5,
        lockedUntil: { toDate: () => new Date(Date.now() + 30 * 60 * 1000) }, // Locked for 30 min
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => lockedUserData,
          },
        ],
      });

      // Act & Assert: Login should be blocked (Requirement 1.4, 19.6)
      await expect(
        authService.login(testEmail, 'password123', '192.168.1.1', 'test-agent')
      ).rejects.toThrow(/Account is locked due to multiple failed login attempts/);
    });

    /**
     * Test that user permissions are validated on each request
     */
    it('should validate user permissions consistently across multiple checks', () => {
      // Arrange: Manager user
      const managerUser: User = {
        userId: testUserId,
        email: testEmail,
        displayName: 'Manager User',
        role: 'Manager',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act: Multiple permission checks for the same user
      const check1 = authService.checkPermission(managerUser, 'upload_pricelists');
      const check2 = authService.checkPermission(managerUser, 'upload_pricelists');
      const check3 = authService.checkPermission(managerUser, 'manage_users');
      const check4 = authService.checkPermission(managerUser, 'manage_users');

      // Assert: Results should be consistent (Requirement 1.4)
      expect(check1).toBe(true);
      expect(check2).toBe(true);
      expect(check3).toBe(false);
      expect(check4).toBe(false);
    });
  });

  /**
   * Test Suite 5: Firestore Security Rules Behavior Validation
   * These tests validate the expected behavior enforced by Firestore security rules
   */
  describe('Firestore Security Rules Behavior Validation', () => {
    /**
     * Test that only administrators can manage users
     * Mirrors firestore.rules: users collection access control
     */
    it('should enforce user management restricted to Administrators', () => {
      // Arrange: Different role users
      const users: Array<{ role: UserRole; shouldAccess: boolean }> = [
        { role: 'Administrator', shouldAccess: true },
        { role: 'Manager', shouldAccess: false },
        { role: 'Analyst', shouldAccess: false },
        { role: 'Clerk', shouldAccess: false },
        { role: 'Sales_Associate', shouldAccess: false },
      ];

      // Act & Assert: Validate manage_users permission matches Firestore rules
      for (const { role, shouldAccess } of users) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'manage_users');
        expect(hasPermission).toBe(shouldAccess);
      }
    });

    /**
     * Test supplier management permissions
     * Mirrors firestore.rules: suppliers collection access control
     */
    it('should enforce supplier management for Administrator and Manager only', () => {
      // Arrange: Different role users
      const users: Array<{ role: UserRole; shouldAccess: boolean }> = [
        { role: 'Administrator', shouldAccess: true },
        { role: 'Manager', shouldAccess: true },
        { role: 'Analyst', shouldAccess: false },
        { role: 'Clerk', shouldAccess: false },
        { role: 'Sales_Associate', shouldAccess: false },
      ];

      // Act & Assert: Validate manage_suppliers permission matches Firestore rules
      for (const { role, shouldAccess } of users) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'manage_suppliers');
        expect(hasPermission).toBe(shouldAccess);
      }
    });

    /**
     * Test pricelist upload permissions
     * Mirrors firestore.rules: pricelists and pricelist_items collections
     */
    it('should enforce pricelist operations for authorized roles', () => {
      // Arrange: Different role users
      const users: Array<{ role: UserRole; shouldAccess: boolean }> = [
        { role: 'Administrator', shouldAccess: true },
        { role: 'Manager', shouldAccess: true },
        { role: 'Analyst', shouldAccess: true },
        { role: 'Clerk', shouldAccess: true },
        { role: 'Sales_Associate', shouldAccess: false },
      ];

      // Act & Assert: Validate upload_pricelists permission matches Firestore rules
      for (const { role, shouldAccess } of users) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'upload_pricelists');
        expect(hasPermission).toBe(shouldAccess);
      }
    });

    /**
     * Test inventory adjustment permissions
     * Mirrors firestore.rules: inventory collection access control
     */
    it('should enforce inventory operations for Administrator, Manager, and Clerk', () => {
      // Arrange: Different role users
      const users: Array<{ role: UserRole; shouldAccess: boolean }> = [
        { role: 'Administrator', shouldAccess: true },
        { role: 'Manager', shouldAccess: true },
        { role: 'Analyst', shouldAccess: false },
        { role: 'Clerk', shouldAccess: true },
        { role: 'Sales_Associate', shouldAccess: false },
      ];

      // Act & Assert: Validate adjust_inventory permission matches Firestore rules
      for (const { role, shouldAccess } of users) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'adjust_inventory');
        expect(hasPermission).toBe(shouldAccess);
      }
    });

    /**
     * Test POS sales processing permissions
     * Mirrors firestore.rules: pos_transactions collection access control
     */
    it('should enforce sales processing for Administrator, Manager, and Sales_Associate', () => {
      // Arrange: Different role users
      const users: Array<{ role: UserRole; shouldAccess: boolean }> = [
        { role: 'Administrator', shouldAccess: true },
        { role: 'Manager', shouldAccess: true },
        { role: 'Analyst', shouldAccess: false },
        { role: 'Clerk', shouldAccess: false },
        { role: 'Sales_Associate', shouldAccess: true },
      ];

      // Act & Assert: Validate process_sales permission matches Firestore rules
      for (const { role, shouldAccess } of users) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        const hasPermission = authService.checkPermission(user, 'process_sales');
        expect(hasPermission).toBe(shouldAccess);
      }
    });

    /**
     * Test that all active users can read data
     * Mirrors firestore.rules: isActiveUser() requirement for read operations
     */
    it('should allow all active authenticated users to read data', async () => {
      // Arrange: Active users of different roles
      const roles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];

      for (const role of roles) {
        const userData = {
          userId: testUserId,
          email: testEmail,
          displayName: `${role} User`,
          role,
          isActive: true,
          createdAt: { toDate: () => new Date() },
          lastLoginAt: { toDate: () => new Date() },
          failedLoginAttempts: 0,
        };

        mockAuthInstance.getAuth.mockReturnValue({
          currentUser: mockFirebaseUser,
        });

        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => userData,
        });

        // Act: Get current user (simulates read access check)
        const currentUser = await authService.getCurrentUser();

        // Assert: All active users should be able to read (Firestore rules requirement)
        expect(currentUser).not.toBeNull();
        expect(currentUser?.isActive).toBe(true);
        expect(currentUser?.role).toBe(role);
      }
    });

    /**
     * Test that unauthenticated users cannot access any data
     * Mirrors firestore.rules: isAuthenticated() requirement
     */
    it('should deny all data access to unauthenticated users', async () => {
      // Arrange: No authenticated user
      mockAuthInstance.getAuth.mockReturnValue({
        currentUser: null,
      });

      // Act: Attempt to access data
      const currentUser = await authService.getCurrentUser();

      // Assert: Access denied (mirrors Firestore rules behavior for unauthenticated access)
      expect(currentUser).toBeNull();
    });
  });

  /**
   * Test Suite 6: Cross-Role Permission Validation
   * Validates that permission boundaries are strictly enforced
   */
  describe('Cross-Role Permission Validation', () => {
    /**
     * Test that no role has permissions it shouldn't have
     */
    it('should prevent privilege escalation across role boundaries', () => {
      // Arrange: Test scenarios where users might attempt unauthorized actions
      const testCases: Array<{
        role: UserRole;
        unauthorizedPermissions: Permission[];
      }> = [
        {
          role: 'Sales_Associate',
          unauthorizedPermissions: [
            'manage_users',
            'manage_suppliers',
            'upload_pricelists',
            'approve_matches',
            'adjust_inventory',
            'generate_reports',
          ],
        },
        {
          role: 'Clerk',
          unauthorizedPermissions: [
            'manage_users',
            'manage_suppliers',
            'approve_matches',
            'process_sales',
            'generate_reports',
          ],
        },
        {
          role: 'Analyst',
          unauthorizedPermissions: [
            'manage_users',
            'manage_suppliers',
            'adjust_inventory',
            'process_sales',
          ],
        },
        {
          role: 'Manager',
          unauthorizedPermissions: ['manage_users'],
        },
      ];

      // Act & Assert: Verify each role cannot access unauthorized permissions
      for (const testCase of testCases) {
        const user: User = {
          userId: testUserId,
          email: testEmail,
          displayName: `${testCase.role} User`,
          role: testCase.role,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        };

        for (const permission of testCase.unauthorizedPermissions) {
          const hasPermission = authService.checkPermission(user, permission);
          expect(hasPermission).toBe(false);
        }
      }
    });

    /**
     * Test permission isolation - one role's permissions don't leak to another
     */
    it('should maintain strict permission isolation between roles', () => {
      // Arrange: Create users with different roles
      const adminUser: User = {
        userId: 'admin-123',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'Administrator',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      const salesUser: User = {
        userId: 'sales-456',
        email: 'sales@example.com',
        displayName: 'Sales User',
        role: 'Sales_Associate',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      };

      // Act: Check permissions for both users
      const adminCanManageUsers = authService.checkPermission(adminUser, 'manage_users');
      const salesCanManageUsers = authService.checkPermission(salesUser, 'manage_users');
      const salesCanProcessSales = authService.checkPermission(salesUser, 'process_sales');
      const adminCanProcessSales = authService.checkPermission(adminUser, 'process_sales');

      // Assert: Permissions are isolated correctly
      expect(adminCanManageUsers).toBe(true);
      expect(salesCanManageUsers).toBe(false);
      expect(salesCanProcessSales).toBe(true);
      expect(adminCanProcessSales).toBe(true); // Admin has all permissions
    });
  });
});
