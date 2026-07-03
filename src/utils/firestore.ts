/**
 * Firestore Query Optimization Utilities
 * 
 * Provides utilities for optimized Firestore queries with pagination,
 * real-time listener management, and query builders.
 * 
 * Requirements: 17.2 (Performance Efficiency)
 * Target: Queries returning ≤1000 records must complete within 2 seconds
 */

import {
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  type Query,
  type QueryConstraint,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type CollectionReference,
  type OrderByDirection,
} from 'firebase/firestore';

/**
 * Pagination metadata returned with paginated queries
 */
export interface PaginationMetadata {
  /** Whether there are more results available */
  hasMore: boolean;
  /** Last document in the current page (for cursor-based pagination) */
  lastDoc: QueryDocumentSnapshot | null;
  /** Total number of results in the current page */
  count: number;
}

/**
 * Result of a paginated query
 */
export interface PaginatedQueryResult<T> {
  /** Array of documents in the current page */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Configuration for paginated queries
 */
export interface PaginatedQueryConfig {
  /** Maximum number of results per page (default: 100, max: 1000) */
  pageSize?: number;
  /** Last document from previous page (for cursor-based pagination) */
  startAfterDoc?: QueryDocumentSnapshot | null;
}

/**
 * Execute a paginated query
 * 
 * Implements cursor-based pagination using startAfter() for efficient
 * navigation through large result sets.
 * 
 * @param baseQuery - Base Firestore query
 * @param config - Pagination configuration
 * @param converter - Function to convert Firestore document to domain model
 * @returns Promise resolving to paginated results
 * 
 * @example
 * ```typescript
 * const productsRef = collection(db, 'products');
 * const baseQuery = query(productsRef, where('isActive', '==', true));
 * 
 * const result = await executePaginatedQuery(
 *   baseQuery,
 *   { pageSize: 50 },
 *   (doc) => doc.data() as Product
 * );
 * 
 * console.log(`Found ${result.data.length} products`);
 * console.log(`Has more: ${result.pagination.hasMore}`);
 * 
 * // Get next page
 * if (result.pagination.hasMore) {
 *   const nextPage = await executePaginatedQuery(
 *     baseQuery,
 *     { pageSize: 50, startAfterDoc: result.pagination.lastDoc },
 *     (doc) => doc.data() as Product
 *   );
 * }
 * ```
 */
export async function executePaginatedQuery<T>(
  baseQuery: Query<DocumentData>,
  config: PaginatedQueryConfig,
  converter: (doc: QueryDocumentSnapshot<DocumentData>) => T
): Promise<PaginatedQueryResult<T>> {
  // Validate and apply page size (max 1000 for performance requirement)
  const pageSize = Math.min(config.pageSize || 100, 1000);
  
  // Build paginated query
  let paginatedQuery = query(baseQuery, limit(pageSize + 1)); // +1 to check hasMore
  
  if (config.startAfterDoc) {
    paginatedQuery = query(paginatedQuery, startAfter(config.startAfterDoc));
  }
  
  // Execute query
  const snapshot = await getDocs(paginatedQuery);
  
  // Determine if there are more results
  const hasMore = snapshot.docs.length > pageSize;
  
  // Get the actual results (excluding the extra document)
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  
  // Convert documents to domain models
  const data = docs.map(converter);
  
  // Get last document for next page cursor
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  
  return {
    data,
    pagination: {
      hasMore,
      lastDoc,
      count: data.length,
    },
  };
}

/**
 * Listener cleanup function
 */
export type ListenerCleanup = () => void;

/**
 * Listener callback function
 */
export type ListenerCallback<T> = (data: T[], error?: Error) => void;

/**
 * Configuration for real-time listeners
 */
export interface ListenerConfig {
  /** Whether to include metadata changes (default: false) */
  includeMetadataChanges?: boolean;
  /** Error handler for listener errors */
  onError?: (error: Error) => void;
}

/**
 * Create a real-time listener with automatic cleanup
 * 
 * Manages Firestore real-time listeners with proper error handling
 * and cleanup to prevent memory leaks.
 * 
 * @param query - Firestore query to listen to
 * @param callback - Callback function to receive updates
 * @param converter - Function to convert Firestore document to domain model
 * @param config - Listener configuration
 * @returns Cleanup function to unsubscribe the listener
 * 
 * @example
 * ```typescript
 * const inventoryQuery = query(
 *   collection(db, 'inventory'),
 *   where('quantityOnHand', '<', 10)
 * );
 * 
 * const unsubscribe = createRealtimeListener(
 *   inventoryQuery,
 *   (items) => {
 *     console.log('Low stock items:', items);
 *     updateUI(items);
 *   },
 *   (doc) => doc.data() as InventoryDoc,
 *   {
 *     onError: (error) => console.error('Listener error:', error),
 *   }
 * );
 * 
 * // Later, clean up the listener
 * unsubscribe();
 * ```
 */
export function createRealtimeListener<T>(
  firestoreQuery: Query<DocumentData>,
  callback: ListenerCallback<T>,
  converter: (doc: QueryDocumentSnapshot<DocumentData>) => T,
  config: ListenerConfig = {}
): ListenerCleanup {
  const unsubscribe = onSnapshot(
    firestoreQuery,
    {
      includeMetadataChanges: config.includeMetadataChanges || false,
    },
    (snapshot: QuerySnapshot<DocumentData>) => {
      try {
        const data = snapshot.docs.map(converter);
        callback(data);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error in listener');
        if (config.onError) {
          config.onError(err);
        } else {
          console.error('Listener error:', err);
        }
        callback([], err);
      }
    },
    (error) => {
      const err = error instanceof Error ? error : new Error('Unknown listener error');
      if (config.onError) {
        config.onError(err);
      } else {
        console.error('Listener error:', err);
      }
      callback([], err);
    }
  );
  
  return unsubscribe;
}

/**
 * Manager for multiple real-time listeners
 * 
 * Manages multiple Firestore listeners with automatic cleanup
 * to prevent memory leaks when components unmount.
 */
export class ListenerManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  
  /**
   * Add a new listener with a unique ID
   * 
   * @param id - Unique identifier for the listener
   * @param listener - Listener cleanup function
   */
  add(id: string, listener: ListenerCleanup): void {
    // Clean up existing listener with same ID if it exists
    this.remove(id);
    this.listeners.set(id, listener);
  }
  
  /**
   * Remove and clean up a specific listener
   * 
   * @param id - Identifier of the listener to remove
   */
  remove(id: string): void {
    const listener = this.listeners.get(id);
    if (listener) {
      listener(); // Unsubscribe
      this.listeners.delete(id);
    }
  }
  
  /**
   * Clean up all listeners
   */
  removeAll(): void {
    this.listeners.forEach((listener) => listener());
    this.listeners.clear();
  }
  
  /**
   * Check if a listener exists
   * 
   * @param id - Identifier of the listener
   * @returns True if listener exists
   */
  has(id: string): boolean {
    return this.listeners.has(id);
  }
  
  /**
   * Get the number of active listeners
   * 
   * @returns Number of active listeners
   */
  get count(): number {
    return this.listeners.size;
  }
}

/**
 * Query builder for common Firestore query patterns
 * 
 * Provides a fluent interface for building optimized Firestore queries
 * with automatic limit application to ensure performance requirements.
 */
export class QueryBuilder<T = DocumentData> {
  private constraints: QueryConstraint[] = [];
  private maxLimit: number = 1000; // Default max for performance requirement
  
  /**
   * Create a new QueryBuilder
   * 
   * @param collectionRef - Firestore collection reference
   */
  constructor(private collectionRef: CollectionReference<DocumentData>) {}
  
  /**
   * Add a where clause
   * 
   * @param fieldPath - Field to filter on
   * @param opStr - Comparison operator
   * @param value - Value to compare against
   * @returns This builder for chaining
   */
  where(fieldPath: string, opStr: any, value: any): this {
    this.constraints.push(where(fieldPath, opStr, value));
    return this;
  }
  
  /**
   * Add an orderBy clause
   * 
   * @param fieldPath - Field to order by
   * @param direction - Sort direction ('asc' or 'desc')
   * @returns This builder for chaining
   */
  orderBy(fieldPath: string, direction?: OrderByDirection): this {
    this.constraints.push(orderBy(fieldPath, direction));
    return this;
  }
  
  /**
   * Set the maximum number of results
   * 
   * Automatically capped at 1000 for performance requirement.
   * 
   * @param count - Maximum number of results
   * @returns This builder for chaining
   */
  limit(count: number): this {
    this.maxLimit = Math.min(count, 1000);
    return this;
  }
  
  /**
   * Start after a specific document (for pagination)
   * 
   * @param doc - Document to start after
   * @returns This builder for chaining
   */
  startAfter(doc: QueryDocumentSnapshot): this {
    this.constraints.push(startAfter(doc));
    return this;
  }
  
  /**
   * Build the final query
   * 
   * @returns Firestore query
   */
  build(): Query<DocumentData> {
    return query(
      this.collectionRef,
      ...this.constraints,
      limit(this.maxLimit)
    );
  }
  
  /**
   * Execute the query and return results
   * 
   * @param converter - Function to convert Firestore document to domain model
   * @returns Promise resolving to array of results
   */
  async execute(converter: (doc: QueryDocumentSnapshot<DocumentData>) => T): Promise<T[]> {
    const firestoreQuery = this.build();
    const snapshot = await getDocs(firestoreQuery);
    return snapshot.docs.map(converter);
  }
  
  /**
   * Execute a paginated query
   * 
   * @param config - Pagination configuration
   * @param converter - Function to convert Firestore document to domain model
   * @returns Promise resolving to paginated results
   */
  async executePaginated(
    config: PaginatedQueryConfig,
    converter: (doc: QueryDocumentSnapshot<DocumentData>) => T
  ): Promise<PaginatedQueryResult<T>> {
    const baseQuery = query(this.collectionRef, ...this.constraints);
    return executePaginatedQuery(baseQuery, config, converter);
  }
}

/**
 * Create a new query builder
 * 
 * @param collectionRef - Firestore collection reference
 * @returns New QueryBuilder instance
 * 
 * @example
 * ```typescript
 * const products = await createQueryBuilder(collection(db, 'products'))
 *   .where('category', '==', 'Electronics')
 *   .where('isActive', '==', true)
 *   .orderBy('sku', 'asc')
 *   .limit(100)
 *   .execute((doc) => doc.data() as Product);
 * ```
 */
export function createQueryBuilder<T = DocumentData>(
  collectionRef: CollectionReference<DocumentData>
): QueryBuilder<T> {
  return new QueryBuilder<T>(collectionRef);
}

/**
 * Common query patterns for pricelist items
 * 
 * Leverages composite index: pricelist_items (supplierId, matchStatus, isNewProduct)
 */
export const PricelistItemQueries = {
  /**
   * Get unmatched products for a supplier
   */
  getUnmatched(
    collectionRef: CollectionReference<DocumentData>,
    supplierId: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('supplierId', '==', supplierId),
      where('matchStatus', '==', 'unmatched'),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get new products for a supplier
   */
  getNewProducts(
    collectionRef: CollectionReference<DocumentData>,
    supplierId: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('supplierId', '==', supplierId),
      where('isNewProduct', '==', true),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get suggested matches for a supplier
   */
  getSuggested(
    collectionRef: CollectionReference<DocumentData>,
    supplierId: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('supplierId', '==', supplierId),
      where('matchStatus', '==', 'suggested'),
      limit(Math.min(maxResults, 1000))
    );
  },
};

/**
 * Common query patterns for price changes
 * 
 * Leverages composite indexes:
 * - price_changes (changeDate DESC, isSignificant ASC)
 * - price_changes (sku ASC, changeDate DESC)
 */
export const PriceChangeQueries = {
  /**
   * Get significant price changes in date range
   */
  getSignificant(
    collectionRef: CollectionReference<DocumentData>,
    startDate: Date,
    endDate: Date,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('isSignificant', '==', true),
      where('changeDate', '>=', startDate),
      where('changeDate', '<=', endDate),
      orderBy('changeDate', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get price history for a product
   */
  getPriceHistory(
    collectionRef: CollectionReference<DocumentData>,
    sku: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('sku', '==', sku),
      orderBy('changeDate', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
};

/**
 * Common query patterns for inventory transactions
 * 
 * Leverages composite indexes:
 * - inventory_transactions (sku ASC, timestamp DESC)
 * - inventory_transactions (locationId ASC, timestamp DESC)
 */
export const InventoryTransactionQueries = {
  /**
   * Get transactions for a product
   */
  getByProduct(
    collectionRef: CollectionReference<DocumentData>,
    sku: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('sku', '==', sku),
      orderBy('timestamp', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get transactions for a location
   */
  getByLocation(
    collectionRef: CollectionReference<DocumentData>,
    locationId: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('locationId', '==', locationId),
      orderBy('timestamp', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
};

/**
 * Common query patterns for POS transactions
 * 
 * Leverages composite indexes:
 * - pos_transactions (timestamp DESC, status ASC)
 * - pos_transactions (userId ASC, timestamp DESC)
 */
export const POSTransactionQueries = {
  /**
   * Get recent transactions
   */
  getRecent(
    collectionRef: CollectionReference<DocumentData>,
    startDate: Date,
    endDate: Date,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      orderBy('timestamp', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get transactions by user
   */
  getByUser(
    collectionRef: CollectionReference<DocumentData>,
    userId: string,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get completed transactions
   */
  getCompleted(
    collectionRef: CollectionReference<DocumentData>,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('status', '==', 'completed'),
      orderBy('timestamp', 'desc'),
      limit(Math.min(maxResults, 1000))
    );
  },
};

/**
 * Common query patterns for products
 * 
 * Leverages composite index: products (category ASC, isActive ASC)
 */
export const ProductQueries = {
  /**
   * Get products by category and status
   */
  getByCategoryAndStatus(
    collectionRef: CollectionReference<DocumentData>,
    category: string,
    isActive: boolean,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('category', '==', category),
      where('isActive', '==', isActive),
      limit(Math.min(maxResults, 1000))
    );
  },
  
  /**
   * Get active products
   */
  getActive(
    collectionRef: CollectionReference<DocumentData>,
    maxResults: number = 1000
  ): Query<DocumentData> {
    return query(
      collectionRef,
      where('isActive', '==', true),
      limit(Math.min(maxResults, 1000))
    );
  },
};
