/**
 * Error Response Utilities - Usage Examples
 * 
 * This file demonstrates how to use the error response utilities
 * in various scenarios throughout the PRO SYNAPSE application.
 */

import {
  ErrorResponse,
  ValidationErrorFactory,
  ParseErrorFactory,
  BusinessLogicErrorFactory,
  DatabaseErrorFactory,
  AuthErrorFactory,
  ExternalServiceErrorFactory,
  SystemErrorFactory,
  generateRequestId,
  toErrorResponse,
  isErrorResponse,
} from './errors';

// ============================================================================
// Example 1: API Endpoint Error Handling
// ============================================================================

/**
 * Example: Astro API endpoint with consistent error handling
 */
export async function handleProductCreate(request: Request): Promise<Response> {
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
    
    if (!body.price || body.price < 0) {
      const error = ValidationErrorFactory.invalidPrice(
        'price',
        body.price,
        'Price must be non-negative',
        requestId
      );
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check for duplicate SKU
    const existingSKU = await checkSKUExists(body.sku);
    if (existingSKU) {
      const error = ValidationErrorFactory.duplicateSKU(body.sku, requestId);
      return new Response(JSON.stringify(error), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Create product
    const product = await createProduct(body);
    
    return new Response(JSON.stringify(product), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    // Convert unknown errors to ErrorResponse
    const errorResponse = toErrorResponse(error, requestId);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================================
// Example 2: Document Parsing Error Handling
// ============================================================================

/**
 * Example: Pricelist parser with detailed error reporting
 */
export async function parsePricelist(file: File): Promise<any> {
  const requestId = generateRequestId();
  
  // Check file format
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['csv', 'xlsx', 'pdf'].includes(extension || '')) {
    throw ParseErrorFactory.unsupportedFormat(
      file.name,
      extension || 'unknown',
      ['csv', 'xlsx', 'pdf'],
      requestId
    );
  }
  
  try {
    const content = await file.text();
    
    // Check for required columns
    const requiredColumns = ['sku', 'description', 'price'];
    const firstLine = content.split('\n')[0];
    const headers = firstLine.split(',').map(h => h.trim().toLowerCase());
    
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw ParseErrorFactory.missingColumns(file.name, missingColumns, requestId);
    }
    
    // Parse data
    const lines = content.split('\n').slice(1);
    const data = lines.map((line, index) => {
      const values = line.split(',');
      if (values.length !== headers.length) {
        throw ParseErrorFactory.parseFailure(
          file.name,
          `row ${index + 2}`,
          'Column count mismatch',
          requestId
        );
      }
      return {
        sku: values[0],
        description: values[1],
        price: parseFloat(values[2]),
      };
    });
    
    return data;
    
  } catch (error) {
    if (isErrorResponse(error)) {
      throw error;
    }
    throw ParseErrorFactory.corruptedFile(file.name, 'Unable to read file content', requestId);
  }
}

// ============================================================================
// Example 3: Business Logic Validation
// ============================================================================

/**
 * Example: Inventory check before POS transaction
 */
export async function processSale(
  items: Array<{ sku: string; quantity: number }>
): Promise<void> {
  const requestId = generateRequestId();
  
  for (const item of items) {
    // Check inventory
    const available = await getInventoryQuantity(item.sku);
    
    if (available < item.quantity) {
      throw BusinessLogicErrorFactory.insufficientInventory(
        item.sku,
        item.quantity,
        available,
        requestId
      );
    }
  }
  
  // Process sale...
}

/**
 * Example: Price margin validation
 */
export async function validateRetailPrice(
  sku: string,
  proposedPrice: number
): Promise<ErrorResponse | null> {
  const requestId = generateRequestId();
  
  // Get supplier cost
  const cost = await getSupplierCost(sku);
  
  // Check for negative margin
  if (proposedPrice < cost) {
    return BusinessLogicErrorFactory.negativeMargin(
      sku,
      cost,
      proposedPrice,
      requestId
    );
  }
  
  return null; // No error
}

/**
 * Example: Invoice variance detection
 */
export async function validateInvoice(
  invoiceNumber: string,
  lineItems: Array<{ sku: string; quantity: number; price: number }>
): Promise<ErrorResponse[]> {
  const requestId = generateRequestId();
  const errors: ErrorResponse[] = [];
  
  for (const item of lineItems) {
    const expectedPrice = await getExpectedPrice(item.sku);
    const variance = Math.abs((item.price - expectedPrice) / expectedPrice) * 100;
    
    if (variance > 5) {
      errors.push(
        BusinessLogicErrorFactory.invoiceVariance(
          invoiceNumber,
          item.sku,
          expectedPrice,
          item.price,
          variance,
          requestId
        )
      );
    }
  }
  
  return errors;
}

// ============================================================================
// Example 4: Database Error Handling with Retry Logic
// ============================================================================

/**
 * Example: Firestore operation with retry and error handling
 */
export async function saveProduct(product: any): Promise<void> {
  const requestId = generateRequestId();
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Attempt Firestore write
      await firestoreWrite('products', product);
      return; // Success
      
    } catch (error: any) {
      attempt++;
      
      // Check error type
      if (error.code === 'unavailable' && attempt < maxRetries) {
        // Transient error - retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      
      if (error.code === 'conflict') {
        throw DatabaseErrorFactory.conflict('Product', product.sku, requestId);
      }
      
      // Other database error
      throw DatabaseErrorFactory.firestoreFailure('write', 'products', requestId);
    }
  }
  
  // Max retries exceeded
  throw DatabaseErrorFactory.networkTimeout('saveProduct', 30000, requestId);
}

// ============================================================================
// Example 5: Authentication and Authorization
// ============================================================================

/**
 * Example: Protected API endpoint with auth checks
 */
export async function handleProtectedRequest(request: Request): Promise<Response> {
  const requestId = generateRequestId();
  
  // Check authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    const error = AuthErrorFactory.expiredSession(requestId);
    return new Response(JSON.stringify(error), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Verify token
  const user = await verifyToken(authHeader);
  if (!user) {
    const error = AuthErrorFactory.invalidCredentials(requestId);
    return new Response(JSON.stringify(error), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Check account lock
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const error = AuthErrorFactory.accountLocked(new Date(user.lockedUntil), requestId);
    return new Response(JSON.stringify(error), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Check permissions
  if (!user.permissions.includes('manage_products')) {
    const error = AuthErrorFactory.insufficientPermissions(
      'manage_products',
      user.role,
      requestId
    );
    return new Response(JSON.stringify(error), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Proceed with request...
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Example 6: External Service Integration
// ============================================================================

/**
 * Example: AI product matching with graceful degradation
 */
export async function matchProductsWithAI(
  supplierProducts: any[]
): Promise<any[]> {
  const requestId = generateRequestId();
  
  try {
    // Call external AI service
    const response = await fetch('https://ai-service.example.com/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: supplierProducts }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error('AI service returned error');
    }
    
    return await response.json();
    
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw ExternalServiceErrorFactory.aiServiceUnavailable('product matching', requestId);
    }
    
    // Fall back to basic matching
    console.warn('AI service unavailable, falling back to basic matching');
    return fallbackBasicMatching(supplierProducts);
  }
}

// ============================================================================
// Example 7: System-Level Error Handling
// ============================================================================

/**
 * Example: Global error boundary for Astro components
 */
export function handleGlobalError(error: unknown, context: string): ErrorResponse {
  const requestId = generateRequestId();
  
  // Log error for monitoring
  console.error(`[${requestId}] Error in ${context}:`, error);
  
  // Convert to ErrorResponse
  if (isErrorResponse(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return SystemErrorFactory.unexpectedError(error, requestId);
  }
  
  return SystemErrorFactory.systemError(
    'An unexpected error occurred',
    { context },
    requestId
  );
}

/**
 * Example: Resource lookup with not found error
 */
export async function getProductBySKU(sku: string): Promise<any> {
  const requestId = generateRequestId();
  
  const product = await firestoreGet('products', sku);
  
  if (!product) {
    throw SystemErrorFactory.notFound('Product', sku, requestId);
  }
  
  return product;
}

// ============================================================================
// Example 8: Multiple Validation Errors
// ============================================================================

/**
 * Example: Form validation with multiple errors
 */
export function validateProductForm(data: any): ErrorResponse | null {
  const requestId = generateRequestId();
  const fieldErrors: Array<{ field: string; message: string }> = [];
  
  if (!data.sku || data.sku.trim() === '') {
    fieldErrors.push({ field: 'sku', message: 'SKU is required' });
  }
  
  if (!data.description || data.description.trim() === '') {
    fieldErrors.push({ field: 'description', message: 'Description is required' });
  }
  
  if (data.price === undefined || data.price === null) {
    fieldErrors.push({ field: 'price', message: 'Price is required' });
  } else if (data.price < 0) {
    fieldErrors.push({ field: 'price', message: 'Price must be non-negative' });
  } else if (!Number.isFinite(data.price)) {
    fieldErrors.push({ field: 'price', message: 'Price must be a valid number' });
  }
  
  if (data.quantity !== undefined && data.quantity <= 0) {
    fieldErrors.push({ field: 'quantity', message: 'Quantity must be positive' });
  }
  
  if (fieldErrors.length > 0) {
    return ValidationErrorFactory.multipleErrors(fieldErrors, requestId);
  }
  
  return null; // No errors
}

// ============================================================================
// Mock Helper Functions (for demonstration purposes)
// ============================================================================

async function checkSKUExists(sku: string): Promise<boolean> {
  // Mock implementation
  return false;
}

async function createProduct(data: any): Promise<any> {
  // Mock implementation
  return { id: '123', ...data };
}

async function getInventoryQuantity(sku: string): Promise<number> {
  // Mock implementation
  return 10;
}

async function getSupplierCost(sku: string): Promise<number> {
  // Mock implementation
  return 50;
}

async function getExpectedPrice(sku: string): Promise<number> {
  // Mock implementation
  return 100;
}

async function firestoreWrite(collection: string, data: any): Promise<void> {
  // Mock implementation
}

async function firestoreGet(collection: string, id: string): Promise<any> {
  // Mock implementation
  return null;
}

async function verifyToken(token: string): Promise<any> {
  // Mock implementation
  return { id: '1', role: 'user', permissions: ['read'] };
}

async function fallbackBasicMatching(products: any[]): Promise<any[]> {
  // Mock implementation
  return products;
}
