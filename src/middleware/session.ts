/**
 * Session Management Middleware
 * 
 * Handles session validation, token refresh, and automatic redirect
 * on session expiration for all protected routes.
 * 
 * Requirements: 1.5, 1.6, 1.7
 */

import { defineMiddleware } from 'astro:middleware';
import type { UserSession } from '../types/models';

/**
 * Session validation middleware
 * 
 * Requirement 1.6: WHILE a user session is active, 
 * THE System SHALL validate session validity on each request
 * 
 * Requirement 1.7: IF a session expires, THEN THE System SHALL require 
 * re-authentication before proceeding
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, url, redirect } = context;

  // Skip middleware for public routes
  const publicRoutes = ['/login', '/favicon.svg', '/favicon.ico'];
  const isPublicRoute = publicRoutes.some(route => url.pathname === route);
  
  if (isPublicRoute) {
    return next();
  }

  // Skip middleware for static assets
  if (url.pathname.startsWith('/_') || url.pathname.includes('.')) {
    return next();
  }

  // Get session from cookie
  const sessionCookie = cookies.get('session');
  
  if (!sessionCookie) {
    // No session found - redirect to login
    // Requirement 1.7: Require re-authentication
    return redirect('/login');
  }

  try {
    // Parse session data
    const session: UserSession = JSON.parse(sessionCookie.value);

    // Requirement 1.6: Validate session validity
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    // Check if session has expired
    if (now >= expiresAt) {
      // Session expired - clear cookie and redirect to login
      // Requirement 1.7: Automatic redirect on session expiration
      cookies.delete('session', { path: '/' });
      return redirect('/login');
    }

    // Check if session is about to expire (within 5 minutes)
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const shouldRefresh = expiresAt <= fiveMinutesFromNow;

    if (shouldRefresh) {
      // Token refresh logic will be handled client-side or in a separate refresh endpoint
      // For now, we'll add a flag to indicate refresh is needed
      context.locals.shouldRefreshToken = true;
    }

    // Attach session to context for use in pages
    context.locals.session = session;
    context.locals.user = {
      userId: session.userId,
      email: session.email,
      role: session.role,
    };

    return next();
  } catch (error) {
    // Invalid session data - clear cookie and redirect to login
    console.error('Session validation error:', error);
    cookies.delete('session', { path: '/' });
    return redirect('/login');
  }
});
