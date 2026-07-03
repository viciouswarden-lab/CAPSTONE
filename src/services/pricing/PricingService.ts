/**
 * Pricing Service Implementation
 * 
 * Manages retail pricing calculations, margin rules, and pricing tier management.
 * Calculates suggested retail prices based on supplier costs and configured margins.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import type { PricingDoc } from '../../types/firestore';

/**
 * Pricing tier types
 */
export type PriceTier = 'standard' | 'wholesale' | 'vip';

/**
 * Retail price calculation input
 */
export interface RetailPriceInput {
  cost: number;
  marginPercentage: number;
}

/**
 * Retail price calculation result
 */
export interface RetailPriceResult {
  retailPrice: number;
  cost: number;
  margin: number;
  marginPercentage: number;
  hasNegativeMargin: boolean;
}

/**
 * Pricing record for setting/getting prices
 */
export interface PricingRecord {
  sku: string;
  priceTier: PriceTier;
  retailPrice: number;
  effectiveDate: Date;
  updatedBy: string;
}

/**
 * Price history entry
 */
export interface PriceHistoryEntry {
  retailPrice: number;
  effectiveDate: Date;
  updatedBy: string;
}

/**
 * PricingService
 * 
 * Handles retail price calculations and management across multiple pricing tiers.
 */
export class PricingService {
  private db = getFirestore();

  /**
   * Calculate suggested retail price based on supplier cost and margin percentage
   * 
   * Formula: retail_price = cost * (1 + margin/100)
   * Result is rounded to 2 decimal places
   * 
   * @param input - Cost and margin percentage
   * @returns Calculated retail price and margin details
   * 
   * Requirement 12.2
   */
  calculateRetailPrice(input: RetailPriceInput): RetailPriceResult {
    const { cost, marginPercentage } = input;

    // Validate inputs
    if (cost < 0) {
      throw new Error('Cost must be non-negative');
    }

    // Calculate retail price using the formula: retail_price = cost * (1 + margin/100)
    const retailPrice = cost * (1 + marginPercentage / 100);
    
    // Round to 2 decimal places
    const roundedRetailPrice = Math.round(retailPrice * 100) / 100;
    
    // Calculate actual margin in currency
    const margin = roundedRetailPrice - cost;
    
    // Check for negative margin
    const hasNegativeMargin = roundedRetailPrice < cost;

    return {
      retailPrice: roundedRetailPrice,
      cost,
      margin,
      marginPercentage,
      hasNegativeMargin,
    };
  }

  /**
   * Set retail price for a product
   * 
   * @param record - Pricing record to store
   * @returns Promise resolving when price is saved
   * 
   * Requirement 12.1
   */
  async setRetailPrice(record: PricingRecord): Promise<void> {
    const { sku, priceTier, retailPrice, effectiveDate, updatedBy } = record;

    // Validate
    if (retailPrice < 0) {
      throw new Error('Retail price must be non-negative');
    }

    // Create document ID
    const pricingId = `${sku}_${priceTier}`;

    const pricingDoc: PricingDoc = {
      pricingId,
      sku,
      priceTier,
      retailPrice,
      effectiveDate: Timestamp.fromDate(effectiveDate),
      updatedBy,
      updatedAt: Timestamp.now(),
    };

    const docRef = doc(this.db, 'pricing', pricingId);
    await setDoc(docRef, pricingDoc);
  }

  /**
   * Get current retail price for a product and tier
   * 
   * @param sku - Product SKU
   * @param priceTier - Pricing tier
   * @returns Promise resolving to current price or null if not found
   * 
   * Requirement 12.1
   */
  async getRetailPrice(sku: string, priceTier: PriceTier): Promise<number | null> {
    const pricingId = `${sku}_${priceTier}`;
    const docRef = doc(this.db, 'pricing', pricingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as PricingDoc;
    return data.retailPrice;
  }

  /**
   * Get price history for a product and tier
   * 
   * @param sku - Product SKU
   * @param priceTier - Pricing tier
   * @returns Promise resolving to price history
   * 
   * Requirement 12.5
   */
  async getPriceHistory(sku: string, priceTier: PriceTier): Promise<PriceHistoryEntry[]> {
    // Note: This is a simplified implementation
    // In a full implementation, you would maintain a separate price_history collection
    // For now, we just return the current price as a single history entry
    
    const currentPrice = await this.getRetailPrice(sku, priceTier);
    if (currentPrice === null) {
      return [];
    }

    const pricingId = `${sku}_${priceTier}`;
    const docRef = doc(this.db, 'pricing', pricingId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return [];
    }

    const data = docSnap.data() as PricingDoc;
    
    return [{
      retailPrice: data.retailPrice,
      effectiveDate: data.effectiveDate.toDate(),
      updatedBy: data.updatedBy,
    }];
  }

  /**
   * Check if a proposed price would result in a negative margin
   * 
   * @param proposedPrice - Proposed retail price
   * @param cost - Supplier cost
   * @returns True if margin would be negative (price < cost)
   * 
   * Requirement 12.6
   */
  hasNegativeMargin(proposedPrice: number, cost: number): boolean {
    return proposedPrice < cost;
  }

  /**
   * Get all pricing tiers for a product
   * 
   * @param sku - Product SKU
   * @returns Promise resolving to array of pricing records for all tiers
   * 
   * Requirement 12.3
   */
  async getPricingTiers(sku: string): Promise<PricingRecord[]> {
    const pricingTiers: PriceTier[] = ['standard', 'wholesale', 'vip'];
    const results: PricingRecord[] = [];

    for (const tier of pricingTiers) {
      const pricingId = `${sku}_${tier}`;
      const docRef = doc(this.db, 'pricing', pricingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as PricingDoc;
        results.push({
          sku: data.sku,
          priceTier: data.priceTier,
          retailPrice: data.retailPrice,
          effectiveDate: data.effectiveDate.toDate(),
          updatedBy: data.updatedBy,
        });
      }
    }

    return results;
  }

  /**
   * Bulk update prices for multiple products
   * 
   * @param updates - Array of pricing records to update
   * @returns Promise resolving when all updates complete
   * 
   * Requirement 12.4
   */
  async bulkUpdatePrices(updates: PricingRecord[]): Promise<void> {
    // Process updates sequentially (in production, consider batch writes)
    for (const record of updates) {
      await this.setRetailPrice(record);
    }
  }
}
