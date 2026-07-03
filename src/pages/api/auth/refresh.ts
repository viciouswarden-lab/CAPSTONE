/**
 * Token Refresh API Endpoint
 * 
 * Handles automatic token refresh for authenticated sessions.
 * 
 * Requirement 1.6: Session validation and token refresh
 * Requirement 1.7: Re-authentication on session expiration
 */

import type { APIRoute } from 'astro';
import { FirebaseAuthService } from '../../../services/auth/AuthService';
import { auth, db } from '../../../services/firebase';
import { CookieSessionManager } from '../../../utils/session';

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    // Get current session from cookie
    const sessionCookie = cookies.get('session');

    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'No session found' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse session
    const session = CookieSessionManager.deserializeSession(sessionCookie.value);

    // Check if session has expired
    const now = new Date();
    if (now >= session.expiresAt) {
      // Session expired - clear cookie
      cookies.delete('session', { path: '/' });
      
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize auth service
    const authService = new FirebaseAuthService(auth, db);

    // Attempt to refresh token
    const newToken = await authService.refreshToken();

    if (!newToken) {
      // Refresh failed - clear cookie and require re-authentication
      cookies.delete('session', { path: '/' });
      
      return new Response(
        JSON.stringify({ error: 'Token refresh failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new session with refreshed token
    // Firebase tokens are valid for 1 hour
    const newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    
    const newSession = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      token: newToken,
      expiresAt: newExpiresAt,
    };

    // Update session cookie
    cookies.set(
      'session',
      CookieSessionManager.serializeSession(newSession),
      CookieSessionManager.getCookieOptions(60 * 60) // 1 hour
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        session: newSession,
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
