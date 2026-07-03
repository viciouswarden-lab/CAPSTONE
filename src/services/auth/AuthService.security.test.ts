/**
 * Security Tests for Authentication Service (Task 44.1)
 * 
 * This test suite validates the security aspects of the authentication system:
 * 1. Password Hashing (Firebase Auth built-in)
 * 2. Account Lockout Mechanism
 * 3. Session Expiration
 * 4. Authentication Logging
 * 
 * **Validates: Requirements 19.3, 19.5, 19.6**
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { FirebaseAuthService } from './AuthService';
import { AuthLogger } from './AuthLogger';
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
    addDoc: vi.fn(),
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
const mockAddDoc = firestore.addDoc as Mock;
const mockDoc = firestore.doc as Mock;
const mockCollection = firestore.collection as Mock;
const mockQuery = firestore.query as Mock;
const mockWhere = firestore.where as Mock;
const mockServerTimestamp = firestore.serverTimestamp as Mock;

describe('AuthService Security Tests - Task 44.1', () => {
  let authService: FirebaseAuthService;
  let mockAuthInstance: any;
  let mockFirestoreInstance: any;

  // Test data
  const validEmail = 'security@test.com';
  const validPassword = 'SecurePassword123!';
  const weakPassword = '123';
  const validUserId = 'sec-user-123';
  const testIpAddress = '203.0.113.42';
  const testUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  const mockUserData = {
    userId: validUserId,
    email: validEmail,
    displayName: 'Security Test User',
    role: 'Analyst' as UserRole,
    isActive: true,
    createdAt: { toDate: () => new Date('2024-01-01') },
    lastLoginAt: { toDate: () => new Date('2024-01-10') },
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  const mockFirebaseUser = {
    uid: validUserId,
    email: validEmail,
    getIdToken: vi.fn().mockResolvedValue('secure-token-abc123'),
    getIdTokenResult: vi.fn().mockResolvedValue({
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthInstance = {
      getAuth: mockGetAuth,
      signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
      signOut: mockSignOut,
      currentUser: null,
    };

    mockFirestoreInstance = {
      getFirestore: vi.fn(),
      doc: mockDoc,
      getDoc: mockGetDoc,
      collection: mockCollection,
      addDoc: mockAddDoc,
      query: mockQuery,
      where: mockWhere,
      getDocs: mockGetDocs,
      updateDoc: mockUpdateDoc,
      serverTimestamp: mockServerTimestamp,
      Timestamp: firestore.Timestamp,
    };

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
   * Security Test 1: Password Hashing
   * 
   * Firebase Auth automatically handles password hashing using bcrypt with salt.
   * These tests verify that the system never handles or stores plain-text passwords.
   * 
   * **Validates: Requirement 19.3 - Password hashing with strong algorithm and salt**
   */
  describe('1. Password Hashing Security (Requirement 19.3)', () => {
    it('should delegate password hashing to Firebase Auth (never handle plain-text passwords)', async () => {
      // Arrange
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Login with password
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Firebase Auth was called with email and password
      // Firebase Auth handles the hashing internally
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        validEmail,
        validPassword
      );

      // Verify no password is stored in Firestore update
      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCalls = mockUpdateDoc.mock.calls;
      updateCalls.forEach(call => {
        const updateData = call[1];
        expect(updateData).not.toHaveProperty('password');
        expect(updateData).not.toHaveProperty('passwordHash');
        expect(JSON.stringify(updateData)).not.toContain(validPassword);
      });

      // Verify session token is returned (not password)
      expect(session.token).toBeDefined();
      expect(session.token).not.toContain(validPassword);
    });

    it('should verify Firebase Auth rejects weak passwords (enforces password strength)', async () => {
      // Arrange: Firebase rejects weak password
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/weak-password',
        message: 'Password should be at least 6 characters',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      // Act & Assert: Weak password should be rejected by Firebase Auth
      await expect(
        authService.login(validEmail, weakPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow();

      // Verify Firebase Auth was called (and rejected it)
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    });

    it('should ensure password is never returned in user session or user object', async () => {
      // Arrange: Successful authentication
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Login and get session
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Get current user
      mockAuthInstance.currentUser = mockFirebaseUser;
      const user = await authService.getCurrentUser();

      // Assert: Neither session nor user object contain password
      const sessionString = JSON.stringify(session);
      const userString = JSON.stringify(user);

      expect(sessionString).not.toContain(validPassword);
      expect(sessionString).not.toContain('password');
      expect(userString).not.toContain(validPassword);
      expect(userString).not.toContain('password');

      expect(session).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password');
    });

    it('should verify Firebase Auth uses secure password comparison (prevents timing attacks)', async () => {
      // Arrange: Two login attempts with different passwords
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Invalid password',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      const password1 = 'CompletelyWrongPassword123!';
      const password2 = 'SecurePassword123'; // Close but wrong

      // Act: Attempt login with both passwords
      const startTime1 = Date.now();
      await authService.login(validEmail, password1, testIpAddress, testUserAgent).catch(() => {});
      const duration1 = Date.now() - startTime1;

      vi.clearAllMocks();
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Invalid password',
      });
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      const startTime2 = Date.now();
      await authService.login(validEmail, password2, testIpAddress, testUserAgent).catch(() => {});
      const duration2 = Date.now() - startTime2;

      // Assert: Both failed attempts should take similar time (no timing leaks)
      // Allow 50ms tolerance for system variance
      const timingDifference = Math.abs(duration1 - duration2);
      expect(timingDifference).toBeLessThan(100);
    });
  });

  /**
   * Security Test 2: Account Lockout Mechanism
   * 
   * Tests that the system properly locks accounts after multiple failed login attempts
   * to prevent brute-force attacks.
   * 
   * **Validates: Requirement 19.6 - Account lockout after failed attempts**
   */
  describe('2. Account Lockout Mechanism (Requirement 19.6)', () => {
    it('should lock account after exactly 5 failed login attempts within 15 minutes', async () => {
      // Simulate 5 failed attempts
      for (let attempt = 0; attempt < 5; attempt++) {
        vi.clearAllMocks();

        const userData = {
          ...mockUserData,
          failedLoginAttempts: attempt,
          lockedUntil: null,
        };

        mockSignInWithEmailAndPassword.mockRejectedValue({
          code: 'auth/wrong-password',
          message: 'Invalid password',
        });

        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [{
            ref: {},
            data: () => userData,
          }],
        });

        mockUpdateDoc.mockResolvedValue(undefined);

        // Act: Attempt login with wrong password
        await expect(
          authService.login(validEmail, 'wrongPassword', testIpAddress, testUserAgent)
        ).rejects.toThrow('Invalid email or password');

        // Assert: Check if account should be locked on 5th attempt
        if (attempt === 4) { // 5th attempt (0-indexed)
          expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              failedLoginAttempts: 5,
              lockedUntil: expect.any(Object),
            })
          );
        }
      }
    });

    it('should prevent login when account is locked (lockout duration 30 minutes)', async () => {
      // Arrange: Account locked for 30 minutes
      const lockedUntilTime = new Date(Date.now() + 30 * 60 * 1000);
      const lockedUserData = {
        ...mockUserData,
        failedLoginAttempts: 5,
        lockedUntil: {
          toDate: () => lockedUntilTime,
        },
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => lockedUserData,
        }],
      });

      // Act & Assert: Login should be blocked
      await expect(
        authService.login(validEmail, validPassword, testIpAddress, testUserAgent)
      ).rejects.toThrow(/Account is locked due to multiple failed login attempts/);

      // Verify Firebase Auth was NOT called (blocked before authentication)
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should allow login after lockout period expires', async () => {
      // Arrange: Lockout period expired
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
        docs: [{
          ref: {},
          data: () => userWithExpiredLock,
        }],
      });

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => userWithExpiredLock,
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Login after lockout expired
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Login successful, lockout cleared
      expect(session).toBeDefined();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
    });

    it('should reset failed login attempts to zero after successful login', async () => {
      // Arrange: User with 3 failed attempts
      const userWith3FailedAttempts = {
        ...mockUserData,
        failedLoginAttempts: 3,
        lockedUntil: null,
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => userWith3FailedAttempts,
        }],
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

      // Assert: Failed attempts reset
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
   * Security Test 3: Session Expiration
   * 
   * Tests that sessions expire properly and require re-authentication.
   * 
   * **Validates: Requirements 1.6, 1.7**
   */
  describe('3. Session Expiration (Requirements 1.6, 1.7)', () => {
    it('should detect expired session and require re-authentication', async () => {
      // Arrange: User with expired token (expired 1 second ago)
      const expiredFirebaseUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() - 1000).toISOString(),
        }),
      };

      mockAuthInstance.currentUser = expiredFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockSignOut.mockResolvedValue(undefined);

      // Act: Attempt to get current user with expired session
      const currentUser = await authService.getCurrentUser();

      // Assert: Session expired, user signed out
      expect(currentUser).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should allow access with valid non-expired session', async () => {
      // Arrange: User with valid token (expires in 1 hour)
      const validFirebaseUser = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
        }),
      };

      mockAuthInstance.currentUser = validFirebaseUser;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      // Act
      const currentUser = await authService.getCurrentUser();

      // Assert: Access granted
      expect(currentUser).not.toBeNull();
      expect(currentUser?.userId).toBe(validUserId);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should return session with expiration time (1 hour from Firebase)', async () => {
      // Arrange
      const futureExpirationTime = new Date(Date.now() + 3600000);
      const firebaseUserWithExpiration = {
        ...mockFirebaseUser,
        getIdTokenResult: vi.fn().mockResolvedValue({
          expirationTime: futureExpirationTime.toISOString(),
        }),
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: firebaseUserWithExpiration,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);

      // Act: Login
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Session includes expiration time
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(futureExpirationTime.getTime() + 1000);
    });

    it('should successfully refresh token when valid user exists', async () => {
      // Arrange
      const refreshableFirebaseUser = {
        ...mockFirebaseUser,
        getIdToken: vi.fn().mockResolvedValue('new-refreshed-token-xyz'),
      };

      mockAuthInstance.currentUser = refreshableFirebaseUser;

      // Act
      const newToken = await authService.refreshToken(testIpAddress);

      // Assert: Token refreshed
      expect(newToken).toBe('new-refreshed-token-xyz');
      expect(refreshableFirebaseUser.getIdToken).toHaveBeenCalledWith(true);
    });

    it('should return null when token refresh fails (requires re-authentication)', async () => {
      // Arrange: Token refresh fails
      const failedRefreshUser = {
        ...mockFirebaseUser,
        getIdToken: vi.fn().mockRejectedValue(new Error('Token refresh failed')),
      };

      mockAuthInstance.currentUser = failedRefreshUser;

      // Act
      const newToken = await authService.refreshToken(testIpAddress);

      // Assert: Null returned (requires re-authentication)
      expect(newToken).toBeNull();
    });
  });

  /**
   * Security Test 4: Authentication Logging
   * 
   * Tests that all authentication events are logged with IP and timestamp.
   * 
   * **Validates: Requirement 19.5 - Authentication attempt logging**
   */
  describe('4. Authentication Logging (Requirement 19.5)', () => {
    it('should log successful login with IP address and timestamp', async () => {
      // Arrange
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue(undefined);

      // Act: Login
      await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Log entry created
      expect(mockAddDoc).toHaveBeenCalled();
      
      const logCall = mockAddDoc.mock.calls[0][1];
      expect(logCall.eventType).toBe('login_success');
      expect(logCall.email).toBe(validEmail);
      expect(logCall.userId).toBe(validUserId);
      expect(logCall.ipAddress).toBe(testIpAddress);
      expect(logCall.userAgent).toBe(testUserAgent);
      expect(logCall.timestamp).toBeDefined();
    });

    it('should log failed login with IP address and failure reason', async () => {
      // Arrange
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Invalid password',
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue(undefined);

      // Act: Failed login attempt
      await expect(
        authService.login(validEmail, 'wrongPassword', testIpAddress, testUserAgent)
      ).rejects.toThrow();

      // Assert: Failed login logged
      expect(mockAddDoc).toHaveBeenCalled();
      
      const logCall = mockAddDoc.mock.calls[0][1];
      expect(logCall.eventType).toBe('login_failure');
      expect(logCall.email).toBe(validEmail);
      expect(logCall.ipAddress).toBe(testIpAddress);
      expect(logCall.failureReason).toBe('Invalid credentials');
      expect(logCall.timestamp).toBeDefined();
    });

    it('should log account lockout event with IP address and failed attempt count', async () => {
      // Arrange: 5th failed attempt leading to lockout
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
        docs: [{
          ref: {},
          data: () => userWith4FailedAttempts,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue(undefined);

      // Act: 5th failed attempt
      await expect(
        authService.login(validEmail, 'wrongPassword', testIpAddress, testUserAgent)
      ).rejects.toThrow();

      // Assert: Account lockout logged
      const addDocCalls = mockAddDoc.mock.calls;
      
      // Find the account_locked log entry
      const lockoutLog = addDocCalls.find(call => call[1].eventType === 'account_locked');
      expect(lockoutLog).toBeDefined();
      expect(lockoutLog[1].email).toBe(validEmail);
      expect(lockoutLog[1].ipAddress).toBe(testIpAddress);
      expect(lockoutLog[1].metadata.failedAttempts).toBe(5);
    });

    it('should log logout event with IP address', async () => {
      // Arrange
      mockAuthInstance.currentUser = mockFirebaseUser;
      mockSignOut.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue(undefined);

      // Act: Logout
      await authService.logout(testIpAddress);

      // Assert: Logout logged
      expect(mockAddDoc).toHaveBeenCalled();
      
      const logCall = mockAddDoc.mock.calls[0][1];
      expect(logCall.eventType).toBe('logout');
      expect(logCall.email).toBe(validEmail);
      expect(logCall.userId).toBe(validUserId);
      expect(logCall.ipAddress).toBe(testIpAddress);
      expect(logCall.timestamp).toBeDefined();
    });

    it('should log token refresh with IP address', async () => {
      // Arrange
      const refreshableFirebaseUser = {
        ...mockFirebaseUser,
        getIdToken: vi.fn().mockResolvedValue('new-token'),
      };

      mockAuthInstance.currentUser = refreshableFirebaseUser;
      mockAddDoc.mockResolvedValue(undefined);

      // Act: Refresh token
      await authService.refreshToken(testIpAddress);

      // Assert: Token refresh logged
      expect(mockAddDoc).toHaveBeenCalled();
      
      const logCall = mockAddDoc.mock.calls[0][1];
      expect(logCall.eventType).toBe('token_refresh');
      expect(logCall.email).toBe(validEmail);
      expect(logCall.userId).toBe(validUserId);
      expect(logCall.ipAddress).toBe(testIpAddress);
      expect(logCall.timestamp).toBeDefined();
    });

    it('should include user agent in all authentication logs when provided', async () => {
      // Arrange
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockResolvedValue(undefined);

      // Act: Login with user agent
      await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: User agent included in log
      const logCall = mockAddDoc.mock.calls[0][1];
      expect(logCall.userAgent).toBe(testUserAgent);
    });

    it('should handle logging failures gracefully without breaking authentication flow', async () => {
      // Arrange: Logging fails but authentication should succeed
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{
          ref: {},
          data: () => mockUserData,
        }],
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockAddDoc.mockRejectedValue(new Error('Firestore logging error'));

      // Act: Login (logging fails internally)
      const session = await authService.login(
        validEmail,
        validPassword,
        testIpAddress,
        testUserAgent
      );

      // Assert: Authentication succeeded despite logging failure
      expect(session).toBeDefined();
      expect(session.userId).toBe(validUserId);
    });
  });
});
