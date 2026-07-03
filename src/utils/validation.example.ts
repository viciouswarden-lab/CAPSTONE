/**
 * Usage Examples for Validation Utilities
 * 
 * This file demonstrates how to use the validation utilities in various
 * scenarios throughout the PRO SYNAPSE application.
 */

import {
  validateRequired,
  validateRequiredFields,
  validateEmail,
  validatePositiveQuantity,
  validatePrice,
  validateSKUFormat,
  validateSKUUniqueness,
  validateForm,
  getValidationMessages,
  getValidationErrorsByField,
  type ValidationResult,
} from './validation';

/**
 * Example 1: Validating a single required field
 */
export function validateProductName(name: string): ValidationResult {
  return validateRequired(name, 'productName');
}

/**
 * Example 2: Validating multiple required fields
 */
export function validateSupplierBasicInfo(supplierData: any): ValidationResult {
  return validateRequiredFields({
    name: supplierData.name,
    contactPerson: supplierData.contactPerson,
    email: supplierData.email,
  });
}

/**
 * Example 3: Validating a product form with multiple validation rules
 */
export function validateProductForm(productData: any): ValidationResult {
  const rules = {
    sku: [validateRequired, validateSKUFormat],
    description: [validateRequired],
    category: [validateRequired],
    unitOfMeasure: [validateRequired],
    reorderPoint: [validateRequired, validatePositiveQuantity],
  };

  return validateForm(productData, rules);
}

/**
 * Example 4: Validating a pricelist item
 */
export function validatePricelistItem(item: any): ValidationResult {
  const rules = {
    supplierCode: [validateRequired],
    description: [validateRequired],
    price: [validateRequired, validatePrice],
  };

  return validateForm(item, rules);
}

/**
 * Example 5: Validating inventory adjustment
 */
export function validateInventoryAdjustment(adjustment: any): ValidationResult {
  const rules = {
    sku: [validateRequired, validateSKUFormat],
    locationId: [validateRequired],
    // Note: quantityChange can be negative for adjustments down
    // so we just validate it's a number
    reason: [validateRequired],
    userId: [validateRequired],
  };

  return validateForm(adjustment, rules);
}

/**
 * Example 6: Validating a receiving record
 */
export function validateReceivingRecord(record: any): ValidationResult {
  const rules = {
    supplierId: [validateRequired],
    receivingDate: [validateRequired],
    documentType: [validateRequired],
  };

  return validateForm(record, rules);
}

/**
 * Example 7: Validating POS transaction line item
 */
export function validatePOSLineItem(item: any): ValidationResult {
  const rules = {
    sku: [validateRequired, validateSKUFormat],
    description: [validateRequired],
    quantity: [validateRequired, validatePositiveQuantity],
    unitPrice: [validateRequired, validatePrice],
  };

  return validateForm(item, rules);
}

/**
 * Example 8: Validating pricing record
 */
export function validatePricingRecord(record: any): ValidationResult {
  const rules = {
    sku: [validateRequired, validateSKUFormat],
    priceTier: [validateRequired],
    retailPrice: [validateRequired, validatePrice],
    effectiveDate: [validateRequired],
    updatedBy: [validateRequired],
  };

  return validateForm(record, rules);
}

/**
 * Example 9: Validating user creation data
 */
export function validateUserCreation(userData: any): ValidationResult {
  const rules = {
    email: [validateRequired, validateEmail],
    displayName: [validateRequired],
    role: [validateRequired],
    password: [validateRequired],
  };

  return validateForm(userData, rules);
}

/**
 * Example 10: Validating SKU uniqueness in product creation
 * 
 * This would typically be called in the ProductService after format validation
 */
export async function validateNewProduct(
  productData: any,
  existingSKUs: string[]
): Promise<{
  formatValidation: ValidationResult;
  uniquenessValidation: ValidationResult;
}> {
  // First validate the format and required fields
  const formatValidation = validateProductForm(productData);

  // Then validate SKU uniqueness
  const uniquenessValidation = validateSKUUniqueness(
    productData.sku,
    existingSKUs,
    'sku'
  );

  return {
    formatValidation,
    uniquenessValidation,
  };
}

/**
 * Example 11: Using validation in an Astro API endpoint
 * 
 * This demonstrates how to integrate validation into API routes
 */
export function handleProductCreateRequest(requestData: any): {
  isValid: boolean;
  errors?: Record<string, string[]>;
  data?: any;
} {
  // Validate the request data
  const validation = validateProductForm(requestData);

  if (!validation.isValid) {
    // Return errors grouped by field for the client
    return {
      isValid: false,
      errors: getValidationErrorsByField(validation),
    };
  }

  // If valid, return the data
  return {
    isValid: true,
    data: requestData,
  };
}

/**
 * Example 12: Using validation with custom error handling
 */
export function validateAndFormatErrors(data: any, rules: any): {
  success: boolean;
  messages?: string[];
  fieldErrors?: Record<string, string[]>;
} {
  const validation = validateForm(data, rules);

  if (!validation.isValid) {
    return {
      success: false,
      messages: getValidationMessages(validation),
      fieldErrors: getValidationErrorsByField(validation),
    };
  }

  return { success: true };
}

/**
 * Example 13: Client-side validation helper for forms
 * 
 * This can be used in Astro components or client-side JS
 */
export function validateFormField(
  fieldName: string,
  value: any,
  validators: Array<(value: any, fieldName: string) => ValidationResult>
): string | null {
  for (const validator of validators) {
    const result = validator(value, fieldName);
    if (!result.isValid) {
      // Return the first error message for display
      return result.errors[0].message;
    }
  }
  return null;
}

/**
 * Example 14: Batch validation for bulk operations
 */
export function validateBulkPriceUpdate(
  items: Array<{ sku: string; price: number }>
): {
  validItems: Array<{ sku: string; price: number }>;
  invalidItems: Array<{ sku: string; price: number; error: string }>;
} {
  const validItems: Array<{ sku: string; price: number }> = [];
  const invalidItems: Array<{ sku: string; price: number; error: string }> = [];

  for (const item of items) {
    const validation = validateForm(item, {
      sku: [validateRequired, validateSKUFormat],
      price: [validateRequired, validatePrice],
    });

    if (validation.isValid) {
      validItems.push(item);
    } else {
      invalidItems.push({
        ...item,
        error: getValidationMessages(validation).join('; '),
      });
    }
  }

  return { validItems, invalidItems };
}
