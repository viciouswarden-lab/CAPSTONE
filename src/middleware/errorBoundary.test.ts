/**
 * Unit Tests for Global Error Boundary Middleware
 * 
 * Tests error handling, logging, and user experience for unhandled exceptions
 * 
 * Requirements 18.2: System SHALL log errors with diagnostic information
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorBoundary } from './errorBoundary';
import { logger } from '../services/logging/Logger';
import * as errorsModule from '../utils/errors';

// Mock the logger
vi.mock('../services/logging/Logger', () => ({
  logger: {
    critical: vi.fn(),
  },
}));

// Mock the errors module
vi.mock('../utils/errors', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    generateRequestId: vi.fn(() => 'test-request-id-12345'),
  };
});

describe('Global Error Boundary Middleware', () => {
  let mockContext: any;
  let mockNext: any;
  let mockCookies: Map<string, any>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock cookies
    mockCookies = new Map();
    
    // Setup mock context
    mockContext = {
      url: new URL('http://localhost:4321/test-page'),
      request: {
        method: 'GET',
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'user-agent') return 'Test-Browser/1.0';
            if (header === 'referer') return 'http://localhost:4321/previous-page';
            return null;
          }),
        },
      },
      redirect: vi.fn((url: string) => ({ type: 'redirect', url })),
      cookies: {
        set: vi.fn((name: string, value: string, options: any) => {
          mockCookies.set(name, { value, options });
        }),
      },
      locals: {
        userId: 'user-123',
        userEmail: 'test@example.com',
        userRole: 'Manager',
      },
    };

    // Setup mock next function
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should call next() and return its result when no error occurs', async () => {
      // Arrange
      const expectedResponse = { status: 200, body: 'Success' };
      mockNext.mockResolvedValue(expectedResponse);

      // Act
      const result = await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledOnce();
      expect(result).toBe(expectedResponse);
      expect(logger.critical).not.toHaveBeenCalled();
    });

    it('should attach requestId to context locals', async () => {
      // Arrange
      mockNext.mockResolvedValue({ status: 200 });

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.locals.requestId).toBe('test-request-id-12345');
    });
  });

  describe('Error Handling', () => {
    it('should catch Error instances and log them at CRITICAL level', async () => {
      // Arrange
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error message\n    at test.ts:10:15';
      mockNext.mockRejectedValue(testError);

      // Act
      const result = await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalledOnce();
      const [message, context, error] = (logger.critical as any).mock.calls[0];
      
      expect(message).toBe('Unhandled exception in GET /test-page');
      expect(context).toMatchObject({
        requestId: 'test-request-id-12345',
        url: 'http://localhost:4321/test-page',
        pathname: '/test-page',
        method: 'GET',
        userAgent: 'Test-Browser/1.0',
        referer: 'http://localhost:4321/previous-page',
        userId: 'user-123',
        userEmail: 'test@example.com',
        userRole: 'Manager',
      });
      expect(error).toBe(testError);
    });

    it('should catch non-Error exceptions and log them appropriately', async () => {
      // Arrange
      const testError = 'String error message';
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalledOnce();
      const [message, context] = (logger.critical as any).mock.calls[0];
      
      expect(message).toBe('Unhandled non-Error exception in GET /test-page');
      expect(context.errorValue).toBe('String error message');
      expect(context.errorType).toBe('string');
    });

    it('should log full diagnostic context including user information', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const [, context] = (logger.critical as any).mock.calls[0];
      
      // Verify all diagnostic information is logged
      expect(context.requestId).toBe('test-request-id-12345');
      expect(context.userId).toBe('user-123');
      expect(context.userEmail).toBe('test@example.com');
      expect(context.userRole).toBe('Manager');
      expect(context.pathname).toBe('/test-page');
      expect(context.method).toBe('GET');
      expect(context.userAgent).toBe('Test-Browser/1.0');
      expect(context.referer).toBe('http://localhost:4321/previous-page');
    });

    it('should redirect to /error/500 page when error occurs', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      const result = await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.redirect).toHaveBeenCalledWith('/error/500');
      expect(result).toEqual({ type: 'redirect', url: '/error/500' });
    });
  });

  describe('Request ID Generation and Storage', () => {
    it('should generate a unique request ID for troubleshooting', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(errorsModule.generateRequestId).toHaveBeenCalled();
      expect(mockContext.locals.requestId).toBe('test-request-id-12345');
    });

    it('should store request ID in cookie for error page display', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_request_id',
        'test-request-id-12345',
        expect.objectContaining({
          path: '/',
          maxAge: 300,
          httpOnly: false,
          sameSite: 'strict',
        })
      );
    });

    it('should store user-friendly error message in cookie', async () => {
      // Arrange
      const testError = new Error('Database connection failed');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_message',
        'Database connection failed',
        expect.objectContaining({
          path: '/',
          maxAge: 300,
          httpOnly: false,
          sameSite: 'strict',
        })
      );
    });

    it('should handle non-Error exceptions in cookie message', async () => {
      // Arrange
      const testError = { code: 'FIRESTORE_ERROR', details: 'Connection timeout' };
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const errorMessageCall = (mockContext.cookies.set as any).mock.calls.find(
        (call: any) => call[0] === 'error_message'
      );
      expect(errorMessageCall[1]).toBe('An unexpected error occurred');
    });
  });

  describe('Security - Sensitive Information Protection', () => {
    it('should NOT expose stack traces to user via cookies', async () => {
      // Arrange
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at sensitiveFunction (auth.ts:42:10)';
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const errorMessageCall = (mockContext.cookies.set as any).mock.calls.find(
        (call: any) => call[0] === 'error_message'
      );
      
      // Cookie should only contain the message, not the stack trace
      expect(errorMessageCall[1]).toBe('Test error');
      expect(errorMessageCall[1]).not.toContain('auth.ts');
      expect(errorMessageCall[1]).not.toContain('sensitiveFunction');
    });

    it('should log stack trace for debugging but not expose to users', async () => {
      // Arrange
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at sensitiveFunction (auth.ts:42:10)';
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      // Stack trace should be in the logged error object
      const [, , loggedError] = (logger.critical as any).mock.calls[0];
      expect(loggedError.stack).toContain('sensitiveFunction');
      
      // But NOT in the user-facing cookie
      const errorMessageCall = (mockContext.cookies.set as any).mock.calls.find(
        (call: any) => call[0] === 'error_message'
      );
      expect(errorMessageCall[1]).not.toContain('sensitiveFunction');
    });
  });

  describe('Different Error Types', () => {
    it('should handle TypeError appropriately', async () => {
      // Arrange
      const testError = new TypeError('Cannot read property of undefined');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalled();
      const [, , error] = (logger.critical as any).mock.calls[0];
      expect(error).toBeInstanceOf(TypeError);
    });

    it('should handle ReferenceError appropriately', async () => {
      // Arrange
      const testError = new ReferenceError('Variable is not defined');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalled();
      expect(mockContext.redirect).toHaveBeenCalledWith('/error/500');
    });

    it('should handle null/undefined errors', async () => {
      // Arrange
      mockNext.mockRejectedValue(null);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalled();
      const [message] = (logger.critical as any).mock.calls[0];
      expect(message).toContain('non-Error exception');
    });
  });

  describe('HTTP Methods', () => {
    it('should log POST request errors correctly', async () => {
      // Arrange
      mockContext.request.method = 'POST';
      const testError = new Error('POST error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const [message, context] = (logger.critical as any).mock.calls[0];
      expect(message).toContain('POST /test-page');
      expect(context.method).toBe('POST');
    });

    it('should log PUT request errors correctly', async () => {
      // Arrange
      mockContext.request.method = 'PUT';
      const testError = new Error('PUT error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const [message, context] = (logger.critical as any).mock.calls[0];
      expect(message).toContain('PUT /test-page');
      expect(context.method).toBe('PUT');
    });

    it('should log DELETE request errors correctly', async () => {
      // Arrange
      mockContext.request.method = 'DELETE';
      const testError = new Error('DELETE error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const [message, context] = (logger.critical as any).mock.calls[0];
      expect(message).toContain('DELETE /test-page');
      expect(context.method).toBe('DELETE');
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors when user info is not available in context', async () => {
      // Arrange
      mockContext.locals = {}; // No user info
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalled();
      const [, context] = (logger.critical as any).mock.calls[0];
      expect(context.userId).toBeUndefined();
      expect(context.userEmail).toBeUndefined();
      expect(context.userRole).toBeUndefined();
      // Should still have request info
      expect(context.requestId).toBe('test-request-id-12345');
      expect(context.pathname).toBe('/test-page');
    });

    it('should handle missing headers gracefully', async () => {
      // Arrange
      mockContext.request.headers.get = vi.fn(() => null);
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(logger.critical).toHaveBeenCalled();
      const [, context] = (logger.critical as any).mock.calls[0];
      expect(context.userAgent).toBeNull();
      expect(context.referer).toBeNull();
    });

    it('should handle errors on different pathnames', async () => {
      // Arrange
      mockContext.url = new URL('http://localhost:4321/api/products/123');
      const testError = new Error('API error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      const [message, context] = (logger.critical as any).mock.calls[0];
      expect(message).toContain('/api/products/123');
      expect(context.pathname).toBe('/api/products/123');
    });
  });

  describe('Integration - Cookie Expiration', () => {
    it('should set cookie max age to 5 minutes (300 seconds)', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_request_id',
        expect.any(String),
        expect.objectContaining({ maxAge: 300 })
      );
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_message',
        expect.any(String),
        expect.objectContaining({ maxAge: 300 })
      );
    });

    it('should set cookies with strict sameSite policy', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_request_id',
        expect.any(String),
        expect.objectContaining({ sameSite: 'strict' })
      );
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_message',
        expect.any(String),
        expect.objectContaining({ sameSite: 'strict' })
      );
    });

    it('should set cookies as non-httpOnly for error page access', async () => {
      // Arrange
      const testError = new Error('Test error');
      mockNext.mockRejectedValue(testError);

      // Act
      await errorBoundary(mockContext, mockNext);

      // Assert
      // Error cookies need to be accessible to the error page
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_request_id',
        expect.any(String),
        expect.objectContaining({ httpOnly: false })
      );
      expect(mockContext.cookies.set).toHaveBeenCalledWith(
        'error_message',
        expect.any(String),
        expect.objectContaining({ httpOnly: false })
      );
    });
  });
});
