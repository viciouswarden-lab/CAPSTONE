/**
 * Integration Tests for Authentication Flow (Task 42.1)
 * 
 * Tests complete login → access protected resource → logout flow
 * Tests session expiration and redirect
 * Tests account lockout after failed attempts
 * 
 * **Validates: Requirements 1.1, 1.2, 1.5, 1.7, 19.6**
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { FirebaseAuthService } from './AuthService';
import type { User, UserSession } from '../../types/models';
import type { UserRole } from '../../types/firestore';

// Mock Firebase Auth module
vi.mock('firebase/auth', () => {
  return {
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    getAuth: vi.fn(),
  };
});

// Mock Firebase Firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
    Timestamp: {
      fromDate: (date: Date) => ({
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      }),
    },
  };
});

import * as firebaseAuth from 'firebase/auth';
import * as firestore from 'firebase/firestore';

// Get mocked functions
const mockSignInWithEmailAndPassword = firebaseAuth.signInWithEmailAndPassword as Mock;
const mockSignOut = firebaseAuth.signOut as Mock;
const mockGetAuth = firebaseAuth.getAuth as Mock;
const mockGetDoc = firestore.getDoc as Mock;
const mockGetDocs = firestore.getDocs as Mock;
const mockUpdateDoc = firestore.updateDoc as Mock;
const mockDoc = firestore.doc as Mock;
const mockCollection = firestore.collection as Mock;
const mockQuery = firestore.query as Mock;
const mockWhere = firestore.where as Mock;
const mockServerTimestamp = firestore.serverTimestamp as Mock;

describe('AuthService Integration Tests - Task 42.1', () => {
  let authService: FirebaseAuthService;
  let mockAuthInstance: any;
  let mockFirestoreInstance: any;

  // Test data
  const validEmail = 'test@example.com';
  const validPassword = 'password123';
  const validUserId = 'user123';
  const invalidPassword = 'wrongpassword';
  const testIpAddress = '192.168.1.100';
  const testUserAgent = 'Mozilla/5.0 (Test Browser)';

  const mockUserData = {
    userId: validUserId,
    email: validEmail,
    displayName: 'Test User',
    role: 'Manager' as UserRole,
    isActive: true,
    createdAt: { toDate: () => new Date('2024-01-01') },
    lastLoginAt: { toDate: () => new Date('2024-01-10') },
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  const mockFirebaseUser = {
    uid: validUserId,
    email: validEmail,
    getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
    getIdTokenResult: vi.fn().mockResolvedValue({
      expirationTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Auth instance
    mockAuthInstance = {
      getAuth: mockGetAuth,
      signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
      signOut: mockSignOut,
      currentUser: null,
    };

    // Setup mock Firestore instance
    mockFirestoreInstance = {
      getFirestore: vi.fn(),
      doc: mockDoc,
      getDoc: mockGetDoc,
      collection: mockCollection,
      query: mockQuery,
      where: mockWhere,
      getDocs: mockGetDocs,
      updateDoc: mockUpdateDoc,
      serverTimestamp: mockServerTimestamp,
      Timestamp: firestore.Timestamp,
    };

    // Default mock implementations
    mockGetAuth.mockReturnValue(mockAuthInstance);
    mockDoc.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});
    
    authService = new FirebaseAuthService(mockAuthInstance, mockFirestoreInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Complete Authentication Flow
   * Login → Access Protected Resource → Logout
   * 
   * **Validates: Requirements 1.1, 1.2, 1.5**
   */
  describe('Complete Authentication Flow', () => {
    it('should complete full authentication lifecycle: login → access protected resource → logout', async () => {
      // Phase 1: Login with valid credentials
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Execute login
      const session: UserSession = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Session created successfully (Requirement 1.1)
      expect(session).toBeDefined();
      expect(session.userId).toBe(validUserId);
      expect(session.email).toBe(validEmail);
      expect(session.role).toBe('Manager');
      expect(session.token).toBe('mock-token-123');
      expect(session.expiresAt).toBeInstanceOf(Date);

      // Verify failed login attempts were reset
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );

      // Phase 2: Access protected resource (verify session validity)
      mockAuthInstance.currentUser = mockFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      const currentUser: User | null = await authService.getCurrentUser();

      // Assert: Protected resource access granted (Requirement 1.6)
      expect(currentUser).toBeDefined();
      expect(currentUser?.userId).toBe(validUserId);
      expect(currentUser?.email).toBe(validEmail);
      expect(currentUser?.role).toBe('Manager');
      expect(currentUser?.isActive).toBe(true);

      // Phase 3: Logout and terminate session
      mockSignOut.mockResolvedValue(undefined);

      await authService.logout(testIpAddress);

      // Assert: Session terminated (Requirement 1.5)
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should reject login with invalid credentials and not create session', async () => {
      // Arrange: Simulate Firebase auth error for invalid credentials
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Invalid password',
      });

      // Mock user lookup for failed attempt tracking
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => ({
              ...mockUserData,
              failedLoginAttempts: 2,
            }),
          },
        ],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act & Assert: Login should fail (Requirement 1.2)
      await expect(
        authService.login(validEmail, invalidPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('Invalid email or password');

      // Verify failed login attempt was tracked
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 3,
        })
      );
    });

    it('should deny access to protected resource without authentication', async () => {
      // Arrange: No authenticated user
      mockAuthInstance.currentUser = null;

      // Act
      const currentUser = await authService.getCurrentUser();

      // Assert: No user returned (Requirement 1.3)
      expect(currentUser).toBeNull();
    });
  });

  /**
   * Test 2: Session Expiration and Redirect
   * 
   * **Validates: Requirement 1.7**
   */
  describe('Session Expiration and Redirect', () => {
    it('should detect expired session and require re-authentication', async () => {
      // Arrange: User with expired token
      const expiredFirebaseUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        }),
      };

      mockAuthInstance.currentUser = expiredFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act: Attempt to access protected resource with expired session
      const currentUser = await authService.getCurrentUser();

      // Assert: Session expired, user signed out, null returned (Requirement 1.7)
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should allow access with valid non-expired session', async () => {
      // Arrange: User with valid token
      const validFirebaseUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() + 3600000).toISOString(), // Expires in 1 hour
        }),
      };

      mockAuthInstance.currentUser = validFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      // Act
      const currentUser = await authService.getCurrentUser();

      // Assert: Access granted (Requirement 1.6)
      expect(currentUser).not.toBeNull();
      expect(currentUser?.userId).toBe(validUserId);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should successfully refresh token when valid user exists', async () => {
      // Arrange
      const refreshableFirebaseUser = {
        ...mockFirebaseUser,
        getIdToken: vi.fn().mockResolvedValue('new-refreshed-token-456'),
      };

      mockAuthInstance.currentUser = refreshableFirebaseUser;

      // Act
      const newToken = await authService.refreshToken(testIpAddress);

      // Assert: Token refreshed successfully
      expect(newToken).toBe('new-refreshed-token-456');
      expect(refreshableFirebaseUser.getIdToken).toHaveBeenCalledWith(true); // Force refresh
    });

    it('should return null when token refresh fails (requires re-authentication)', async () => {
      // Arrange: User exists but token refresh fails
      const failedRefreshUser = {
        ...mockFirebaseUser,
        getIdToken: vi.fn().mockRejectedValue(new Error('Token refresh failed')),
      };

      mockAuthInstance.currentUser = failedRefreshUser;

      // Act
      const newToken = await authService.refreshToken(testIpAddress);

      // Assert: Null returned, user needs to re-authenticate (Requirement 1.7)
      expect(newToken).toBeNull();
    });

    it('should return null when no user is authenticated', async () => {
      // Arrange: No current user
      mockAuthInstance.currentUser = null;

      // Act
      const newToken = await authService.refreshToken(testIpAddress);

      // Assert: Null returned
      expect(newToken).toBeNull();
    });
  });

  /**
   * Test 3: Account Lockout After Failed Attempts
   * 
   * **Validates: Requirement 19.6**
   */
  describe('Account Lockout After Failed Attempts', () => {
    it('should lock account after 5 failed login attempts within 15 minutes', async () => {
      // Arrange: User with 4 previous failed attempts
      const userWith4FailedAttempts = {
        ...mockUserData,
        failedLoginAttempts: 4,
        lockedUntil: null,
      };

      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Invalid password',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => userWith4FailedAttempts,
          },
        ],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: 5th failed attempt
      await expect(
        authService.login(validEmail, invalidPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('Invalid email or password');

      // Assert: Account should be locked for 30 minutes (Requirement 19.6)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Object),
        })
      );

      // Verify lock duration is approximately 30 minutes
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      const lockedUntilDate = updateCall.lockedUntil.toDate();
      const lockDuration = lockedUntilDate.getTime() - Date.now();
      const expectedDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
      const tolerance = 5000; // 5 seconds tolerance

      expect(lockDuration).toBeGreaterThan(expectedDuration - tolerance);
      expect(lockDuration).toBeLessThan(expectedDuration + tolerance);
    });

    it('should prevent login when account is currently locked', async () => {
      // Arrange: User with locked account (locked until 10 minutes from now)
      const lockedUntilTime = new Date(Date.now() + 10 * 60 * 1000);
      const lockedUserData = {
        ...mockUserData,
        failedLoginAttempts: 5,
        lockedUntil: {
          toDate: () => lockedUntilTime,
        },
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

      // Act & Assert: Login should be blocked with lockout message (Requirement 19.6)
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow(/Account is locked due to multiple failed login attempts/);

      // Verify the error message includes remaining time
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow(/Please try again in \d+ minute\(s\)/);

      // Firebase auth should not be called when account is locked
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should allow login after lockout period expires', async () => {
      // Arrange: User with expired lock (locked until 1 second ago)
      const expiredLockTime = new Date(Date.now() - 1000);
      const userWithExpiredLock = {
        ...mockUserData,
        failedLoginAttempts: 5,
        lockedUntil: {
          toDate: () => expiredLockTime,
        },
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => userWithExpiredLock,
          },
        ],
      });

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => userWithExpiredLock,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Attempt login with valid credentials after lockout expired
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Login succeeds, failed attempts reset (Requirement 19.6)
      expect(session).toBeDefined();
      expect(session.userId).toBe(validUserId);

      // Verify failed attempts and lock were cleared
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
    });

    it('should increment failed attempts on each failed login', async () => {
      // Test progression: 0 → 1 → 2 → 3 → 4 → 5 (locked)
      const testCases = [
        { current: 0, expected: 1 },
        { current: 1, expected: 2 },
        { current: 2, expected: 3 },
        { current: 3, expected: 4 },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const userData = {
          ...mockUserData,
          failedLoginAttempts: testCase.current,
          lockedUntil: null,
        };

        mockSignInWithEmailAndPassword.mockRejectedValue({
          code: 'auth/wrong-password',
          message: 'Invalid password',
        });

        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [
            {
              ref: {},
              data: () => userData,
            },
          ],
        });

        mockUpdateDoc.mockResolvedValue(undefined);

        // Act
        await expect(
          authService.login(validEmail, invalidPassword, testIpAddress, testUserAgent)
        ).rejects.toThrow();

        // Assert: Failed attempts incremented
        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            failedLoginAttempts: testCase.expected,
          })
        );
      }
    });

    it('should reset failed login attempts to zero on successful login', async () => {
      // Arrange: User with 3 failed attempts
      const userWith3FailedAttempts = {
        ...mockUserData,
        failedLoginAttempts: 3,
        lockedUntil: null,
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => userWith3FailedAttempts,
          },
        ],
      });

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => userWith3FailedAttempts,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Successful login
      await authService.login(validEmail, validPassword, testIpAddress, testUserAgent);

      // Assert: Failed attempts reset to 0 (Requirement 19.6)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
    });
  });

  /**
   * Test 4: Role-Based Access Control Integration
   * 
   * **Validates: Requirement 1.4**
   */
  describe('Role-Based Access Control', () => {
    it('should grant access to protected resource based on user permissions', async () => {
      // Arrange: Manager user with specific permissions
      mockAuthInstance.currentUser = mockFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData, // Manager role
      });

      // Act: Get current user
      const currentUser = await authService.getCurrentUser();

      // Assert: User retrieved successfully
      expect(currentUser).not.toBeNull();
      expect(currentUser?.role).toBe('Manager');

      // Verify permission check
      const hasUploadPermission = authService.checkPermission(
        currentUser!,
        'upload_pricelists'
      );
      const hasManageUsersPermission = authService.checkPermission(
        currentUser!,
        'manage_users'
      );

      // Manager has upload_pricelists but not manage_users (Requirement 1.4)
      expect(hasUploadPermission).toBe(true);
      expect(hasManageUsersPermission).toBe(false);
    });

    it('should deny access when user account is inactive', async () => {
      // Arrange: Inactive user
      const inactiveUserData = {
        ...mockUserData,
        isActive: false,
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => inactiveUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act & Assert: Login should fail for inactive user
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('User account is inactive');

      // User should be signed out
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should revoke access when user becomes inactive during session', async () => {
      // Arrange: User becomes inactive while session is active
      const inactiveUserData = {
        ...mockUserData,
        isActive: false,
      };

      mockAuthInstance.currentUser = mockFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => inactiveUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act: Attempt to access protected resource
      const currentUser = await authService.getCurrentUser();

      // Assert: Access denied, user signed out
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should verify different role permissions correctly', async () => {
      // Test permissions for different roles
      const testRoles: Array<{
        role: UserRole;
        shouldHave: string[];
        shouldNotHave: string[];
      }> = [
        {
          role: 'Administrator',
          shouldHave: ['manage_users', 'manage_suppliers', 'process_sales'],
          shouldNotHave: [],
        },
        {
          role: 'Sales_Associate',
          shouldHave: ['process_sales'],
          shouldNotHave: ['manage_users', 'manage_suppliers', 'upload_pricelists'],
        },
        {
          role: 'Clerk',
          shouldHave: ['upload_pricelists', 'adjust_inventory'],
          shouldNotHave: ['manage_users', 'process_sales'],
        },
      ];

      for (const testRole of testRoles) {
        const testUser: User = {
          ...mockUserData,
          role: testRole.role,
        } as User;

        // Check permissions user should have
        for (const permission of testRole.shouldHave) {
          const hasPermission = authService.checkPermission(
            testUser,
            permission as any
          );
          expect(hasPermission).toBe(true);
        }

        // Check permissions user should not have
        for (const permission of testRole.shouldNotHave) {
          const hasPermission = authService.checkPermission(
            testUser,
            permission as any
          );
          expect(hasPermission).toBe(false);
        }
      }
    });
  });

  /**
   * Test 5: Edge Cases and Error Handling
   */
  describe('Edge Cases and Error Handling', () => {
    it('should handle Firebase auth service errors gracefully', async () => {
      // Arrange: Firebase returns unexpected error
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => mockUserData,
          },
        ],
      });

      // Act & Assert: Error should be logged and propagated
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow();
    });

    it('should handle missing user document in Firestore', async () => {
      // Arrange: User authenticated but no Firestore document
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      // Act & Assert: Login should fail
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('User document not found in database');
    });

    it('should handle too many requests error from Firebase', async () => {
      // Arrange: Firebase rate limiting
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/too-many-requests',
        message: 'Too many requests',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => mockUserData,
          },
        ],
      });

      // Act & Assert: Appropriate error message
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('Too many failed login attempts. Please try again later.');
    });

    it('should handle user-not-found scenario securely', async () => {
      // Arrange: User does not exist
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'User not found',
      });

      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      // Act & Assert: Generic error message (don't reveal user existence)
      await expect(
        authService.login('nonexistent@example.com', validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should handle logout when no user is authenticated', async () => {
      // Arrange: No current user
      mockAuthInstance.currentUser = null;
      mockSignOut.mockResolvedValue(undefined);

      // Act: Logout should complete without error
      await expect(authService.logout(testIpAddress)).resolves.not.toThrow();
    });

    it('should handle getCurrentUser when Firebase user exists but Firestore document is missing', async () => {
      // Arrange
      mockAuthInstance.currentUser = mockFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      // Act
      const currentUser = await authService.getCurrentUser();

      // Assert: Should return null (invalid state)
      expect(currentUser).toBeNull();
    });
  });

  /**
   * Test 6: Complete Multi-Step Scenarios
   */
  describe('Complete Multi-Step Scenarios', () => {
    it('should handle scenario: failed attempts → lockout → wait → successful login', async () => {
      // Step 1: 5 failed login attempts leading to lockout
      for (let i = 1; i <= 5; i++) {
        vi.clearAllMocks();

        const userData = {
          ...mockUserData,
          failedLoginAttempts: i - 1,
          lockedUntil: null,
        };

        mockSignInWithEmailAndPassword.mockRejectedValue({
          code: 'auth/wrong-password',
          message: 'Invalid password',
        });

        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [
            {
              ref: {},
              data: () => userData,
            },
          ],
        });

        mockUpdateDoc.mockResolvedValue(undefined);

        await expect(
          authService.login(validEmail, invalidPassword, testIpAddress, testUserAgent)
        ).rejects.toThrow('Invalid email or password');

        if (i === 5) {
          // Verify account is locked after 5th attempt
          expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              failedLoginAttempts: 5,
              lockedUntil: expect.any(Object),
            })
          );
        }
      }

      // Step 2: Attempt login while locked (should fail)
      vi.clearAllMocks();

      const lockedUserData = {
        ...mockUserData,
        failedLoginAttempts: 5,
        lockedUntil: {
          toDate: () => new Date(Date.now() + 15 * 60 * 1000), // Still locked
        },
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

      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow(/Account is locked/);

      // Step 3: Wait for lock to expire, then login successfully
      vi.clearAllMocks();

      const expiredLockUserData = {
        ...mockUserData,
        failedLoginAttempts: 5,
        lockedUntil: {
          toDate: () => new Date(Date.now() - 1000), // Lock expired
        },
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: {},
            data: () => expiredLockUserData,
          },
        ],
      });

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => expiredLockUserData,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Login after lock expires
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Login successful, attempts reset
      expect(session).toBeDefined();
      expect(session.userId).toBe(validUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
    });

    it('should handle scenario: successful login → access resource → session expires → re-authenticate', async () => {
      // Phase 1: Initial successful login
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      const initialSession = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      expect(initialSession).toBeDefined();

      // Phase 2: Access protected resource with valid session
      vi.clearAllMocks();

      const validUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
        }),
      };

      mockAuthInstance.currentUser = validUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      let currentUser = await authService.getCurrentUser();
      expect(currentUser).not.toBeNull();

      // Phase 3: Session expires
      vi.clearAllMocks();

      const expiredUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() - 1000).toISOString(), // Expired
        }),
      };

      mockAuthInstance.currentUser = expiredUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      currentUser = await authService.getCurrentUser();
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();

      // Phase 4: Re-authenticate required
      vi.clearAllMocks();

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      const newSession = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      expect(newSession).toBeDefined();
      expect(newSession.userId).toBe(validUserId);
    });
  });
});
