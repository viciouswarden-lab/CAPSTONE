/**
 * New Product Detector
 * 
 * Detects new products by comparing a current pricelist against a previous
 * pricelist from the same supplier. Products present in the current pricelist
 * but absent from the previous pricelist are flagged as new products.
 * 
 * This helps category managers identify new offerings from suppliers for
 * evaluation and potential inclusion in the catalog.
 * 
 * Requirements: 5.1, 5.2
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PricelistData, PricelistItem } from '@/types/models';
import type { PricelistDoc, PricelistItemDoc } from '@/types/firestore';

/**
 * New product detection result
 */
export interface NewProductDetectionResult {
  /**
   * Products identified as new (present in current but not in previous)
   */
  newProducts: PricelistItem[];

  /**
   * Number of products in the current pricelist
   */
  currentCount: number;

  /**
   * Number of products in the previous pricelist
   */
  previousCount: number;

  /**
   * Supplier ID
   */
  supplierId: string;
}

/**
 * NewProductDetector class
 * 
 * Compares two pricelists from the same supplier to identify new products.
 * 
 * Requirements: 5.1, 5.2
 */
export class NewProductDetector {
  /**
   * Detect new products by comparing current and previous pricelists
   * 
   * A product is considered "new" if:
   * - It exists in the current pricelist
   * - It does NOT exist in the previous pricelist
   * - Comparison is based on supplier product code
   * 
   * @param currentPricelist - The new/current pricelist to analyze
   * @param previousPricelist - The previous pricelist to compare against
   * @returns Detection result with new products identified
   * @throws Error if pricelists are from different suppliers
   * 
   * Requirements: 5.1, 5.2
   */
  detectNewProducts(
    currentPricelist: PricelistData,
    previousPricelist: PricelistData
  ): NewProductDetectionResult {
    // Validate that both pricelists are from the same supplier
    if (currentPricelist.supplierId !== previousPricelist.supplierId) {
      throw new Error(
        `Pricelists must be from the same supplier. ` +
        `Current: ${currentPricelist.supplierId}, Previous: ${previousPricelist.supplierId}`
      );
    }

    // Build a Set of supplier codes from the previous pricelist for O(1) lookups
    const previousCodes = new Set<string>(
      previousPricelist.items.map((item) => item.supplierCode)
    );

    // Find products in current pricelist that don't exist in previous
    const newProducts: PricelistItem[] = [];

    for (const currentItem of currentPricelist.items) {
      if (!previousCodes.has(currentItem.supplierCode)) {
        // This product code is new - it wasn't in the previous pricelist
        newProducts.push(currentItem);
      }
    }

    // Log detection summary
    console.log(
      `New product detection complete for supplier ${currentPricelist.supplierId}: ` +
      `${newProducts.length} new products found ` +
      `(current: ${currentPricelist.items.length}, previous: ${previousPricelist.items.length})`
    );

    return {
      newProducts,
      currentCount: currentPricelist.items.length,
      previousCount: previousPricelist.items.length,
      supplierId: currentPricelist.supplierId,
    };
  }

  /**
   * Detect new products by comparing current pricelist against multiple
   * previous pricelists from the same supplier
   * 
   * A product is considered "new" if it exists in the current pricelist
   * but doesn't exist in ANY of the previous pricelists.
   * 
   * This variant is useful when you want to check against historical data
   * to avoid false positives (e.g., seasonal products that come and go).
   * 
   * @param currentPricelist - The new/current pricelist to analyze
   * @param previousPricelists - Array of previous pricelists to compare against
   * @returns Detection result with new products identified
   * @throws Error if any pricelist is from a different supplier
   */
  detectNewProductsAgainstMultiple(
    currentPricelist: PricelistData,
    previousPricelists: PricelistData[]
  ): NewProductDetectionResult {
    // Validate all pricelists are from the same supplier
    for (const pricelist of previousPricelists) {
      if (pricelist.supplierId !== currentPricelist.supplierId) {
        throw new Error(
          `All pricelists must be from the same supplier. ` +
          `Expected: ${currentPricelist.supplierId}, Got: ${pricelist.supplierId}`
        );
      }
    }

    // Build a Set of ALL supplier codes from previous pricelists
    const previousCodes = new Set<string>();

    for (const pricelist of previousPricelists) {
      for (const item of pricelist.items) {
        previousCodes.add(item.supplierCode);
      }
    }

    // Find products in current pricelist that don't exist in any previous
    const newProducts: PricelistItem[] = [];

    for (const currentItem of currentPricelist.items) {
      if (!previousCodes.has(currentItem.supplierCode)) {
        newProducts.push(currentItem);
      }
    }

    // Calculate total previous count
    const previousCount = previousPricelists.reduce(
      (sum, pl) => sum + pl.items.length,
      0
    );

    console.log(
      `New product detection complete for supplier ${currentPricelist.supplierId}: ` +
      `${newProducts.length} new products found ` +
      `(current: ${currentPricelist.items.length}, ` +
      `previous: ${previousCount} across ${previousPricelists.length} pricelists)`
    );

    return {
      newProducts,
      currentCount: currentPricelist.items.length,
      previousCount,
      supplierId: currentPricelist.supplierId,
    };
  }

  /**
   * Detect both new and discontinued products
   * 
   * Returns both:
   * - New products: in current but not in previous
   * - Discontinued products: in previous but not in current
   * 
   * @param currentPricelist - The new/current pricelist
   * @param previousPricelist - The previous pricelist
   * @returns Object with new and discontinued products
   * @throws Error if pricelists are from different suppliers
   */
  detectProductChanges(
    currentPricelist: PricelistData,
    previousPricelist: PricelistData
  ): {
    newProducts: PricelistItem[];
    discontinuedProducts: PricelistItem[];
    supplierId: string;
  } {
    // Validate that both pricelists are from the same supplier
    if (currentPricelist.supplierId !== previousPricelist.supplierId) {
      throw new Error(
        `Pricelists must be from the same supplier. ` +
        `Current: ${currentPricelist.supplierId}, Previous: ${previousPricelist.supplierId}`
      );
    }

    // Build Sets for efficient lookups
    const previousCodes = new Set<string>(
      previousPricelist.items.map((item) => item.supplierCode)
    );
    const currentCodes = new Set<string>(
      currentPricelist.items.map((item) => item.supplierCode)
    );

    // Find new products (in current but not in previous)
    const newProducts = currentPricelist.items.filter(
      (item) => !previousCodes.has(item.supplierCode)
    );

    // Find discontinued products (in previous but not in current)
    const discontinuedProducts = previousPricelist.items.filter(
      (item) => !currentCodes.has(item.supplierCode)
    );

    console.log(
      `Product changes detected for supplier ${currentPricelist.supplierId}: ` +
      `${newProducts.length} new, ${discontinuedProducts.length} discontinued`
    );

    return {
      newProducts,
      discontinuedProducts,
      supplierId: currentPricelist.supplierId,
    };
  }

  /**
   * Fetch the most recent previous pricelist from Firestore for a supplier
   * 
   * Retrieves the most recent pricelist from Firestore that was uploaded
   * before the current pricelist's upload date.
   * 
   * @param supplierId - The supplier ID
   * @param beforeDate - Optional date to query pricelists before (defaults to now)
   * @returns Promise resolving to the previous pricelist, or null if none found
   * 
   * Requirements: 5.1
   */
  async fetchPreviousPricelist(
    supplierId: string,
    beforeDate?: Date
  ): Promise<PricelistData | null> {
    try {
      const cutoffDate = beforeDate || new Date();

      // Query for the most recent pricelist before the cutoff date
      const pricelistsRef = collection(db, 'pricelists');
      const q = query(
        pricelistsRef,
        where('supplierId', '==', supplierId),
        where('uploadDate', '<', Timestamp.fromDate(cutoffDate)),
        orderBy('uploadDate', 'desc'),
        limit(1)
      );

      const pricelistSnapshot = await getDocs(q);

      if (pricelistSnapshot.empty) {
        console.log(`No previous pricelist found for supplier ${supplierId}`);
        return null;
      }

      const pricelistDoc = pricelistSnapshot.docs[0].data() as PricelistDoc;
      const pricelistId = pricelistDoc.pricelistId;

      // Fetch all items for this pricelist
      const itemsRef = collection(db, 'pricelist_items');
      const itemsQuery = query(
        itemsRef,
        where('pricelistId', '==', pricelistId)
      );

      const itemsSnapshot = await getDocs(itemsQuery);
      const items: PricelistItem[] = [];

      for (const doc of itemsSnapshot.docs) {
        const itemDoc = doc.data() as PricelistItemDoc;
        items.push({
          supplierCode: itemDoc.supplierCode,
          description: itemDoc.description,
          price: itemDoc.price,
          uom: itemDoc.uom,
        });
      }

      console.log(
        `Fetched previous pricelist for supplier ${supplierId}: ` +
        `${items.length} items from ${pricelistDoc.uploadDate.toDate().toISOString()}`
      );

      return {
        supplierId: pricelistDoc.supplierId,
        uploadDate: pricelistDoc.uploadDate.toDate(),
        items,
      };
    } catch (error) {
      console.error('Error fetching previous pricelist:', error);
      throw new Error(
        `Failed to fetch previous pricelist: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect new products by comparing current pricelist against the previous
   * pricelist fetched from Firestore
   * 
   * This is the main method for integration with the pricelist processing pipeline.
   * It automatically fetches the most recent previous pricelist from Firestore.
   * 
   * @param currentPricelist - The new/current pricelist to analyze
   * @returns Promise resolving to detection result with new products identified
   * 
   * Requirements: 5.1, 5.2
   */
  async detectNewProductsFromFirestore(
    currentPricelist: PricelistData
  ): Promise<NewProductDetectionResult> {
    // Fetch the previous pricelist from Firestore
    const previousPricelist = await this.fetchPreviousPricelist(
      currentPricelist.supplierId,
      currentPricelist.uploadDate
    );

    // If no previous pricelist exists, all products are new
    if (!previousPricelist) {
      console.log(
        `No previous pricelist found for supplier ${currentPricelist.supplierId}. ` +
        `All ${currentPricelist.items.length} products marked as new.`
      );

      return {
        newProducts: currentPricelist.items,
        currentCount: currentPricelist.items.length,
        previousCount: 0,
        supplierId: currentPricelist.supplierId,
      };
    }

    // Use the existing detection logic
    return this.detectNewProducts(currentPricelist, previousPricelist);
  }
}

/**
 * Create and export a singleton instance
 */
export const newProductDetector = new NewProductDetector();

/**
 * Create a new NewProductDetector instance
 * 
 * @returns New NewProductDetector instance
 */
export function createNewProductDetector(): NewProductDetector {
  return new NewProductDetector();
}
