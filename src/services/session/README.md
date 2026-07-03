# Session Management Service

## Overview

The Session Management Service provides secure session state management using HTTP-only cookies with automatic token refresh and session validation middleware.

**Requirements:** 1.5, 1.6, 1.7

## Features

- ✅ Secure HTTP-only cookie storage
- ✅ Automatic session validation on each request
- ✅ Proactive token refresh (5 minutes before expiration)
- ✅ Automatic redirect to login on session expiration
- ✅ Session cleanup on logout
- ✅ SameSite=strict protection against CSRF

## Architecture

### SessionManager Class

Located in `src/services/session/SessionManager.ts`

**Key Methods:**

- `setSession(cookies, session)` - Store user session in secure cookie
- `getSession(cookies)` - Retrieve session from cookie
- `validateSession(cookies)` - Validate session and check expiration
- `clearSession(cookies)` - Remove session cookie
- `isSessionExpired(session)` - Check if token has expired
- `shouldRefreshToken(session)` - Check if token needs refresh
- `updateToken(cookies, token, expiresAt)` - Update session with new token

### Middleware

Located in `src/middleware.ts`

Runs on every request to:
1. Validate session exists and hasn't expired
2. Refresh token if within 5 minutes of expiration
3. Redirect to login if session invalid or expired
4. Attach session data to `Astro.locals` for use in pages

**Public Routes** (no authentication required):
- `/login`
- `/favicon.ico`
- `/favicon.svg`

## Session Data Structure

```typescript
interface SessionData {
  userId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string; // ISO string
}
```

## Cookie Configuration

```typescript
{
  httpOnly: true,        // Prevents JavaScript access
  secure: true,          // HTTPS only
  sameSite: 'strict',    // CSRF protection
  path: '/',             // Available site-wide
  maxAge: 604800,        // 7 days (longer than token for refresh)
}
```

## Token Refresh Strategy

Firebase authentication tokens expire after **1 hour**.

The session management system:
1. Checks token expiration on every request via middleware
2. If token expires in < 5 minutes, proactively refreshes it
3. Updates session cookie with new token and expiration
4. If refresh fails, clears session and redirects to login

## Usage Examples

### Login Page

```typescript
import { FirebaseAuthService } from '../services/auth/AuthService';
import { SessionManager } from '../services/session';
import { auth, db } from '../services/firebase';

// Authenticate user
const authService = new FirebaseAuthService(auth, db);
const userSession = await authService.login(email, password);

// Store session in secure cookie
SessionManager.setSession(Astro.cookies, userSession);

// Redirect to dashboard
return Astro.redirect('/');
```

### Logout Page

```typescript
import { FirebaseAuthService } from '../services/auth/AuthService';
import { SessionManager } from '../services/session';
import { auth, db } from '../services/firebase';

// Logout from Firebase
const authService = new FirebaseAuthService(auth, db);
await authService.logout();

// Clear session cookie
SessionManager.clearSession(Astro.cookies);

// Redirect to login
return Astro.redirect('/login');
```

### Protected Page

```typescript
---
// Session validation happens automatically via middleware
// Access session data from Astro.locals

const { session, userId, userEmail, userRole } = Astro.locals;

// If this page loads, user is authenticated
// Middleware redirects to /login if not authenticated
---

<h1>Welcome, {userEmail}!</h1>
<p>Your role: {userRole}</p>
```

### Accessing Session in Components

```typescript
---
// In any Astro component or page
const session = Astro.locals.session;

if (!session) {
  // This shouldn't happen on protected routes due to middleware
  return Astro.redirect('/login');
}
---
```

## Security Considerations

### HTTP-Only Cookies
Session tokens are stored in HTTP-only cookies, preventing XSS attacks from accessing the token via JavaScript.

### Secure Flag
Cookies are only sent over HTTPS in production, preventing man-in-the-middle attacks.

### SameSite Protection
`SameSite=strict` prevents CSRF attacks by ensuring cookies are only sent in first-party contexts.

### Token Expiration
Firebase tokens expire after 1 hour. The middleware automatically refreshes tokens or redirects to login if refresh fails.

### Session Validation
Every request validates the session:
1. Cookie exists and is parseable
2. Required fields are present
3. Token hasn't expired
4. If expired, clears session and redirects to login

## Requirements Validation

### Requirement 1.5: Session Termination on Logout
✅ `SessionManager.clearSession()` removes the session cookie when user logs out

### Requirement 1.6: Session Validation on Each Request
✅ Middleware validates session on every request via `SessionManager.validateSession()`

### Requirement 1.7: Re-authentication on Expiration
✅ Middleware checks token expiration and redirects to login if expired
✅ Attempts token refresh if within 5 minutes of expiration
✅ Clears session and redirects to login if refresh fails

## Testing

To test session management:

1. **Login Flow**
   - Navigate to `/login`
   - Submit valid credentials
   - Verify redirect to dashboard
   - Check session cookie exists in browser DevTools

2. **Protected Route Access**
   - Without login, navigate to `/`
   - Verify redirect to `/login`

3. **Token Refresh**
   - Login and wait ~55 minutes
   - Make a request (navigate to any page)
   - Verify token is refreshed (check session cookie update)

4. **Session Expiration**
   - Login and wait > 60 minutes without activity
   - Make a request
   - Verify redirect to `/login`

5. **Logout Flow**
   - Login successfully
   - Navigate to `/logout`
   - Verify redirect to `/login`
   - Verify session cookie is cleared
   - Attempt to access protected route → redirects to login

## Integration with MainLayout

The `MainLayout.astro` currently uses `authService.getCurrentUser()` for authentication checks. This still works, but can be optimized to use `Astro.locals.session` directly since middleware already validated the session:

```typescript
// Before (still works)
const authService = new FirebaseAuthService(auth, db);
const currentUser = await authService.getCurrentUser();

// After (more efficient - session already validated by middleware)
const session = Astro.locals.session;
if (!session) {
  return Astro.redirect('/login');
}
```

## Troubleshooting

**Issue:** Constant redirects to login
- Check that `/login` is in `PUBLIC_ROUTES` array in middleware
- Verify cookie is being set correctly in browser DevTools

**Issue:** Token not refreshing
- Check Firebase auth configuration
- Verify `authService.refreshToken()` is working
- Check token expiration threshold (default 5 minutes)

**Issue:** Session lost on page refresh
- Verify cookie `maxAge` is set correctly
- Check cookie domain and path settings
- Ensure HTTPS is enabled in production

## Future Enhancements

- [ ] Add remember me functionality (extended session duration)
- [ ] Implement session activity tracking
- [ ] Add concurrent session management (limit sessions per user)
- [ ] Add session revocation API
- [ ] Implement refresh token rotation for enhanced security
