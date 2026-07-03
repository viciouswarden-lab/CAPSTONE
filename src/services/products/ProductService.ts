/**
 * Product Service Implementation
 * 
 * Manages product records including CRUD operations, unique SKU constraints,
 * search functionality, version history tracking, and supplier mappings.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
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
  runTransaction,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, SupplierMapping } from '../../types/models';
import type { ProductDoc, SupplierMapping as FirestoreSupplierMapping } from '../../types/firestore';

/**
 * Request type for creating a new product
 */
export interface CreateProductRequest {
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  reorderPoint: number;
  isActive?: boolean;
  supplierMappings?: SupplierMapping[];
}

/**
 * Request type for updating a product
 */
export interface UpdateProductRequest {
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  reorderPoint?: number;
  isActive?: boolean;
}

/**
 * Filters for product search
 */
export interface ProductSearchFilters {
  category?: string;
  supplierId?: string;
  status?: 'active' | 'inactive' | 'all';
  searchText?: string;
}

/**
 * Product version history entry
 */
interface ProductVersionHistory {
  sku: string;
  version: number;
  changes: Partial<ProductDoc>;
  changedBy: string;
  changedAt: Timestamp;
}

/**
 * Service for managing product records
 * 
 * Provides CRUD operations with unique SKU constraints, search functionality,
 * version history tracking, and supplier mapping management.
 */
export class ProductService {
  private readonly productsCollection = 'products';
  private readonly productVersionsCollection = 'product_versions';

  /**
   * Create a new product
   * 
   * Requirement 7.1: WHEN a user creates a new product, THE System SHALL require
   * SKU, description, category, and unit of measure
   * 
   * Requirement 7.4: THE System SHALL enforce unique SKU constraints across all active products
   * 
   * @param product - Product creation request
   * @returns Promise resolving to created product
   * @throws Error if SKU already exists or creation fails
   */
  async createProduct(product: CreateProductRequest): Promise<Product> {
    try {
      // Validate required fields
      if (!product.sku || !product.description || !product.category || !product.unitOfMeasure) {
        throw new Error('SKU, description, category, and unit of measure are required');
      }

      // Use transaction to ensure unique SKU constraint
      return await runTransaction(db, async (transaction) => {
        const productRef = doc(db, this.productsCollection, product.sku);
        const existingDoc = await transaction.get(productRef);

        // Requirement 7.4: Enforce unique SKU constraint
        if (existingDoc.exists()) {
          const existingProduct = existingDoc.data() as ProductDoc;
          if (existingProduct.isActive) {
            throw new Error(`Product with SKU "${product.sku}" already exists and is active`);
          }
        }

        const now = Timestamp.now();

        // Convert supplier mappings to Firestore format
        const firestoreSupplierMappings: FirestoreSupplierMapping[] = (product.supplierMappings || []).map(
          (mapping) => ({
            supplierId: mapping.supplierId,
            supplierCode: mapping.supplierCode,
            lastCost: mapping.lastCost,
            lastCostDate: Timestamp.fromDate(mapping.lastCostDate),
          })
        );

        // Create product document
        const productDoc: ProductDoc = {
          sku: product.sku,
          description: product.description,
          category: product.category,
          unitOfMeasure: product.unitOfMeasure,
          reorderPoint: product.reorderPoint,
          isActive: product.isActive !== undefined ? product.isActive : true,
          createdAt: now,
          updatedAt: now,
          supplierMappings: firestoreSupplierMappings,
        };

        // Save to Firestore
        transaction.set(productRef, productDoc);

        // Convert and return
        return this.convertToProduct(productDoc);
      });
    } catch (error) {
      throw new Error(
        `Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a product by SKU
   * 
   * Requirement 7.5: WHEN a user searches for products, THE System SHALL support
   * filtering by category, supplier, and status
   * 
   * @param sku - Product SKU to retrieve
   * @returns Promise resolving to product or null if not found
   * @throws Error if retrieval fails
   */
  async getProduct(sku: string): Promise<Product | null> {
    try {
      const productRef = doc(db, this.productsCollection, sku);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        return null;
      }

      const productDoc = productSnap.data() as ProductDoc;
      return this.convertToProduct(productDoc);
    } catch (error) {
      throw new Error(
        `Failed to get product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing product
   * 
   * Requirement 7.2: WHEN a user updates product information, THE System SHALL
   * save changes and maintain version history
   * 
   * @param sku - Product SKU to update
   * @param updates - Partial product data to update
   * @param userId - User ID performing the update
   * @returns Promise resolving to updated product
   * @throws Error if product not found or update fails
   */
  async updateProduct(
    sku: string,
    updates: UpdateProductRequest,
    userId: string
  ): Promise<Product> {
    try {
      return await runTransaction(db, async (transaction) => {
        const productRef = doc(db, this.productsCollection, sku);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Product ${sku} not found`);
        }

        const currentProduct = productSnap.data() as ProductDoc;
        const now = Timestamp.now();

        // Prepare update data
        const updateData: Partial<ProductDoc> = {
          ...updates,
          updatedAt: now,
        };

        // Update product
        transaction.update(productRef, updateData);

        // Requirement 7.2: Maintain version history
        const versionRef = doc(collection(db, this.productVersionsCollection));
        const versionHistory: ProductVersionHistory = {
          sku,
          version: Date.now(), // Use timestamp as version number
          changes: updateData,
          changedBy: userId,
          changedAt: now,
        };
        transaction.set(versionRef, versionHistory);

        // Return updated product
        const updatedProduct: ProductDoc = {
          ...currentProduct,
          ...updateData,
          sku: currentProduct.sku, // Ensure SKU doesn't change
          createdAt: currentProduct.createdAt,
          updatedAt: now,
        };

        return this.convertToProduct(updatedProduct);
      });
    } catch (error) {
      throw new Error(
        `Failed to update product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deactivate a product
   * 
   * Requirement 7.3: WHEN a user deactivates a product, THE System SHALL mark it
   * as inactive while preserving historical transaction data
   * 
   * @param sku - Product SKU to deactivate
   * @param userId - User ID performing the deactivation
   * @returns Promise resolving when deactivation is complete
   * @throws Error if product not found or deactivation fails
   */
  async deactivateProduct(sku: string, userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, this.productsCollection, sku);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Product ${sku} not found`);
        }

        const now = Timestamp.now();

        // Mark as inactive
        transaction.update(productRef, {
          isActive: false,
          updatedAt: now,
        });

        // Store version history
        const versionRef = doc(collection(db, this.productVersionsCollection));
        const versionHistory: ProductVersionHistory = {
          sku,
          version: Date.now(),
          changes: { isActive: false, updatedAt: now },
          changedBy: userId,
          changedAt: now,
        };
        transaction.set(versionRef, versionHistory);
      });
    } catch (error) {
      throw new Error(
        `Failed to deactivate product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search for products with filters
   * 
   * Requirement 7.5: WHEN a user searches for products, THE System SHALL support
   * filtering by category, supplier, and status
   * 
   * Requirement 7.6: THE System SHALL return product search results within 2 seconds
   * 
   * Requirement 17.2: Optimized query performance with pagination and proper indexing
   * 
   * @param filters - Search filters (category, supplier, status, text)
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to array of matching products
   * @throws Error if search fails
   */
  async searchProducts(
    filters: ProductSearchFilters,
    maxResults: number = 1000
  ): Promise<Product[]> {
    try {
      const productsRef = collection(db, this.productsCollection);
      
      // Apply status filter (default to active only)
      const statusFilter = filters.status || 'active';
      const isActive = statusFilter === 'active';

      // Build optimized query using composite index (products: category, isActive)
      // This leverages the Firestore index defined in firestore.indexes.json
      let productsQuery: any;
      
      if (filters.category && statusFilter !== 'all') {
        // Use composite index: category + isActive
        productsQuery = query(
          productsRef,
          where('category', '==', filters.category),
          where('isActive', '==', isActive),
          firestoreLimit(maxResults)
        );
      } else if (filters.category) {
        // Filter by category only
        productsQuery = query(
          productsRef,
          where('category', '==', filters.category),
          firestoreLimit(maxResults)
        );
      } else if (statusFilter !== 'all') {
        // Filter by status only
        productsQuery = query(
          productsRef,
          where('isActive', '==', isActive),
          firestoreLimit(maxResults)
        );
      } else {
        // No filters - add limit to ensure performance
        productsQuery = query(productsRef, firestoreLimit(maxResults));
      }

      // Execute query
      const querySnap = await getDocs(productsQuery);
      let products: Product[] = [];

      // Convert documents to products
      querySnap.forEach((doc) => {
        const productDoc = doc.data() as ProductDoc;
        products.push(this.convertToProduct(productDoc));
      });

      // Apply supplier filter (in-memory, as it requires checking supplierMappings array)
      if (filters.supplierId) {
        products = products.filter((product) =>
          product.supplierMappings.some((mapping) => mapping.supplierId === filters.supplierId)
        );
      }

      // Apply text search filter (in-memory, case-insensitive)
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase().trim();
        products = products.filter(
          (product) =>
            product.sku.toLowerCase().includes(searchLower) ||
            product.description.toLowerCase().includes(searchLower) ||
            product.category.toLowerCase().includes(searchLower)
        );
      }

      // Sort by SKU for consistent results
      products.sort((a, b) => a.sku.localeCompare(b.sku));

      return products;
    } catch (error) {
      throw new Error(
        `Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a supplier mapping to a product
   * 
   * Links a supplier's product code to the internal SKU and stores cost information.
   * 
   * @param sku - Product SKU
   * @param mapping - Supplier mapping to add
   * @returns Promise resolving when mapping is added
   * @throws Error if product not found or operation fails
   */
  async addSupplierMapping(sku: string, mapping: SupplierMapping): Promise<void> {
    try {
      const productRef = doc(db, this.productsCollection, sku);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Product ${sku} not found`);
      }

      const productDoc = productSnap.data() as ProductDoc;

      // Check if mapping already exists for this supplier
      const existingMappingIndex = productDoc.supplierMappings.findIndex(
        (m) => m.supplierId === mapping.supplierId
      );

      const firestoreMapping: FirestoreSupplierMapping = {
        supplierId: mapping.supplierId,
        supplierCode: mapping.supplierCode,
        lastCost: mapping.lastCost,
        lastCostDate: Timestamp.fromDate(mapping.lastCostDate),
      };

      let updatedMappings: FirestoreSupplierMapping[];

      if (existingMappingIndex >= 0) {
        // Update existing mapping
        updatedMappings = [...productDoc.supplierMappings];
        updatedMappings[existingMappingIndex] = firestoreMapping;
      } else {
        // Add new mapping
        updatedMappings = [...productDoc.supplierMappings, firestoreMapping];
      }

      // Update product
      await updateDoc(productRef, {
        supplierMappings: updatedMappings,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      throw new Error(
        `Failed to add supplier mapping for product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update supplier cost for a product
   * 
   * Updates the last cost information for a specific supplier mapping.
   * 
   * @param sku - Product SKU
   * @param supplierId - Supplier ID
   * @param cost - New cost value
   * @returns Promise resolving when cost is updated
   * @throws Error if product or supplier mapping not found
   */
  async updateSupplierCost(sku: string, supplierId: string, cost: number): Promise<void> {
    try {
      const productRef = doc(db, this.productsCollection, sku);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Product ${sku} not found`);
      }

      const productDoc = productSnap.data() as ProductDoc;

      // Find the supplier mapping
      const mappingIndex = productDoc.supplierMappings.findIndex(
        (m) => m.supplierId === supplierId
      );

      if (mappingIndex < 0) {
        throw new Error(`Supplier mapping not found for supplier ${supplierId}`);
      }

      // Update the mapping
      const updatedMappings = [...productDoc.supplierMappings];
      updatedMappings[mappingIndex] = {
        ...updatedMappings[mappingIndex],
        lastCost: cost,
        lastCostDate: Timestamp.now(),
      };

      // Update product
      await updateDoc(productRef, {
        supplierMappings: updatedMappings,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      throw new Error(
        `Failed to update supplier cost for product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get product version history
   * 
   * Retrieves all version history entries for a product.
   * 
   * @param sku - Product SKU
   * @returns Promise resolving to array of version history entries
   * @throws Error if retrieval fails
   */
  async getProductVersionHistory(sku: string): Promise<ProductVersionHistory[]> {
    try {
      const versionsRef = collection(db, this.productVersionsCollection);
      const versionsQuery = query(
        versionsRef,
        where('sku', '==', sku),
        orderBy('changedAt', 'desc')
      );

      const querySnap = await getDocs(versionsQuery);
      const versions: ProductVersionHistory[] = [];

      querySnap.forEach((doc) => {
        versions.push(doc.data() as ProductVersionHistory);
      });

      return versions;
    } catch (error) {
      throw new Error(
        `Failed to get version history for product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all products with optional limit
   * 
   * @param limitCount - Maximum number of results to return (optional)
   * @returns Promise resolving to array of products
   * @throws Error if retrieval fails
   */
  async getAllProducts(limitCount?: number): Promise<Product[]> {
    try {
      const productsRef = collection(db, this.productsCollection);
      let productsQuery = query(productsRef, orderBy('sku', 'asc'));

      if (limitCount !== undefined && limitCount > 0) {
        productsQuery = query(productsQuery, firestoreLimit(limitCount));
      }

      const querySnap = await getDocs(productsQuery);
      const products: Product[] = [];

      querySnap.forEach((doc) => {
        const productDoc = doc.data() as ProductDoc;
        products.push(this.convertToProduct(productDoc));
      });

      return products;
    } catch (error) {
      throw new Error(
        `Failed to get all products: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert Firestore ProductDoc to domain model Product
   * 
   * @param doc - Firestore document
   * @returns Domain model
   */
  private convertToProduct(doc: ProductDoc): Product {
    return {
      sku: doc.sku,
      description: doc.description,
      category: doc.category,
      unitOfMeasure: doc.unitOfMeasure,
      reorderPoint: doc.reorderPoint,
      isActive: doc.isActive,
      createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : new Date(),
      updatedAt: doc.updatedAt?.toDate ? doc.updatedAt.toDate() : new Date(),
      supplierMappings: (doc.supplierMappings || []).map((mapping) => ({
        supplierId: mapping.supplierId,
        supplierCode: mapping.supplierCode,
        lastCost: mapping.lastCost || 0,
        lastCostDate: mapping.lastCostDate?.toDate ? mapping.lastCostDate.toDate() : new Date(),
      })),
    };
  }
}

// Export singleton instance
export const productService = new ProductService();
