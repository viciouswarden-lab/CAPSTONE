# Authentication Service

## Overview

The Authentication Service provides secure user authentication, session management, and role-based access control for the PRO SYNAPSE system. It wraps Firebase Authentication and integrates with Firestore for user data management.

## Features

### 1. User Authentication (Requirements 1.1, 1.2)
- Email/password authentication using Firebase Auth
- Secure credential validation
- Automatic session creation on successful login
- Descriptive error messages for invalid credentials

### 2. Session Management (Requirements 1.5, 1.6, 1.7)
- Token-based session management
- Automatic session validation
- Token refresh functionality
- Session termination on logout
- Automatic logout on session expiration

### 3. Role-Based Access Control (Requirement 1.4)
- Five user roles: Administrator, Manager, Analyst, Clerk, Sales_Associate
- Permission checking based on role
- Seven system permissions:
  - `manage_users`
  - `manage_suppliers`
  - `upload_pricelists`
  - `approve_matches`
  - `adjust_inventory`
  - `process_sales`
  - `generate_reports`

### 4. Account Security (Requirement 19.6)
- Failed login attempt tracking
- Automatic account lockout after 5 failed attempts
- 30-minute lockout duration
- Lockout bypass after timeout expiration

## Role Permissions Matrix

| Role | Permissions |
|------|------------|
| **Administrator** | All permissions (manage_users, manage_suppliers, upload_pricelists, approve_matches, adjust_inventory, process_sales, generate_reports) |
| **Manager** | manage_suppliers, upload_pricelists, approve_matches, adjust_inventory, process_sales, generate_reports |
| **Analyst** | upload_pricelists, approve_matches, generate_reports |
| **Clerk** | upload_pricelists, adjust_inventory |
| **Sales_Associate** | process_sales |

## API Reference

### `login(email: string, password: string): Promise<UserSession>`

Authenticates a user with email and password.

**Parameters:**
- `email` - User email address
- `password` - User password

**Returns:**
- `UserSession` object containing userId, email, role, token, and expiresAt

**Throws:**
- Error if credentials are invalid
- Error if account is locked
- Error if user account is inactive

**Example:**
```typescript
const session = await authService.login('user@example.com', 'password123');
console.log(`Logged in as ${session.email} with role ${session.role}`);
```

### `logout(): Promise<void>`

Logs out the current user and terminates their session.

**Example:**
```typescript
await authService.logout();
```

### `getCurrentUser(): Promise<User | null>`

Gets the currently authenticated user with session validation.

**Returns:**
- `User` object if authenticated and session is valid
- `null` if not authenticated or session has expired

**Example:**
```typescript
const user = await authService.getCurrentUser();
if (user) {
  console.log(`Current user: ${user.displayName}`);
} else {
  console.log('No authenticated user');
}
```

### `checkPermission(user: User, permission: Permission): boolean`

Checks if a user has a specific permission based on their role.

**Parameters:**
- `user` - User object to check
- `permission` - Permission to verify

**Returns:**
- `true` if user has the permission
- `false` otherwise

**Example:**
```typescript
const canManageUsers = authService.checkPermission(user, 'manage_users');
if (canManageUsers) {
  // Show user management UI
}
```

### `lockAccount(userId: string, duration: number): Promise<void>`

Locks a user account for a specified duration.

**Parameters:**
- `userId` - ID of the user to lock
- `duration` - Lock duration in milliseconds

**Example:**
```typescript
const THIRTY_MINUTES = 30 * 60 * 1000;
await authService.lockAccount('user123', THIRTY_MINUTES);
```

### `refreshToken(): Promise<string | null>`

Refreshes the current user's authentication token.

**Returns:**
- New token string if refresh is successful
- `null` if refresh fails (user needs to re-authenticate)

**Example:**
```typescript
const newToken = await authService.refreshToken();
if (!newToken) {
  // Redirect to login page
}
```

## Usage Example

```typescript
import { FirebaseAuthService } from './services/auth';
import { auth, firestore } from './services/firebase/config';

// Initialize the service
const authService = new FirebaseAuthService(auth, firestore);

// Login flow
try {
  const session = await authService.login('user@example.com', 'password123');
  console.log('Login successful:', session);
  
  // Check permissions
  const user = await authService.getCurrentUser();
  if (user && authService.checkPermission(user, 'manage_suppliers')) {
    // User can manage suppliers
  }
} catch (error) {
  console.error('Login failed:', error.message);
}

// Logout
await authService.logout();
```

## Security Features

### Account Lockout
- Tracks failed login attempts in Firestore
- Locks account after 5 consecutive failed attempts
- Lock duration: 30 minutes
- Automatic unlock after timeout expires
- Prevents brute-force attacks

### Session Validation
- Validates token expiration on each request
- Automatically signs out expired sessions
- Checks user active status
- Ensures data integrity

### Error Handling
- Generic error messages to prevent information leakage
- Specific errors only for authenticated users
- Secure logging of authentication events
- Protection against user enumeration attacks

## Dependencies

- Firebase Authentication (`firebase/auth`)
- Firebase Firestore (`firebase/firestore`)
- Type definitions from `../../types/services`, `../../types/models`, `../../types/firestore`

## Testing

Unit tests for this service should be implemented in Task 3.3. Key test scenarios:

1. **Successful login with valid credentials**
2. **Failed login with invalid credentials**
3. **Session expiration handling**
4. **Account lockout after multiple failed attempts**
5. **Role-based permission checks for each role**
6. **Token refresh functionality**
7. **Logout functionality**

## Integration Notes

This service requires Firebase to be properly configured (Task 1). The following Firebase modules must be initialized:
- Firebase Authentication
- Firebase Firestore

Once Task 1 is complete, update the constructor to properly import Firebase instances from the config module.

## Future Enhancements

Potential improvements for future iterations:
- Multi-factor authentication (MFA)
- Social authentication providers (Google, Microsoft, etc.)
- Password reset functionality
- Email verification on signup
- Rate limiting on login attempts
- IP-based blocking
- Session activity tracking
- Concurrent session limits
