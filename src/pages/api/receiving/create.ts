/**
 * API Endpoint: Create Receiving Record
 * 
 * Creates a new receiving record with line items by:
 * 1. Validating required fields (supplier, date, document type) per Requirement 9.1
 * 2. Validating that all products exist in the system per Requirement 9.2
 * 3. Creating the receiving record via ReceivingService
 * 4. Adding all line items to the record
 * 5. Returning the created receiving record with ID
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 * Task: 29.2
 */

import type { APIRoute } from 'astro';
import { receivingService } from '@/services/receiving';
import { productService } from '@/services/products';
import { supplierService } from '@/services/suppliers';
import type { ReceivingLineItem, ReceivingDocumentType } from '@/types/models';

interface CreateReceivingRequest {
  supplierId: string;
  receivingDate: string; // ISO date string
  documentType: ReceivingDocumentType;
  documentRef?: string;
  lineItems: ReceivingLineItem[];
}

interface CreateReceivingResponse {
  success: boolean;
  message: string;
  receivingId: string;
  hasVariance: boolean;
  timestamp: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get user from session
    const user = locals.user;
    if (!user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json() as CreateReceivingRequest;
    const { supplierId, receivingDate, documentType, documentRef, lineItems } = body;

    // Validate required fields - Requirement 9.1
    if (!supplierId || !receivingDate || !documentType) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: supplierId, receivingDate, documentType are required (Requirement 9.1)',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate document type
    if (documentType !== 'invoice' && documentType !== 'delivery_receipt') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentType must be either "invoice" or "delivery_receipt"',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate receiving date
    const parsedDate = new Date(receivingDate);
    if (isNaN(parsedDate.getTime())) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'receivingDate must be a valid ISO date string',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate line items exist
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one line item is required',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate supplier exists
    try {
      const supplier = await supplierService.getSupplier(supplierId);
      if (!supplier) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'SUPPLIER_NOT_FOUND',
              message: `Supplier with ID "${supplierId}" does not exist`,
              timestamp: new Date().toISOString(),
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'SUPPLIER_NOT_FOUND',
            message: `Supplier with ID "${supplierId}" does not exist`,
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate all line items
    for (let i = 0; i < lineItems.length; i++) {
      const lineItem = lineItems[i];

      // Validate required line item fields
      if (!lineItem.sku || !lineItem.quantity || !lineItem.locationId) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: `Line item ${i + 1}: sku, quantity, and locationId are required`,
              timestamp: new Date().toISOString(),
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate quantity is positive
      if (lineItem.quantity <= 0) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: `Line item ${i + 1}: quantity must be greater than 0`,
              timestamp: new Date().toISOString(),
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate product exists - Requirement 9.2
      try {
        const product = await productService.getProduct(lineItem.sku);
        if (!product) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'PRODUCT_NOT_FOUND',
                message: `Line item ${i + 1}: Product with SKU "${lineItem.sku}" does not exist in the system (Requirement 9.2)`,
                timestamp: new Date().toISOString(),
              },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Line item ${i + 1}: Product with SKU "${lineItem.sku}" does not exist in the system (Requirement 9.2)`,
              timestamp: new Date().toISOString(),
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate expected quantity if provided
      if (lineItem.expectedQuantity !== undefined && lineItem.expectedQuantity !== null) {
        if (lineItem.expectedQuantity < 0) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'VALIDATION_ERROR',
                message: `Line item ${i + 1}: expectedQuantity must be non-negative`,
                timestamp: new Date().toISOString(),
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Create receiving record
    const receiving = await receivingService.createReceiving({
      supplierId,
      receivingDate: parsedDate,
      documentType,
      documentRef,
      createdBy: user.userId,
    });

    // Add all line items to the receiving record
    for (const lineItem of lineItems) {
      await receivingService.addLineItem(receiving.receivingId, lineItem);
    }

    // Detect variances - Requirement 9.5
    const variances = receivingService.detectVariances(lineItems);
    const hasVariance = variances.some(v => v.requiresReview);

    console.log(
      `Receiving record created: ${receiving.receivingId} by ${user.userId} - ` +
      `${lineItems.length} line items, variance: ${hasVariance ? 'YES' : 'NO'}`
    );

    // Return success response
    const response: CreateReceivingResponse = {
      success: true,
      message: hasVariance 
        ? 'Receiving record created successfully. Variance detected - record flagged for review.'
        : 'Receiving record created successfully.',
      receivingId: receiving.receivingId,
      hasVariance,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating receiving record:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: {
          code: 'CREATE_RECEIVING_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create receiving record',
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
