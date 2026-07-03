/**
 * Receiving Service Implementation
 * 
 * Manages receiving operations including record creation, line item management,
 * variance detection, and inventory updates upon completion.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  updateDoc,
  limit as firestoreLimit,
  orderBy,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ReceivingRecord,
  ReceivingLineItem,
  ReceivingDocumentType,
  ReceivingStatus,
} from '../../types/models';
import type {
  ReceivingRecordDoc,
} from '../../types/firestore';
import type { ProductDoc } from '../../types/firestore';
import { inventoryService } from '../inventory';
import {
  executePaginatedQuery,
  type PaginatedQueryResult,
  type PaginatedQueryConfig,
} from '../../utils/firestore';

/**
 * Interface for creating a new receiving record
 */
export interface CreateReceivingParams {
  supplierId: string;
  receivingDate: Date;
  documentType: ReceivingDocumentType;
  documentRef?: string;
  createdBy: string;
}

/**
 * Interface for variance detection results
 */
export interface VarianceResult {
  sku: string;
  expectedQuantity: number;
  receivedQuantity: number;
  variance: number;
  variancePercentage: number;
  requiresReview: boolean;
}

/**
 * Interface for filtering receiving records
 */
export interface ReceivingRecordFilter {
  supplierId?: string;
  status?: ReceivingStatus;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Receiving Service Implementation
 * 
 * Handles all receiving operations including creating records, adding line items,
 * detecting variances, and updating inventory upon completion.
 */
export class ReceivingService {
  private readonly receivingCollection = 'receiving_records';
  private readonly productsCollection = 'products';

  /**
   * Create a new receiving record
   * 
   * Requires supplier reference, receiving date, and document type per Requirement 9.1.
   * 
   * @param params - Receiving record creation parameters
   * @returns Promise resolving to the created receiving record
   * @throws Error if required fields are missing or invalid
   * 
   * Requirement 9.1
   */
  async createReceiving(params: CreateReceivingParams): Promise<ReceivingRecord> {
    // Validate required fields
    if (!params.supplierId) {
      throw new Error('Supplier reference is required');
    }
    if (!params.receivingDate) {
      throw new Error('Receiving date is required');
    }
    if (!params.documentType) {
      throw new Error('Document type is required');
    }
    if (!params.createdBy) {
      throw new Error('Created by user ID is required');
    }

    try {
      // Generate unique receiving ID
      const receivingId = `RCV_${Date.now()}_${params.supplierId}`;
      const receivingRef = doc(db, this.receivingCollection, receivingId);

      // Create receiving record document
      const receivingDoc: ReceivingRecordDoc = {
        receivingId,
        supplierId: params.supplierId,
        receivingDate: Timestamp.fromDate(params.receivingDate),
        documentType: params.documentType,
        documentRef: params.documentRef,
        lineItems: [],
        status: 'pending',
        createdBy: params.createdBy,
        createdAt: Timestamp.now(),
      };

      await setDoc(receivingRef, receivingDoc);

      // Return domain model
      return {
        receivingId,
        supplierId: params.supplierId,
        receivingDate: params.receivingDate,
        documentType: params.documentType,
        lineItems: [],
        status: 'pending',
      };
    } catch (error) {
      throw new Error(
        `Failed to create receiving record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a line item to a receiving record
   * 
   * Validates that the product exists in the system per Requirement 9.2.
   * 
   * @param receivingId - ID of the receiving record
   * @param lineItem - Line item to add
   * @returns Promise resolving when line item is added
   * @throws Error if product doesn't exist or receiving record not found
   * 
   * Requirement 9.2
   */
  async addLineItem(receivingId: string, lineItem: ReceivingLineItem): Promise<void> {
    try {
      // Validate that product exists
      const productRef = doc(db, this.productsCollection, lineItem.sku);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Product with SKU ${lineItem.sku} does not exist in the system`);
      }

      // Get existing receiving record
      const receivingRef = doc(db, this.receivingCollection, receivingId);
      const receivingSnap = await getDoc(receivingRef);

      if (!receivingSnap.exists()) {
        throw new Error(`Receiving record ${receivingId} not found`);
      }

      const receivingData = receivingSnap.data() as ReceivingRecordDoc;

      // Validate receiving record is still pending
      if (receivingData.status !== 'pending') {
        throw new Error(`Cannot add line items to ${receivingData.status} receiving record`);
      }

      // Add line item to the array
      const updatedLineItems = [...receivingData.lineItems, lineItem];

      // Update the receiving record
      await updateDoc(receivingRef, {
        lineItems: updatedLineItems,
      });
    } catch (error) {
      throw new Error(
        `Failed to add line item to receiving record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Complete a receiving record and update inventory
   * 
   * Updates all associated inventory records and detects variances per Requirements 9.3, 9.5.
   * Flags receiving record for review if variance > 5%.
   * 
   * @param receivingId - ID of the receiving record to complete
   * @param userId - User ID completing the receiving
   * @returns Promise resolving to variance results
   * @throws Error if receiving record not found or already completed
   * 
   * Requirements 9.3, 9.5
   */
  async completeReceiving(receivingId: string, userId: string): Promise<VarianceResult[]> {
    try {
      // Get receiving record
      const receivingRef = doc(db, this.receivingCollection, receivingId);
      const receivingSnap = await getDoc(receivingRef);

      if (!receivingSnap.exists()) {
        throw new Error(`Receiving record ${receivingId} not found`);
      }

      const receivingData = receivingSnap.data() as ReceivingRecordDoc;

      // Validate receiving record is pending
      if (receivingData.status !== 'pending') {
        throw new Error(`Receiving record ${receivingId} is already ${receivingData.status}`);
      }

      // Validate there are line items to process
      if (receivingData.lineItems.length === 0) {
        throw new Error('Cannot complete receiving record with no line items');
      }

      // Detect variances
      const variances = this.detectVariances(receivingData.lineItems);
      const hasVariance = variances.some(v => v.requiresReview);

      // Convert to domain model for inventory service
      const receivingRecord: ReceivingRecord = {
        receivingId: receivingData.receivingId,
        supplierId: receivingData.supplierId,
        receivingDate: receivingData.receivingDate.toDate(),
        documentType: receivingData.documentType,
        lineItems: receivingData.lineItems,
        status: 'pending',
      };

      // Update inventory via InventoryService
      await inventoryService.processReceiving(receivingRecord);

      // Update receiving record status
      await updateDoc(receivingRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
      });

      return variances;
    } catch (error) {
      throw new Error(
        `Failed to complete receiving record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect variances between expected and received quantities
   * 
   * Flags variances where |expected - received| / expected > 0.05 (5%) per Requirement 9.5.
   * 
   * @param lineItems - Line items to check for variances
   * @returns Array of variance results
   * 
   * Requirement 9.5
   */
  detectVariances(lineItems: ReceivingLineItem[]): VarianceResult[] {
    const variances: VarianceResult[] = [];

    for (const lineItem of lineItems) {
      // Only check variance if expectedQuantity is provided
      if (lineItem.expectedQuantity !== undefined && lineItem.expectedQuantity !== null) {
        const expected = lineItem.expectedQuantity;
        const received = lineItem.quantity;
        
        // Calculate variance
        const variance = received - expected;
        const variancePercentage = expected !== 0 ? Math.abs(variance) / expected : 0;
        
        // Flag for review if variance exceeds 5%
        const requiresReview = variancePercentage > 0.05;

        variances.push({
          sku: lineItem.sku,
          expectedQuantity: expected,
          receivedQuantity: received,
          variance,
          variancePercentage,
          requiresReview,
        });
      }
    }

    return variances;
  }

  /**
   * Get receiving records with pagination support
   * 
   * Supports filtering by date, supplier, and status per Requirement 9.6.
   * Uses cursor-based pagination for efficient navigation.
   * 
   * Requirement 17.2: Optimized query with proper limit and pagination
   * 
   * @param filter - Optional filter parameters
   * @param paginationConfig - Pagination configuration
   * @returns Promise resolving to paginated receiving records
   * 
   * Requirements 9.6, 17.2
   */
  async getReceivingRecordsPaginated(
    filter?: ReceivingRecordFilter,
    paginationConfig?: PaginatedQueryConfig
  ): Promise<PaginatedQueryResult<ReceivingRecord>> {
    try {
      const receivingRef = collection(db, this.receivingCollection);
      const constraints = [];

      // Apply filters
      if (filter?.supplierId) {
        constraints.push(where('supplierId', '==', filter.supplierId));
      }

      if (filter?.status) {
        constraints.push(where('status', '==', filter.status));
      }

      if (filter?.startDate) {
        constraints.push(where('receivingDate', '>=', Timestamp.fromDate(filter.startDate)));
      }

      if (filter?.endDate) {
        constraints.push(where('receivingDate', '<=', Timestamp.fromDate(filter.endDate)));
      }

      // Add ordering
      constraints.push(orderBy('receivingDate', 'desc'));

      // Build base query
      const baseQuery = query(receivingRef, ...constraints);

      // Execute paginated query
      return await executePaginatedQuery(
        baseQuery,
        paginationConfig || {},
        (doc: QueryDocumentSnapshot) => {
          const data = doc.data() as ReceivingRecordDoc;
          return {
            receivingId: data.receivingId,
            supplierId: data.supplierId,
            receivingDate: data.receivingDate.toDate(),
            documentType: data.documentType,
            lineItems: data.lineItems,
            status: data.status,
          };
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to get receiving records: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get receiving records with optional filtering (non-paginated)
   * 
   * Supports filtering by date, supplier, and status per Requirement 9.6.
   * 
   * Requirement 17.2: Optimized query with proper limit
   * 
   * @param filter - Optional filter parameters
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to array of receiving records
   * 
   * Requirements 9.6, 17.2
   */
  async getReceivingRecords(
    filter?: ReceivingRecordFilter,
    maxResults: number = 1000
  ): Promise<ReceivingRecord[]> {
    try {
      // Build query with limit for performance (Requirement 17.2)
      let receivingQuery = query(
        collection(db, this.receivingCollection),
        orderBy('receivingDate', 'desc'),
        firestoreLimit(maxResults)
      );

      // Apply filters
      if (filter?.supplierId) {
        receivingQuery = query(
          collection(db, this.receivingCollection),
          where('supplierId', '==', filter.supplierId),
          orderBy('receivingDate', 'desc'),
          firestoreLimit(maxResults)
        );
      }

      if (filter?.status) {
        // Rebuild query with status filter
        const constraints = [where('status', '==', filter.status)];
        
        if (filter?.supplierId) {
          constraints.unshift(where('supplierId', '==', filter.supplierId));
        }
        
        constraints.push(orderBy('receivingDate', 'desc'));
        constraints.push(firestoreLimit(maxResults));
        
        receivingQuery = query(collection(db, this.receivingCollection), ...constraints);
      }

      if (filter?.startDate) {
        // Rebuild query with date range
        const constraints = [];
        
        if (filter?.supplierId) {
          constraints.push(where('supplierId', '==', filter.supplierId));
        }
        
        if (filter?.status) {
          constraints.push(where('status', '==', filter.status));
        }
        
        constraints.push(where('receivingDate', '>=', Timestamp.fromDate(filter.startDate)));
        
        if (filter?.endDate) {
          constraints.push(where('receivingDate', '<=', Timestamp.fromDate(filter.endDate)));
        }
        
        constraints.push(orderBy('receivingDate', 'desc'));
        constraints.push(firestoreLimit(maxResults));
        
        receivingQuery = query(collection(db, this.receivingCollection), ...constraints);
      }

      // Execute query
      const querySnap = await getDocs(receivingQuery);
      const records: ReceivingRecord[] = [];

      querySnap.forEach((doc) => {
        const data = doc.data() as ReceivingRecordDoc;
        records.push({
          receivingId: data.receivingId,
          supplierId: data.supplierId,
          receivingDate: data.receivingDate.toDate(),
          documentType: data.documentType,
          lineItems: data.lineItems,
          status: data.status,
        });
      });

      // Already sorted by receiving date descending via orderBy
      return records;
    } catch (error) {
      throw new Error(
        `Failed to get receiving records: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific receiving record by ID
   * 
   * @param receivingId - ID of the receiving record
   * @returns Promise resolving to the receiving record
   * @throws Error if receiving record not found
   */
  async getReceivingById(receivingId: string): Promise<ReceivingRecord> {
    try {
      const receivingRef = doc(db, this.receivingCollection, receivingId);
      const receivingSnap = await getDoc(receivingRef);

      if (!receivingSnap.exists()) {
        throw new Error(`Receiving record ${receivingId} not found`);
      }

      const data = receivingSnap.data() as ReceivingRecordDoc;

      return {
        receivingId: data.receivingId,
        supplierId: data.supplierId,
        receivingDate: data.receivingDate.toDate(),
        documentType: data.documentType,
        lineItems: data.lineItems,
        status: data.status,
      };
    } catch (error) {
      throw new Error(
        `Failed to get receiving record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const receivingService = new ReceivingService();
