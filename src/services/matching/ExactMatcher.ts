/**
 * Exact Matcher Service
 * 
 * Performs direct SKU code comparison between supplier product codes
 * and internal product SKUs. Returns matches with confidence 1.0.
 * 
 * Requirements: 4.1, 4.2
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { MatchedProduct, PricelistItem } from '@/types/models';
import type { ProductDoc } from '@/types/firestore';

/**
 * ExactMatcher class
 * 
 * Implements exact SKU matching logic by comparing supplier codes
 * against internal SKU database.
 */
export class ExactMatcher {
  /**
   * Match a single supplier product against internal SKU database
   * 
   * Performs two checks:
   * 1. Direct SKU match: supplierCode === product.sku
   * 2. Supplier mapping match: supplierCode === product.supplierMappings[].supplierCode
   * 
   * @param supplierProduct - Supplier product item to match
   * @param supplierId - ID of the supplier
   * @returns MatchedProduct with confidence 1.0 if exact match found, null otherwise
   * 
   * Requirements: 4.1, 4.2
   */
  async matchProduct(
    supplierProduct: PricelistItem,
    supplierId: string
  ): Promise<MatchedProduct | null> {
    const { supplierCode } = supplierProduct;

    // Check 1: Direct SKU match
    const directMatch = await this.findDirectSKUMatch(supplierCode);
    if (directMatch) {
      return {
        supplierCode,
        internalSKU: directMatch.sku,
        confidence: 1.0,
        matchType: 'exact',
      };
    }

    // Check 2: Supplier mapping match
    const mappingMatch = await this.findSupplierMappingMatch(supplierCode, supplierId);
    if (mappingMatch) {
      return {
        supplierCode,
        internalSKU: mappingMatch.sku,
        confidence: 1.0,
        matchType: 'exact',
      };
    }

    return null;
  }

  /**
   * Match multiple supplier products against internal SKU database
   * 
   * @param items - Array of supplier product items to match
   * @param supplierId - ID of the supplier
   * @returns Array of MatchedProduct results for exact matches
   * 
   * Requirements: 4.1, 4.2
   */
  async matchProducts(
    items: PricelistItem[],
    supplierId: string
  ): Promise<MatchedProduct[]> {
    const matches: MatchedProduct[] = [];

    for (const item of items) {
      const match = await this.matchProduct(item, supplierId);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Find a product by direct SKU match
   * 
   * Searches for a product where the supplier code exactly matches the internal SKU.
   * 
   * @param supplierCode - Supplier's product code
   * @returns ProductDoc if found, null otherwise
   * 
   * @private
   */
  private async findDirectSKUMatch(supplierCode: string): Promise<ProductDoc | null> {
    try {
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        where('sku', '==', supplierCode),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      // Return the first matching product
      const doc = querySnapshot.docs[0];
      return doc.data() as ProductDoc;
    } catch (error) {
      console.error('Error finding direct SKU match:', error);
      throw new Error(`Failed to search for direct SKU match: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find a product by supplier mapping match
   * 
   * Searches for a product where the supplier code matches one of the
   * supplier mappings for the given supplier.
   * 
   * Note: Firestore doesn't support querying array elements with multiple conditions,
   * so we fetch all products for the supplier and filter in memory.
   * 
   * @param supplierCode - Supplier's product code
   * @param supplierId - Supplier ID
   * @returns ProductDoc if found, null otherwise
   * 
   * @private
   */
  private async findSupplierMappingMatch(
    supplierCode: string,
    supplierId: string
  ): Promise<ProductDoc | null> {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('isActive', '==', true));

      const querySnapshot = await getDocs(q);

      // Filter products in memory to find matching supplier code
      for (const doc of querySnapshot.docs) {
        const product = doc.data() as ProductDoc;

        // Check if any supplier mapping matches
        const hasMatch = product.supplierMappings?.some(
          (mapping) =>
            mapping.supplierId === supplierId &&
            mapping.supplierCode === supplierCode
        );

        if (hasMatch) {
          return product;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding supplier mapping match:', error);
      throw new Error(`Failed to search for supplier mapping match: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Create and export a singleton instance
 */
export const exactMatcher = new ExactMatcher();
