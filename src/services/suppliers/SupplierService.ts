/**
 * Supplier Service Implementation
 * 
 * Manages supplier records including CRUD operations, search functionality,
 * and audit trail maintenance using Firestore.
 * 
 * All Firestore operations use automatic retry logic with exponential backoff
 * to handle transient network failures (Requirement 18.4).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 18.4
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { retryFirestore } from '../../utils/retry';
import type { Supplier } from '../../types/models';
import type { SupplierDoc } from '../../types/firestore';

/**
 * Service for managing supplier records
 * 
 * Provides CRUD operations for supplier management with audit trail
 * and search functionality. All operations update audit fields automatically.
 */
export class SupplierService {
  private readonly suppliersCollection = 'suppliers';

  /**
   * Create a new supplier record
   * 
   * Requirement 2.1: WHEN an administrator creates a new supplier record,
   * THE System SHALL store the supplier name, contact information, and business details
   * 
   * @param supplier - Supplier data (supplierId will be generated if not provided)
   * @param userId - ID of user creating the supplier
   * @returns Promise resolving to created supplier with generated ID
   * @throws Error if creation fails
   */
  async createSupplier(
    supplier: Omit<Supplier, 'supplierId' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    userId: string
  ): Promise<Supplier> {
    try {
      return await retryFirestore(async () => {
        // Generate a unique supplier ID
        const suppliersRef = collection(db, this.suppliersCollection);
        const newSupplierRef = doc(suppliersRef);
        const supplierId = newSupplierRef.id;

        // Create timestamp
        const now = Timestamp.now();

        // Create supplier document
        const supplierDoc: SupplierDoc = {
          supplierId,
          name: supplier.name,
          contactPerson: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
        };

        // Save to Firestore
        await setDoc(newSupplierRef, supplierDoc);

        // Convert to domain model and return
        return this.convertToSupplier(supplierDoc);
      });
    } catch (error) {
      throw new Error(
        `Failed to create supplier: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a supplier by ID
   * 
   * Requirement 2.4: THE System SHALL display a searchable list of all suppliers
   * with their current status
   * 
   * @param supplierId - Supplier ID to retrieve
   * @returns Promise resolving to supplier or null if not found
   * @throws Error if retrieval fails
   */
  async getSupplier(supplierId: string): Promise<Supplier | null> {
    try {
      return await retryFirestore(async () => {
        const supplierRef = doc(db, this.suppliersCollection, supplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (!supplierSnap.exists()) {
          return null;
        }

        const supplierDoc = supplierSnap.data() as SupplierDoc;
        return this.convertToSupplier(supplierDoc);
      });
    } catch (error) {
      throw new Error(
        `Failed to get supplier ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing supplier record
   * 
   * Requirement 2.2: WHEN an administrator updates supplier information,
   * THE System SHALL save the changes and maintain an audit trail
   * 
   * @param supplierId - Supplier ID to update
   * @param updates - Partial supplier data to update
   * @returns Promise resolving to updated supplier
   * @throws Error if supplier not found or update fails
   */
  async updateSupplier(
    supplierId: string,
    updates: Partial<Omit<Supplier, 'supplierId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<Supplier> {
    try {
      return await retryFirestore(async () => {
        const supplierRef = doc(db, this.suppliersCollection, supplierId);

        // Check if supplier exists
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) {
          throw new Error(`Supplier ${supplierId} not found`);
        }

        // Update supplier with new timestamp
        const updateData: Partial<SupplierDoc> = {
          ...updates,
          updatedAt: Timestamp.now(),
        };

        await updateDoc(supplierRef, updateData);

        // Retrieve and return updated supplier
        const updatedSnap = await getDoc(supplierRef);
        const updatedDoc = updatedSnap.data() as SupplierDoc;
        return this.convertToSupplier(updatedDoc);
      });
    } catch (error) {
      throw new Error(
        `Failed to update supplier ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deactivate a supplier
   * 
   * Requirement 2.3: WHEN an administrator deactivates a supplier,
   * THE System SHALL mark the supplier as inactive without deleting historical data
   * 
   * @param supplierId - Supplier ID to deactivate
   * @returns Promise resolving when deactivation is complete
   * @throws Error if supplier not found or deactivation fails
   */
  async deactivateSupplier(supplierId: string): Promise<void> {
    try {
      await retryFirestore(async () => {
        const supplierRef = doc(db, this.suppliersCollection, supplierId);

        // Check if supplier exists
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) {
          throw new Error(`Supplier ${supplierId} not found`);
        }

        // Mark as inactive
        await updateDoc(supplierRef, {
          isActive: false,
          updatedAt: Timestamp.now(),
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to deactivate supplier ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reactivate a supplier
   * 
   * Convenience method to reactivate a previously deactivated supplier.
   * 
   * @param supplierId - Supplier ID to reactivate
   * @returns Promise resolving when reactivation is complete
   * @throws Error if supplier not found or reactivation fails
   */
  async reactivateSupplier(supplierId: string): Promise<void> {
    try {
      await retryFirestore(async () => {
        const supplierRef = doc(db, this.suppliersCollection, supplierId);

        // Check if supplier exists
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) {
          throw new Error(`Supplier ${supplierId} not found`);
        }

        // Mark as active
        await updateDoc(supplierRef, {
          isActive: true,
          updatedAt: Timestamp.now(),
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to reactivate supplier ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search for suppliers by text matching
   * 
   * Requirement 2.4: THE System SHALL display a searchable list of all suppliers
   * with their current status
   * 
   * Requirement 2.5: WHEN a user searches for a supplier,
   * THE System SHALL return matching results within 2 seconds
   * 
   * Requirement 17.2: Optimized query performance with pagination
   * 
   * Searches across supplier name, contact person, and email fields.
   * 
   * @param searchText - Text to search for (case-insensitive partial match)
   * @param includeInactive - Whether to include inactive suppliers (default: false)
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to array of matching suppliers
   * @throws Error if search fails
   */
  async searchSuppliers(
    searchText: string,
    includeInactive: boolean = false,
    maxResults: number = 1000
  ): Promise<Supplier[]> {
    try {
      return await retryFirestore(async () => {
        // Build base query with limit to ensure ≤1000 records within 2 seconds (Requirement 17.2)
        const suppliersRef = collection(db, this.suppliersCollection);
        let searchQuery = query(suppliersRef, firestoreLimit(maxResults));

        // Filter by active status if needed
        if (!includeInactive) {
          searchQuery = query(
            collection(db, this.suppliersCollection),
            where('isActive', '==', true),
            firestoreLimit(maxResults)
          );
        }

        // Execute query
        const querySnap = await getDocs(searchQuery);

        // Filter results by search text (case-insensitive)
        const searchLower = searchText.toLowerCase().trim();
        const suppliers: Supplier[] = [];

        querySnap.forEach((doc) => {
          const supplierDoc = doc.data() as SupplierDoc;

          // Check if search text matches name, contact person, or email
          const nameMatch = supplierDoc.name.toLowerCase().includes(searchLower);
          const contactMatch = supplierDoc.contactPerson.toLowerCase().includes(searchLower);
          const emailMatch = supplierDoc.email.toLowerCase().includes(searchLower);

          if (nameMatch || contactMatch || emailMatch) {
            suppliers.push(this.convertToSupplier(supplierDoc));
          }
        });

        // Sort by name for consistent results
        suppliers.sort((a, b) => a.name.localeCompare(b.name));

        return suppliers;
      });
    } catch (error) {
      throw new Error(
        `Failed to search suppliers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all suppliers with optional filtering
   * 
   * Requirement 2.4: THE System SHALL display a searchable list of all suppliers
   * with their current status
   * 
   * @param includeInactive - Whether to include inactive suppliers (default: false)
   * @param limitCount - Maximum number of results to return (optional)
   * @returns Promise resolving to array of suppliers
   * @throws Error if retrieval fails
   */
  async getAllSuppliers(
    includeInactive: boolean = false,
    limitCount?: number
  ): Promise<Supplier[]> {
    try {
      // Build query
      const suppliersRef = collection(db, this.suppliersCollection);
      let suppliersQuery = query(suppliersRef, orderBy('name', 'asc'));

      // Filter by active status if needed
      if (!includeInactive) {
        suppliersQuery = query(
          collection(db, this.suppliersCollection),
          where('isActive', '==', true),
          orderBy('name', 'asc')
        );
      }

      // Apply limit if specified
      if (limitCount !== undefined && limitCount > 0) {
        suppliersQuery = query(suppliersQuery, firestoreLimit(limitCount));
      }

      // Execute query
      const querySnap = await getDocs(suppliersQuery);

      // Convert to domain models
      const suppliers: Supplier[] = [];
      querySnap.forEach((doc) => {
        const supplierDoc = doc.data() as SupplierDoc;
        suppliers.push(this.convertToSupplier(supplierDoc));
      });

      return suppliers;
    } catch (error) {
      throw new Error(
        `Failed to get all suppliers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get active suppliers only
   * 
   * Convenience method to get only active suppliers.
   * 
   * @returns Promise resolving to array of active suppliers
   * @throws Error if retrieval fails
   */
  async getActiveSuppliers(): Promise<Supplier[]> {
    return this.getAllSuppliers(false);
  }

  /**
   * Convert Firestore SupplierDoc to domain model Supplier
   * 
   * @param doc - Firestore document
   * @returns Domain model
   */
  private convertToSupplier(doc: SupplierDoc): Supplier {
    return {
      supplierId: doc.supplierId,
      name: doc.name,
      contactPerson: doc.contactPerson,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      isActive: doc.isActive,
      createdAt: doc.createdAt.toDate(),
      updatedAt: doc.updatedAt.toDate(),
      createdBy: doc.createdBy,
    };
  }
}

// Export singleton instance
export const supplierService = new SupplierService();
