/**
 * Query Helper Utilities
 * 
 * Provides common query patterns for pagination, real-time listeners,
 * and query result transformation with proper performance optimization.
 * 
 * Requirement 17.2: Optimized query performance with pagination and proper indexing
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  type Query,
  type DocumentData,
  type QueryConstraint,
  type Firestore,
  type QuerySnapshot,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

/**
 * Pagination metadata returned with paginated results
 */
export interface PaginationMetadata {
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
  totalCount?: number; // Optional: expensive to calculate
  pageSize: number;
  currentPage: number;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}

/**
 * Options for paginated queries
 */
export interface PaginationOptions {
  pageSize?: number; // Default: 100, max: 1000
  startAfterDoc?: DocumentSnapshot | null;
  includeTotalCount?: boolean; // Default: false (expensive operation)
  currentPage?: number; // For tracking purposes
}

/**
 * Options for real-time listeners
 */
export interface ListenerOptions {
  onData: (data: DocumentData[]) => void;
  onError?: (error: Error) => void;
  includeMetadata?: boolean;
}

/**
 * Helper class for building and executing paginated queries
 * 
 * Implements cursor-based pagination using startAfter() for efficient
 * pagination without skipping documents.
 */
export class PaginatedQueryHelper {
  private db: Firestore;
  private maxPageSize = 1000; // Firestore limit
  private defaultPageSize = 100;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Execute a paginated query
   * 
   * Uses cursor-based pagination with startAfter() for efficient traversal.
   * Returns pagination metadata including hasMore flag and lastDoc cursor.
   * 
   * @param collectionPath - Firestore collection path
   * @param constraints - Query constraints (where, orderBy, etc.)
   * @param options - Pagination options
   * @returns Promise resolving to paginated result
   * 
   * Requirement 17.2: Ensure queries return ≤1000 records within 2 seconds
   */
  async executePaginatedQuery<T = DocumentData>(
    collectionPath: string,
    constraints: QueryConstraint[],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const pageSize = Math.min(
      options.pageSize || this.defaultPageSize,
      this.maxPageSize
    );
    const currentPage = options.currentPage || 1;

    // Build query with limit
    const queryConstraints = [...constraints, limit(pageSize + 1)]; // Fetch one extra to check hasMore

    // Add startAfter if provided
    if (options.startAfterDoc) {
      queryConstraints.push(startAfter(options.startAfterDoc));
    }

    const q = query(collection(this.db, collectionPath), ...queryConstraints);

    // Execute query
    const querySnapshot = await getDocs(q);

    // Check if there are more results
    const hasMore = querySnapshot.docs.length > pageSize;

    // Extract data (exclude the extra document used for hasMore check)
    const data: T[] = [];
    const docs = hasMore ? querySnapshot.docs.slice(0, pageSize) : querySnapshot.docs;

    docs.forEach((doc) => {
      data.push(doc.data() as T);
    });

    // Get last document for cursor
    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    // Calculate total count if requested (expensive operation)
    let totalCount: number | undefined = undefined;
    if (options.includeTotalCount) {
      // This requires a separate query without pagination
      const countQuery = query(
        collection(this.db, collectionPath),
        ...constraints.filter((c) => !(c as any).type || (c as any).type !== 'limit')
      );
      const countSnapshot = await getDocs(countQuery);
      totalCount = countSnapshot.size;
    }

    return {
      data,
      pagination: {
        hasMore,
        lastDoc,
        totalCount,
        pageSize,
        currentPage,
      },
    };
  }

  /**
   * Build a query with standard pagination constraints
   * 
   * Helper method to construct queries with proper ordering and limits.
   * 
   * @param collectionPath - Firestore collection path
   * @param constraints - Base query constraints
   * @param pageSize - Number of results per page
   * @param startAfterDoc - Optional cursor for pagination
   * @returns Firestore Query object
   */
  buildPaginatedQuery(
    collectionPath: string,
    constraints: QueryConstraint[],
    pageSize: number,
    startAfterDoc?: DocumentSnapshot | null
  ): Query<DocumentData> {
    const queryConstraints = [...constraints, limit(pageSize)];

    if (startAfterDoc) {
      queryConstraints.push(startAfter(startAfterDoc));
    }

    return query(collection(this.db, collectionPath), ...queryConstraints);
  }
}

/**
 * Helper class for managing real-time Firestore listeners
 * 
 * Provides utilities for creating, tracking, and cleaning up real-time listeners
 * with proper error handling and memory management.
 */
export class RealtimeListenerManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Create a real-time listener with proper cleanup tracking
   * 
   * Registers the listener with a unique ID for later cleanup.
   * Automatically handles errors and metadata updates.
   * 
   * @param listenerId - Unique identifier for this listener
   * @param collectionPath - Firestore collection path
   * @param constraints - Query constraints
   * @param options - Listener options
   * @returns Unsubscribe function
   */
  createListener(
    listenerId: string,
    collectionPath: string,
    constraints: QueryConstraint[],
    options: ListenerOptions
  ): Unsubscribe {
    // Clean up existing listener with same ID
    this.removeListener(listenerId);

    // Build query
    const q = query(collection(this.db, collectionPath), ...constraints);

    // Create listener
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: options.includeMetadata || false },
      (snapshot: QuerySnapshot<DocumentData>) => {
        // Extract data
        const data: DocumentData[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });

        // Call data callback
        options.onData(data);
      },
      (error: Error) => {
        // Call error callback if provided
        if (options.onError) {
          options.onError(error);
        } else {
          console.error(`Listener error (${listenerId}):`, error);
        }
      }
    );

    // Store unsubscribe function
    this.listeners.set(listenerId, unsubscribe);

    return unsubscribe;
  }

  /**
   * Remove a specific listener
   * 
   * Unsubscribes and removes the listener from tracking.
   * 
   * @param listenerId - Unique identifier of the listener to remove
   */
  removeListener(listenerId: string): void {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
    }
  }

  /**
   * Remove all listeners
   * 
   * Unsubscribes all tracked listeners and clears the registry.
   * Call this when component unmounts or page navigates away.
   */
  removeAllListeners(): void {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }

  /**
   * Get count of active listeners
   * 
   * @returns Number of currently active listeners
   */
  getActiveListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Check if a specific listener is active
   * 
   * @param listenerId - Unique identifier to check
   * @returns True if listener exists and is active
   */
  hasListener(listenerId: string): boolean {
    return this.listeners.has(listenerId);
  }
}

/**
 * Helper class for transforming query results
 * 
 * Provides utilities for converting Firestore documents to domain models
 * with type safety and consistent error handling.
 */
export class QueryResultTransformer {
  /**
   * Transform a query snapshot to an array of typed objects
   * 
   * @param snapshot - Firestore query snapshot
   * @param transformer - Function to transform each document
   * @returns Array of transformed objects
   */
  static transformSnapshot<T, R>(
    snapshot: QuerySnapshot<DocumentData>,
    transformer: (data: T, docId: string) => R
  ): R[] {
    const results: R[] = [];

    snapshot.forEach((doc) => {
      try {
        const transformed = transformer(doc.data() as T, doc.id);
        results.push(transformed);
      } catch (error) {
        console.error(`Error transforming document ${doc.id}:`, error);
        // Skip invalid documents rather than failing entire result set
      }
    });

    return results;
  }

  /**
   * Transform a single document to a typed object
   * 
   * @param doc - Firestore document snapshot
   * @param transformer - Function to transform the document
   * @returns Transformed object or null if document doesn't exist
   */
  static transformDocument<T, R>(
    doc: DocumentSnapshot<DocumentData>,
    transformer: (data: T, docId: string) => R
  ): R | null {
    if (!doc.exists()) {
      return null;
    }

    try {
      return transformer(doc.data() as T, doc.id);
    } catch (error) {
      console.error(`Error transforming document ${doc.id}:`, error);
      return null;
    }
  }

  /**
   * Apply filters to an array of results
   * 
   * Useful for client-side filtering after initial query when
   * Firestore query constraints are insufficient.
   * 
   * @param data - Array of data to filter
   * @param filters - Object with filter criteria
   * @returns Filtered array
   */
  static applyFilters<T extends Record<string, any>>(
    data: T[],
    filters: Partial<Record<keyof T, any>>
  ): T[] {
    return data.filter((item) => {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // Array filter: item value must be in filter array
            if (!value.includes(item[key])) {
              return false;
            }
          } else if (typeof value === 'string' && typeof item[key] === 'string') {
            // String filter: case-insensitive partial match
            if (!item[key].toLowerCase().includes(value.toLowerCase())) {
              return false;
            }
          } else {
            // Exact match filter
            if (item[key] !== value) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  /**
   * Sort an array of results by a field
   * 
   * @param data - Array of data to sort
   * @param field - Field to sort by
   * @param direction - Sort direction ('asc' or 'desc')
   * @returns Sorted array
   */
  static sortResults<T extends Record<string, any>>(
    data: T[],
    field: keyof T,
    direction: 'asc' | 'desc' = 'asc'
  ): T[] {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }
}

/**
 * Build optimized query constraints for common patterns
 * 
 * Provides helper functions for constructing queries that leverage
 * Firestore composite indexes effectively.
 */
export class QueryConstraintBuilder {
  /**
   * Build constraints for date range queries
   * 
   * Creates optimized where clauses for date range filtering.
   * 
   * @param field - Date field name
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Array of query constraints
   */
  static dateRange(
    field: string,
    startDate: Date,
    endDate: Date
  ): QueryConstraint[] {
    return [
      where(field, '>=', startDate),
      where(field, '<=', endDate),
    ];
  }

  /**
   * Build constraints for category + status filtering
   * 
   * Leverages composite index: (category ASC, isActive ASC)
   * 
   * @param category - Category value
   * @param isActive - Active status
   * @returns Array of query constraints
   */
  static categoryAndStatus(
    category: string,
    isActive: boolean
  ): QueryConstraint[] {
    return [
      where('category', '==', category),
      where('isActive', '==', isActive),
    ];
  }

  /**
   * Build constraints for supplier + match status filtering
   * 
   * Leverages composite index: (supplierId ASC, matchStatus ASC, isNewProduct ASC)
   * 
   * @param supplierId - Supplier ID
   * @param matchStatus - Match status
   * @param isNewProduct - Optional new product flag
   * @returns Array of query constraints
   */
  static supplierAndMatchStatus(
    supplierId: string,
    matchStatus: string,
    isNewProduct?: boolean
  ): QueryConstraint[] {
    const constraints = [
      where('supplierId', '==', supplierId),
      where('matchStatus', '==', matchStatus),
    ];

    if (isNewProduct !== undefined) {
      constraints.push(where('isNewProduct', '==', isNewProduct));
    }

    return constraints;
  }

  /**
   * Build constraints for timestamp-based queries with status
   * 
   * Leverages composite index: (timestamp DESC, status ASC)
   * 
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param status - Optional status filter
   * @returns Array of query constraints
   */
  static timestampAndStatus(
    startDate: Date,
    endDate: Date,
    status?: string
  ): QueryConstraint[] {
    const constraints = [
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      orderBy('timestamp', 'desc'),
    ];

    if (status !== undefined) {
      // Note: This requires a composite index
      constraints.push(where('status', '==', status));
    }

    return constraints;
  }
}
