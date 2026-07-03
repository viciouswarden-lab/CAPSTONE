/**
 * API Endpoint: Confirm Product Match
 * 
 * Confirms a product match suggestion by:
 * 1. Calling MatcherService.confirmMatch to create product link
 * 2. Updating pricelist_item status to 'matched'
 * 3. Recording match confirmation for learning system
 * 
 * Requirements: 4.6
 * Task: 27.2
 */

import type { APIRoute } from 'astro';
import { matcherService } from '@/services/matching';
import { db } from '@/services/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface ConfirmMatchRequest {
  itemId: string;
  supplierCode: string;
  internalSKU: string;
  supplierId: string;
  pricelistId: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as ConfirmMatchRequest;
    const { itemId, supplierCode, internalSKU, supplierId, pricelistId } = body;

    // Validate required fields
    if (!itemId || !supplierCode || !internalSKU || !supplierId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: itemId, supplierCode, internalSKU, supplierId',
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the pricelist item to get the price
    const pricelistItemRef = doc(db, 'pricelist_items', itemId);
    const pricelistItemSnap = await getDoc(pricelistItemRef);
    
    let price: number | undefined;
    if (pricelistItemSnap.exists()) {
      const pricelistItem = pricelistItemSnap.data();
      price = pricelistItem.price;
      console.log(`Retrieved price from pricelist item: ₱${price}`);
    }

    // Call MatcherService to confirm the match
    // This creates the supplier mapping in the product document
    // and stores the confirmation for learning
    // Now includes the price from the pricelist item
    await matcherService.confirmMatch(supplierCode, internalSKU, supplierId, price);

    // Update the pricelist_item status to 'matched'
    await updateDoc(pricelistItemRef, {
      matchStatus: 'matched',
      matchedSKU: internalSKU,
      matchConfidence: 1.0, // User-confirmed matches have 100% confidence
      matchType: 'confirmed',
      matchedAt: Timestamp.now(),
    });

    console.log(`Match confirmed: ${supplierCode} -> ${internalSKU} (item: ${itemId}) with cost: ₱${price}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Match confirmed successfully',
        data: {
          itemId,
          supplierCode,
          internalSKU,
          supplierId,
          price,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error confirming match:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: {
          code: 'CONFIRM_MATCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to confirm match',
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
