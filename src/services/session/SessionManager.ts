/**
 * Session Management Service
 * 
 * Implements session state management using secure cookies with automatic
 * token refresh and session validation.
 * 
 * Requirements: 1.5, 1.6, 1.7
 */

import type { UserSession } from '../../types/models';
import type { AstroCookies } from 'astro';

/**
 * Session cookie configuration
 */
const SESSION_COOKIE_NAME = 'pro_synapse_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Only send over HTTPS
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days (longer than token expiry for refresh)
};

/**
 * Token refresh threshold - refresh when less than this many minutes remain
 */
const TOKEN_REFRESH_THRESHOLD_MINUTES = 5;

/**
 * Session data stored in cookie
 */
export interface SessionData {
  userId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string; // ISO string
}

/**
 * Session Manager
 * 
 * Handles session storage, validation, and token refresh logic using
 * secure HTTP-only cookies.
 */
export class SessionManager {
  /**
   * Store user session in secure cookie
   * 
   * Requirement 1.1: WHEN a user submits valid credentials, 
   * THE Authentication_Service SHALL create an authenticated session
   * 
   * @param cookies - Astro cookies object
   * @param session - User session to store
   */
  static setSession(cookies: AstroCookies, session: UserSession): void {
    const sessionData: SessionData = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    };

    cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), SESSION_COOKIE_OPTIONS);
  }

  /**
   * Retrieve user session from cookie
   * 
   * Requirement 1.6: WHILE a user session is active, 
   * THE System SHALL validate session validity on each request
   * 
   * @param cookies - Astro cookies object
   * @returns SessionData or null if not found or invalid
   */
  static getSession(cookies: AstroCookies): SessionData | null {
    try {
      const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
      
      if (!sessionCookie || !sessionCookie.value) {
        return null;
      }

      const sessionData = JSON.parse(sessionCookie.value) as SessionData;

      // Validate session structure
      if (!sessionData.userId || !sessionData.token || !sessionData.expiresAt) {
        return null;
      }

      return sessionData;
    } catch (error) {
      // Invalid JSON or cookie structure
      return null;
    }
  }

  /**
   * Check if session token has expired
   * 
   * Requirement 1.7: IF a session expires, THEN THE System SHALL require 
   * re-authentication before proceeding
   * 
   * @param session - Session data to check
   * @returns true if expired, false otherwise
   */
  static isSessionExpired(session: SessionData): boolean {
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    return now >= expiresAt;
  }

  /**
   * Check if session token needs refresh (within threshold of expiration)
   * 
   * @param session - Session data to check
   * @returns true if token should be refreshed
   */
  static shouldRefreshToken(session: SessionData): boolean {
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60);
    
    return minutesUntilExpiry <= TOKEN_REFRESH_THRESHOLD_MINUTES && minutesUntilExpiry > 0;
  }

  /**
   * Update session with new token
   * 
   * @param cookies - Astro cookies object
   * @param token - New token
   * @param expiresAt - New expiration date
   */
  static updateToken(cookies: AstroCookies, token: string, expiresAt: Date): void {
    const session = this.getSession(cookies);
    
    if (!session) {
      return;
    }

    session.token = token;
    session.expiresAt = expiresAt.toISOString();
    
    cookies.set(SESSION_COOKIE_NAME, JSON.stringify(session), SESSION_COOKIE_OPTIONS);
  }

  /**
   * Clear user session from cookie
   * 
   * Requirement 1.5: WHEN a user logs out, 
   * THE Authentication_Service SHALL terminate the authenticated session
   * 
   * @param cookies - Astro cookies object
   */
  static clearSession(cookies: AstroCookies): void {
    cookies.delete(SESSION_COOKIE_NAME, {
      path: '/',
    });
  }

  /**
   * Validate session and return user data
   * 
   * Requirements 1.6, 1.7: Session validation with expiration handling
   * 
   * @param cookies - Astro cookies object
   * @returns Valid session data or null if expired/invalid
   */
  static validateSession(cookies: AstroCookies): SessionData | null {
    const session = this.getSession(cookies);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (this.isSessionExpired(session)) {
      // Clear expired session
      this.clearSession(cookies);
      return null;
    }

    return session;
  }
}
