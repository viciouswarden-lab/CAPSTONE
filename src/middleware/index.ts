/**
 * Middleware Index
 * 
 * Central export for all application middleware.
 * Configures the middleware sequence for Astro.
 * 
 * Middleware order:
 * 1. Error boundary (catches all unhandled exceptions)
 * 2. Session validation (authentication)
 * 3. CSRF protection (for state-changing operations)
 */

import { sequence } from 'astro:middleware';
import { errorBoundary } from './errorBoundary';
import { onRequest as sessionMiddleware } from './session';
import { csrfProtection } from './csrf';

// Combine middleware in sequence
// Error boundary wraps everything to catch unhandled exceptions
// Session validation runs first, then CSRF protection
export const onRequest = sequence(
  errorBoundary,
  sessionMiddleware,
  csrfProtection
);
