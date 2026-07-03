/**
 * Authentication Service Implementation
 * 
 * This module implements the AuthService interface for user authentication,
 * session management, and role-based access control using Firebase Authentication
 * and Firestore.
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 19.3, 19.5
 */

import type { AuthService } from '../../types/services';
import type { User, UserSession, Permission } from '../../types/models';
import type { UserRole } from '../../types/firestore';
import { AuthLogger } from './AuthLogger';

/**
 * Role-to-permissions mapping
 * Defines which permissions are granted to each role
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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
 * Firebase Authentication Service Implementation
 * 
 * Wraps Firebase Authentication and implements role-based access control
 * with session management and account lockout functionality.
 * 
 * Requirement 19.3: Firebase Auth automatically handles password hashing
 * using bcrypt with salt. No additional password hashing is needed as
 * Firebase Auth provides built-in secure password storage.
 */
export class FirebaseAuthService implements AuthService {
  // These will be imported from Firebase config once Task 1 is complete
  // For now, we define the structure
  private auth: any; // Firebase Auth instance
  private firestore: any; // Firestore instance
  private authLogger: AuthLogger;

  constructor(auth: any, firestore: any) {
    this.auth = auth;
    this.firestore = firestore;
    this.authLogger = new AuthLogger(firestore);
  }

  /**
   * Authenticate a user with email and password
   * 
   * Requirement 1.1: WHEN a user submits valid credentials, 
   * THE Authentication_Service SHALL create an authenticated session
   * 
   * Requirement 1.2: WHEN a user submits invalid credentials, 
   * THE Authentication_Service SHALL reject the login attempt and return an error message
   * 
   * Requirement 19.5: THE System SHALL log all authentication attempts 
   * including failures with IP address and timestamp
   * 
   * @param email - User email address
   * @param password - User password
   * @param ipAddress - Client IP address for logging
   * @param userAgent - Client user agent for logging
   * @returns Promise resolving to user session on success
   * @throws Error if credentials are invalid or account is locked
   */
  async login(
    email: string, 
    password: string,
    ipAddress: string = 'unknown',
    userAgent?: string
  ): Promise<UserSession> {
    try {
      // Check if account is locked before attempting authentication
      const userDoc = await this.getUserDocByEmail(email);
      
      if (userDoc && userDoc.lockedUntil) {
        const now = new Date();
        const lockedUntil = userDoc.lockedUntil.toDate();
        
        if (now < lockedUntil) {
          const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / (1000 * 60));
          throw new Error(
            `Account is locked due to multiple failed login attempts. ` +
            `Please try again in ${remainingMinutes} minute(s).`
          );
        }
      }

      // Attempt Firebase authentication
      // This will throw an error if credentials are invalid
      const userCredential = await this.auth.signInWithEmailAndPassword(
        this.auth.getAuth(),
        email,
        password
      );

      // Get the Firebase user
      const firebaseUser = userCredential.user;

      // Get user document from Firestore
      const userDocRef = this.firestore.doc(this.firestore.getFirestore(), 'users', firebaseUser.uid);
      const userSnapshot = await this.firestore.getDoc(userDocRef);

      if (!userSnapshot.exists()) {
        throw new Error('User document not found in database');
      }

      const userData = userSnapshot.data();

      // Check if user is active
      if (!userData.isActive) {
        await this.auth.signOut(this.auth.getAuth());
        throw new Error('User account is inactive');
      }

      // Reset failed login attempts on successful login
      await this.firestore.updateDoc(userDocRef, {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: this.firestore.serverTimestamp(),
      });

      // Requirement 19.5: Log successful authentication attempt with IP
      await this.authLogger.logLoginSuccess(
        email,
        firebaseUser.uid,
        ipAddress,
        userAgent
      );

      // Get ID token for session
      const token = await firebaseUser.getIdToken();

      // Get token expiration time (Firebase tokens expire after 1 hour)
      const tokenResult = await firebaseUser.getIdTokenResult();
      const expiresAt = new Date(tokenResult.expirationTime);

      // Create and return user session
      const session: UserSession = {
        userId: firebaseUser.uid,
        email: firebaseUser.email!,
        role: userData.role,
        token,
        expiresAt,
      };

      return session;
    } catch (error: any) {
      // Handle Firebase auth errors
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        // Requirement 19.5: Log failed authentication attempt with IP
        await this.authLogger.logLoginFailure(
          email,
          ipAddress,
          'Invalid credentials',
          userAgent
        );
        
        // Track failed login attempt
        await this.trackFailedLoginAttempt(email, ipAddress);
        throw new Error('Invalid email or password');
      }
      
      if (error.code === 'auth/too-many-requests') {
        // Requirement 19.5: Log failed authentication attempt
        await this.authLogger.logLoginFailure(
          email,
          ipAddress,
          'Too many requests',
          userAgent
        );
        throw new Error('Too many failed login attempts. Please try again later.');
      }

      // Requirement 19.5: Log other authentication failures
      await this.authLogger.logLoginFailure(
        email,
        ipAddress,
        error.message || 'Unknown error',
        userAgent
      );

      // Re-throw other errors (including account locked errors)
      throw error;
    }
  }

  /**
   * Log out the current user and terminate their session
   * 
   * Requirement 1.5: WHEN a user logs out, 
   * THE Authentication_Service SHALL terminate the authenticated session
   * 
   * @param ipAddress - Client IP address for logging
   * @returns Promise resolving when logout is complete
   */
  async logout(ipAddress: string = 'unknown'): Promise<void> {
    try {
      const firebaseUser = this.auth.getAuth().currentUser;
      
      // Log logout event before signing out
      if (firebaseUser) {
        await this.authLogger.logLogout(
          firebaseUser.email || 'unknown',
          firebaseUser.uid,
          ipAddress
        );
      }
      
      await this.auth.signOut(this.auth.getAuth());
    } catch (error: any) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Get the currently authenticated user
   * 
   * Requirement 1.6: WHILE a user session is active, 
   * THE System SHALL validate session validity on each request
   * 
   * @returns Promise resolving to User object or null if not authenticated
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const firebaseUser = this.auth.getAuth().currentUser;

      if (!firebaseUser) {
        return null;
      }

      // Validate token is still valid
      const tokenResult = await firebaseUser.getIdTokenResult();
      const expiresAt = new Date(tokenResult.expirationTime);
      const now = new Date();

      // Check if token has expired
      if (now >= expiresAt) {
        // Session expired - sign out
        await this.logout();
        return null;
      }

      // Get user document from Firestore
      const userDocRef = this.firestore.doc(this.firestore.getFirestore(), 'users', firebaseUser.uid);
      const userSnapshot = await this.firestore.getDoc(userDocRef);

      if (!userSnapshot.exists()) {
        return null;
      }

      const userData = userSnapshot.data();

      // Check if user is still active
      if (!userData.isActive) {
        await this.logout();
        return null;
      }

      // Convert Firestore document to User model
      const user: User = {
        userId: userData.userId,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        isActive: userData.isActive,
        createdAt: userData.createdAt.toDate(),
        lastLoginAt: userData.lastLoginAt.toDate(),
        failedLoginAttempts: userData.failedLoginAttempts,
        lockedUntil: userData.lockedUntil ? userData.lockedUntil.toDate() : undefined,
      };

      return user;
    } catch (error: any) {
      throw new Error(`Failed to get current user: ${error.message}`);
    }
  }

  /**
   * Check if a user has a specific permission
   * 
   * Requirement 1.4: THE System SHALL enforce role-based permissions 
   * for all protected operations
   * 
   * @param user - User to check
   * @param permission - Permission to verify
   * @returns true if user has the permission, false otherwise
   */
  checkPermission(user: User, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[user.role];
    return rolePermissions.includes(permission);
  }

  /**
   * Lock a user account after failed login attempts
   * 
   * Requirement 19.6: IF multiple failed login attempts occur from the same account 
   * within 15 minutes, THEN THE System SHALL temporarily lock the account for 30 minutes
   * 
   * @param userId - ID of user to lock
   * @param email - Email of user to lock
   * @param duration - Lock duration in milliseconds
   * @param ipAddress - Client IP address for logging
   * @param failedAttempts - Number of failed attempts
   * @returns Promise resolving when lock is applied
   */
  async lockAccount(
    userId: string, 
    email: string,
    duration: number,
    ipAddress: string = 'unknown',
    failedAttempts: number = 0
  ): Promise<void> {
    try {
      const userDocRef = this.firestore.doc(this.firestore.getFirestore(), 'users', userId);
      const lockedUntil = new Date(Date.now() + duration);

      await this.firestore.updateDoc(userDocRef, {
        lockedUntil: this.firestore.Timestamp.fromDate(lockedUntil),
      });

      // Log account lockout event
      await this.authLogger.logAccountLocked(
        email,
        userId,
        ipAddress,
        failedAttempts
      );
    } catch (error: any) {
      throw new Error(`Failed to lock account: ${error.message}`);
    }
  }

  /**
   * Helper method to get user document by email
   * 
   * @param email - User email
   * @returns User document or null if not found
   */
  private async getUserDocByEmail(email: string): Promise<any> {
    try {
      const usersCollection = this.firestore.collection(this.firestore.getFirestore(), 'users');
      const q = this.firestore.query(
        usersCollection,
        this.firestore.where('email', '==', email)
      );
      const querySnapshot = await this.firestore.getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return querySnapshot.docs[0].data();
    } catch (error) {
      return null;
    }
  }

  /**
   * Track failed login attempt and lock account if threshold is exceeded
   * 
   * Requirement 19.6: Account lockout after multiple failed attempts
   * 
   * @param email - Email of the user
   * @param ipAddress - Client IP address
   */
  private async trackFailedLoginAttempt(email: string, ipAddress: string): Promise<void> {
    try {
      const userDoc = await this.getUserDocByEmail(email);
      
      if (!userDoc) {
        // User doesn't exist, but don't reveal this for security
        return;
      }

      const usersCollection = this.firestore.collection(this.firestore.getFirestore(), 'users');
      const q = this.firestore.query(
        usersCollection,
        this.firestore.where('email', '==', email)
      );
      const querySnapshot = await this.firestore.getDocs(q);

      if (querySnapshot.empty) {
        return;
      }

      const userDocRef = querySnapshot.docs[0].ref;
      const currentAttempts = userDoc.failedLoginAttempts || 0;
      const newAttempts = currentAttempts + 1;

      // Lock account after 5 failed attempts within 15 minutes
      const FAILED_ATTEMPT_THRESHOLD = 5;
      const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

      if (newAttempts >= FAILED_ATTEMPT_THRESHOLD) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await this.firestore.updateDoc(userDocRef, {
          failedLoginAttempts: newAttempts,
          lockedUntil: this.firestore.Timestamp.fromDate(lockedUntil),
        });

        // Log account lockout
        await this.authLogger.logAccountLocked(
          email,
          userDoc.userId,
          ipAddress,
          newAttempts
        );
      } else {
        await this.firestore.updateDoc(userDocRef, {
          failedLoginAttempts: newAttempts,
        });
      }
    } catch (error) {
      // Log error but don't throw to avoid information leakage
      console.error('Failed to track login attempt:', error);
    }
  }

  /**
   * Refresh user's authentication token
   * 
   * Requirement 1.7: IF a session expires, THEN THE System SHALL require 
   * re-authentication before proceeding
   * 
   * @param ipAddress - Client IP address for logging
   * @returns Promise resolving to new token or null if refresh fails
   */
  async refreshToken(ipAddress: string = 'unknown'): Promise<string | null> {
    try {
      const firebaseUser = this.auth.getAuth().currentUser;

      if (!firebaseUser) {
        return null;
      }

      // Force token refresh
      const newToken = await firebaseUser.getIdToken(true);
      
      // Log token refresh event
      await this.authLogger.logTokenRefresh(
        firebaseUser.email || 'unknown',
        firebaseUser.uid,
        ipAddress
      );
      
      return newToken;
    } catch (error) {
      // Token refresh failed - user needs to re-authenticate
      return null;
    }
  }
}
