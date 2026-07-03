/**
 * Astro Middleware for Session Validation
 * 
 * Validates user sessions on each request and handles token refresh logic.
 * Automatically redirects to login on session expiration.
 * 
 * Requirements: 1.3, 1.6, 1.7
 */

import { defineMiddleware } from 'astro:middleware';
import { SessionManager } from './services/session/SessionManager';
import { FirebaseAuthService } from './services/auth/AuthService';
import { auth, db } from './services/firebase';

/**
 * CAPSTONE DEMO MODE - Authentication DISABLED
 * 
 * All requests get automatic Administrator session.
 * No authentication, no redirects, full access to all pages.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { locals } = context;

  // Create automatic Administrator session for ALL requests
  locals.session = {
    userId: 'demo-user-001',
    email: 'demo@tpro.com',
    role: 'Administrator',
    token: 'demo-token-capstone-2026',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry
  };
  locals.userId = 'demo-user-001';
  locals.userEmail = 'demo@tpro.com';
  locals.userRole = 'Administrator';

  // Always proceed - no checks, no redirects
  return next();
});
