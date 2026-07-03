/**
 * CSRF Protection Middleware
 * 
 * Implements Cross-Site Request Forgery (CSRF) token validation for
 * state-changing operations (POST, PUT, DELETE, PATCH).
 * 
 * Requirements: 19.4 - THE System SHALL implement protection against 
 * common web vulnerabilities including cross-site request forgery
 */

import { defineMiddleware } from 'astro:middleware';
import type { AstroCookies } from 'astro';
import { randomBytes } from 'crypto';

/**
 * HTTP methods that require CSRF protection
 */
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Routes exempt from CSRF protection (login/logout flow)
 */
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
];

/**
 * Generate a cryptographically secure CSRF token
 * 
 * @returns 32-byte random token as hex string
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get or create CSRF token for the current session
 * 
 * @param cookies - Astro cookies object
 * @returns CSRF token string
 */
export function getCSRFToken(cookies: AstroCookies): string {
  const existingToken = cookies.get('csrf_token');
  
  if (existingToken?.value) {
    return existingToken.value;
  }

  // Generate new token
  const newToken = generateCSRFToken();
  
  // Set cookie with HttpOnly and SameSite attributes for security
  cookies.set('csrf_token', newToken, {
    httpOnly: true,
    secure: true, // Only send over HTTPS
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return newToken;
}

/**
 * Validate CSRF token from request
 * 
 * Checks for token in:
 * 1. X-CSRF-Token header
 * 2. csrf_token form field (for form submissions)
 * 
 * @param request - Request object
 * @param cookies - Astro cookies object
 * @returns true if token is valid, false otherwise
 */
async function validateCSRFToken(request: Request, cookies: AstroCookies): Promise<boolean> {
  const expectedToken = cookies.get('csrf_token')?.value;

  if (!expectedToken) {
    return false;
  }

  // Check header first (preferred for AJAX requests)
  let providedToken = request.headers.get('X-CSRF-Token');

  // If not in header, check form data or JSON body
  if (!providedToken) {
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        const body = await request.clone().json();
        providedToken = body.csrf_token;
      } catch {
        // Invalid JSON, token check will fail
      }
    } else if (contentType?.includes('application/x-www-form-urlencoded') || 
               contentType?.includes('multipart/form-data')) {
      try {
        const formData = await request.clone().formData();
        providedToken = formData.get('csrf_token') as string;
      } catch {
        // Invalid form data, token check will fail
      }
    }
  }

  if (!providedToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedToken, providedToken);
}

/**
 * Timing-safe string comparison
 * 
 * Prevents timing attacks by ensuring comparison time is constant
 * regardless of where strings differ.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * CSRF Protection Middleware
 * 
 * Validates CSRF tokens for all state-changing operations.
 * Generates and provides tokens for legitimate requests.
 * 
 * Requirements: 19.4 - Protection against CSRF attacks
 */
export const csrfProtection = defineMiddleware(async (context, next) => {
  const { request, cookies, url } = context;
  const method = request.method.toUpperCase();

  // Generate/retrieve CSRF token for all requests
  // This ensures the token is available for forms and AJAX calls
  const csrfToken = getCSRFToken(cookies);
  context.locals.csrfToken = csrfToken;

  // Skip CSRF validation for exempt routes
  const isExempt = CSRF_EXEMPT_ROUTES.some(route => url.pathname.startsWith(route));
  if (isExempt) {
    return next();
  }

  // Only validate for state-changing methods
  if (!STATE_CHANGING_METHODS.includes(method)) {
    return next();
  }

  // Validate CSRF token
  const isValid = await validateCSRFToken(request, cookies);

  if (!isValid) {
    // CSRF token validation failed
    return new Response(
      JSON.stringify({
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'CSRF token validation failed. Please refresh the page and try again.',
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Token valid, proceed with request
  return next();
});
