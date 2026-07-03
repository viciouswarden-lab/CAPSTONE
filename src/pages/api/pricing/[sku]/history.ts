/**
 * API Endpoint: Price History
 * 
 * Retrieves price history for a specific product across all tiers.
 * Requirements: 12.5
 */

import type { APIRoute } from 'astro';
import { PricingService, type PriceTier } from '../../../../services/pricing/PricingService';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { sku } = params;

    if (!sku) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'SKU is required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch price history for all tiers
    const pricingService = new PricingService();
    const tiers: PriceTier[] = ['standard', 'wholesale', 'vip'];
    
    const history = [];

    for (const tier of tiers) {
      const tierHistory = await pricingService.getPriceHistory(sku, tier);
      
      // Add tier information to each history entry
      tierHistory.forEach(entry => {
        history.push({
          tier,
          retailPrice: entry.retailPrice,
          effectiveDate: entry.effectiveDate.toISOString(),
          updatedBy: entry.updatedBy,
        });
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sku,
        history
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Price history error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch price history' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
