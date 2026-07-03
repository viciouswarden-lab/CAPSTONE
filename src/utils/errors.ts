/**
 * Error Response Utilities
 * 
 * Provides consistent error response format across all API endpoints
 * and error factories for common error categories.
 * 
 * Requirements 18.2: Error handling with descriptive messages
 */

import { randomUUID } from 'crypto';

/**
 * Standard error response format for all API endpoints
 */
export interface ErrorResponse {
  error: {
    code: string; // e.g., "VALIDATION_ERROR", "PARSE_ERROR"
    message: string; // user-friendly message
    details?: any; // additional context (field errors, etc.)
    timestamp: string;
    requestId: string; // for support troubleshooting
  };
}

/**
 * Error code constants for consistent error classification
 */
export const ErrorCodes = {
  // Validation Errors (1000-1999)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_DATA_TYPE: 'INVALID_DATA_TYPE',
  DUPLICATE_SKU: 'DUPLICATE_SKU',
  NEGATIVE_QUANTITY: 'NEGATIVE_QUANTITY',
  INVALID_PRICE: 'INVALID_PRICE',
  
  // Parse Errors (2000-2999)
  PARSE_ERROR: 'PARSE_ERROR',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  MISSING_COLUMNS: 'MISSING_COLUMNS',
  ENCODING_ERROR: 'ENCODING_ERROR',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  
  // Business Logic Errors (3000-3999)
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  INVOICE_VARIANCE: 'INVOICE_VARIANCE',
  NEGATIVE_MARGIN: 'NEGATIVE_MARGIN',
  RECEIVING_VARIANCE: 'RECEIVING_VARIANCE',
  LOW_STOCK: 'LOW_STOCK',
  
  // Database Errors (4000-4999)
  DATABASE_ERROR: 'DATABASE_ERROR',
  FIRESTORE_FAILURE: 'FIRESTORE_FAILURE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  CONFLICT: 'CONFLICT',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  
  // Auth/Authorization Errors (5000-5999)
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EXPIRED_SESSION: 'EXPIRED_SESSION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // External Service Errors (6000-6999)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  PAYMENT_TIMEOUT: 'PAYMENT_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // System Errors (7000-7999)
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

/**
 * Generate a unique request ID for troubleshooting
 * Format: UUID v4
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a standard error response object
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
    },
  };
}

/**
 * Validation Error Factory
 * Creates error responses for validation failures
 */
export class ValidationErrorFactory {
  /**
   * Missing required field error
   */
  static missingField(fieldName: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.MISSING_FIELD,
      `Required field '${fieldName}' is missing`,
      { field: fieldName },
      requestId
    );
  }

  /**
   * Invalid data type error
   */
  static invalidDataType(
    fieldName: string,
    expectedType: string,
    actualType: string,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INVALID_DATA_TYPE,
      `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`,
      { field: fieldName, expectedType, actualType },
      requestId
    );
  }

  /**
   * Duplicate SKU error
   */
  static duplicateSKU(sku: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.DUPLICATE_SKU,
      `SKU '${sku}' already exists in the system`,
      { sku },
      requestId
    );
  }

  /**
   * Negative quantity error
   */
  static negativeQuantity(fieldName: string, value: number, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.NEGATIVE_QUANTITY,
      `Quantity in field '${fieldName}' must be positive, got ${value}`,
      { field: fieldName, value },
      requestId
    );
  }

  /**
   * Invalid price error
   */
  static invalidPrice(fieldName: string, value: number, reason: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INVALID_PRICE,
      `Price in field '${fieldName}' is invalid: ${reason}`,
      { field: fieldName, value, reason },
      requestId
    );
  }

  /**
   * Generic validation error with multiple field errors
   */
  static multipleErrors(
    fieldErrors: Array<{ field: string; message: string }>,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'One or more validation errors occurred',
      { fieldErrors },
      requestId
    );
  }
}

/**
 * Parse Error Factory
 * Creates error responses for document parsing failures
 */
export class ParseErrorFactory {
  /**
   * Corrupted file error
   */
  static corruptedFile(fileName: string, reason?: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.CORRUPTED_FILE,
      `File '${fileName}' is corrupted or unreadable${reason ? `: ${reason}` : ''}`,
      { fileName, reason },
      requestId
    );
  }

  /**
   * Missing columns error
   */
  static missingColumns(
    fileName: string,
    missingColumns: string[],
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.MISSING_COLUMNS,
      `File '${fileName}' is missing required columns: ${missingColumns.join(', ')}`,
      { fileName, missingColumns },
      requestId
    );
  }

  /**
   * Encoding error
   */
  static encodingError(fileName: string, expectedEncoding?: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.ENCODING_ERROR,
      `File '${fileName}' has encoding issues${expectedEncoding ? `, expected ${expectedEncoding}` : ''}`,
      { fileName, expectedEncoding },
      requestId
    );
  }

  /**
   * Unsupported format error
   */
  static unsupportedFormat(
    fileName: string,
    format: string,
    supportedFormats: string[],
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.UNSUPPORTED_FORMAT,
      `File format '${format}' is not supported. Supported formats: ${supportedFormats.join(', ')}`,
      { fileName, format, supportedFormats },
      requestId
    );
  }

  /**
   * Generic parse error with specific failure reason
   */
  static parseFailure(
    fileName: string,
    location: string,
    reason: string,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.PARSE_ERROR,
      `Failed to parse '${fileName}' at ${location}: ${reason}`,
      { fileName, location, reason },
      requestId
    );
  }
}

/**
 * Business Logic Error Factory
 * Creates error responses for business rule violations
 */
export class BusinessLogicErrorFactory {
  /**
   * Insufficient inventory error
   */
  static insufficientInventory(
    sku: string,
    requested: number,
    available: number,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INSUFFICIENT_INVENTORY,
      `Insufficient inventory for SKU '${sku}': requested ${requested}, available ${available}`,
      { sku, requested, available, shortage: requested - available },
      requestId
    );
  }

  /**
   * Invoice variance error
   */
  static invoiceVariance(
    invoiceNumber: string,
    lineItem: string,
    expectedValue: number,
    actualValue: number,
    variancePercent: number,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INVOICE_VARIANCE,
      `Invoice '${invoiceNumber}' has variance exceeding threshold for item '${lineItem}'`,
      {
        invoiceNumber,
        lineItem,
        expectedValue,
        actualValue,
        variance: actualValue - expectedValue,
        variancePercent,
      },
      requestId
    );
  }

  /**
   * Negative margin error
   */
  static negativeMargin(
    sku: string,
    cost: number,
    proposedPrice: number,
    requestId?: string
  ): ErrorResponse {
    const margin = proposedPrice - cost;
    const marginPercent = ((margin / cost) * 100).toFixed(2);
    
    return createErrorResponse(
      ErrorCodes.NEGATIVE_MARGIN,
      `Proposed price for SKU '${sku}' results in negative margin`,
      { sku, cost, proposedPrice, margin, marginPercent },
      requestId
    );
  }

  /**
   * Receiving variance error
   */
  static receivingVariance(
    receivingId: string,
    sku: string,
    expected: number,
    received: number,
    variancePercent: number,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.RECEIVING_VARIANCE,
      `Receiving record '${receivingId}' has variance for SKU '${sku}': expected ${expected}, received ${received}`,
      {
        receivingId,
        sku,
        expected,
        received,
        variance: received - expected,
        variancePercent,
      },
      requestId
    );
  }

  /**
   * Low stock alert error
   */
  static lowStock(
    sku: string,
    currentQuantity: number,
    reorderPoint: number,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.LOW_STOCK,
      `SKU '${sku}' is below reorder point: ${currentQuantity} units (reorder at ${reorderPoint})`,
      { sku, currentQuantity, reorderPoint, shortage: reorderPoint - currentQuantity },
      requestId
    );
  }

  /**
   * Generic business logic error
   */
  static businessRuleViolation(rule: string, details: any, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.BUSINESS_LOGIC_ERROR,
      `Business rule violation: ${rule}`,
      details,
      requestId
    );
  }
}

/**
 * Database Error Factory
 * Creates error responses for database operation failures
 */
export class DatabaseErrorFactory {
  /**
   * Firestore write failure
   */
  static firestoreFailure(operation: string, collection: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.FIRESTORE_FAILURE,
      `Failed to ${operation} in collection '${collection}'`,
      { operation, collection },
      requestId
    );
  }

  /**
   * Network timeout error
   */
  static networkTimeout(operation: string, timeoutMs: number, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.NETWORK_TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { operation, timeoutMs },
      requestId
    );
  }

  /**
   * Concurrent modification conflict
   */
  static conflict(resourceType: string, resourceId: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.CONFLICT,
      `Concurrent modification detected for ${resourceType} '${resourceId}'`,
      { resourceType, resourceId },
      requestId
    );
  }

  /**
   * Transaction failed error
   */
  static transactionFailed(reason: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.TRANSACTION_FAILED,
      `Database transaction failed: ${reason}`,
      { reason },
      requestId
    );
  }

  /**
   * Generic database error
   */
  static databaseError(message: string, details?: any, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.DATABASE_ERROR,
      message,
      details,
      requestId
    );
  }
}

/**
 * Auth Error Factory
 * Creates error responses for authentication and authorization failures
 */
export class AuthErrorFactory {
  /**
   * Invalid credentials error
   */
  static invalidCredentials(requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INVALID_CREDENTIALS,
      'Invalid email or password',
      undefined,
      requestId
    );
  }

  /**
   * Expired session error
   */
  static expiredSession(requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.EXPIRED_SESSION,
      'Your session has expired. Please log in again.',
      undefined,
      requestId
    );
  }

  /**
   * Insufficient permissions error
   */
  static insufficientPermissions(
    requiredPermission: string,
    userRole: string,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.INSUFFICIENT_PERMISSIONS,
      `Access denied. Required permission: ${requiredPermission}`,
      { requiredPermission, userRole },
      requestId
    );
  }

  /**
   * Account locked error
   */
  static accountLocked(unlockTime: Date, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.ACCOUNT_LOCKED,
      `Account is temporarily locked due to multiple failed login attempts. Try again at ${unlockTime.toLocaleString()}`,
      { unlockTime: unlockTime.toISOString() },
      requestId
    );
  }

  /**
   * Generic authentication error
   */
  static authError(message: string, details?: any, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.AUTH_ERROR,
      message,
      details,
      requestId
    );
  }
}

/**
 * External Service Error Factory
 * Creates error responses for external service failures
 */
export class ExternalServiceErrorFactory {
  /**
   * AI service unavailable error
   */
  static aiServiceUnavailable(operation: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.AI_SERVICE_UNAVAILABLE,
      `AI service is temporarily unavailable for ${operation}. Please try again later.`,
      { operation },
      requestId
    );
  }

  /**
   * Payment timeout error
   */
  static paymentTimeout(paymentMethod: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.PAYMENT_TIMEOUT,
      `Payment processor timed out for ${paymentMethod}. Please try again.`,
      { paymentMethod },
      requestId
    );
  }

  /**
   * Generic service unavailable error
   */
  static serviceUnavailable(serviceName: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.SERVICE_UNAVAILABLE,
      `External service '${serviceName}' is currently unavailable`,
      { serviceName },
      requestId
    );
  }

  /**
   * Generic external service error
   */
  static externalServiceError(
    serviceName: string,
    message: string,
    details?: any,
    requestId?: string
  ): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      `${serviceName}: ${message}`,
      { serviceName, ...details },
      requestId
    );
  }
}

/**
 * System Error Factory
 * Creates error responses for system-level failures
 */
export class SystemErrorFactory {
  /**
   * Unexpected error
   */
  static unexpectedError(originalError?: Error, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.UNEXPECTED_ERROR,
      'An unexpected error occurred. Please contact support with the request ID.',
      originalError
        ? {
            name: originalError.name,
            message: originalError.message,
            stack: process.env.NODE_ENV === 'development' ? originalError.stack : undefined,
          }
        : undefined,
      requestId
    );
  }

  /**
   * Configuration error
   */
  static configurationError(configKey: string, reason: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.CONFIGURATION_ERROR,
      `Configuration error for '${configKey}': ${reason}`,
      { configKey, reason },
      requestId
    );
  }

  /**
   * Resource not found error
   */
  static notFound(resourceType: string, resourceId: string, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.NOT_FOUND,
      `${resourceType} with ID '${resourceId}' not found`,
      { resourceType, resourceId },
      requestId
    );
  }

  /**
   * Generic system error
   */
  static systemError(message: string, details?: any, requestId?: string): ErrorResponse {
    return createErrorResponse(
      ErrorCodes.SYSTEM_ERROR,
      message,
      details,
      requestId
    );
  }
}

/**
 * Helper function to convert any error to an ErrorResponse
 * Useful for catching unknown errors and standardizing them
 */
export function toErrorResponse(error: unknown, requestId?: string): ErrorResponse {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    // Already an ErrorResponse
    return error as ErrorResponse;
  }

  if (error instanceof Error) {
    return SystemErrorFactory.unexpectedError(error, requestId);
  }

  return SystemErrorFactory.systemError(
    String(error) || 'Unknown error occurred',
    undefined,
    requestId
  );
}

/**
 * Type guard to check if an object is an ErrorResponse
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as any).error === 'object' &&
    'code' in (obj as any).error &&
    'message' in (obj as any).error &&
    'timestamp' in (obj as any).error &&
    'requestId' in (obj as any).error
  );
}
