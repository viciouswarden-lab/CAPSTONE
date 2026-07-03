/**
 * Price Change Detector
 * 
 * Compares product prices between pricelists and detects changes.
 * Calculates absolute and percentage differences.
 * 
 * Requirements: 6.1, 6.2
 */

import type { PricelistData, PriceChange } from '../../types/models';

/**
 * Price change detector utility
 * 
 * Compares prices between old and new pricelists to detect changes.
 * Uses formula: percentage_change = ((new_price - old_price) / old_price) * 100
 */
export class PriceChangeDetector {
  /**
   * Calculate the percentage change between old and new prices
   * 
   * Formula: ((new_price - old_price) / old_price) * 100
   * 
   * @param oldPrice - Previous price
   * @param newPrice - Current price
   * @returns Percentage change rounded to 2 decimal places
   * 
   * Requirement 6.2
   */
  calculatePercentageChange(oldPrice: number, newPrice: number): number {
    // Handle edge case: old price is 0 to avoid division by zero
    if (oldPrice === 0) {
      return 0;
    }
    
    const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
    
    // Round to 2 decimal places
    return Math.round(percentageChange * 100) / 100;
  }
  
  /**
   * Calculate the absolute difference between old and new prices
   * 
   * @param oldPrice - Previous price
   * @param newPrice - Current price
   * @returns Absolute difference (new_price - old_price)
   * 
   * Requirement 6.2
   */
  calculateAbsoluteDifference(oldPrice: number, newPrice: number): number {
    return Math.round((newPrice - oldPrice) * 100) / 100;
  }
  
  /**
   * Check if a price change is significant (increase > 10%)
   * 
   * @param percentageChange - Percentage change value
   * @returns true if change is a significant increase, false otherwise
   * 
   * Requirement 6.3
   */
  isSignificantIncrease(percentageChange: number): boolean {
    return percentageChange > 10;
  }
  
  /**
   * Compare prices between two pricelists and detect changes
   * 
   * @param currentPricelist - Current pricelist data
   * @param previousPricelist - Previous pricelist data from the same supplier
   * @returns Array of PriceChange records for items that exist in both lists
   * 
   * Requirements 6.1, 6.2
   */
  detectChanges(
    currentPricelist: PricelistData,
    previousPricelist: PricelistData
  ): PriceChange[] {
    // Validate that both pricelists are from the same supplier
    if (currentPricelist.supplierId !== previousPricelist.supplierId) {
      throw new Error('Cannot compare pricelists from different suppliers');
    }
    
    const changes: PriceChange[] = [];
    
    // Create a map of old prices by supplier code for efficient lookup
    const oldPriceMap = new Map<string, number>();
    for (const item of previousPricelist.items) {
      oldPriceMap.set(item.supplierCode, item.price);
    }
    
    // Compare new prices against old prices
    for (const newItem of currentPricelist.items) {
      const oldPrice = oldPriceMap.get(newItem.supplierCode);
      
      // Only compare if the product existed in the old pricelist
      if (oldPrice !== undefined) {
        const newPrice = newItem.price;
        
        // Skip if prices are the same
        if (oldPrice === newPrice) {
          continue;
        }
        
        const absoluteChange = this.calculateAbsoluteDifference(oldPrice, newPrice);
        const percentageChange = this.calculatePercentageChange(oldPrice, newPrice);
        const isSignificant = this.isSignificantIncrease(percentageChange);
        
        changes.push({
          sku: newItem.supplierCode, // Using supplierCode as SKU for now
          supplierId: currentPricelist.supplierId,
          oldPrice,
          newPrice,
          absoluteChange,
          percentageChange,
          changeDate: currentPricelist.uploadDate,
          isSignificant,
        });
      }
    }
    
    return changes;
  }
}
