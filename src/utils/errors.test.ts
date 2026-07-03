/**
 * Unit tests for error response utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorCodes,
  generateRequestId,
  createErrorResponse,
  ValidationErrorFactory,
  ParseErrorFactory,
  BusinessLogicErrorFactory,
  DatabaseErrorFactory,
  AuthErrorFactory,
  ExternalServiceErrorFactory,
  SystemErrorFactory,
  toErrorResponse,
  isErrorResponse,
  type ErrorResponse,
} from './errors';

describe('Error Response Utilities', () => {
  describe('generateRequestId', () => {
    it('should generate a valid UUID', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createErrorResponse', () => {
    it('should create a basic error response', () => {
      const response = createErrorResponse('TEST_ERROR', 'Test message');
      
      expect(response.error.code).toBe('TEST_ERROR');
      expect(response.error.message).toBe('Test message');
      expect(response.error.timestamp).toBeDefined();
      expect(response.error.requestId).toBeDefined();
    });

    it('should include details when provided', () => {
      const details = { field: 'testField', value: 123 };
      const response = createErrorResponse('TEST_ERROR', 'Test message', details);
      
      expect(response.error.details).toEqual(details);
    });

    it('should use provided requestId', () => {
      const requestId = 'test-request-id';
      const response = createErrorResponse('TEST_ERROR', 'Test message', undefined, requestId);
      
      expect(response.error.requestId).toBe(requestId);
    });

    it('should generate timestamp in ISO format', () => {
      const response = createErrorResponse('TEST_ERROR', 'Test message');
      const timestamp = new Date(response.error.timestamp);
      
      expect(timestamp.toISOString()).toBe(response.error.timestamp);
    });
  });

  describe('ValidationErrorFactory', () => {
    it('should create missing field error', () => {
      const error = ValidationErrorFactory.missingField('username');
      
      expect(error.error.code).toBe(ErrorCodes.MISSING_FIELD);
      expect(error.error.message).toContain('username');
      expect(error.error.details.field).toBe('username');
    });

    it('should create invalid data type error', () => {
      const error = ValidationErrorFactory.invalidDataType('age', 'number', 'string');
      
      expect(error.error.code).toBe(ErrorCodes.INVALID_DATA_TYPE);
      expect(error.error.message).toContain('age');
      expect(error.error.message).toContain('number');
      expect(error.error.message).toContain('string');
      expect(error.error.details.expectedType).toBe('number');
      expect(error.error.details.actualType).toBe('string');
    });

    it('should create duplicate SKU error', () => {
      const error = ValidationErrorFactory.duplicateSKU('SKU001');
      
      expect(error.error.code).toBe(ErrorCodes.DUPLICATE_SKU);
      expect(error.error.message).toContain('SKU001');
      expect(error.error.details.sku).toBe('SKU001');
    });

    it('should create negative quantity error', () => {
      const error = ValidationErrorFactory.negativeQuantity('quantity', -5);
      
      expect(error.error.code).toBe(ErrorCodes.NEGATIVE_QUANTITY);
      expect(error.error.message).toContain('quantity');
      expect(error.error.message).toContain('-5');
      expect(error.error.details.value).toBe(-5);
    });

    it('should create invalid price error', () => {
      const error = ValidationErrorFactory.invalidPrice('price', 99.999, 'too many decimals');
      
      expect(error.error.code).toBe(ErrorCodes.INVALID_PRICE);
      expect(error.error.message).toContain('price');
      expect(error.error.message).toContain('too many decimals');
      expect(error.error.details.value).toBe(99.999);
    });

    it('should create multiple errors response', () => {
      const fieldErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ];
      const error = ValidationErrorFactory.multipleErrors(fieldErrors);
      
      expect(error.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.error.details.fieldErrors).toEqual(fieldErrors);
    });
  });

  describe('ParseErrorFactory', () => {
    it('should create corrupted file error', () => {
      const error = ParseErrorFactory.corruptedFile('pricelist.csv', 'unexpected end of file');
      
      expect(error.error.code).toBe(ErrorCodes.CORRUPTED_FILE);
      expect(error.error.message).toContain('pricelist.csv');
      expect(error.error.message).toContain('unexpected end of file');
      expect(error.error.details.fileName).toBe('pricelist.csv');
    });

    it('should create missing columns error', () => {
      const missingColumns = ['price', 'sku'];
      const error = ParseErrorFactory.missingColumns('invoice.xlsx', missingColumns);
      
      expect(error.error.code).toBe(ErrorCodes.MISSING_COLUMNS);
      expect(error.error.message).toContain('invoice.xlsx');
      expect(error.error.message).toContain('price');
      expect(error.error.message).toContain('sku');
      expect(error.error.details.missingColumns).toEqual(missingColumns);
    });

    it('should create encoding error', () => {
      const error = ParseErrorFactory.encodingError('data.csv', 'UTF-8');
      
      expect(error.error.code).toBe(ErrorCodes.ENCODING_ERROR);
      expect(error.error.message).toContain('data.csv');
      expect(error.error.message).toContain('UTF-8');
    });

    it('should create unsupported format error', () => {
      const error = ParseErrorFactory.unsupportedFormat('doc.txt', 'txt', ['csv', 'xlsx', 'pdf']);
      
      expect(error.error.code).toBe(ErrorCodes.UNSUPPORTED_FORMAT);
      expect(error.error.message).toContain('txt');
      expect(error.error.message).toContain('csv');
      expect(error.error.details.supportedFormats).toContain('csv');
    });

    it('should create parse failure error', () => {
      const error = ParseErrorFactory.parseFailure('data.csv', 'row 5', 'invalid number format');
      
      expect(error.error.code).toBe(ErrorCodes.PARSE_ERROR);
      expect(error.error.message).toContain('data.csv');
      expect(error.error.message).toContain('row 5');
      expect(error.error.message).toContain('invalid number format');
      expect(error.error.details.location).toBe('row 5');
    });
  });

  describe('BusinessLogicErrorFactory', () => {
    it('should create insufficient inventory error', () => {
      const error = BusinessLogicErrorFactory.insufficientInventory('SKU001', 10, 5);
      
      expect(error.error.code).toBe(ErrorCodes.INSUFFICIENT_INVENTORY);
      expect(error.error.message).toContain('SKU001');
      expect(error.error.message).toContain('10');
      expect(error.error.message).toContain('5');
      expect(error.error.details.shortage).toBe(5);
    });

    it('should create invoice variance error', () => {
      const error = BusinessLogicErrorFactory.invoiceVariance('INV001', 'Item A', 100, 110, 10);
      
      expect(error.error.code).toBe(ErrorCodes.INVOICE_VARIANCE);
      expect(error.error.message).toContain('INV001');
      expect(error.error.message).toContain('Item A');
      expect(error.error.details.variance).toBe(10);
      expect(error.error.details.variancePercent).toBe(10);
    });

    it('should create negative margin error', () => {
      const error = BusinessLogicErrorFactory.negativeMargin('SKU002', 100, 90);
      
      expect(error.error.code).toBe(ErrorCodes.NEGATIVE_MARGIN);
      expect(error.error.message).toContain('SKU002');
      expect(error.error.details.cost).toBe(100);
      expect(error.error.details.proposedPrice).toBe(90);
      expect(error.error.details.margin).toBe(-10);
    });

    it('should create receiving variance error', () => {
      const error = BusinessLogicErrorFactory.receivingVariance('REC001', 'SKU003', 100, 95, 5);
      
      expect(error.error.code).toBe(ErrorCodes.RECEIVING_VARIANCE);
      expect(error.error.message).toContain('REC001');
      expect(error.error.message).toContain('SKU003');
      expect(error.error.details.variance).toBe(-5);
    });

    it('should create low stock error', () => {
      const error = BusinessLogicErrorFactory.lowStock('SKU004', 5, 10);
      
      expect(error.error.code).toBe(ErrorCodes.LOW_STOCK);
      expect(error.error.message).toContain('SKU004');
      expect(error.error.details.shortage).toBe(5);
    });

    it('should create business rule violation error', () => {
      const error = BusinessLogicErrorFactory.businessRuleViolation('Custom rule', { custom: 'data' });
      
      expect(error.error.code).toBe(ErrorCodes.BUSINESS_LOGIC_ERROR);
      expect(error.error.message).toContain('Custom rule');
      expect(error.error.details.custom).toBe('data');
    });
  });

  describe('DatabaseErrorFactory', () => {
    it('should create Firestore failure error', () => {
      const error = DatabaseErrorFactory.firestoreFailure('write', 'products');
      
      expect(error.error.code).toBe(ErrorCodes.FIRESTORE_FAILURE);
      expect(error.error.message).toContain('write');
      expect(error.error.message).toContain('products');
      expect(error.error.details.operation).toBe('write');
      expect(error.error.details.collection).toBe('products');
    });

    it('should create network timeout error', () => {
      const error = DatabaseErrorFactory.networkTimeout('query', 5000);
      
      expect(error.error.code).toBe(ErrorCodes.NETWORK_TIMEOUT);
      expect(error.error.message).toContain('query');
      expect(error.error.message).toContain('5000');
      expect(error.error.details.timeoutMs).toBe(5000);
    });

    it('should create conflict error', () => {
      const error = DatabaseErrorFactory.conflict('Product', 'SKU001');
      
      expect(error.error.code).toBe(ErrorCodes.CONFLICT);
      expect(error.error.message).toContain('Product');
      expect(error.error.message).toContain('SKU001');
      expect(error.error.details.resourceType).toBe('Product');
      expect(error.error.details.resourceId).toBe('SKU001');
    });

    it('should create transaction failed error', () => {
      const error = DatabaseErrorFactory.transactionFailed('deadlock detected');
      
      expect(error.error.code).toBe(ErrorCodes.TRANSACTION_FAILED);
      expect(error.error.message).toContain('deadlock detected');
    });

    it('should create generic database error', () => {
      const error = DatabaseErrorFactory.databaseError('Connection failed', { host: 'localhost' });
      
      expect(error.error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.error.message).toBe('Connection failed');
      expect(error.error.details.host).toBe('localhost');
    });
  });

  describe('AuthErrorFactory', () => {
    it('should create invalid credentials error', () => {
      const error = AuthErrorFactory.invalidCredentials();
      
      expect(error.error.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
      expect(error.error.message).toContain('Invalid email or password');
    });

    it('should create expired session error', () => {
      const error = AuthErrorFactory.expiredSession();
      
      expect(error.error.code).toBe(ErrorCodes.EXPIRED_SESSION);
      expect(error.error.message).toContain('expired');
    });

    it('should create insufficient permissions error', () => {
      const error = AuthErrorFactory.insufficientPermissions('admin', 'user');
      
      expect(error.error.code).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
      expect(error.error.message).toContain('admin');
      expect(error.error.details.requiredPermission).toBe('admin');
      expect(error.error.details.userRole).toBe('user');
    });

    it('should create account locked error', () => {
      const unlockTime = new Date('2025-12-31T10:00:00Z');
      const error = AuthErrorFactory.accountLocked(unlockTime);
      
      expect(error.error.code).toBe(ErrorCodes.ACCOUNT_LOCKED);
      expect(error.error.message).toContain('locked');
      expect(error.error.details.unlockTime).toBe(unlockTime.toISOString());
    });

    it('should create generic auth error', () => {
      const error = AuthErrorFactory.authError('Custom auth error', { user: 'john' });
      
      expect(error.error.code).toBe(ErrorCodes.AUTH_ERROR);
      expect(error.error.message).toBe('Custom auth error');
      expect(error.error.details.user).toBe('john');
    });
  });

  describe('ExternalServiceErrorFactory', () => {
    it('should create AI service unavailable error', () => {
      const error = ExternalServiceErrorFactory.aiServiceUnavailable('product matching');
      
      expect(error.error.code).toBe(ErrorCodes.AI_SERVICE_UNAVAILABLE);
      expect(error.error.message).toContain('product matching');
      expect(error.error.details.operation).toBe('product matching');
    });

    it('should create payment timeout error', () => {
      const error = ExternalServiceErrorFactory.paymentTimeout('credit card');
      
      expect(error.error.code).toBe(ErrorCodes.PAYMENT_TIMEOUT);
      expect(error.error.message).toContain('credit card');
    });

    it('should create service unavailable error', () => {
      const error = ExternalServiceErrorFactory.serviceUnavailable('Email Service');
      
      expect(error.error.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
      expect(error.error.message).toContain('Email Service');
      expect(error.error.details.serviceName).toBe('Email Service');
    });

    it('should create generic external service error', () => {
      const error = ExternalServiceErrorFactory.externalServiceError('API', 'Rate limit exceeded', { limit: 100 });
      
      expect(error.error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
      expect(error.error.message).toContain('API');
      expect(error.error.message).toContain('Rate limit');
      expect(error.error.details.limit).toBe(100);
    });
  });

  describe('SystemErrorFactory', () => {
    it('should create unexpected error', () => {
      const originalError = new Error('Something went wrong');
      const error = SystemErrorFactory.unexpectedError(originalError);
      
      expect(error.error.code).toBe(ErrorCodes.UNEXPECTED_ERROR);
      expect(error.error.message).toContain('unexpected');
      expect(error.error.details.name).toBe('Error');
      expect(error.error.details.message).toBe('Something went wrong');
    });

    it('should create unexpected error without original error', () => {
      const error = SystemErrorFactory.unexpectedError();
      
      expect(error.error.code).toBe(ErrorCodes.UNEXPECTED_ERROR);
      expect(error.error.details).toBeUndefined();
    });

    it('should create configuration error', () => {
      const error = SystemErrorFactory.configurationError('DATABASE_URL', 'missing value');
      
      expect(error.error.code).toBe(ErrorCodes.CONFIGURATION_ERROR);
      expect(error.error.message).toContain('DATABASE_URL');
      expect(error.error.message).toContain('missing value');
      expect(error.error.details.configKey).toBe('DATABASE_URL');
    });

    it('should create not found error', () => {
      const error = SystemErrorFactory.notFound('Product', 'SKU999');
      
      expect(error.error.code).toBe(ErrorCodes.NOT_FOUND);
      expect(error.error.message).toContain('Product');
      expect(error.error.message).toContain('SKU999');
      expect(error.error.details.resourceType).toBe('Product');
      expect(error.error.details.resourceId).toBe('SKU999');
    });

    it('should create generic system error', () => {
      const error = SystemErrorFactory.systemError('System overload', { cpu: 95 });
      
      expect(error.error.code).toBe(ErrorCodes.SYSTEM_ERROR);
      expect(error.error.message).toBe('System overload');
      expect(error.error.details.cpu).toBe(95);
    });
  });

  describe('toErrorResponse', () => {
    it('should return ErrorResponse as is', () => {
      const errorResponse = createErrorResponse('TEST_ERROR', 'Test message');
      const result = toErrorResponse(errorResponse);
      
      expect(result).toBe(errorResponse);
    });

    it('should convert Error to ErrorResponse', () => {
      const error = new Error('Test error');
      const result = toErrorResponse(error);
      
      expect(result.error.code).toBe(ErrorCodes.UNEXPECTED_ERROR);
      expect(result.error.details.message).toBe('Test error');
    });

    it('should convert string to ErrorResponse', () => {
      const result = toErrorResponse('String error');
      
      expect(result.error.code).toBe(ErrorCodes.SYSTEM_ERROR);
      expect(result.error.message).toContain('String error');
    });

    it('should handle unknown error types', () => {
      const result = toErrorResponse({ weird: 'object' });
      
      expect(result.error.code).toBe(ErrorCodes.SYSTEM_ERROR);
    });

    it('should use provided requestId', () => {
      const requestId = 'custom-request-id';
      const result = toErrorResponse(new Error('Test'), requestId);
      
      expect(result.error.requestId).toBe(requestId);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for valid ErrorResponse', () => {
      const errorResponse = createErrorResponse('TEST_ERROR', 'Test message');
      expect(isErrorResponse(errorResponse)).toBe(true);
    });

    it('should return false for non-ErrorResponse objects', () => {
      expect(isErrorResponse({ code: 'ERROR' })).toBe(false);
      expect(isErrorResponse({ error: 'string' })).toBe(false);
      expect(isErrorResponse(null)).toBe(false);
      expect(isErrorResponse(undefined)).toBe(false);
      expect(isErrorResponse('string')).toBe(false);
      expect(isErrorResponse(123)).toBe(false);
    });

    it('should return false for incomplete ErrorResponse', () => {
      const incomplete = {
        error: {
          code: 'TEST',
          message: 'Test',
          // missing timestamp and requestId
        },
      };
      expect(isErrorResponse(incomplete)).toBe(false);
    });

    it('should return true for ErrorResponse with optional details', () => {
      const withDetails = createErrorResponse('TEST', 'Message', { extra: 'data' });
      expect(isErrorResponse(withDetails)).toBe(true);
    });
  });

  describe('Error Codes', () => {
    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCodes);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should have all expected error code categories', () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCodes.PARSE_ERROR).toBeDefined();
      expect(ErrorCodes.BUSINESS_LOGIC_ERROR).toBeDefined();
      expect(ErrorCodes.DATABASE_ERROR).toBeDefined();
      expect(ErrorCodes.AUTH_ERROR).toBeDefined();
      expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBeDefined();
      expect(ErrorCodes.SYSTEM_ERROR).toBeDefined();
    });
  });
});
