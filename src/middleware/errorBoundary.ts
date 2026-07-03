/**
 * Global Error Boundary Middleware
 * 
 * Catches unhandled exceptions in the application and provides:
 * - User-friendly error display
 * - Critical error logging with full context
 * - Request ID generation for troubleshooting
 * - Security: Prevents sensitive information from leaking to users
 * 
 * Requirements 18.2: Log system errors with diagnostic information
 * Design: Error Handling - System Errors section
 */

import type { MiddlewareHandler } from 'astro';
import { logger } from '../services/logging/Logger';
import { generateRequestId, ErrorCodes } from '../utils/errors';

/**
 * Global error boundary middleware
 * 
 * This middleware wraps all requests in a try-catch block to catch
 * unhandled exceptions. When an error occurs:
 * 1. Log at CRITICAL level with full context and stack trace
 * 2. Generate a unique request ID for support troubleshooting
 * 3. Redirect to user-friendly error page
 * 4. Ensure sensitive information (stack traces) is not exposed to users
 */
export const errorBoundary: MiddlewareHandler = async (context, next) => {
  const { url, request, redirect, cookies } = context;
  
  // Generate request ID for this request (for tracking through the system)
  const requestId = generateRequestId();
  
  // Attach request ID to context for use in handlers
  context.locals.requestId = requestId;
  
  try {
    // Continue with normal request processing
    return await next();
  } catch (error) {
    // Unhandled exception occurred - log it with full context
    const errorContext = {
      requestId,
      url: url.toString(),
      pathname: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      // Include user info if available
      userId: context.locals.userId,
      userEmail: context.locals.userEmail,
      userRole: context.locals.userRole,
    };

    // Requirement 18.2: Log critical errors with full context
    if (error instanceof Error) {
      logger.critical(
        `Unhandled exception in ${request.method} ${url.pathname}`,
        errorContext,
        error
      );
    } else {
      logger.critical(
        `Unhandled non-Error exception in ${request.method} ${url.pathname}`,
        {
          ...errorContext,
          errorValue: String(error),
          errorType: typeof error,
        }
      );
    }

    // Store request ID in cookie for error page to display
    cookies.set('error_request_id', requestId, {
      path: '/',
      maxAge: 300, // 5 minutes
      httpOnly: false, // Needs to be accessible to error page
      sameSite: 'strict',
    });

    // Store minimal error message in cookie (NO stack traces or sensitive data)
    const userMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    cookies.set('error_message', userMessage, {
      path: '/',
      maxAge: 300, // 5 minutes
      httpOnly: false,
      sameSite: 'strict',
    });

    // Redirect to error page
    // Design requirement: Display friendly error page with support contact
    return redirect('/error/500');
  }
};

/**
 * Helper function to extract error details for logging
 * (used internally, not exported)
 */
function extractErrorDetails(error: unknown): {
  message: string;
  name: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    name: 'UnknownError',
    stack: undefined,
  };
}
