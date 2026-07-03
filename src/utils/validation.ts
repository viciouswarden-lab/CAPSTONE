/**
 * Input Validation Utilities
 * 
 * Provides reusable validation functions for data accuracy throughout the system.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6
 */

/**
 * Validation error with field context
 */
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(`Validation error in ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Create a successful validation result
 */
function validResult(): ValidationResult {
  return { isValid: true, errors: [] };
}

/**
 * Create a failed validation result
 */
function invalidResult(errors: ValidationError[]): ValidationResult {
  return { isValid: false, errors };
}

/**
 * Validate required field is present and not empty
 * 
 * Requirement 21.1: THE System SHALL validate required fields before accepting form submissions
 * 
 * @param value - Value to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push(new ValidationError(fieldName, 'This field is required'));
    return invalidResult(errors);
  }

  if (typeof value === 'string' && value.trim() === '') {
    errors.push(new ValidationError(fieldName, 'This field cannot be empty'));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate multiple required fields
 * 
 * Requirement 21.1: THE System SHALL validate required fields before accepting form submissions
 * 
 * @param fields - Object with field names and values
 * @returns Validation result
 */
export function validateRequiredFields(fields: Record<string, any>): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    const result = validateRequired(value, fieldName);
    if (!result.isValid) {
      errors.push(...result.errors);
    }
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validate data type is a number
 * 
 * Requirement 21.2: THE System SHALL validate data types and formats for numeric, date, and email fields
 * 
 * @param value - Value to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateNumber(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    errors.push(new ValidationError(fieldName, 'Must be a valid number'));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate data type is a date
 * 
 * Requirement 21.2: THE System SHALL validate data types and formats for numeric, date, and email fields
 * 
 * @param value - Value to validate (Date object or ISO string)
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateDate(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      errors.push(new ValidationError(fieldName, 'Invalid date'));
      return invalidResult(errors);
    }
    return validResult();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      errors.push(new ValidationError(fieldName, 'Invalid date format'));
      return invalidResult(errors);
    }
    return validResult();
  }

  errors.push(new ValidationError(fieldName, 'Must be a valid date'));
  return invalidResult(errors);
}

/**
 * Validate email format
 * 
 * Requirement 21.2: THE System SHALL validate data types and formats for numeric, date, and email fields
 * 
 * @param value - Email address to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateEmail(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value !== 'string') {
    errors.push(new ValidationError(fieldName, 'Email must be a string'));
    return invalidResult(errors);
  }

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    errors.push(new ValidationError(fieldName, 'Invalid email format'));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate quantity is a positive number
 * 
 * Requirement 21.5: THE System SHALL validate quantity values to ensure they are positive numbers
 * 
 * @param value - Quantity value to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validatePositiveQuantity(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  // First validate it's a number
  const numberResult = validateNumber(value, fieldName);
  if (!numberResult.isValid) {
    return numberResult;
  }

  // Then validate it's positive
  if (value <= 0) {
    errors.push(new ValidationError(fieldName, 'Quantity must be a positive number'));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate price is a non-negative number with maximum two decimal places
 * 
 * Requirement 21.6: THE System SHALL validate price values to ensure they are 
 * non-negative numbers with maximum two decimal places
 * 
 * @param value - Price value to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validatePrice(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  // First validate it's a number
  const numberResult = validateNumber(value, fieldName);
  if (!numberResult.isValid) {
    return numberResult;
  }

  // Validate it's non-negative
  if (value < 0) {
    errors.push(new ValidationError(fieldName, 'Price must be non-negative'));
    return invalidResult(errors);
  }

  // Validate maximum two decimal places
  const decimalPlaces = (value.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push(new ValidationError(fieldName, 'Price must have maximum two decimal places'));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate SKU format and non-emptiness
 * 
 * Requirement 21.4: WHEN a user enters a duplicate SKU, THE System SHALL reject 
 * the entry and display a validation error (format validation part)
 * 
 * @param value - SKU value to validate
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateSKUFormat(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value !== 'string') {
    errors.push(new ValidationError(fieldName, 'SKU must be a string'));
    return invalidResult(errors);
  }

  const trimmedSKU = value.trim();
  
  if (trimmedSKU === '') {
    errors.push(new ValidationError(fieldName, 'SKU cannot be empty'));
    return invalidResult(errors);
  }

  // SKU should not contain only whitespace or special characters that could cause issues
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedSKU)) {
    errors.push(new ValidationError(
      fieldName, 
      'SKU must contain only letters, numbers, hyphens, and underscores'
    ));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate SKU uniqueness against existing SKUs
 * 
 * Requirement 21.4: WHEN a user enters a duplicate SKU, THE System SHALL reject 
 * the entry and display a validation error
 * 
 * @param sku - SKU to validate
 * @param existingSKUs - Array of existing SKUs to check against
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateSKUUniqueness(
  sku: string, 
  existingSKUs: string[], 
  fieldName: string = 'sku'
): ValidationResult {
  const errors: ValidationError[] = [];

  // First validate SKU format
  const formatResult = validateSKUFormat(sku, fieldName);
  if (!formatResult.isValid) {
    return formatResult;
  }

  // Check uniqueness (case-insensitive)
  const normalizedSKU = sku.trim().toUpperCase();
  const isDuplicate = existingSKUs.some(
    existingSKU => existingSKU.trim().toUpperCase() === normalizedSKU
  );

  if (isDuplicate) {
    errors.push(new ValidationError(fieldName, `SKU "${sku}" already exists`));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate a complete form object with multiple validation rules
 * 
 * @param data - Form data object
 * @param rules - Validation rules for each field
 * @returns Validation result
 */
export function validateForm(
  data: Record<string, any>,
  rules: Record<string, ((value: any, fieldName: string) => ValidationResult)[]>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [fieldName, validators] of Object.entries(rules)) {
    const value = data[fieldName];
    
    for (const validator of validators) {
      const result = validator(value, fieldName);
      if (!result.isValid) {
        errors.push(...result.errors);
        // Stop validating this field on first error
        break;
      }
    }
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validate numeric range
 * 
 * @param value - Number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateRange(
  value: any, 
  min: number, 
  max: number, 
  fieldName: string
): ValidationResult {
  const errors: ValidationError[] = [];

  // First validate it's a number
  const numberResult = validateNumber(value, fieldName);
  if (!numberResult.isValid) {
    return numberResult;
  }

  if (value < min || value > max) {
    errors.push(new ValidationError(
      fieldName, 
      `Must be between ${min} and ${max}`
    ));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Validate string length
 * 
 * @param value - String to validate
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @param fieldName - Name of the field for error reporting
 * @returns Validation result
 */
export function validateStringLength(
  value: any,
  minLength: number,
  maxLength: number,
  fieldName: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value !== 'string') {
    errors.push(new ValidationError(fieldName, 'Must be a string'));
    return invalidResult(errors);
  }

  const length = value.length;

  if (length < minLength) {
    errors.push(new ValidationError(
      fieldName,
      `Must be at least ${minLength} characters long`
    ));
    return invalidResult(errors);
  }

  if (length > maxLength) {
    errors.push(new ValidationError(
      fieldName,
      `Must be at most ${maxLength} characters long`
    ));
    return invalidResult(errors);
  }

  return validResult();
}

/**
 * Helper to extract error messages from validation result
 * 
 * @param result - Validation result
 * @returns Array of error messages
 */
export function getValidationMessages(result: ValidationResult): string[] {
  return result.errors.map(err => err.message);
}

/**
 * Helper to get validation errors grouped by field
 * 
 * @param result - Validation result
 * @returns Object with field names as keys and error messages as values
 */
export function getValidationErrorsByField(result: ValidationResult): Record<string, string[]> {
  const errorsByField: Record<string, string[]> = {};

  for (const error of result.errors) {
    if (!errorsByField[error.field]) {
      errorsByField[error.field] = [];
    }
    errorsByField[error.field].push(error.message);
  }

  return errorsByField;
}
