# Input Validation Utilities

Comprehensive validation utilities for PRO SYNAPSE data accuracy requirements.

## Overview

This module provides reusable validation functions that enforce data integrity throughout the PRO SYNAPSE system. All validation functions return a `ValidationResult` object with validation status and detailed error information.

**Requirements Coverage:**
- Requirement 21.1: Required field validation
- Requirement 21.2: Data type and format validation (numeric, date, email)
- Requirement 21.3: Referential integrity (enforced at service layer using these utilities)
- Requirement 21.4: SKU uniqueness validation
- Requirement 21.5: Positive quantity validation
- Requirement 21.6: Price validation (non-negative, max 2 decimal places)

## Core Types

### ValidationResult
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
```

### ValidationError
```typescript
class ValidationError extends Error {
  field: string;
  message: string;
}
```

## Validation Functions

### Required Field Validation (Requirement 21.1)

#### `validateRequired(value: any, fieldName: string): ValidationResult`
Validates that a field is present and not empty.

```typescript
import { validateRequired } from '@/utils/validation';

const result = validateRequired(formData.name, 'name');
if (!result.isValid) {
  console.error(result.errors[0].message);
}
```

#### `validateRequiredFields(fields: Record<string, any>): ValidationResult`
Validates multiple required fields at once.

```typescript
const result = validateRequiredFields({
  name: userData.name,
  email: userData.email,
  role: userData.role
});
```

### Data Type Validation (Requirement 21.2)

#### `validateNumber(value: any, fieldName: string): ValidationResult`
Validates that a value is a valid, finite number.

```typescript
const result = validateNumber(formData.quantity, 'quantity');
```

#### `validateDate(value: any, fieldName: string): ValidationResult`
Validates Date objects or ISO date strings.

```typescript
const result = validateDate(formData.receivingDate, 'receivingDate');
```

#### `validateEmail(value: any, fieldName: string): ValidationResult`
Validates email address format.

```typescript
const result = validateEmail(formData.email, 'email');
```

### Quantity Validation (Requirement 21.5)

#### `validatePositiveQuantity(value: any, fieldName: string): ValidationResult`
Validates that a quantity is a positive number (> 0).

```typescript
const result = validatePositiveQuantity(formData.quantity, 'quantity');
// Fails for: 0, -5, "10", null, NaN
// Passes for: 1, 5.5, 100
```

### Price Validation (Requirement 21.6)

#### `validatePrice(value: any, fieldName: string): ValidationResult`
Validates that a price is:
- A valid number
- Non-negative (>= 0)
- Has maximum two decimal places

```typescript
const result = validatePrice(formData.retailPrice, 'retailPrice');
// Passes: 0, 99, 99.9, 99.99
// Fails: -10, 99.999, "99.99", NaN
```

### SKU Validation (Requirement 21.4)

#### `validateSKUFormat(value: any, fieldName: string): ValidationResult`
Validates SKU format (alphanumeric, hyphens, underscores only).

```typescript
const result = validateSKUFormat(formData.sku, 'sku');
// Passes: "SKU123", "PROD-001", "item_456"
// Fails: "SKU 123", "PROD@001", "", "  "
```

#### `validateSKUUniqueness(sku: string, existingSKUs: string[], fieldName?: string): ValidationResult`
Validates that a SKU is unique (case-insensitive comparison).

```typescript
const existingSKUs = await productService.getAllSKUs();
const result = validateSKUUniqueness(formData.sku, existingSKUs, 'sku');
```

### Advanced Validation

#### `validateForm(data: Record<string, any>, rules: Record<string, Function[]>): ValidationResult`
Validates an entire form object with multiple validation rules per field.

```typescript
const result = validateForm(productData, {
  sku: [validateRequired, validateSKUFormat],
  description: [validateRequired],
  price: [validateRequired, validatePrice],
  reorderPoint: [validateRequired, validatePositiveQuantity]
});
```

#### `validateRange(value: any, min: number, max: number, fieldName: string): ValidationResult`
Validates that a number is within a specified range (inclusive).

```typescript
const result = validateRange(formData.discount, 0, 100, 'discount');
```

#### `validateStringLength(value: any, minLength: number, maxLength: number, fieldName: string): ValidationResult`
Validates string length constraints.

```typescript
const result = validateStringLength(formData.notes, 0, 500, 'notes');
```

## Helper Functions

### `getValidationMessages(result: ValidationResult): string[]`
Extracts error messages from a validation result.

```typescript
const result = validateForm(data, rules);
if (!result.isValid) {
  const messages = getValidationMessages(result);
  console.log(messages); // ["Email is required", "Price must be non-negative"]
}
```

### `getValidationErrorsByField(result: ValidationResult): Record<string, string[]>`
Groups validation errors by field name.

```typescript
const result = validateForm(data, rules);
if (!result.isValid) {
  const errorsByField = getValidationErrorsByField(result);
  // { email: ["Email is required"], price: ["Must be non-negative"] }
  
  // Display errors next to form fields
  Object.entries(errorsByField).forEach(([field, errors]) => {
    displayFieldError(field, errors[0]);
  });
}
```

## Usage Patterns

### Pattern 1: Simple Field Validation
```typescript
const nameValidation = validateRequired(formData.name, 'name');
if (!nameValidation.isValid) {
  return { error: nameValidation.errors[0].message };
}
```

### Pattern 2: Multi-Rule Validation
```typescript
// Validate with multiple rules
const priceValidation = validateForm({ price: formData.price }, {
  price: [validateRequired, validatePrice]
});
```

### Pattern 3: Form Validation with Error Display
```typescript
const validation = validateProductForm(formData);

if (!validation.isValid) {
  const errorsByField = getValidationErrorsByField(validation);
  
  // Display errors in UI
  return {
    success: false,
    errors: errorsByField
  };
}
```

### Pattern 4: API Endpoint Validation
```typescript
// In Astro API route
export async function POST({ request }) {
  const data = await request.json();
  
  const validation = validateForm(data, {
    sku: [validateRequired, validateSKUFormat],
    price: [validateRequired, validatePrice]
  });
  
  if (!validation.isValid) {
    return new Response(JSON.stringify({
      error: 'Validation failed',
      details: getValidationErrorsByField(validation)
    }), { status: 400 });
  }
  
  // Process valid data...
}
```

### Pattern 5: SKU Uniqueness Check
```typescript
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase/config';

async function validateNewProductSKU(sku: string): Promise<ValidationResult> {
  // Get existing SKUs from database
  const productsRef = collection(db, 'products');
  const snapshot = await getDocs(productsRef);
  const existingSKUs = snapshot.docs.map(doc => doc.id);
  
  // Validate uniqueness
  return validateSKUUniqueness(sku, existingSKUs, 'sku');
}
```

## Integration Examples

### Client-Side Form Validation (Astro Component)
```astro
---
import { validateRequired, validateEmail } from '@/utils/validation';

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData();
  const email = formData.get('email')?.toString() || '';
  
  const emailValidation = validateEmail(email, 'email');
  
  if (!emailValidation.isValid) {
    // Display error
  }
}
---
```

### Server-Side Service Layer Validation
```typescript
// In ProductService.ts
import { validateSKUUniqueness, validateProductForm } from '@/utils/validation';

async createProduct(productData: CreateProductRequest): Promise<Product> {
  // Validate format
  const formatValidation = validateProductForm(productData);
  if (!formatValidation.isValid) {
    throw new Error(getValidationMessages(formatValidation).join('; '));
  }
  
  // Validate uniqueness
  const existingSKUs = await this.getAllSKUs();
  const uniquenessValidation = validateSKUUniqueness(
    productData.sku, 
    existingSKUs
  );
  
  if (!uniquenessValidation.isValid) {
    throw new Error(uniquenessValidation.errors[0].message);
  }
  
  // Create product...
}
```

## Testing

The validation utilities include comprehensive unit tests covering:
- All validation functions with valid and invalid inputs
- Edge cases (null, undefined, empty strings, special characters)
- Boundary conditions (min/max values, decimal places)
- Error message formatting

Run tests:
```bash
npm test -- src/utils/validation.test.ts
```

## Best Practices

1. **Validate early**: Perform validation at the entry points (API routes, form submissions)
2. **Chain validations**: Use `validateForm` to apply multiple validators per field
3. **Provide context**: Always include field names for clear error messages
4. **Handle errors gracefully**: Display validation errors to users with specific guidance
5. **Validate on both client and server**: Client-side for UX, server-side for security
6. **Use type safety**: Leverage TypeScript types along with runtime validation

## See Also

- `validation.example.ts` - Additional usage examples
- `validation.test.ts` - Comprehensive test suite
- Requirements Document - Requirements 21.1-21.6
- Design Document - Data validation section
