/**
 * API Endpoint: Set Price
 * 
 * Handles setting/updating a single product's retail price.
 * Requirements: 12.1
 */

import type { APIRoute } from 'astro';
import { PricingService } from '../../../services/pricing/PricingService';
import type { PricingRecord } from '../../../services/pricing/PricingService';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { sku, priceTier, retailPrice, effectiveDate, updatedBy } = body;

    // Validate required fields
    if (!sku || !priceTier || !retailPrice || !effectiveDate || !updatedBy) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'sku, priceTier, retailPrice, effectiveDate, and updatedBy are required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate price tier
    const validTiers = ['standard', 'wholesale', 'vip'];
    if (!validTiers.includes(priceTier)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid price tier. Must be standard, wholesale, or vip' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create pricing record
    const pricingRecord: PricingRecord = {
      sku,
      priceTier,
      retailPrice: parseFloat(retailPrice),
      effectiveDate: new Date(effectiveDate),
      updatedBy,
    };

    // Set price
    const pricingService = new PricingService();
    await pricingService.setRetailPrice(pricingRecord);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Price updated successfully' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Set price error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to set price' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
