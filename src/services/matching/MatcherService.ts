/**
 * Matcher Service Orchestrator
 * 
 * Main orchestrator for product matching operations.
 * Coordinates ExactMatcher, FuzzyMatcher, and AIMatcher to perform
 * intelligent product matching between supplier codes and internal SKUs.
 * 
 * Matching Pipeline:
 * 1. Try ExactMatcher first (confidence 1.0)
 * 2. For unmatched items, try FuzzyMatcher
 * 3. For still-unmatched items, try AIMatcher (if available)
 * 4. Apply 0.85 confidence threshold to determine suggestions vs unmatched
 * 5. Store match confirmations in Firestore for learning
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  Timestamp,
  updateDoc,
  doc,
  limit as firestoreLimit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ExactMatcher } from './ExactMatcher';
import { FuzzyMatcher } from './FuzzyMatcher';
import { AIMatcher, createAIMatcher } from './AIMatcher';
import type {
  PricelistData,
  PricelistItem,
  MatchingResult,
  MatchedProduct,
  UnmatchedProduct,
  MatchSuggestion,
  Product,
} from '@/types/models';
import type { ProductDoc, SupplierMapping } from '@/types/firestore';

/**
 * Configuration for the MatcherService
 */
export interface MatcherServiceConfig {
  /**
   * Confidence threshold for suggestions (0-1)
   * Matches above this threshold are suggested for review.
   * Matches below this threshold are classified as unmatched.
   * 
   * Default: 0.85
   */
  confidenceThreshold?: number;

  /**
   * Whether to use AIMatcher for unmatched products
   * 
   * Default: true
   */
  useAIMatcher?: boolean;

  /**
   * Whether to use FuzzyMatcher for unmatched products
   * 
   * Default: true
   */
  useFuzzyMatcher?: boolean;
}

/**
 * MatcherService class
 * 
 * Orchestrates the product matching pipeline using multiple matching strategies.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */
export class MatcherService {
  private exactMatcher: ExactMatcher;
  private fuzzyMatcher: FuzzyMatcher;
  private aiMatcher: AIMatcher;
  private config: Required<MatcherServiceConfig>;

  /**
   * Create a new MatcherService instance
   * 
   * @param config - Optional configuration for the matcher
   */
  constructor(config: MatcherServiceConfig = {}) {
    this.exactMatcher = new ExactMatcher();
    this.fuzzyMatcher = new FuzzyMatcher();
    this.aiMatcher = createAIMatcher();
    
    this.config = {
      confidenceThreshold: config.confidenceThreshold ?? 0.85,
      useAIMatcher: config.useAIMatcher ?? true,
      useFuzzyMatcher: config.useFuzzyMatcher ?? true,
    };
  }

  /**
   * Match all products in a pricelist to internal SKUs
   * 
   * Implements the matching pipeline:
   * 1. Try ExactMatcher first (confidence 1.0)
   * 2. For unmatched items, try FuzzyMatcher
   * 3. For still-unmatched items, try AIMatcher (if available)
   * 4. Apply 0.85 confidence threshold to determine suggestions vs unmatched
   * 
   * @param pricelist - Pricelist data to match
   * @returns Promise resolving to matching results
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async matchProducts(pricelist: PricelistData): Promise<MatchingResult> {
    const { supplierId, items, uploadDate } = pricelist;

    // Initialize result arrays
    const matched: MatchedProduct[] = [];
    const unmatched: UnmatchedProduct[] = [];
    const suggestions: MatchSuggestion[] = [];

    // Track unmatched items for fuzzy/AI matching
    const unmatchedItems: PricelistItem[] = [];

    // Step 1: Try ExactMatcher first
    console.log(`Starting exact matching for ${items.length} items...`);
    for (const item of items) {
      const exactMatch = await this.exactMatcher.matchProduct(item, supplierId);
      
      if (exactMatch) {
        matched.push(exactMatch);
      } else {
        unmatchedItems.push(item);
      }
    }
    console.log(`Exact matching complete: ${matched.length} matched, ${unmatchedItems.length} unmatched`);

    // If there are no unmatched items, return early
    if (unmatchedItems.length === 0) {
      return { matched, unmatched, suggestions };
    }

    // Load all internal products for fuzzy/AI matching
    const internalProducts = await this.loadInternalProducts();
    console.log(`Loaded ${internalProducts.length} internal products for fuzzy/AI matching`);

    // Step 2: Try FuzzyMatcher for unmatched items
    if (this.config.useFuzzyMatcher) {
      console.log(`Starting fuzzy matching for ${unmatchedItems.length} unmatched items...`);
      const stillUnmatched: PricelistItem[] = [];

      for (const item of unmatchedItems) {
        const fuzzySuggestions = await this.fuzzyMatcher.matchProduct(
          item,
          internalProducts
        );

        // Check if any suggestion exceeds confidence threshold
        const bestMatch = fuzzySuggestions[0];
        
        if (bestMatch && bestMatch.confidence >= this.config.confidenceThreshold) {
          // High confidence - add to suggestions
          suggestions.push(bestMatch);
        } else {
          // Low confidence - keep for AI matching
          stillUnmatched.push(item);
        }
      }

      console.log(`Fuzzy matching complete: ${suggestions.length} suggestions, ${stillUnmatched.length} still unmatched`);

      // Update unmatchedItems for AI matching
      unmatchedItems.length = 0;
      unmatchedItems.push(...stillUnmatched);
    }

    // Step 3: Try AIMatcher for still-unmatched items
    if (this.config.useAIMatcher && unmatchedItems.length > 0) {
      console.log(`Starting AI matching for ${unmatchedItems.length} unmatched items...`);
      const finallyUnmatched: PricelistItem[] = [];

      for (const item of unmatchedItems) {
        const aiSuggestions = await this.aiMatcher.matchProduct(
          item,
          internalProducts
        );

        // Check if any suggestion exceeds confidence threshold
        const bestMatch = aiSuggestions[0];
        
        if (bestMatch && bestMatch.confidence >= this.config.confidenceThreshold) {
          // High confidence - add to suggestions
          suggestions.push(bestMatch);
        } else {
          // Low confidence - classify as unmatched
          finallyUnmatched.push(item);
        }
      }

      console.log(`AI matching complete: ${suggestions.length} total suggestions, ${finallyUnmatched.length} unmatched`);

      // Update unmatchedItems
      unmatchedItems.length = 0;
      unmatchedItems.push(...finallyUnmatched);
    }

    // Step 4: Convert remaining unmatched items to UnmatchedProduct format
    for (const item of unmatchedItems) {
      unmatched.push({
        supplierCode: item.supplierCode,
        description: item.description,
        supplierId,
        uploadDate,
      });
    }

    console.log(`Matching pipeline complete: ${matched.length} matched, ${suggestions.length} suggestions, ${unmatched.length} unmatched`);

    return { matched, unmatched, suggestions };
  }

  /**
   * Get match suggestions for a single supplier product
   * 
   * Uses fuzzy and AI matching to generate suggestions for manual review.
   * 
   * @param supplierProduct - Supplier product to match
   * @returns Promise resolving to array of match suggestions
   * 
   * Requirement 4.3
   */
  async suggestMatch(supplierProduct: PricelistItem): Promise<MatchSuggestion[]> {
    const suggestions: MatchSuggestion[] = [];

    // Load all internal products
    const internalProducts = await this.loadInternalProducts();

    // Try fuzzy matching
    if (this.config.useFuzzyMatcher) {
      const fuzzySuggestions = await this.fuzzyMatcher.matchProduct(
        supplierProduct,
        internalProducts
      );
      suggestions.push(...fuzzySuggestions);
    }

    // Try AI matching
    if (this.config.useAIMatcher) {
      const aiSuggestions = await this.aiMatcher.matchProduct(
        supplierProduct,
        internalProducts
      );
      suggestions.push(...aiSuggestions);
    }

    // Sort by confidence (highest first) and remove duplicates
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    
    return uniqueSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Confirm a match between supplier code and internal SKU
   * 
   * Creates a supplier mapping in the product document and stores
   * the confirmation to improve future matching accuracy.
   * Updates supplier cost from pricelist item.
   * 
   * @param supplierCode - Supplier's product code
   * @param internalSKU - Internal SKU to link
   * @param supplierId - Supplier ID
   * @param price - Price from pricelist item (optional, defaults to 0)
   * @returns Promise resolving when match is confirmed
   * 
   * Requirement 4.6
   */
  async confirmMatch(
    supplierCode: string,
    internalSKU: string,
    supplierId: string,
    price?: number
  ): Promise<void> {
    try {
      // Step 1: Find the product document
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('sku', '==', internalSKU));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`Product with SKU ${internalSKU} not found`);
      }

      const productDoc = querySnapshot.docs[0];
      const product = productDoc.data() as ProductDoc;

      const costToUse = price !== undefined ? price : 0;

      // Step 2: Check if supplier mapping already exists
      const existingMappingIndex = product.supplierMappings?.findIndex(
        (mapping) =>
          mapping.supplierId === supplierId &&
          mapping.supplierCode === supplierCode
      );

      if (existingMappingIndex !== undefined && existingMappingIndex >= 0) {
        // Update existing mapping with new cost
        const updatedMappings = [...(product.supplierMappings || [])];
        updatedMappings[existingMappingIndex] = {
          ...updatedMappings[existingMappingIndex],
          lastCost: costToUse,
          lastCostDate: Timestamp.now(),
        };

        await updateDoc(doc(db, 'products', productDoc.id), {
          supplierMappings: updatedMappings,
          updatedAt: Timestamp.now(),
        });

        console.log(`Updated supplier mapping for ${supplierCode} -> ${internalSKU} with cost ₱${costToUse}`);
        await this.storeMatchConfirmation(supplierCode, internalSKU, supplierId);
        return;
      }

      // Step 3: Add new supplier mapping to product with cost from pricelist
      const newMapping: SupplierMapping = {
        supplierId,
        supplierCode,
        lastCost: costToUse,
        lastCostDate: Timestamp.now(),
      };

      const updatedMappings = [...(product.supplierMappings || []), newMapping];

      await updateDoc(doc(db, 'products', productDoc.id), {
        supplierMappings: updatedMappings,
        updatedAt: Timestamp.now(),
      });

      console.log(`Confirmed match: ${supplierCode} -> ${internalSKU} with cost ₱${costToUse}`);

      // Step 4: Store confirmation for learning (future enhancement)
      // This would feed into AI/ML model training to improve future matches
      await this.storeMatchConfirmation(supplierCode, internalSKU, supplierId);
    } catch (error) {
      console.error('Error confirming match:', error);
      throw new Error(
        `Failed to confirm match: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find all unmatched products for a supplier
   * 
   * Queries pricelist items that have not been matched to internal SKUs.
   * 
   * Requirement 17.2: Optimized query with proper limit and composite index
   * Uses composite index: pricelist_items (supplierId ASC, matchStatus ASC)
   * 
   * @param supplierId - Supplier ID to query
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to array of unmatched products
   * 
   * Requirements 4.7, 17.2
   */
  async findUnmatchedProducts(
    supplierId: string,
    maxResults: number = 1000
  ): Promise<UnmatchedProduct[]> {
    try {
      const pricelistItemsRef = collection(db, 'pricelist_items');
      
      // Use composite index: pricelist_items (supplierId ASC, matchStatus ASC)
      const q = query(
        pricelistItemsRef,
        where('supplierId', '==', supplierId),
        where('matchStatus', '==', 'unmatched'),
        firestoreLimit(maxResults)
      );

      const querySnapshot = await getDocs(q);
      const unmatchedProducts: UnmatchedProduct[] = [];

      for (const doc of querySnapshot.docs) {
        const item = doc.data();
        
        unmatchedProducts.push({
          supplierCode: item.supplierCode,
          description: item.description,
          supplierId: item.supplierId,
          uploadDate: item.uploadDate?.toDate() || new Date(),
        });
      }

      return unmatchedProducts;
    } catch (error) {
      console.error('Error finding unmatched products:', error);
      throw new Error(
        `Failed to find unmatched products: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load all active internal products from Firestore
   * 
   * @returns Promise resolving to array of internal products
   * 
   * @private
   */
  private async loadInternalProducts(): Promise<Product[]> {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      const products: Product[] = [];

      for (const doc of querySnapshot.docs) {
        const productDoc = doc.data() as ProductDoc;
        
        products.push({
          sku: productDoc.sku,
          description: productDoc.description,
          category: productDoc.category,
          unitOfMeasure: productDoc.unitOfMeasure,
          reorderPoint: productDoc.reorderPoint,
          isActive: productDoc.isActive,
          createdAt: productDoc.createdAt.toDate(),
          updatedAt: productDoc.updatedAt.toDate(),
          supplierMappings: productDoc.supplierMappings.map((mapping) => ({
            supplierId: mapping.supplierId,
            supplierCode: mapping.supplierCode,
            lastCost: mapping.lastCost,
            lastCostDate: mapping.lastCostDate.toDate(),
          })),
        });
      }

      return products;
    } catch (error) {
      console.error('Error loading internal products:', error);
      throw new Error(
        `Failed to load internal products: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Store match confirmation for learning
   * 
   * Stores confirmed matches in a separate collection to build
   * supplier-specific mappings and improve ML model accuracy.
   * 
   * @param supplierCode - Supplier's product code
   * @param internalSKU - Confirmed internal SKU
   * @param supplierId - Supplier ID
   * @returns Promise resolving when confirmation is stored
   * 
   * @private
   */
  private async storeMatchConfirmation(
    supplierCode: string,
    internalSKU: string,
    supplierId: string
  ): Promise<void> {
    try {
      const confirmationsRef = collection(db, 'match_confirmations');
      
      await addDoc(confirmationsRef, {
        supplierCode,
        internalSKU,
        supplierId,
        confirmedAt: Timestamp.now(),
      });

      console.log(`Stored match confirmation for learning: ${supplierCode} -> ${internalSKU}`);
    } catch (error) {
      // Don't fail the confirmation if storing for learning fails
      console.error('Error storing match confirmation:', error);
    }
  }

  /**
   * Deduplicate suggestions by SKU, keeping the highest confidence
   * 
   * @param suggestions - Array of suggestions to deduplicate
   * @returns Deduplicated array of suggestions
   * 
   * @private
   */
  private deduplicateSuggestions(
    suggestions: MatchSuggestion[]
  ): MatchSuggestion[] {
    const skuMap = new Map<string, MatchSuggestion>();

    for (const suggestion of suggestions) {
      const existing = skuMap.get(suggestion.suggestedSKU);
      
      if (!existing || suggestion.confidence > existing.confidence) {
        skuMap.set(suggestion.suggestedSKU, suggestion);
      }
    }

    return Array.from(skuMap.values());
  }
}

/**
 * Create and export a singleton instance with default configuration
 */
export const matcherService = new MatcherService();

/**
 * Create a new MatcherService instance with custom configuration
 * 
 * @param config - Configuration for the matcher service
 * @returns New MatcherService instance
 */
export function createMatcherService(
  config?: MatcherServiceConfig
): MatcherService {
  return new MatcherService(config);
}
