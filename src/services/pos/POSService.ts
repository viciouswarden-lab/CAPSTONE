/**
 * Point-of-Sale Service Implementation
 * 
 * Manages sales transactions with fast product lookups and atomic inventory updates.
 * Provides complete transaction processing including line item calculations and inventory management.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.6
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  Timestamp,
  limit as firestoreLimit,
  orderBy,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { POSService as IPOSService, DateRange, POSTransactionDraft } from '../../types/services';
import type { ProductPOS, POSTransaction } from '../../types/models';
import type {
  ProductDoc,
  POSTransactionDoc,
  InventoryDoc,
  PricingDoc,
} from '../../types/firestore';

/**
 * Implementation of the POSService interface
 * 
 * This service provides fast product lookups (within 1 second) and complete
 * transaction processing (within 5 seconds) as required by the specifications.
 */
export class POSService implements IPOSService {
  private readonly productsCollection = 'products';
  private readonly inventoryCollection = 'inventory';
  private readonly pricingCollection = 'pricing';
  private readonly transactionsCollection = 'pos_transactions';
  private readonly defaultLocationId = 'default';

  /**
   * Look up product information by SKU for POS display
   * 
   * Fast SKU-based retrieval with price and availability.
   * Target: Complete within 1 second (Requirement 13.1)
   * 
   * @param sku - Product SKU to look up
   * @returns Promise resolving to product details
   * @throws Error if product not found or is inactive
   * 
   * Requirement 13.1
   */
  async lookupProduct(sku: string): Promise<ProductPOS> {
    try {
      // Retrieve product information
      const productRef = doc(db, this.productsCollection, sku);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Product with SKU ${sku} not found`);
      }

      const productData = productSnap.data() as ProductDoc;

      // Validate product is active
      if (!productData.isActive) {
        throw new Error(`Product ${sku} is inactive and cannot be sold`);
      }

      // Get current price (standard tier)
      const pricingId = `${sku}_standard`;
      const pricingRef = doc(db, this.pricingCollection, pricingId);
      const pricingSnap = await getDoc(pricingRef);

      if (!pricingSnap.exists()) {
        throw new Error(`No pricing found for product ${sku}`);
      }

      const pricingData = pricingSnap.data() as PricingDoc;

      // Get available quantity across all locations (or default location)
      const inventoryId = `${sku}_${this.defaultLocationId}`;
      const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
      const inventorySnap = await getDoc(inventoryRef);

      let availableQuantity = 0;
      if (inventorySnap.exists()) {
        const inventoryData = inventorySnap.data() as InventoryDoc;
        availableQuantity = inventoryData.quantityOnHand;
      }

      // Return product information for POS
      return {
        sku: productData.sku,
        description: productData.description,
        price: pricingData.retailPrice,
        availableQuantity,
        category: productData.category,
      };
    } catch (error) {
      throw new Error(
        `Failed to lookup product ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new POS transaction
   * 
   * Calculates line totals: line_total = quantity * unit_price (rounded to 2 decimals)
   * Calculates transaction subtotal, tax, and total
   * Updates inventory atomically on completion
   * Target: Complete within 5 seconds (Requirement 13.6)
   * 
   * @param transaction - Transaction draft to create
   * @returns Promise resolving to completed transaction
   * @throws Error if validation fails or inventory insufficient
   * 
   * Requirements 13.2, 13.3, 13.6
   */
  async createTransaction(transaction: POSTransactionDraft): Promise<POSTransaction> {
    try {
      // Validate transaction has line items
      if (!transaction.lineItems || transaction.lineItems.length === 0) {
        throw new Error('Transaction must have at least one line item');
      }

      // Generate transaction ID
      const transactionId = `POS_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const timestamp = Timestamp.now();

      // Calculate line totals and validate inventory availability
      const lineItems = transaction.lineItems.map((item) => {
        // Calculate line total: line_total = quantity * unit_price (rounded to 2 decimals)
        const lineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

        return {
          ...item,
          lineTotal,
        };
      });

      // Calculate transaction totals
      const subtotal = Math.round(
        lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100
      ) / 100;

      // Calculate tax (assuming 0% for now - should be configurable)
      const taxRate = 0;
      const tax = Math.round(subtotal * taxRate * 100) / 100;

      // Calculate total
      const total = Math.round((subtotal + tax) * 100) / 100;

      // Use Firestore transaction to atomically:
      // 1. Create POS transaction record
      // 2. Update inventory quantities for all line items
      await runTransaction(db, async (firestoreTransaction: Transaction) => {
        // Validate inventory availability for all items
        for (const item of lineItems) {
          const inventoryId = `${item.sku}_${this.defaultLocationId}`;
          const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
          const inventorySnap = await firestoreTransaction.get(inventoryRef);

          if (!inventorySnap.exists()) {
            throw new Error(`No inventory record found for product ${item.sku}`);
          }

          const inventoryData = inventorySnap.data() as InventoryDoc;

          // Check if sufficient quantity available
          if (inventoryData.quantityOnHand < item.quantity) {
            throw new Error(
              `Insufficient inventory for ${item.sku}. Available: ${inventoryData.quantityOnHand}, Requested: ${item.quantity}`
            );
          }
        }

        // Create POS transaction record
        const transactionDoc: POSTransactionDoc = {
          transactionId,
          timestamp,
          lineItems,
          subtotal,
          tax,
          total,
          paymentMethod: transaction.paymentMethod,
          userId: transaction.userId,
          status: 'completed',
          syncStatus: 'synced',
        };

        const transactionRef = doc(db, this.transactionsCollection, transactionId);
        firestoreTransaction.set(transactionRef, transactionDoc);

        // Update inventory for each line item (decrease quantities)
        for (const item of lineItems) {
          const inventoryId = `${item.sku}_${this.defaultLocationId}`;
          const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
          const inventorySnap = await firestoreTransaction.get(inventoryRef);

          const inventoryData = inventorySnap.data() as InventoryDoc;
          const newQuantity = inventoryData.quantityOnHand - item.quantity;

          firestoreTransaction.update(inventoryRef, {
            quantityOnHand: newQuantity,
            lastUpdated: timestamp,
            lastTransactionId: transactionId,
          });
        }
      });

      // Return the completed transaction
      return {
        transactionId,
        timestamp: timestamp.toDate(),
        lineItems,
        subtotal,
        tax,
        total,
        paymentMethod: transaction.paymentMethod,
        userId: transaction.userId,
        status: 'completed',
      };
    } catch (error) {
      throw new Error(
        `Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Void a completed transaction
   * 
   * Reverses inventory adjustments and maintains audit trail.
   * Updates transaction status to 'voided' and restores inventory quantities.
   * 
   * @param transactionId - Transaction ID to void
   * @param userId - User performing the void
   * @returns Promise resolving when void is complete
   * @throws Error if transaction not found or already voided
   * 
   * Requirement 13.5
   */
  async voidTransaction(transactionId: string, userId: string): Promise<void> {
    try {
      await runTransaction(db, async (firestoreTransaction: Transaction) => {
        // Get the transaction to void
        const transactionRef = doc(db, this.transactionsCollection, transactionId);
        const transactionSnap = await firestoreTransaction.get(transactionRef);

        if (!transactionSnap.exists()) {
          throw new Error(`Transaction ${transactionId} not found`);
        }

        const transactionData = transactionSnap.data() as POSTransactionDoc;

        // Check if already voided
        if (transactionData.status === 'voided') {
          throw new Error(`Transaction ${transactionId} is already voided`);
        }

        // Update transaction status to voided
        firestoreTransaction.update(transactionRef, {
          status: 'voided',
          voidedAt: Timestamp.now(),
          voidedBy: userId,
        });

        // Reverse inventory adjustments: add back the quantities that were sold
        for (const item of transactionData.lineItems) {
          const inventoryId = `${item.sku}_${this.defaultLocationId}`;
          const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
          const inventorySnap = await firestoreTransaction.get(inventoryRef);

          if (inventorySnap.exists()) {
            const inventoryData = inventorySnap.data() as InventoryDoc;
            const restoredQuantity = inventoryData.quantityOnHand + item.quantity;

            firestoreTransaction.update(inventoryRef, {
              quantityOnHand: restoredQuantity,
              lastUpdated: Timestamp.now(),
              lastTransactionId: `VOID_${transactionId}`,
            });
          }
        }
      });
    } catch (error) {
      throw new Error(
        `Failed to void transaction ${transactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get transaction history within a date range
   * 
   * Requirement 13.1, 17.2: Optimized query with composite index and limit
   * Uses composite index: pos_transactions (timestamp DESC, status ASC)
   * 
   * @param dateRange - Date range to query
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to transaction history
   * 
   * Requirement 13.1
   */
  async getTransactionHistory(
    dateRange: DateRange,
    maxResults: number = 1000
  ): Promise<POSTransaction[]> {
    try {
      const startTimestamp = Timestamp.fromDate(dateRange.start);
      const endTimestamp = Timestamp.fromDate(dateRange.end);

      // Use composite index: pos_transactions (timestamp DESC, status ASC)
      const historyQuery = query(
        collection(db, this.transactionsCollection),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc'),
        firestoreLimit(maxResults)
      );

      const querySnap = await getDocs(historyQuery);
      const history: POSTransaction[] = [];

      querySnap.forEach((doc) => {
        const data = doc.data() as POSTransactionDoc;
        history.push({
          transactionId: data.transactionId,
          timestamp: data.timestamp.toDate(),
          lineItems: data.lineItems,
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          paymentMethod: data.paymentMethod,
          userId: data.userId,
          status: data.status,
        });
      });

      // Already sorted by timestamp descending (most recent first) via orderBy
      return history;
    } catch (error) {
      throw new Error(
        `Failed to get transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const posService = new POSService();
