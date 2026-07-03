# Error Response Utilities

## Overview

The error response utilities provide a consistent, standardized approach to error handling across all PRO SYNAPSE API endpoints and services. This module implements **Requirement 18.2** for reliable error handling with descriptive messages and troubleshooting support.

## Key Features

- **Consistent Error Format**: All errors follow the same `ErrorResponse` structure
- **Unique Request IDs**: Every error includes a UUID for troubleshooting and support
- **Error Categories**: Seven predefined error categories covering all application scenarios
- **Factory Pattern**: Clean, type-safe error creation using factory classes
- **Detailed Context**: Errors include relevant details for debugging and user guidance
- **Type Safety**: Full TypeScript support with interfaces and type guards

## Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // e.g., "VALIDATION_ERROR", "PARSE_ERROR"
    message: string;        // User-friendly message
    details?: any;          // Additional context (field errors, etc.)
    timestamp: string;      // ISO 8601 timestamp
    requestId: string;      // UUID v4 for troubleshooting
  };
}
```

### Example Error Response

```json
{
  "error": {
    "code": "MISSING_FIELD",
    "message": "Required field 'sku' is missing",
    "details": {
      "field": "sku"
    },
    "timestamp": "2025-06-15T10:30:45.123Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Error Categories

### 1. Validation Errors (1000-1999)

For user input validation failures.

```typescript
import { ValidationErrorFactory } from '@/utils/errors';

// Missing required field
const error = ValidationErrorFactory.missingField('email');

// Invalid data type
const error = ValidationErrorFactory.invalidDataType('age', 'number', 'string');

// Duplicate SKU
const error = ValidationErrorFactory.duplicateSKU('SKU001');

// Negative quantity
const error = ValidationErrorFactory.negativeQuantity('quantity', -5);

// Invalid price
const error = ValidationErrorFactory.invalidPrice('price', 99.999, 'too many decimals');

// Multiple field errors
const error = ValidationErrorFactory.multipleErrors([
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too short' }
]);
```

**Error Codes:**
- `VALIDATION_ERROR` - Generic validation failure
- `MISSING_FIELD` - Required field not provided
- `INVALID_DATA_TYPE` - Wrong data type
- `DUPLICATE_SKU` - SKU already exists
- `NEGATIVE_QUANTITY` - Quantity must be positive
- `INVALID_PRICE` - Price validation failed

### 2. Parse Errors (2000-2999)

For document parsing failures (CSV, Excel, PDF).

```typescript
import { ParseErrorFactory } from '@/utils/errors';

// Corrupted file
const error = ParseErrorFactory.corruptedFile('pricelist.csv', 'unexpected end of file');

// Missing columns
const error = ParseErrorFactory.missingColumns('invoice.xlsx', ['price', 'sku']);

// Encoding error
const error = ParseErrorFactory.encodingError('data.csv', 'UTF-8');

// Unsupported format
const error = ParseErrorFactory.unsupportedFormat('doc.txt', 'txt', ['csv', 'xlsx', 'pdf']);

// Parse failure at specific location
const error = ParseErrorFactory.parseFailure('data.csv', 'row 5', 'invalid number format');
```

**Error Codes:**
- `PARSE_ERROR` - Generic parsing failure
- `CORRUPTED_FILE` - File is corrupted or unreadable
- `MISSING_COLUMNS` - Required columns missing
- `ENCODING_ERROR` - File encoding issues
- `UNSUPPORTED_FORMAT` - File format not supported

### 3. Business Logic Errors (3000-3999)

For business rule violations.

```typescript
import { BusinessLogicErrorFactory } from '@/utils/errors';

// Insufficient inventory
const error = BusinessLogicErrorFactory.insufficientInventory('SKU001', 10, 5);

// Invoice variance
const error = BusinessLogicErrorFactory.invoiceVariance('INV001', 'Item A', 100, 110, 10);

// Negative margin
const error = BusinessLogicErrorFactory.negativeMargin('SKU002', 100, 90);

// Receiving variance
const error = BusinessLogicErrorFactory.receivingVariance('REC001', 'SKU003', 100, 95, 5);

// Low stock alert
const error = BusinessLogicErrorFactory.lowStock('SKU004', 5, 10);

// Generic business rule violation
const error = BusinessLogicErrorFactory.businessRuleViolation('Custom rule', { data: 'value' });
```

**Error Codes:**
- `BUSINESS_LOGIC_ERROR` - Generic business rule violation
- `INSUFFICIENT_INVENTORY` - Not enough stock
- `INVOICE_VARIANCE` - Invoice/receiving mismatch
- `NEGATIVE_MARGIN` - Pricing results in loss
- `RECEIVING_VARIANCE` - Expected vs received mismatch
- `LOW_STOCK` - Below reorder point

### 4. Database Errors (4000-4999)

For database operation failures.

```typescript
import { DatabaseErrorFactory } from '@/utils/errors';

// Firestore failure
const error = DatabaseErrorFactory.firestoreFailure('write', 'products');

// Network timeout
const error = DatabaseErrorFactory.networkTimeout('query', 5000);

// Concurrent modification conflict
const error = DatabaseErrorFactory.conflict('Product', 'SKU001');

// Transaction failed
const error = DatabaseErrorFactory.transactionFailed('deadlock detected');

// Generic database error
const error = DatabaseErrorFactory.databaseError('Connection failed', { host: 'localhost' });
```

**Error Codes:**
- `DATABASE_ERROR` - Generic database error
- `FIRESTORE_FAILURE` - Firestore operation failed
- `NETWORK_TIMEOUT` - Operation timed out
- `CONFLICT` - Concurrent modification detected
- `TRANSACTION_FAILED` - Transaction rolled back

### 5. Auth/Authorization Errors (5000-5999)

For authentication and authorization failures.

```typescript
import { AuthErrorFactory } from '@/utils/errors';

// Invalid credentials
const error = AuthErrorFactory.invalidCredentials();

// Expired session
const error = AuthErrorFactory.expiredSession();

// Insufficient permissions
const error = AuthErrorFactory.insufficientPermissions('admin', 'user');

// Account locked
const unlockTime = new Date('2025-12-31T10:00:00Z');
const error = AuthErrorFactory.accountLocked(unlockTime);

// Generic auth error
const error = AuthErrorFactory.authError('Custom auth error', { user: 'john' });
```

**Error Codes:**
- `AUTH_ERROR` - Generic authentication error
- `INVALID_CREDENTIALS` - Wrong username/password
- `EXPIRED_SESSION` - Session expired
- `INSUFFICIENT_PERMISSIONS` - Access denied
- `ACCOUNT_LOCKED` - Too many failed attempts

### 6. External Service Errors (6000-6999)

For external service failures.

```typescript
import { ExternalServiceErrorFactory } from '@/utils/errors';

// AI service unavailable
const error = ExternalServiceErrorFactory.aiServiceUnavailable('product matching');

// Payment timeout
const error = ExternalServiceErrorFactory.paymentTimeout('credit card');

// Service unavailable
const error = ExternalServiceErrorFactory.serviceUnavailable('Email Service');

// Generic external service error
const error = ExternalServiceErrorFactory.externalServiceError(
  'API',
  'Rate limit exceeded',
  { limit: 100 }
);
```

**Error Codes:**
- `EXTERNAL_SERVICE_ERROR` - Generic service error
- `AI_SERVICE_UNAVAILABLE` - AI service down
- `PAYMENT_TIMEOUT` - Payment processor timeout
- `SERVICE_UNAVAILABLE` - Service temporarily down

### 7. System Errors (7000-7999)

For system-level failures.

```typescript
import { SystemErrorFactory } from '@/utils/errors';

// Unexpected error
const originalError = new Error('Something went wrong');
const error = SystemErrorFactory.unexpectedError(originalError);

// Configuration error
const error = SystemErrorFactory.configurationError('DATABASE_URL', 'missing value');

// Resource not found
const error = SystemErrorFactory.notFound('Product', 'SKU999');

// Generic system error
const error = SystemErrorFactory.systemError('System overload', { cpu: 95 });
```

**Error Codes:**
- `SYSTEM_ERROR` - Generic system error
- `UNEXPECTED_ERROR` - Unhandled exception
- `CONFIGURATION_ERROR` - Invalid configuration
- `NOT_FOUND` - Resource not found

## Utility Functions

### generateRequestId()

Generates a unique UUID v4 for request tracking.

```typescript
import { generateRequestId } from '@/utils/errors';

const requestId = generateRequestId();
// "550e8400-e29b-41d4-a716-446655440000"
```

### createErrorResponse()

Low-level function to create custom error responses.

```typescript
import { createErrorResponse } from '@/utils/errors';

const error = createErrorResponse(
  'CUSTOM_ERROR',
  'Custom error message',
  { extra: 'data' },
  requestId
);
```

### toErrorResponse()

Converts any error type to an `ErrorResponse`.

```typescript
import { toErrorResponse } from '@/utils/errors';

try {
  // Some operation
} catch (error) {
  const errorResponse = toErrorResponse(error);
  return new Response(JSON.stringify(errorResponse), { status: 500 });
}
```

### isErrorResponse()

Type guard to check if an object is an `ErrorResponse`.

```typescript
import { isErrorResponse } from '@/utils/errors';

if (isErrorResponse(error)) {
  console.log(error.error.requestId);
}
```

## Usage in API Endpoints

### Basic Pattern

```typescript
import { generateRequestId, ValidationErrorFactory, toErrorResponse } from '@/utils/errors';

export async function POST({ request }: { request: Request }): Promise<Response> {
  const requestId = generateRequestId();
  
  try {
    const body = await request.json();
    
    // Validation
    if (!body.sku) {
      const error = ValidationErrorFactory.missingField('sku', requestId);
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Business logic...
    const result = await processData(body);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const errorResponse = toErrorResponse(error, requestId);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### HTTP Status Code Mapping

| Error Category | Typical HTTP Status |
|----------------|---------------------|
| Validation Errors | 400 Bad Request |
| Parse Errors | 400 Bad Request |
| Business Logic Errors | 422 Unprocessable Entity |
| Database Errors | 500 Internal Server Error |
| Auth Errors | 401 Unauthorized / 403 Forbidden |
| External Service Errors | 502 Bad Gateway / 503 Service Unavailable |
| System Errors | 500 Internal Server Error |
| Not Found | 404 Not Found |
| Conflict | 409 Conflict |

## Best Practices

### 1. Always Include Request IDs

Generate a request ID at the start of each operation for consistent tracking:

```typescript
const requestId = generateRequestId();
```

### 2. Use Specific Error Factories

Prefer specific factory methods over generic ones:

```typescript
// ✅ Good
ValidationErrorFactory.missingField('email');

// ❌ Avoid
createErrorResponse('VALIDATION_ERROR', 'Field missing');
```

### 3. Include Relevant Details

Always include context that helps debugging:

```typescript
// ✅ Good - includes all relevant details
BusinessLogicErrorFactory.insufficientInventory('SKU001', 10, 5);

// ❌ Avoid - missing context
createErrorResponse('ERROR', 'Not enough inventory');
```

### 4. Catch and Convert Unknown Errors

Use `toErrorResponse()` to handle unexpected errors:

```typescript
try {
  await operation();
} catch (error) {
  return toErrorResponse(error, requestId);
}
```

### 5. Log Errors Appropriately

Different error types should be logged at different levels:

```typescript
// User errors (validation) - INFO level
console.info(`[${requestId}] Validation failed:`, error);

// System errors - ERROR level
console.error(`[${requestId}] System error:`, error);

// Business logic warnings - WARN level
console.warn(`[${requestId}] Business rule violation:`, error);
```

### 6. Provide User-Friendly Messages

Error messages should be clear and actionable:

```typescript
// ✅ Good - tells user what to do
"Required field 'email' is missing"

// ❌ Avoid - technical jargon
"NULL_POINTER_EXCEPTION in field validation"
```

### 7. Don't Expose Sensitive Information

In production, avoid exposing internal details:

```typescript
// ✅ Good
SystemErrorFactory.unexpectedError(error, requestId);
// User sees: "An unexpected error occurred. Contact support with request ID."

// ❌ Avoid
createErrorResponse('ERROR', error.stack); // Exposes stack trace
```

## Testing

The error utilities include comprehensive unit tests. Run them with:

```bash
npm test -- src/utils/errors.test.ts --run
```

All 53 test cases cover:
- Request ID generation and uniqueness
- All error factory methods
- Utility functions (toErrorResponse, isErrorResponse)
- Error code uniqueness
- Response format validation

## Integration with Existing Code

### With Validation Module

```typescript
import { getValidationMessages } from '@/utils/validation';
import { ValidationErrorFactory } from '@/utils/errors';

const validationResult = validateProduct(data);
if (!validationResult.isValid) {
  const messages = getValidationMessages(validationResult);
  const fieldErrors = messages.map((msg, i) => ({
    field: validationResult.errors[i].field,
    message: msg
  }));
  
  return ValidationErrorFactory.multipleErrors(fieldErrors);
}
```

### With Firebase Services

```typescript
import { DatabaseErrorFactory } from '@/utils/errors';
import { getFirestore } from 'firebase/firestore';

try {
  await setDoc(doc(db, 'products', sku), data);
} catch (error: any) {
  if (error.code === 'unavailable') {
    throw DatabaseErrorFactory.networkTimeout('write', 5000);
  }
  throw DatabaseErrorFactory.firestoreFailure('write', 'products');
}
```

## File Structure

```
src/utils/
├── errors.ts              # Main error utilities module
├── errors.test.ts         # Unit tests (53 test cases)
├── errors.example.ts      # Usage examples
└── ERRORS_README.md       # This documentation
```

## Related Requirements

- **Requirement 18.2**: Reliability and error logging with diagnostic information
- **Requirement 3.3, 10.2, 11.2**: Descriptive parse error messages
- **Requirement 20.3**: Clear error messages with specific guidance

## Support

For troubleshooting:
1. Note the `requestId` from the error response
2. Search application logs for that request ID
3. Review the error details for context
4. Check the error code category for general guidance

## Future Enhancements

Potential improvements:
- Error internationalization (i18n) support
- Error telemetry integration
- Custom error recovery strategies
- Error rate limiting and circuit breakers
