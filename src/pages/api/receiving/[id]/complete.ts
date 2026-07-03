/**
 * Complete Receiving API Endpoint
 * 
 * POST /api/receiving/[id]/complete
 * 
 * Marks a receiving record as completed and updates all associated inventory records atomically.
 * This endpoint validates receiving status, calls InventoryService.processReceiving to update
 * inventory quantities, and marks the receiving as completed with a timestamp.
 * 
 * Requirements: 9.3
 * Task: 29.3
 */

import type { APIRoute } from 'astro';
import { receivingService } from '../../../../services/receiving';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Receiving ID is required',
            timestamp: new Date().toISOString(),
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user ID from session/auth (placeholder - should be from actual session)
    const userId = 'system'; // TODO: Get from authenticated session

    // Call receivingService.completeReceiving which handles:
    // 1. Validation (receiving exists and is pending)
    // 2. Inventory updates via inventoryService.processReceiving (atomic)
    // 3. Status update to 'completed' with completedAt timestamp
    // 4. Variance detection and flagging
    const variances = await receivingService.completeReceiving(id, userId);

    // Get updated receiving record
    const updatedReceiving = await receivingService.getReceivingById(id);

    // Build response with inventory update summary
    const itemsUpdated = updatedReceiving.lineItems.length;
    const totalQuantityAdded = updatedReceiving.lineItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const hasVariance = variances.some(v => v.requiresReview);

    return new Response(
      JSON.stringify({
        success: true,
        receiving: {
          receivingId: updatedReceiving.receivingId,
          supplierId: updatedReceiving.supplierId,
          receivingDate: updatedReceiving.receivingDate.toISOString(),
          documentType: updatedReceiving.documentType,
          status: updatedReceiving.status,
          lineItems: updatedReceiving.lineItems,
        },
        inventorySummary: {
          itemsUpdated,
          totalQuantityAdded,
          hasVariance,
          variances: variances.filter(v => v.requiresReview).map(v => ({
            sku: v.sku,
            expected: v.expectedQuantity,
            received: v.receivedQuantity,
            variancePercentage: (v.variancePercentage * 100).toFixed(1) + '%',
          })),
        },
        message: hasVariance
          ? `Receiving completed with variance alerts. ${itemsUpdated} items updated, ${totalQuantityAdded} total units added to inventory.`
          : `Receiving completed successfully. ${itemsUpdated} items updated, ${totalQuantityAdded} total units added to inventory.`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error completing receiving:', error);

    // Determine error type and status code
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    // Handle specific error cases
    if (errorMessage.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (errorMessage.includes('already completed') || errorMessage.includes('already')) {
      statusCode = 400;
      errorCode = 'ALREADY_COMPLETED';
    } else if (errorMessage.includes('Cannot complete') || errorMessage.includes('no line items')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (errorMessage.includes('Failed to process receiving') || errorMessage.includes('inventory')) {
      statusCode = 500;
      errorCode = 'INVENTORY_UPDATE_FAILED';
    }

    return new Response(
      JSON.stringify({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: `complete_${Date.now()}`,
        },
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
