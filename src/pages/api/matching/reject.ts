/**
 * API Endpoint: Reject Product Match
 * 
 * Rejects a product match suggestion by:
 * 1. Updating pricelist_item status to 'unmatched'
 * 2. Clearing suggested match data
 * 3. Returning product to unmatched queue for manual review
 * 
 * Requirements: 4.6
 * Task: 27.2
 */

import type { APIRoute } from 'astro';
import { db } from '@/services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

interface RejectMatchRequest {
  itemId: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as RejectMatchRequest;
    const { itemId } = body;

    // Validate required fields
    if (!itemId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: itemId',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the pricelist_item status to 'unmatched'
    // Clear suggested match data
    const pricelistItemRef = doc(db, 'pricelist_items', itemId);
    await updateDoc(pricelistItemRef, {
      matchStatus: 'unmatched',
      matchedSKU: null,
      matchConfidence: null,
      matchType: null,
      rejectedAt: Timestamp.now(),
    });

    console.log(`Match rejected for item: ${itemId}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Match rejected successfully. Product returned to unmatched queue.',
        data: {
          itemId,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error rejecting match:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: {
          code: 'REJECT_MATCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to reject match',
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
