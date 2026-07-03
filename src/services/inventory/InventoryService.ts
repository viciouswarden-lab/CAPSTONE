/**
 * Inventory Service Implementation
 * 
 * Manages inventory quantities, locations, and transactions with atomic Firestore operations.
 * Provides real-time stock tracking and transaction history.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.6, 8.7
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
  runTransaction,
  Timestamp,
  limit as firestoreLimit,
  orderBy,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  InventoryService as IInventoryService,
  DateRange,
  InventoryAdjustment,
  LowStockAlert,
  InventoryTransaction,
  ReceivingRecord,
  POSTransaction,
} from '../../types/services';
import type {
  InventoryDoc,
  InventoryTransactionDoc,
  ProductDoc,
  LowStockAlertDoc,
  AlertStatus,
} from '../../types/firestore';

/**
 * Implementation of the InventoryService interface
 * 
 * This service provides atomic inventory operations using Firestore transactions
 * to ensure data consistency across concurrent operations.
 */
export class InventoryService implements IInventoryService {
  private readonly inventoryCollection = 'inventory';
  private readonly transactionsCollection = 'inventory_transactions';
  private readonly productsCollection = 'products';
  private readonly alertsCollection = 'low_stock_alerts';

  /**
   * Get current quantity on hand for a product
   * 
   * If locationId is provided, returns quantity for that specific location.
   * If locationId is omitted, returns sum of quantities across all locations.
   * 
   * Requirement 17.2: Optimized query with proper limit
   * 
   * @param sku - Product SKU
   * @param locationId - Optional location filter
   * @returns Promise resolving to current quantity
   * 
   * Requirements 8.1, 8.5, 17.2
   */
  async getQuantityOnHand(sku: string, locationId?: string): Promise<number> {
    try {
      if (locationId) {
        // Get quantity for specific location
        // Escape special characters in SKU for use as document ID
        const escapedSku = sku.replace(/\//g, '_');
        const inventoryId = `${escapedSku}_${locationId}`;
        const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
        const inventorySnap = await getDoc(inventoryRef);

        if (!inventorySnap.exists()) {
          return 0;
        }

        const inventoryData = inventorySnap.data() as InventoryDoc;
        return inventoryData.quantityOnHand;
      } else {
        // Get sum across all locations with limit for performance (Requirement 17.2)
        const inventoryQuery = query(
          collection(db, this.inventoryCollection),
          where('sku', '==', sku),
          firestoreLimit(100) // Reasonable limit for locations per product
        );
        const querySnap = await getDocs(inventoryQuery);

        let totalQuantity = 0;
        querySnap.forEach((doc) => {
          const data = doc.data() as InventoryDoc;
          totalQuantity += data.quantityOnHand;
        });

        return totalQuantity;
      }
    } catch (error) {
      throw new Error(
        `Failed to get quantity on hand for SKU ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Adjust inventory quantity with atomic transaction
   * 
   * Uses Firestore transaction to ensure atomic update of both inventory record
   * and transaction history. Formula: new_quantity = current_quantity + quantity_change
   * 
   * @param adjustment - Adjustment details
   * @returns Promise resolving when adjustment is complete
   * @throws Error if SKU doesn't exist or transaction fails
   * 
   * Requirements 8.2, 8.7
   */
  async adjustInventory(adjustment: InventoryAdjustment): Promise<void> {
    try {
      await runTransaction(db, async (transaction: Transaction) => {
        // Generate inventory and transaction IDs
        // Escape special characters in SKU for use as document ID
        const escapedSku = adjustment.sku.replace(/\//g, '_');
        const inventoryId = `${escapedSku}_${adjustment.locationId}`;
        const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
        const transactionId = `${Date.now()}_${escapedSku}_${adjustment.locationId}`;
        const transactionRef = doc(db, this.transactionsCollection, transactionId);

        // Read current inventory
        const inventorySnap = await transaction.get(inventoryRef);
        
        let currentQuantity = 0;
        if (inventorySnap.exists()) {
          const inventoryData = inventorySnap.data() as InventoryDoc;
          currentQuantity = inventoryData.quantityOnHand;
        }

        // Calculate new quantity using the formula: new_quantity = current_quantity + quantity_change
        const newQuantity = currentQuantity + adjustment.quantityChange;

        // Validate that the new quantity is not negative
        if (newQuantity < 0) {
          throw new Error(
            `Insufficient inventory for SKU ${adjustment.sku} at location ${adjustment.locationId}. ` +
            `Current: ${currentQuantity}, Requested change: ${adjustment.quantityChange}`
          );
        }

        // Update or create inventory record
        const inventoryData: InventoryDoc = {
          inventoryId,
          sku: adjustment.sku,
          locationId: adjustment.locationId,
          quantityOnHand: newQuantity,
          lastUpdated: Timestamp.fromDate(adjustment.timestamp),
          lastTransactionId: transactionId,
        };

        if (inventorySnap.exists()) {
          transaction.update(inventoryRef, inventoryData);
        } else {
          transaction.set(inventoryRef, inventoryData);
        }

        // Create transaction history record
        const transactionData: InventoryTransactionDoc = {
          transactionId,
          sku: adjustment.sku,
          locationId: adjustment.locationId,
          transactionType: adjustment.reason,
          quantityChange: adjustment.quantityChange,
          quantityBefore: currentQuantity,
          quantityAfter: newQuantity,
          timestamp: Timestamp.fromDate(adjustment.timestamp),
          userId: adjustment.userId,
          notes: adjustment.notes,
        };

        transaction.set(transactionRef, transactionData);
      });

      // Check for low stock condition after inventory adjustment
      await this.checkLowStockAlert(adjustment.sku, adjustment.locationId);
    } catch (error) {
      throw new Error(
        `Failed to adjust inventory for SKU ${adjustment.sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process a receiving transaction and update inventory
   * 
   * @param receiving - Receiving record to process
   * @returns Promise resolving when receiving is complete
   * 
   * Requirements 8.2, 9.3
   */
  async processReceiving(receiving: ReceivingRecord): Promise<void> {
    // Process each line item as an inventory adjustment
    const adjustmentPromises = receiving.lineItems.map(async (lineItem) => {
      const adjustment: InventoryAdjustment = {
        sku: lineItem.sku,
        locationId: lineItem.locationId,
        quantityChange: lineItem.quantity,
        reason: 'receiving',
        userId: receiving.receivingId, // Using receivingId as reference
        timestamp: new Date(),
        notes: `Receiving ${receiving.receivingId} - ${receiving.documentType}`,
      };

      // adjustInventory already calls checkLowStockAlert internally
      return this.adjustInventory(adjustment);
    });

    try {
      await Promise.all(adjustmentPromises);
    } catch (error) {
      throw new Error(
        `Failed to process receiving ${receiving.receivingId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process a sale transaction and decrease inventory
   * 
   * @param transaction - POS transaction to process
   * @returns Promise resolving when sale is processed
   * 
   * Requirements 8.3, 13.3
   */
  async processSale(transaction: POSTransaction): Promise<void> {
    // For POS sales, we need to determine the location
    // Assuming a default location for now - this should be configurable
    const defaultLocationId = 'default';

    // Process each line item as an inventory adjustment
    const adjustmentPromises = transaction.lineItems.map(async (lineItem) => {
      const adjustment: InventoryAdjustment = {
        sku: lineItem.sku,
        locationId: defaultLocationId,
        quantityChange: -lineItem.quantity, // Negative for sale
        reason: 'sale',
        userId: transaction.userId,
        timestamp: new Date(transaction.timestamp.toDate()),
        notes: `POS Transaction ${transaction.transactionId}`,
      };

      // adjustInventory already calls checkLowStockAlert internally
      return this.adjustInventory(adjustment);
    });

    try {
      await Promise.all(adjustmentPromises);
    } catch (error) {
      throw new Error(
        `Failed to process sale transaction ${transaction.transactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all products with inventory below reorder point
   * 
   * Generates alerts when quantity < reorder_point.
   * 
   * Requirement 8.4, 17.2: Optimized query with proper limit
   * 
   * @param locationId - Optional location filter
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to low stock alerts
   * 
   * Requirement 8.4
   */
  async getLowStockItems(
    locationId?: string,
    maxResults: number = 1000
  ): Promise<LowStockAlert[]> {
    try {
      // Build query for inventory records with limit for performance (Requirement 17.2)
      let inventoryQuery = query(
        collection(db, this.inventoryCollection),
        firestoreLimit(maxResults)
      );
      
      if (locationId) {
        inventoryQuery = query(
          collection(db, this.inventoryCollection),
          where('locationId', '==', locationId),
          firestoreLimit(maxResults)
        );
      }

      const inventorySnap = await getDocs(inventoryQuery);
      const alerts: LowStockAlert[] = [];

      // For each inventory record, check against product reorder point
      for (const inventoryDoc of inventorySnap.docs) {
        const inventoryData = inventoryDoc.data() as InventoryDoc;
        
        // Get product to check reorder point
        const productRef = doc(db, this.productsCollection, inventoryData.sku);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const productData = productSnap.data() as ProductDoc;
          
          // Generate alert if quantity is below reorder point
          if (inventoryData.quantityOnHand < productData.reorderPoint) {
            alerts.push({
              sku: inventoryData.sku,
              currentQuantity: inventoryData.quantityOnHand,
              reorderPoint: productData.reorderPoint,
              locationId: inventoryData.locationId,
            });
          }
        }
      }

      return alerts;
    } catch (error) {
      throw new Error(
        `Failed to get low stock items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get inventory transaction history for a product
   * 
   * Requirement 8.6, 17.2: Optimized query with composite index and limit
   * Uses composite index: inventory_transactions (sku, timestamp DESC)
   * 
   * @param sku - Product SKU
   * @param dateRange - Date range to query
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Promise resolving to transaction history
   * 
   * Requirement 8.6
   */
  async getInventoryHistory(
    sku: string,
    dateRange: DateRange,
    maxResults: number = 1000
  ): Promise<InventoryTransaction[]> {
    try {
      // Build query with SKU and date range filters
      // Uses composite index: inventory_transactions (sku ASC, timestamp DESC)
      const startTimestamp = Timestamp.fromDate(dateRange.start);
      const endTimestamp = Timestamp.fromDate(dateRange.end);

      const historyQuery = query(
        collection(db, this.transactionsCollection),
        where('sku', '==', sku),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc'),
        firestoreLimit(maxResults)
      );

      const querySnap = await getDocs(historyQuery);
      const history: InventoryTransaction[] = [];

      querySnap.forEach((doc) => {
        const data = doc.data() as InventoryTransactionDoc;
        history.push({
          transactionId: data.transactionId,
          sku: data.sku,
          quantityBefore: data.quantityBefore,
          quantityAfter: data.quantityAfter,
          transactionType: data.transactionType,
          timestamp: data.timestamp.toDate(),
          userId: data.userId,
        });
      });

      // Already sorted by timestamp descending (most recent first) via orderBy
      return history;
    } catch (error) {
      throw new Error(
        `Failed to get inventory history for SKU ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check for low stock condition and create/update/resolve alert
   * 
   * Called after inventory adjustments to maintain real-time alert status.
   * Generates alerts when quantity < reorder_point.
   * 
   * @param sku - Product SKU to check
   * @param locationId - Location identifier
   * @returns Promise resolving when alert check is complete
   * 
   * Requirements 8.4
   */
  private async checkLowStockAlert(sku: string, locationId: string): Promise<void> {
    try {
      // Get current quantity
      const currentQty = await this.getQuantityOnHand(sku, locationId);
      
      // Get product to check reorder point
      const productRef = doc(db, this.productsCollection, sku);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        console.log(`Product ${sku} not found, skipping alert check`);
        return;
      }

      const productData = productSnap.data() as ProductDoc;
      
      // Check if product is active
      if (!productData.isActive) {
        console.log(`Product ${sku} is inactive, skipping alert check`);
        return;
      }

      const reorderPoint = productData.reorderPoint;
      
      // Check if low stock condition exists (quantity < reorder_point)
      if (currentQty < reorderPoint) {
        // Low stock detected - create or update alert
        await this.createOrUpdateAlert(
          sku,
          locationId,
          currentQty,
          reorderPoint,
          'active'
        );
      } else {
        // Stock is sufficient - resolve any existing alerts
        await this.resolveAlert(sku, locationId);
      }
    } catch (error) {
      // Log error but don't throw to avoid blocking inventory operations
      console.error(
        `Error checking low stock alert for ${sku} at ${locationId}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Create or update low stock alert
   * 
   * Uses composite key to ensure one alert per SKU-location combination.
   * 
   * @param sku - Product SKU
   * @param locationId - Location identifier
   * @param currentQuantity - Current quantity on hand
   * @param reorderPoint - Reorder point threshold
   * @param status - Alert status
   * @returns Promise resolving when alert is created/updated
   * 
   * Requirements 8.4
   */
  private async createOrUpdateAlert(
    sku: string,
    locationId: string,
    currentQuantity: number,
    reorderPoint: number,
    status: AlertStatus
  ): Promise<void> {
    try {
      // Use composite key: {sku}_{locationId}
      // Escape special characters in SKU for use as document ID
      const escapedSku = sku.replace(/\//g, '_');
      const alertId = `${escapedSku}_${locationId}`;
      const alertRef = doc(db, this.alertsCollection, alertId);
      
      // Check if alert already exists
      const existingAlert = await getDoc(alertRef);
      const now = Timestamp.now();
      
      if (!existingAlert.exists()) {
        // Create new alert
        const newAlert: LowStockAlertDoc = {
          alertId,
          sku,
          locationId,
          currentQuantity,
          reorderPoint,
          status,
          createdAt: now,
          updatedAt: now,
        };
        
        await setDoc(alertRef, newAlert);
        console.log(`Created new low stock alert: ${alertId}`);
      } else {
        // Update existing alert
        const existingData = existingAlert.data() as LowStockAlertDoc;
        
        // Only update if values changed or status needs to change
        if (
          existingData.currentQuantity !== currentQuantity ||
          existingData.status !== status
        ) {
          await updateDoc(alertRef, {
            currentQuantity,
            reorderPoint,
            status,
            updatedAt: now,
          });
          console.log(`Updated existing low stock alert: ${alertId}`);
        } else {
          console.log(`Alert ${alertId} already up to date`);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to create/update alert for ${sku} at ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolve existing low stock alert when stock is replenished
   * 
   * @param sku - Product SKU
   * @param locationId - Location identifier
   * @returns Promise resolving when alert is resolved
   * 
   * Requirements 8.4
   */
  private async resolveAlert(sku: string, locationId: string): Promise<void> {
    try {
      // Escape special characters in SKU for use as document ID
      const escapedSku = sku.replace(/\//g, '_');
      const alertId = `${escapedSku}_${locationId}`;
      const alertRef = doc(db, this.alertsCollection, alertId);
      
      const existingAlert = await getDoc(alertRef);
      
      if (existingAlert.exists()) {
        const alertData = existingAlert.data() as LowStockAlertDoc;
        
        // Only update if currently active
        if (alertData.status === 'active') {
          const now = Timestamp.now();
          
          await updateDoc(alertRef, {
            status: 'resolved',
            updatedAt: now,
            resolvedAt: now,
          });
          
          console.log(`Resolved low stock alert: ${alertId}`);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to resolve alert for ${sku} at ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
