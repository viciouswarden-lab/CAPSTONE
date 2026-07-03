/**
 * Unit Tests for Input Validation Utilities
 * 
 * Tests validation functions for required fields, data types, numeric constraints,
 * SKU uniqueness, and price decimal places.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateRequired,
  validateRequiredFields,
  validateNumber,
  validateDate,
  validateEmail,
  validatePositiveQuantity,
  validatePrice,
  validateSKUFormat,
  validateSKUUniqueness,
  validateForm,
  validateRange,
  validateStringLength,
  getValidationMessages,
  getValidationErrorsByField,
} from './validation';

describe('Validation Utilities', () => {
  
  describe('validateRequired - Requirement 21.1', () => {
    it('should pass for valid non-empty string', () => {
      const result = validateRequired('test value', 'testField');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for valid number', () => {
      const result = validateRequired(42, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for zero', () => {
      const result = validateRequired(0, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for false boolean', () => {
      const result = validateRequired(false, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should fail for null', () => {
      const result = validateRequired(null, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('testField');
      expect(result.errors[0].message).toContain('required');
    });

    it('should fail for undefined', () => {
      const result = validateRequired(undefined, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('required');
    });

    it('should fail for empty string', () => {
      const result = validateRequired('', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('cannot be empty');
    });

    it('should fail for whitespace-only string', () => {
      const result = validateRequired('   ', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('cannot be empty');
    });
  });

  describe('validateRequiredFields - Requirement 21.1', () => {
    it('should pass when all required fields are present', () => {
      const fields = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };
      const result = validateRequiredFields(fields);
      expect(result.isValid).toBe(true);
    });

    it('should fail when one field is missing', () => {
      const fields = {
        name: 'John Doe',
        email: null,
        age: 30,
      };
      const result = validateRequiredFields(fields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
    });

    it('should fail when multiple fields are missing', () => {
      const fields = {
        name: '',
        email: null,
        age: 30,
      };
      const result = validateRequiredFields(fields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateNumber - Requirement 21.2', () => {
    it('should pass for valid integers', () => {
      const result = validateNumber(42, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for valid decimals', () => {
      const result = validateNumber(3.14, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for zero', () => {
      const result = validateNumber(0, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for negative numbers', () => {
      const result = validateNumber(-5, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should fail for NaN', () => {
      const result = validateNumber(NaN, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('valid number');
    });

    it('should fail for Infinity', () => {
      const result = validateNumber(Infinity, 'testField');
      expect(result.isValid).toBe(false);
    });

    it('should fail for string', () => {
      const result = validateNumber('123', 'testField');
      expect(result.isValid).toBe(false);
    });

    it('should fail for null', () => {
      const result = validateNumber(null, 'testField');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateDate - Requirement 21.2', () => {
    it('should pass for valid Date object', () => {
      const result = validateDate(new Date('2024-01-15'), 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for valid ISO date string', () => {
      const result = validateDate('2024-01-15T10:00:00Z', 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should fail for invalid Date object', () => {
      const result = validateDate(new Date('invalid'), 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid date');
    });

    it('should fail for invalid date string', () => {
      const result = validateDate('not a date', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should fail for number', () => {
      const result = validateDate(12345, 'testField');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateEmail - Requirement 21.2', () => {
    it('should pass for valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.co.uk',
        'user+tag@example.com',
        'user_name@example-domain.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email, 'email');
        expect(result.isValid).toBe(true);
      });
    });

    it('should fail for invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email, 'email');
        expect(result.isValid).toBe(false);
      });
    });

    it('should fail for non-string values', () => {
      const result = validateEmail(123, 'email');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a string');
    });
  });

  describe('validatePositiveQuantity - Requirement 21.5', () => {
    it('should pass for positive integers', () => {
      const result = validatePositiveQuantity(10, 'quantity');
      expect(result.isValid).toBe(true);
    });

    it('should pass for positive decimals', () => {
      const result = validatePositiveQuantity(5.5, 'quantity');
      expect(result.isValid).toBe(true);
    });

    it('should fail for zero', () => {
      const result = validatePositiveQuantity(0, 'quantity');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('positive number');
    });

    it('should fail for negative numbers', () => {
      const result = validatePositiveQuantity(-5, 'quantity');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('positive number');
    });

    it('should fail for non-numeric values', () => {
      const result = validatePositiveQuantity('10', 'quantity');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePrice - Requirement 21.6', () => {
    it('should pass for valid prices with 0 decimals', () => {
      const result = validatePrice(100, 'price');
      expect(result.isValid).toBe(true);
    });

    it('should pass for valid prices with 1 decimal', () => {
      const result = validatePrice(99.9, 'price');
      expect(result.isValid).toBe(true);
    });

    it('should pass for valid prices with 2 decimals', () => {
      const result = validatePrice(99.99, 'price');
      expect(result.isValid).toBe(true);
    });

    it('should pass for zero price', () => {
      const result = validatePrice(0, 'price');
      expect(result.isValid).toBe(true);
    });

    it('should fail for negative prices', () => {
      const result = validatePrice(-10.99, 'price');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('non-negative');
    });

    it('should fail for prices with more than 2 decimal places', () => {
      const result = validatePrice(99.999, 'price');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('maximum two decimal places');
    });

    it('should fail for non-numeric values', () => {
      const result = validatePrice('99.99', 'price');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSKUFormat - Requirement 21.4', () => {
    it('should pass for valid SKU formats', () => {
      const validSKUs = [
        'SKU123',
        'PROD-001',
        'item_456',
        'ABC-123-XYZ',
        'test_product',
      ];

      validSKUs.forEach(sku => {
        const result = validateSKUFormat(sku, 'sku');
        expect(result.isValid).toBe(true);
      });
    });

    it('should fail for empty SKU', () => {
      const result = validateSKUFormat('', 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('cannot be empty');
    });

    it('should fail for whitespace-only SKU', () => {
      const result = validateSKUFormat('   ', 'sku');
      expect(result.isValid).toBe(false);
    });

    it('should fail for SKU with spaces', () => {
      const result = validateSKUFormat('SKU 123', 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('letters, numbers, hyphens, and underscores');
    });

    it('should fail for SKU with special characters', () => {
      const invalidSKUs = [
        'SKU@123',
        'PROD#001',
        'item$456',
        'test!product',
      ];

      invalidSKUs.forEach(sku => {
        const result = validateSKUFormat(sku, 'sku');
        expect(result.isValid).toBe(false);
      });
    });

    it('should fail for non-string values', () => {
      const result = validateSKUFormat(123, 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a string');
    });
  });

  describe('validateSKUUniqueness - Requirement 21.4', () => {
    const existingSKUs = ['SKU001', 'SKU002', 'PROD-123', 'item_456'];

    it('should pass for unique SKU', () => {
      const result = validateSKUUniqueness('SKU999', existingSKUs, 'sku');
      expect(result.isValid).toBe(true);
    });

    it('should fail for duplicate SKU (exact match)', () => {
      const result = validateSKUUniqueness('SKU001', existingSKUs, 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('already exists');
    });

    it('should fail for duplicate SKU (case-insensitive)', () => {
      const result = validateSKUUniqueness('sku001', existingSKUs, 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('already exists');
    });

    it('should fail for duplicate SKU with extra whitespace', () => {
      const result = validateSKUUniqueness('  SKU001  ', existingSKUs, 'sku');
      expect(result.isValid).toBe(false);
    });

    it('should fail for invalid SKU format before checking uniqueness', () => {
      const result = validateSKUUniqueness('SKU 001', existingSKUs, 'sku');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('letters, numbers, hyphens, and underscores');
    });
  });

  describe('validateForm', () => {
    it('should pass when all validations succeed', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        quantity: 10,
        price: 99.99,
      };

      const rules = {
        name: [validateRequired],
        email: [validateRequired, validateEmail],
        quantity: [validateRequired, validatePositiveQuantity],
        price: [validateRequired, validatePrice],
      };

      const result = validateForm(data, rules);
      expect(result.isValid).toBe(true);
    });

    it('should fail when one field fails validation', () => {
      const data = {
        name: 'John Doe',
        email: 'invalid-email',
        quantity: 10,
      };

      const rules = {
        name: [validateRequired],
        email: [validateRequired, validateEmail],
        quantity: [validateRequired, validatePositiveQuantity],
      };

      const result = validateForm(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should stop at first validation error for each field', () => {
      const data = {
        price: 'invalid',
      };

      const rules = {
        price: [validateRequired, validateNumber, validatePrice],
      };

      const result = validateForm(data, rules);
      expect(result.isValid).toBe(false);
      // Should only have one error (from validateNumber), not from validatePrice
      expect(result.errors.filter(e => e.field === 'price')).toHaveLength(1);
    });

    it('should collect errors from multiple fields', () => {
      const data = {
        name: '',
        email: 'invalid',
        quantity: -5,
      };

      const rules = {
        name: [validateRequired],
        email: [validateEmail],
        quantity: [validatePositiveQuantity],
      };

      const result = validateForm(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('validateRange', () => {
    it('should pass for value within range', () => {
      const result = validateRange(50, 0, 100, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for value at minimum boundary', () => {
      const result = validateRange(0, 0, 100, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for value at maximum boundary', () => {
      const result = validateRange(100, 0, 100, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should fail for value below minimum', () => {
      const result = validateRange(-1, 0, 100, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('between 0 and 100');
    });

    it('should fail for value above maximum', () => {
      const result = validateRange(101, 0, 100, 'testField');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateStringLength', () => {
    it('should pass for string within length range', () => {
      const result = validateStringLength('hello', 1, 10, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for string at minimum length', () => {
      const result = validateStringLength('hello', 5, 10, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass for string at maximum length', () => {
      const result = validateStringLength('hello', 1, 5, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should fail for string too short', () => {
      const result = validateStringLength('hi', 5, 10, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('at least 5 characters');
    });

    it('should fail for string too long', () => {
      const result = validateStringLength('hello world', 1, 5, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('at most 5 characters');
    });

    it('should fail for non-string values', () => {
      const result = validateStringLength(123, 1, 10, 'testField');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Helper functions', () => {
    describe('getValidationMessages', () => {
      it('should extract error messages from validation result', () => {
        const result = {
          isValid: false,
          errors: [
            new ValidationError('field1', 'Error 1'),
            new ValidationError('field2', 'Error 2'),
          ],
        };

        const messages = getValidationMessages(result);
        expect(messages).toHaveLength(2);
        expect(messages[0]).toContain('Error 1');
        expect(messages[1]).toContain('Error 2');
      });

      it('should return empty array for valid result', () => {
        const result = { isValid: true, errors: [] };
        const messages = getValidationMessages(result);
        expect(messages).toHaveLength(0);
      });
    });

    describe('getValidationErrorsByField', () => {
      it('should group errors by field name', () => {
        const result = {
          isValid: false,
          errors: [
            new ValidationError('email', 'Email is required'),
            new ValidationError('email', 'Invalid email format'),
            new ValidationError('quantity', 'Must be positive'),
          ],
        };

        const errorsByField = getValidationErrorsByField(result);
        expect(errorsByField['email']).toHaveLength(2);
        expect(errorsByField['quantity']).toHaveLength(1);
      });

      it('should return empty object for valid result', () => {
        const result = { isValid: true, errors: [] };
        const errorsByField = getValidationErrorsByField(result);
        expect(Object.keys(errorsByField)).toHaveLength(0);
      });
    });
  });

  describe('ValidationError class', () => {
    it('should create error with field and message', () => {
      const error = new ValidationError('testField', 'Test error message');
      expect(error.field).toBe('testField');
      expect(error.message).toContain('testField');
      expect(error.message).toContain('Test error message');
      expect(error.name).toBe('ValidationError');
    });

    it('should be instanceof Error', () => {
      const error = new ValidationError('testField', 'Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
