/**
 * Session Management Utilities
 * 
 * Provides utilities for session storage, retrieval, validation,
 * and token refresh operations.
 * 
 * Requirements: 1.5, 1.6, 1.7
 */

import type { UserSession } from '../types/models';

/**
 * Session storage keys
 */
const SESSION_COOKIE_NAME = 'session';
const SESSION_STORAGE_KEY = 'pro_synapse_session';

/**
 * Session storage interface for client-side operations
 */
export class SessionManager {
  /**
   * Store session in localStorage (fallback for client-side)
   * 
   * @param session - User session to store
   */
  static setSession(session: UserSession): void {
    if (typeof window === 'undefined') {
      return; // Server-side, skip
    }

    try {
      const sessionData = {
        userId: session.userId,
        email: session.email,
        role: session.role,
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
      };

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  /**
   * Retrieve session from localStorage
   * 
   * Requirement 1.6: Validate session validity
   * 
   * @returns Session object or null if not found or expired
   */
  static getSession(): UserSession | null {
    if (typeof window === 'undefined') {
      return null; // Server-side, skip
    }

    try {
      const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
      
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      
      // Validate expiration
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      if (now >= expiresAt) {
        // Session expired - clear and return null
        // Requirement 1.7: Handle session expiration
        this.clearSession();
        return null;
      }

      return {
        userId: session.userId,
        email: session.email,
        role: session.role,
        token: session.token,
        expiresAt: expiresAt,
      };
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      return null;
    }
  }

  /**
   * Clear session from storage
   * 
   * Requirement 1.5: Terminate authenticated session
   */
  static clearSession(): void {
    if (typeof window === 'undefined') {
      return; // Server-side, skip
    }

    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Check if session exists and is valid
   * 
   * @returns true if session is valid, false otherwise
   */
  static isSessionValid(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Get remaining time until session expires
   * 
   * @returns Milliseconds until expiration, or 0 if expired/no session
   */
  static getTimeUntilExpiration(): number {
    const session = this.getSession();
    
    if (!session) {
      return 0;
    }

    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    const remaining = expiresAt.getTime() - now.getTime();

    return Math.max(0, remaining);
  }

  /**
   * Check if session should be refreshed
   * Token should be refreshed when it has less than 5 minutes remaining
   * 
   * @returns true if refresh is needed, false otherwise
   */
  static shouldRefreshToken(): boolean {
    const remaining = this.getTimeUntilExpiration();
    const fiveMinutesInMs = 5 * 60 * 1000;

    return remaining > 0 && remaining <= fiveMinutesInMs;
  }
}

/**
 * Cookie utilities for server-side session management
 */
export class CookieSessionManager {
  /**
   * Create session cookie options
   * 
   * @param maxAge - Maximum age in seconds
   * @returns Cookie options object
   */
  static getCookieOptions(maxAge: number = 3600) {
    return {
      path: '/',
      maxAge,
      sameSite: 'lax' as const,
      secure: import.meta.env.PROD, // Secure in production
      httpOnly: false, // Allow JS access for token refresh
    };
  }

  /**
   * Serialize session for cookie storage
   * 
   * @param session - User session
   * @returns JSON string
   */
  static serializeSession(session: UserSession): string {
    return JSON.stringify({
      userId: session.userId,
      email: session.email,
      role: session.role,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    });
  }

  /**
   * Deserialize session from cookie
   * 
   * @param cookieValue - Cookie value string
   * @returns UserSession object
   */
  static deserializeSession(cookieValue: string): UserSession {
    const data = JSON.parse(cookieValue);
    
    return {
      userId: data.userId,
      email: data.email,
      role: data.role,
      token: data.token,
      expiresAt: new Date(data.expiresAt),
    };
  }
}

/**
 * Client-side session refresh handler
 * Sets up automatic token refresh before expiration
 */
export function setupSessionRefresh(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  // Check every minute if token needs refresh
  const checkInterval = 60 * 1000; // 1 minute

  setInterval(async () => {
    if (SessionManager.shouldRefreshToken()) {
      try {
        // Call refresh endpoint
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.session) {
            // Update session in localStorage
            SessionManager.setSession(data.session);
          }
        } else {
          // Refresh failed - redirect to login
          // Requirement 1.7: Require re-authentication
          SessionManager.clearSession();
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }
  }, checkInterval);
}
