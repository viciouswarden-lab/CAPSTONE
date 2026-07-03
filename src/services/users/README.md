# User Management Service

## Overview

The User Management Service provides comprehensive user account management functionality for the PRO SYNAPSE system. It handles CRUD operations, role-based access control, activation/deactivation, and audit logging for compliance.

## Requirements

This service implements **Requirement 16: User Management** with the following acceptance criteria:

- **16.1**: Create user accounts requiring username, email, role assignment, and initial password
- **16.2**: Role assignment applies all associated permissions
- **16.3**: Deactivation prevents login while preserving audit trail
- **16.4**: Support predefined roles: Administrator, Manager, Analyst, Clerk, Sales_Associate
- **16.5**: Permission changes apply immediately to active sessions
- **16.6**: Display audit log of user actions for security and compliance

## Features

### User CRUD Operations

- **Create User**: Creates new user accounts in Firebase Auth and Firestore
- **Get User**: Retrieves user information by ID
- **Update User**: Modifies user profile information (name, role, status)
- **Deactivate User**: Soft delete that prevents login while preserving data
- **Activate User**: Reactivates deactivated user accounts

### Role-Based Access Control

The service supports five predefined roles with specific permission sets:

| Role | Permissions |
|------|------------|
| **Administrator** | All permissions (7 total) |
| **Manager** | All except manage_users (6 total) |
| **Analyst** | upload_pricelists, approve_matches, generate_reports (3 total) |
| **Clerk** | upload_pricelists, adjust_inventory (2 total) |
| **Sales_Associate** | process_sales (1 total) |

#### Permissions

- `manage_users` - Create, modify, and deactivate user accounts
- `manage_suppliers` - Manage supplier information
- `upload_pricelists` - Upload and process supplier pricelists
- `approve_matches` - Confirm product matching suggestions
- `adjust_inventory` - Modify inventory quantities
- `process_sales` - Process point-of-sale transactions
- `generate_reports` - Create and export reports

### Audit Logging

All user-related actions are logged for security and compliance:

- User creation
- User updates (including role changes)
- User activation/deactivation
- Role assignments
- Custom actions

Each log entry includes:
- User ID (subject of the action)
- Action type
- Action details
- Timestamp
- Performer ID (who performed the action)

## Usage

### Basic Usage

```typescript
import { userManagementService } from '@/services/users';

// Create a new user
const userId = await userManagementService.createUser({
  email: 'analyst@example.com',
  displayName: 'Jane Smith',
  role: 'Analyst',
  password: 'SecurePass123!',
});

// Get user details
const user = await userManagementService.getUser(userId);

// Update user information
await userManagementService.updateUser(
  userId,
  { displayName: 'Jane Doe', role: 'Manager' },
  'admin-user-id'
);

// Deactivate user
await userManagementService.deactivateUser(userId, 'admin-user-id');

// Reactivate user
await userManagementService.activateUser(userId, 'admin-user-id');
```

### Role Management

```typescript
// Assign a role to a user
await userManagementService.assignRole(
  userId,
  'Manager',
  'admin-user-id'
);

// Get permissions for a role
const permissions = userManagementService.getPermissionsForRole('Analyst');
console.log(permissions); // ['upload_pricelists', 'approve_matches', 'generate_reports']
```

### Listing Users

```typescript
// List all users
const allUsers = await userManagementService.listUsers();

// Filter by role
const analysts = await userManagementService.listUsers({
  role: 'Analyst',
});

// Filter by status
const activeUsers = await userManagementService.listUsers({
  isActive: true,
});

// Search by text (searches email, name, and userId)
const searchResults = await userManagementService.listUsers({
  searchText: 'john',
});

// Combine filters
const activeAnalysts = await userManagementService.listUsers({
  role: 'Analyst',
  isActive: true,
  searchText: 'smith',
});
```

### Audit Logging

```typescript
// Get audit log for a specific user
const userLogs = await userManagementService.getUserAuditLog(userId);

// Get all audit logs (for administrators)
const allLogs = await userManagementService.getAllAuditLogs();

// Limit the number of logs returned
const recentLogs = await userManagementService.getUserAuditLog(userId, 50);

// Log a custom action
await userManagementService.logUserAction(
  userId,
  'password_reset_requested',
  { ipAddress: '192.168.1.1', timestamp: new Date() },
  userId // user performed action on themselves
);
```

## Data Models

### CreateUserData

```typescript
interface CreateUserData {
  email: string;           // User's email address (must be unique)
  displayName: string;     // User's full name
  role: UserRole;          // One of the predefined roles
  password: string;        // Initial password (min requirements apply)
}
```

### UpdateUserData

```typescript
interface UpdateUserData {
  displayName?: string;    // Update display name
  role?: UserRole;         // Change user role
  isActive?: boolean;      // Change active status
}
```

### UserFilters

```typescript
interface UserFilters {
  role?: UserRole;         // Filter by role
  isActive?: boolean;      // Filter by active status
  searchText?: string;     // Search in email, name, or userId
}
```

### UserAuditLog

```typescript
interface UserAuditLog {
  logId: string;           // Unique log entry ID
  userId: string;          // User the action pertains to
  action: string;          // Action type
  details: any;            // Action-specific details
  timestamp: Date;         // When the action occurred
  performedBy: string;     // User who performed the action
}
```

## Integration with Authentication

The User Management Service works in conjunction with the Authentication Service:

1. **User Creation**: Creates both Firebase Auth account and Firestore user document
2. **Deactivation**: AuthService checks `isActive` flag during login
3. **Role Changes**: Permission checks in AuthService use the role stored in Firestore
4. **Session Validity**: AuthService validates user status on each request

## Firestore Collections

### users

Stores user account information:

```typescript
{
  userId: string;           // Document ID (Firebase Auth UID)
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  failedLoginAttempts: number;
  lockedUntil?: Timestamp;
}
```

### user_audit_logs

Stores audit trail for compliance:

```typescript
{
  userId: string;
  action: string;
  details: any;
  timestamp: Timestamp;
  performedBy: string;
}
```

## Security Considerations

1. **Password Handling**: Passwords are handled by Firebase Auth and never stored in plaintext
2. **Soft Delete**: User deactivation preserves all data for audit purposes
3. **Audit Trail**: All administrative actions are logged with performer identity
4. **Role Validation**: Roles are validated against predefined list to prevent privilege escalation
5. **Permission Enforcement**: Permissions are applied through role mapping, ensuring consistency

## Error Handling

The service throws descriptive errors for:

- Missing required fields
- Invalid role assignments
- Non-existent users
- Duplicate email addresses
- Firebase authentication errors

All errors include helpful messages for debugging and user feedback.

## Testing

Comprehensive unit tests cover:

- User creation with all roles
- CRUD operations
- Role assignment and permission mapping
- Activation/deactivation
- Audit logging
- Error handling
- Input validation

Run tests with:

```bash
npm test -- UserManagementService.test.ts
```

## Future Enhancements

Potential improvements for future iterations:

1. **Custom Claims**: Use Firebase Admin SDK to set custom claims for instant permission updates
2. **Password Reset**: Add password reset flow with email verification
3. **User Profiles**: Extend user data with profile pictures, preferences, etc.
4. **Bulk Operations**: Add methods for bulk user import/export
5. **Advanced Filtering**: Add date range filters for audit logs
6. **Email Notifications**: Send emails on user creation, role changes, etc.
7. **MFA Support**: Integrate multi-factor authentication
8. **Session Management**: Add ability to view and terminate active sessions

## Related Services

- **AuthService**: Handles login, logout, and session validation
- **FirebaseConfig**: Provides initialized Firebase instances
- **AuditService** (future): Centralized audit logging across all services
