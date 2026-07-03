/**
 * API Endpoint: Bulk Price Update
 * 
 * Handles bulk updating of retail prices for multiple products.
 * Requirements: 12.1, 12.4
 */

import type { APIRoute } from 'astro';
import { PricingService } from '../../../services/pricing/PricingService';
import type { PricingRecord } from '../../../services/pricing/PricingService';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid request: updates array is required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate each update
    for (const update of updates) {
      if (!update.sku || !update.priceTier || !update.retailPrice || !update.effectiveDate || !update.updatedBy) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Invalid update: sku, priceTier, retailPrice, effectiveDate, and updatedBy are required' 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Convert updates to PricingRecord format
    const pricingRecords: PricingRecord[] = updates.map(update => ({
      sku: update.sku,
      priceTier: update.priceTier,
      retailPrice: update.retailPrice,
      effectiveDate: new Date(update.effectiveDate),
      updatedBy: update.updatedBy,
    }));

    // Execute bulk update
    const pricingService = new PricingService();
    await pricingService.bulkUpdatePrices(pricingRecords);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully updated ${pricingRecords.length} product(s)` 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk price update error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update prices' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
