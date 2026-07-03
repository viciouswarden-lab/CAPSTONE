/**
 * Unit tests for Logger service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger, LogLevel, logger, configureLogger } from './Logger';

describe('Logger', () => {
  let loggerInstance: Logger;
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Get a fresh logger instance
    loggerInstance = Logger.getInstance();
    loggerInstance.setMinLevel(LogLevel.DEBUG); // Enable all levels for testing

    // Spy on console methods
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a default logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
      expect(logger).toBe(Logger.getInstance());
    });
  });

  describe('Log levels', () => {
    it('should log DEBUG messages', () => {
      loggerInstance.debug('Debug message', { test: 'value' });
      
      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe(LogLevel.DEBUG);
      expect(logOutput.message).toBe('Debug message');
      expect(logOutput.context).toEqual({ test: 'value' });
      expect(logOutput.timestamp).toBeDefined();
    });

    it('should log INFO messages', () => {
      loggerInstance.info('Info message', { test: 'value' });
      
      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe(LogLevel.INFO);
      expect(logOutput.message).toBe('Info message');
    });

    it('should log WARN messages', () => {
      loggerInstance.warn('Warning message', { test: 'value' });
      
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe(LogLevel.WARN);
      expect(logOutput.message).toBe('Warning message');
    });

    it('should log ERROR messages', () => {
      const error = new Error('Test error');
      loggerInstance.error('Error message', { test: 'value' }, error);
      
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe(LogLevel.ERROR);
      expect(logOutput.message).toBe('Error message');
      expect(logOutput.error).toBeDefined();
      expect(logOutput.error.message).toBe('Test error');
      expect(logOutput.error.stack).toBeDefined();
    });

    it('should log CRITICAL messages', () => {
      const error = new Error('Critical error');
      loggerInstance.critical('Critical message', { test: 'value' }, error);
      
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe(LogLevel.CRITICAL);
      expect(logOutput.message).toBe('Critical message');
    });
  });

  describe('Minimum log level filtering', () => {
    it('should suppress logs below minimum level', () => {
      loggerInstance.setMinLevel(LogLevel.WARN);
      
      loggerInstance.debug('Debug message');
      loggerInstance.info('Info message');
      loggerInstance.warn('Warn message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });

    it('should log messages at or above minimum level', () => {
      loggerInstance.setMinLevel(LogLevel.ERROR);
      
      loggerInstance.warn('Warn message');
      loggerInstance.error('Error message');
      loggerInstance.critical('Critical message');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Sensitive data redaction', () => {
    it('should redact password fields', () => {
      loggerInstance.info('User action', {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.username).toBe('testuser');
      expect(logOutput.context.password).toBe('[REDACTED]');
      expect(logOutput.context.email).toBe('test@example.com');
    });

    it('should redact token fields', () => {
      loggerInstance.info('Auth action', {
        userId: '123',
        accessToken: 'abc123',
        refreshToken: 'xyz789',
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.userId).toBe('123');
      expect(logOutput.context.accessToken).toBe('[REDACTED]');
      expect(logOutput.context.refreshToken).toBe('[REDACTED]');
    });

    it('should redact payment information', () => {
      loggerInstance.info('Payment processed', {
        orderId: 'ORD-123',
        cardNumber: '4111111111111111',
        cvv: '123',
        amount: 99.99,
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.orderId).toBe('ORD-123');
      expect(logOutput.context.cardNumber).toBe('[REDACTED]');
      expect(logOutput.context.cvv).toBe('[REDACTED]');
      expect(logOutput.context.amount).toBe(99.99);
    });

    it('should redact sensitive fields in nested objects', () => {
      loggerInstance.info('User update', {
        user: {
          id: '123',
          username: 'testuser',
          password: 'secret',
        },
        metadata: {
          apiKey: 'key123',
          timestamp: '2024-01-01',
        },
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.user.username).toBe('testuser');
      expect(logOutput.context.user.password).toBe('[REDACTED]');
      expect(logOutput.context.metadata.apiKey).toBe('[REDACTED]');
      expect(logOutput.context.metadata.timestamp).toBe('2024-01-01');
    });

    it('should redact sensitive fields in arrays', () => {
      loggerInstance.info('Batch operation', {
        users: [
          { id: '1', username: 'user1', password: 'pass1' },
          { id: '2', username: 'user2', password: 'pass2' },
        ],
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.users[0].password).toBe('[REDACTED]');
      expect(logOutput.context.users[1].password).toBe('[REDACTED]');
      expect(logOutput.context.users[0].username).toBe('user1');
    });

    it('should handle null and undefined values', () => {
      loggerInstance.info('Test nulls', {
        nullValue: null,
        undefinedValue: undefined,
        password: 'secret',
      });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.context.nullValue).toBeNull();
      expect(logOutput.context.undefinedValue).toBeUndefined();
      expect(logOutput.context.password).toBe('[REDACTED]');
    });
  });

  describe('Log formatting', () => {
    it('should include timestamp in ISO format', () => {
      loggerInstance.info('Test message');
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      const timestamp = new Date(logOutput.timestamp);
      expect(timestamp.toISOString()).toBe(logOutput.timestamp);
    });

    it('should format logs as JSON', () => {
      loggerInstance.info('Test message', { key: 'value' });
      
      const logString = consoleInfoSpy.mock.calls[0][0];
      expect(() => JSON.parse(logString)).not.toThrow();
    });

    it('should include error details when provided', () => {
      const error = new Error('Test error');
      error.name = 'TestError';
      
      loggerInstance.error('Error occurred', {}, error);
      
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error).toBeDefined();
      expect(logOutput.error.message).toBe('Test error');
      expect(logOutput.error.name).toBe('TestError');
      expect(logOutput.error.stack).toBeDefined();
    });
  });

  describe('Specialized logging methods', () => {
    describe('logAuthAttempt', () => {
      it('should log successful authentication at INFO level', () => {
        loggerInstance.logAuthAttempt('user@example.com', true, '192.168.1.1');
        
        expect(consoleInfoSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.INFO);
        expect(logOutput.message).toContain('Authentication successful');
        expect(logOutput.context.email).toBe('user@example.com');
        expect(logOutput.context.success).toBe(true);
        expect(logOutput.context.ipAddress).toBe('192.168.1.1');
      });

      it('should log failed authentication at WARN level', () => {
        loggerInstance.logAuthAttempt(
          'user@example.com',
          false,
          '192.168.1.1',
          'Invalid password'
        );
        
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.WARN);
        expect(logOutput.message).toContain('Authentication failed');
        expect(logOutput.context.email).toBe('user@example.com');
        expect(logOutput.context.success).toBe(false);
        expect(logOutput.context.ipAddress).toBe('192.168.1.1');
        expect(logOutput.context.failureReason).toBe('Invalid password');
      });

      it('should work without optional parameters', () => {
        loggerInstance.logAuthAttempt('user@example.com', true);
        
        const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
        expect(logOutput.context.email).toBe('user@example.com');
        expect(logOutput.context.ipAddress).toBeUndefined();
      });
    });

    describe('logParseError', () => {
      it('should log parse error with file metadata', () => {
        loggerInstance.logParseError('pricelist.csv', 'Missing required column: price', {
          fileSize: 1024,
          mimeType: 'text/csv',
          uploadedBy: 'user@example.com',
        });
        
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.WARN);
        expect(logOutput.message).toContain('Parse error in file: pricelist.csv');
        expect(logOutput.context.fileName).toBe('pricelist.csv');
        expect(logOutput.context.errorMessage).toBe('Missing required column: price');
        expect(logOutput.context.fileSize).toBe(1024);
        expect(logOutput.context.mimeType).toBe('text/csv');
        expect(logOutput.context.uploadedBy).toBe('user@example.com');
        expect(logOutput.context.category).toBe('parse_error');
      });

      it('should work without optional metadata', () => {
        loggerInstance.logParseError('pricelist.csv', 'Parse failed');
        
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.context.fileName).toBe('pricelist.csv');
        expect(logOutput.context.errorMessage).toBe('Parse failed');
        expect(logOutput.context.fileSize).toBeUndefined();
      });
    });

    describe('logBusinessRuleViolation', () => {
      it('should log business rule violation without override', () => {
        loggerInstance.logBusinessRuleViolation(
          'Negative margin not allowed',
          { sku: 'SKU-123', cost: 100, price: 90 }
        );
        
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.WARN);
        expect(logOutput.message).toContain('Business rule violation:');
        expect(logOutput.context.rule).toBe('Negative margin not allowed');
        expect(logOutput.context.details.sku).toBe('SKU-123');
        expect(logOutput.context.overridden).toBe(false);
        expect(logOutput.context.category).toBe('business_rule_violation');
      });

      it('should log overridden business rule violation', () => {
        loggerInstance.logBusinessRuleViolation(
          'Negative margin not allowed',
          { sku: 'SKU-123', cost: 100, price: 90 },
          true,
          'admin@example.com'
        );
        
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.message).toContain('overridden');
        expect(logOutput.context.overridden).toBe(true);
        expect(logOutput.context.overriddenBy).toBe('admin@example.com');
        expect(logOutput.context.overrideTimestamp).toBeDefined();
      });

      it('should redact sensitive data in violation details', () => {
        loggerInstance.logBusinessRuleViolation(
          'Test rule',
          { sku: 'SKU-123', password: 'secret' }
        );
        
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.context.details.password).toBe('[REDACTED]');
      });
    });

    describe('logDatabaseError', () => {
      it('should log database error with stack trace', () => {
        const error = new Error('Connection timeout');
        loggerInstance.logDatabaseError('write', 'products', error, {
          sku: 'SKU-123',
          attempt: 1,
        });
        
        expect(consoleErrorSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.ERROR);
        expect(logOutput.message).toContain("Database error during write on collection 'products'");
        expect(logOutput.context.operation).toBe('write');
        expect(logOutput.context.collection).toBe('products');
        expect(logOutput.context.sku).toBe('SKU-123');
        expect(logOutput.context.category).toBe('database_error');
        expect(logOutput.error.message).toBe('Connection timeout');
        expect(logOutput.error.stack).toBeDefined();
      });

      it('should work without additional context', () => {
        const error = new Error('Test error');
        loggerInstance.logDatabaseError('read', 'inventory', error);
        
        const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(logOutput.context.operation).toBe('read');
        expect(logOutput.context.collection).toBe('inventory');
      });
    });

    describe('logExternalServiceError', () => {
      it('should log external service error', () => {
        const error = new Error('Service unavailable');
        loggerInstance.logExternalServiceError('AI Matcher', 'fuzzy match', error, {
          productCode: 'PROD-123',
        });
        
        expect(consoleErrorSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(logOutput.message).toContain("External service 'AI Matcher' failed");
        expect(logOutput.context.serviceName).toBe('AI Matcher');
        expect(logOutput.context.operation).toBe('fuzzy match');
        expect(logOutput.context.productCode).toBe('PROD-123');
        expect(logOutput.context.category).toBe('external_service_error');
      });
    });

    describe('logAccountLockout', () => {
      it('should log account lockout', () => {
        loggerInstance.logAccountLockout(
          'user@example.com',
          'Too many failed login attempts',
          30,
          '192.168.1.1'
        );
        
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.message).toContain('Account locked for user: user@example.com');
        expect(logOutput.context.email).toBe('user@example.com');
        expect(logOutput.context.reason).toBe('Too many failed login attempts');
        expect(logOutput.context.lockDurationMinutes).toBe(30);
        expect(logOutput.context.ipAddress).toBe('192.168.1.1');
        expect(logOutput.context.category).toBe('account_lockout');
      });
    });

    describe('logInventoryAdjustment', () => {
      it('should log inventory adjustment', () => {
        loggerInstance.logInventoryAdjustment(
          'SKU-123',
          100,
          120,
          'receiving',
          'user@example.com'
        );
        
        expect(consoleInfoSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
        expect(logOutput.message).toContain('Inventory adjusted for SKU: SKU-123');
        expect(logOutput.context.sku).toBe('SKU-123');
        expect(logOutput.context.quantityBefore).toBe(100);
        expect(logOutput.context.quantityAfter).toBe(120);
        expect(logOutput.context.quantityChange).toBe(20);
        expect(logOutput.context.reason).toBe('receiving');
        expect(logOutput.context.userId).toBe('user@example.com');
        expect(logOutput.context.category).toBe('inventory_adjustment');
      });
    });

    describe('logPriceChange', () => {
      it('should log non-significant price change at INFO level', () => {
        loggerInstance.logPriceChange('SKU-123', 100, 105, 'SUP-1', false);
        
        expect(consoleInfoSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.INFO);
        expect(logOutput.message).toContain('Price change for SKU: SKU-123');
        expect(logOutput.context.sku).toBe('SKU-123');
        expect(logOutput.context.oldPrice).toBe(100);
        expect(logOutput.context.newPrice).toBe(105);
        expect(logOutput.context.priceChange).toBe(5);
        expect(logOutput.context.percentageChange).toBe('5.00');
        expect(logOutput.context.supplierId).toBe('SUP-1');
        expect(logOutput.context.category).toBe('price_change');
      });

      it('should log significant price change at WARN level', () => {
        loggerInstance.logPriceChange('SKU-123', 100, 120, 'SUP-1', true);
        
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
        expect(logOutput.level).toBe(LogLevel.WARN);
        expect(logOutput.context.significant).toBe(true);
        expect(logOutput.context.percentageChange).toBe('20.00');
      });

      it('should work without optional parameters', () => {
        loggerInstance.logPriceChange('SKU-123', 100, 105);
        
        const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
        expect(logOutput.context.sku).toBe('SKU-123');
        expect(logOutput.context.supplierId).toBeUndefined();
      });
    });
  });

  describe('Configuration', () => {
    it('should configure logger for development environment', () => {
      configureLogger('development');
      
      loggerInstance.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should configure logger for production environment', () => {
      configureLogger('production');
      
      loggerInstance.debug('Debug message');
      loggerInstance.info('Info message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should configure logger for test environment', () => {
      configureLogger('test');
      
      loggerInstance.debug('Debug message');
      loggerInstance.info('Info message');
      loggerInstance.warn('Warn message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
