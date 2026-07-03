/**
 * API Endpoint: Adjust Inventory
 * 
 * Processes physical count adjustments by:
 * 1. Validating input (product exists, location valid, quantity is number)
 * 2. Calling InventoryService.adjustInventory to update quantity
 * 3. Logging adjustment with user identity and timestamp
 * 4. Returning confirmation with before/after quantities
 * 
 * Requirements: 8.7
 * Task: 28.2
 */

import type { APIRoute } from 'astro';
import { inventoryService } from '@/services/inventory';
import { productService } from '@/services/products';
import type { InventoryAdjustment } from '@/types/models';

interface AdjustInventoryRequest {
  sku: string;
  locationId: string;
  quantityChange: number;
  reason: 'receiving' | 'sale' | 'adjustment' | 'return';
  notes?: string;
  userId: string;
}

interface AdjustInventoryResponse {
  success: boolean;
  message: string;
  data: {
    sku: string;
    locationId: string;
    quantityBefore: number;
    quantityAfter: number;
    quantityChange: number;
    reason: string;
    timestamp: string;
  };
  timestamp: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as AdjustInventoryRequest;
    const { sku, locationId, quantityChange, reason, notes, userId } = body;

    // Validate required fields
    if (!sku || !locationId || quantityChange === undefined || !reason || !userId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: sku, locationId, quantityChange, reason, userId',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate quantity is a number
    if (typeof quantityChange !== 'number' || isNaN(quantityChange)) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'quantityChange must be a valid number',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate product exists
    const product = await productService.getProduct(sku);
    if (!product) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product with SKU "${sku}" does not exist`,
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate location is not empty
    if (!locationId.trim()) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'locationId cannot be empty',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get quantity before adjustment
    const quantityBefore = await inventoryService.getQuantityOnHand(sku, locationId);

    // Create adjustment record with timestamp
    const timestamp = new Date();
    const adjustment: InventoryAdjustment = {
      sku,
      locationId,
      quantityChange,
      reason,
      userId,
      timestamp,
      notes: notes || undefined,
    };

    // Call InventoryService to perform adjustment
    // This updates the inventory record and logs the adjustment with user identity and timestamp
    // Requirement 8.7: Update Inventory_Record and log adjustment with user identity and timestamp
    await inventoryService.adjustInventory(adjustment);

    // Get quantity after adjustment
    const quantityAfter = await inventoryService.getQuantityOnHand(sku, locationId);

    console.log(
      `Inventory adjusted: ${sku} at ${locationId} by ${userId} - ` +
      `${quantityBefore} → ${quantityAfter} (${quantityChange >= 0 ? '+' : ''}${quantityChange})`
    );

    // Return success response with confirmation and updated quantities
    const response: AdjustInventoryResponse = {
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        sku,
        locationId,
        quantityBefore,
        quantityAfter,
        quantityChange,
        reason,
        timestamp: timestamp.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error adjusting inventory:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: {
          code: 'ADJUST_INVENTORY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to adjust inventory',
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
