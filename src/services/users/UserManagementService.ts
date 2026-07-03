/**
 * User Management Service Implementation
 * 
 * Manages user accounts including CRUD operations, role assignment,
 * activation/deactivation, permission application, and audit logging.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  addDoc,
  runTransaction,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  updatePassword,
  type Auth,
} from 'firebase/auth';
import { db, auth } from '../firebase';
import type { User, UserRole, Permission } from '../../types/models';
import type { UserDoc } from '../../types/firestore';

/**
 * Role-to-permissions mapping
 * Defines which permissions are granted to each role
 * 
 * Requirement 16.2, 16.4
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
 * Request type for creating a new user
 * 
 * Requirement 16.1: WHEN an administrator creates a user account,
 * THE System SHALL require username, email, role assignment, and initial password
 */
export interface CreateUserData {
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
}

/**
 * Request type for updating a user
 */
export interface UpdateUserData {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Filters for listing users
 */
export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  searchText?: string;
}

/**
 * Audit log entry for user actions
 * 
 * Requirement 16.6: Display audit log of user actions
 */
export interface UserAuditLog {
  logId: string;
  userId: string;
  action: string;
  details: any;
  timestamp: Date;
  performedBy: string;
}

/**
 * Service for managing user accounts
 * 
 * Provides CRUD operations with role-based permission assignment,
 * activation/deactivation support, and audit logging.
 */
export class UserManagementService {
  private readonly usersCollection = 'users';
  private readonly auditLogsCollection = 'user_audit_logs';

  /**
   * Create a new user account with Firebase Auth and Firestore
   * 
   * Requirement 16.1: WHEN an administrator creates a user account,
   * THE System SHALL require username, email, role assignment, and initial password
   * 
   * Requirement 16.2: WHEN an administrator assigns a role to a user,
   * THE System SHALL apply all permissions associated with that role
   * 
   * @param userData - User creation data
   * @returns Promise resolving to the new user's ID
   * @throws Error if creation fails or email already exists
   */
  async createUser(userData: CreateUserData): Promise<string> {
    try {
      // Validate required fields
      if (!userData.email || !userData.displayName || !userData.role || !userData.password) {
        throw new Error('Email, display name, role, and password are required');
      }

      // Validate role is one of the predefined roles (Requirement 16.4)
      const validRoles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];
      if (!validRoles.includes(userData.role)) {
        throw new Error(
          `Invalid role. Must be one of: ${validRoles.join(', ')}`
        );
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      const userId = userCredential.user.uid;
      const now = Timestamp.now();

      // Create Firestore user document
      const userDoc: UserDoc = {
        userId,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        isActive: true,
        createdAt: now,
        lastLoginAt: now,
        failedLoginAttempts: 0,
      };

      // Save to Firestore
      const userRef = doc(db, this.usersCollection, userId);
      await setDoc(userRef, userDoc);

      // Log the user creation action
      await this.logUserAction(
        userId,
        'user_created',
        {
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
        },
        userId // Created by themselves (system context)
      );

      return userId;
    } catch (error) {
      if ((error as any).code === 'auth/email-already-in-use') {
        throw new Error('A user with this email already exists');
      }
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a user by ID
   * 
   * @param userId - User ID to retrieve
   * @returns Promise resolving to user or null if not found
   * @throws Error if retrieval fails
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const userRef = doc(db, this.usersCollection, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return null;
      }

      const userDoc = userSnap.data() as UserDoc;
      return this.convertToUser(userDoc);
    } catch (error) {
      throw new Error(
        `Failed to get user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a user's information
   * 
   * Requirement 16.5: WHEN an administrator modifies user permissions,
   * THE System SHALL apply changes immediately to active sessions
   * 
   * @param userId - User ID to update
   * @param updates - Partial user data to update
   * @param performedBy - User ID performing the update
   * @returns Promise resolving when update is complete
   * @throws Error if user not found or update fails
   */
  async updateUser(
    userId: string,
    updates: UpdateUserData,
    performedBy: string
  ): Promise<void> {
    try {
      const userRef = doc(db, this.usersCollection, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const currentUser = userSnap.data() as UserDoc;

      // Prepare update data
      const updateData: Partial<UserDoc> = {
        ...updates,
      };

      // Validate role if being updated
      if (updates.role) {
        const validRoles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];
        if (!validRoles.includes(updates.role)) {
          throw new Error(
            `Invalid role. Must be one of: ${validRoles.join(', ')}`
          );
        }
      }

      // Update user document
      await updateDoc(userRef, updateData);

      // Log the update action
      await this.logUserAction(
        userId,
        'user_updated',
        {
          changes: updates,
        },
        performedBy
      );

      // Note: Requirement 16.5 states changes should apply immediately to active sessions.
      // In Firebase, this happens automatically when the user's next authenticated request
      // refreshes their ID token, which includes custom claims that can be set via Admin SDK.
      // For a full implementation, we would use Firebase Admin SDK to set custom claims.
    } catch (error) {
      throw new Error(
        `Failed to update user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deactivate a user account (soft delete)
   * 
   * Requirement 16.3: WHEN an administrator deactivates a user account,
   * THE System SHALL prevent login while preserving audit trail of historical actions
   * 
   * @param userId - User ID to deactivate
   * @param performedBy - User ID performing the deactivation
   * @returns Promise resolving when deactivation is complete
   * @throws Error if user not found or deactivation fails
   */
  async deactivateUser(userId: string, performedBy: string): Promise<void> {
    try {
      const userRef = doc(db, this.usersCollection, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      // Mark as inactive (soft delete)
      await updateDoc(userRef, {
        isActive: false,
      });

      // Log the deactivation action
      await this.logUserAction(
        userId,
        'user_deactivated',
        {
          reason: 'Account deactivated by administrator',
        },
        performedBy
      );

      // Note: This preserves all historical data including audit logs
      // The user won't be able to log in (checked in AuthService.login)
    } catch (error) {
      throw new Error(
        `Failed to deactivate user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Activate a user account
   * 
   * @param userId - User ID to activate
   * @param performedBy - User ID performing the activation
   * @returns Promise resolving when activation is complete
   * @throws Error if user not found or activation fails
   */
  async activateUser(userId: string, performedBy: string): Promise<void> {
    try {
      const userRef = doc(db, this.usersCollection, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      // Mark as active
      await updateDoc(userRef, {
        isActive: true,
        failedLoginAttempts: 0, // Reset failed attempts
        lockedUntil: null, // Remove any lock
      });

      // Log the activation action
      await this.logUserAction(
        userId,
        'user_activated',
        {
          reason: 'Account activated by administrator',
        },
        performedBy
      );
    } catch (error) {
      throw new Error(
        `Failed to activate user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List users with optional filters
   * 
   * @param filters - Optional filters (role, status, search text)
   * @returns Promise resolving to array of matching users
   * @throws Error if listing fails
   */
  async listUsers(filters?: UserFilters): Promise<User[]> {
    try {
      const usersRef = collection(db, this.usersCollection);
      let usersQuery = query(usersRef, orderBy('createdAt', 'desc'));

      // Apply role filter
      if (filters?.role) {
        usersQuery = query(usersRef, where('role', '==', filters.role), orderBy('createdAt', 'desc'));
      }

      // Apply isActive filter
      if (filters?.isActive !== undefined) {
        usersQuery = query(
          usersRef,
          where('isActive', '==', filters.isActive),
          orderBy('createdAt', 'desc')
        );
      }

      // Execute query
      const querySnap = await getDocs(usersQuery);
      let users: User[] = [];

      // Convert documents to users
      querySnap.forEach((doc) => {
        const userDoc = doc.data() as UserDoc;
        users.push(this.convertToUser(userDoc));
      });

      // Apply text search filter (in-memory, case-insensitive)
      if (filters?.searchText) {
        const searchLower = filters.searchText.toLowerCase().trim();
        users = users.filter(
          (user) =>
            user.email.toLowerCase().includes(searchLower) ||
            user.displayName.toLowerCase().includes(searchLower) ||
            user.userId.toLowerCase().includes(searchLower)
        );
      }

      return users;
    } catch (error) {
      throw new Error(
        `Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Assign a role to a user and apply associated permissions
   * 
   * Requirement 16.2: WHEN an administrator assigns a role to a user,
   * THE System SHALL apply all permissions associated with that role
   * 
   * Requirement 16.4: THE System SHALL support predefined roles including
   * Administrator, Manager, Analyst, Clerk, and Sales_Associate
   * 
   * @param userId - User ID to assign role
   * @param role - Role to assign
   * @param performedBy - User ID performing the assignment
   * @returns Promise resolving when role is assigned
   * @throws Error if user not found or assignment fails
   */
  async assignRole(userId: string, role: UserRole, performedBy: string): Promise<void> {
    try {
      // Validate role (Requirement 16.4)
      const validRoles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];
      if (!validRoles.includes(role)) {
        throw new Error(
          `Invalid role. Must be one of: ${validRoles.join(', ')}`
        );
      }

      const userRef = doc(db, this.usersCollection, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const currentUser = userSnap.data() as UserDoc;
      const oldRole = currentUser.role;

      // Update user role
      await updateDoc(userRef, {
        role,
      });

      // Get permissions for the new role
      const permissions = this.getPermissionsForRole(role);

      // Log the role assignment action
      await this.logUserAction(
        userId,
        'role_assigned',
        {
          oldRole,
          newRole: role,
          permissions,
        },
        performedBy
      );

      // Note: Permissions are applied through ROLE_PERMISSIONS mapping
      // and enforced in the AuthService.checkPermission method
    } catch (error) {
      throw new Error(
        `Failed to assign role to user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get permissions for a specific role
   * 
   * Requirement 16.2: Role assignment applies all associated permissions
   * 
   * @param role - User role
   * @returns Array of permissions for the role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Log a user action to the audit log
   * 
   * Requirement 16.6: THE System SHALL display an audit log of user actions
   * for security and compliance review
   * 
   * @param userId - User ID the action pertains to
   * @param action - Action description
   * @param details - Additional action details
   * @param performedBy - User ID who performed the action
   * @returns Promise resolving when log entry is created
   */
  async logUserAction(
    userId: string,
    action: string,
    details: any,
    performedBy: string
  ): Promise<void> {
    try {
      const auditLogRef = collection(db, this.auditLogsCollection);
      
      await addDoc(auditLogRef, {
        userId,
        action,
        details,
        timestamp: Timestamp.now(),
        performedBy,
      });
    } catch (error) {
      // Log error but don't throw - audit logging shouldn't break operations
      console.error('Failed to log user action:', error);
    }
  }

  /**
   * Get audit log entries for a user
   * 
   * Requirement 16.6: Display audit log of user actions
   * 
   * @param userId - User ID to retrieve logs for
   * @param limit - Maximum number of logs to retrieve (default 100)
   * @returns Promise resolving to array of audit log entries
   * @throws Error if retrieval fails
   */
  async getUserAuditLog(userId: string, limit: number = 100): Promise<UserAuditLog[]> {
    try {
      const auditLogsRef = collection(db, this.auditLogsCollection);
      const auditQuery = query(
        auditLogsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const querySnap = await getDocs(auditQuery);
      const logs: UserAuditLog[] = [];

      querySnap.forEach((doc) => {
        const data = doc.data();
        logs.push({
          logId: doc.id,
          userId: data.userId,
          action: data.action,
          details: data.details,
          timestamp: data.timestamp.toDate(),
          performedBy: data.performedBy,
        });
      });

      // Apply limit
      return logs.slice(0, limit);
    } catch (error) {
      throw new Error(
        `Failed to get audit log for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all audit log entries (for administrators)
   * 
   * Requirement 16.6: Display audit log of user actions
   * 
   * @param limit - Maximum number of logs to retrieve (default 100)
   * @returns Promise resolving to array of audit log entries
   * @throws Error if retrieval fails
   */
  async getAllAuditLogs(limit: number = 100): Promise<UserAuditLog[]> {
    try {
      const auditLogsRef = collection(db, this.auditLogsCollection);
      const auditQuery = query(
        auditLogsRef,
        orderBy('timestamp', 'desc')
      );

      const querySnap = await getDocs(auditQuery);
      const logs: UserAuditLog[] = [];

      querySnap.forEach((doc) => {
        const data = doc.data();
        logs.push({
          logId: doc.id,
          userId: data.userId,
          action: data.action,
          details: data.details,
          timestamp: data.timestamp.toDate(),
          performedBy: data.performedBy,
        });
      });

      // Apply limit
      return logs.slice(0, limit);
    } catch (error) {
      throw new Error(
        `Failed to get all audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert Firestore UserDoc to domain model User
   * 
   * @param doc - Firestore document
   * @returns Domain model
   */
  private convertToUser(doc: UserDoc): User {
    return {
      userId: doc.userId,
      email: doc.email,
      displayName: doc.displayName,
      role: doc.role,
      isActive: doc.isActive,
      createdAt: doc.createdAt.toDate(),
      lastLoginAt: doc.lastLoginAt.toDate(),
      failedLoginAttempts: doc.failedLoginAttempts,
      lockedUntil: doc.lockedUntil ? doc.lockedUntil.toDate() : undefined,
    };
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService();
