/**
 * Retry Utility Usage Examples
 * 
 * Demonstrates how to apply retry logic to Firebase operations
 * throughout the PRO SYNAPSE application.
 * 
 * Requirement 18.4: Automatic retry logic for transient failures
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { retryFirestore, retryNetwork, withRetry, createRetryWrapper } from './retry';

// Mock db for examples
const db: any = {};

// ============================================================================
// EXAMPLE 1: Basic Firestore Write with Retry
// ============================================================================

export async function createProductWithRetry(productData: any): Promise<void> {
  await retryFirestore(async () => {
    const productRef = doc(db, 'products', productData.sku);
    await setDoc(productRef, {
      ...productData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

// ============================================================================
// EXAMPLE 2: Firestore Read with Retry
// ============================================================================

export async function getProductWithRetry(sku: string): Promise<any | null> {
  return await retryFirestore(async () => {
    const productRef = doc(db, 'products', sku);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      return null;
    }
    
    return productSnap.data();
  });
}

// ============================================================================
// EXAMPLE 3: Firestore Update with Retry
// ============================================================================

export async function updateProductPriceWithRetry(
  sku: string,
  newPrice: number
): Promise<void> {
  await retryFirestore(async () => {
    const productRef = doc(db, 'products', sku);
    await updateDoc(productRef, {
      price: newPrice,
      updatedAt: Timestamp.now(),
    });
  });
}

// ============================================================================
// EXAMPLE 4: Firestore Delete with Retry
// ============================================================================

export async function deleteProductWithRetry(sku: string): Promise<void> {
  await retryFirestore(async () => {
    const productRef = doc(db, 'products', sku);
    await deleteDoc(productRef);
  });
}

// ============================================================================
// EXAMPLE 5: Firestore Query with Retry
// ============================================================================

export async function getLowStockProductsWithRetry(): Promise<any[]> {
  return await retryFirestore(async () => {
    const inventoryRef = collection(db, 'inventory');
    const q = query(
      inventoryRef,
      where('quantityOnHand', '<', 10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  });
}

// ============================================================================
// EXAMPLE 6: Firestore Transaction with Retry
// ============================================================================

export async function processInventoryAdjustmentWithRetry(
  sku: string,
  locationId: string,
  quantityChange: number
): Promise<void> {
  await retryFirestore(async () => {
    await runTransaction(db, async (transaction) => {
      const inventoryRef = doc(db, 'inventory', `${sku}_${locationId}`);
      const inventorySnap = await transaction.get(inventoryRef);
      
      if (!inventorySnap.exists()) {
        throw new Error('Inventory record not found');
      }
      
      const currentQuantity = inventorySnap.data().quantityOnHand;
      const newQuantity = currentQuantity + quantityChange;
      
      if (newQuantity < 0) {
        throw new Error('Insufficient inventory');
      }
      
      transaction.update(inventoryRef, {
        quantityOnHand: newQuantity,
        lastUpdated: Timestamp.now(),
      });
      
      // Also create transaction history record
      const transactionRef = doc(collection(db, 'inventory_transactions'));
      transaction.set(transactionRef, {
        sku,
        locationId,
        quantityChange,
        quantityBefore: currentQuantity,
        quantityAfter: newQuantity,
        timestamp: Timestamp.now(),
      });
    });
  });
}

// ============================================================================
// EXAMPLE 7: Firestore Batch Write with Retry
// ============================================================================

export async function bulkUpdatePricesWithRetry(
  updates: Array<{ sku: string; price: number }>
): Promise<void> {
  await retryFirestore(async () => {
    const batch = writeBatch(db);
    const timestamp = Timestamp.now();
    
    updates.forEach(update => {
      const productRef = doc(db, 'products', update.sku);
      batch.update(productRef, {
        price: update.price,
        updatedAt: timestamp,
      });
    });
    
    await batch.commit();
  });
}

// ============================================================================
// EXAMPLE 8: Network Request with Retry
// ============================================================================

export async function fetchExternalAPIWithRetry(url: string): Promise<any> {
  return await retryNetwork(async () => {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  });
}

// ============================================================================
// EXAMPLE 9: Custom Retry Configuration for Critical Operations
// ============================================================================

export async function criticalInventoryUpdateWithRetry(
  sku: string,
  quantity: number
): Promise<void> {
  // Use custom retry configuration for critical operations
  await withRetry(
    async () => {
      const inventoryRef = doc(db, 'inventory', sku);
      await updateDoc(inventoryRef, {
        quantityOnHand: quantity,
        lastUpdated: Timestamp.now(),
      });
    },
    {
      maxRetries: 10,        // More retries for critical ops
      initialDelayMs: 500,   // Start with shorter delay
      backoffMultiplier: 1.5, // Gentler backoff
      maxDelayMs: 20000,     // Cap at 20 seconds
      onRetry: (error, attempt, delay) => {
        console.error(
          `[CRITICAL] Inventory update retry ${attempt}/10 in ${delay}ms`,
          { sku, error }
        );
        // Could send alert to monitoring system here
      },
    }
  );
}

// ============================================================================
// EXAMPLE 10: Creating Domain-Specific Retry Wrappers
// ============================================================================

// Create a specialized retry wrapper for AI service calls
const retryAIService = createRetryWrapper({
  maxRetries: 5,
  initialDelayMs: 2000,  // AI services may need longer initial delay
  backoffMultiplier: 2,
  maxDelayMs: 60000,     // AI processing can take time
  onRetry: (error, attempt, delay) => {
    console.warn(`AI service retry ${attempt} after ${delay}ms:`, error);
  },
});

export async function matchProductsWithAIRetry(
  supplierProducts: any[]
): Promise<any[]> {
  return await retryAIService(async () => {
    // Call AI matching service
    const response = await fetch('https://ai-service.example.com/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: supplierProducts }),
    });
    
    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }
    
    return await response.json();
  });
}

// ============================================================================
// EXAMPLE 11: Combining Retry with Error Handling
// ============================================================================

import {
  DatabaseErrorFactory,
  SystemErrorFactory,
  type ErrorResponse,
} from './errors';

export async function saveSupplierWithRetryAndErrorHandling(
  supplierData: any
): Promise<ErrorResponse | void> {
  try {
    await retryFirestore(async () => {
      const supplierRef = doc(db, 'suppliers', supplierData.supplierId);
      await setDoc(supplierRef, {
        ...supplierData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
  } catch (error: any) {
    // After all retries exhausted, return proper error response
    if (error.code === 'permission-denied') {
      return DatabaseErrorFactory.firestoreFailure(
        'create supplier',
        'suppliers'
      );
    }
    
    return SystemErrorFactory.unexpectedError(error);
  }
}

// ============================================================================
// EXAMPLE 12: Retry with Custom Transient Error Detection
// ============================================================================

export async function callThirdPartyAPIWithCustomRetry(
  endpoint: string
): Promise<any> {
  return await withRetry(
    async () => {
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        // Throw error with status for custom detection
        const error = new Error(`API error: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }
      
      return await response.json();
    },
    {
      // Custom logic to determine if error is transient
      isTransient: (error) => {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          // Retry on specific HTTP status codes
          return status === 429 ||  // Too Many Requests
                 status === 503 ||  // Service Unavailable
                 status === 504;    // Gateway Timeout
        }
        return false;
      },
      maxRetries: 5,
      initialDelayMs: 1000,
    }
  );
}

// ============================================================================
// EXAMPLE 13: Service Class with Integrated Retry Logic
// ============================================================================

export class InventoryServiceWithRetry {
  private readonly inventoryCollection = 'inventory';

  async getQuantityOnHand(sku: string, locationId: string): Promise<number> {
    return await retryFirestore(async () => {
      const inventoryRef = doc(db, this.inventoryCollection, `${sku}_${locationId}`);
      const inventorySnap = await getDoc(inventoryRef);
      
      if (!inventorySnap.exists()) {
        return 0;
      }
      
      return inventorySnap.data().quantityOnHand;
    });
  }

  async adjustInventory(
    sku: string,
    locationId: string,
    quantityChange: number,
    reason: string,
    userId: string
  ): Promise<void> {
    await retryFirestore(async () => {
      await runTransaction(db, async (transaction) => {
        const inventoryRef = doc(db, this.inventoryCollection, `${sku}_${locationId}`);
        const inventorySnap = await transaction.get(inventoryRef);
        
        const currentQuantity = inventorySnap.exists() 
          ? inventorySnap.data().quantityOnHand 
          : 0;
        
        const newQuantity = currentQuantity + quantityChange;
        
        if (newQuantity < 0) {
          throw new Error('Insufficient inventory');
        }
        
        if (inventorySnap.exists()) {
          transaction.update(inventoryRef, {
            quantityOnHand: newQuantity,
            lastUpdated: Timestamp.now(),
            lastTransactionId: 'generated-id',
          });
        } else {
          transaction.set(inventoryRef, {
            inventoryId: `${sku}_${locationId}`,
            sku,
            locationId,
            quantityOnHand: newQuantity,
            lastUpdated: Timestamp.now(),
            lastTransactionId: 'generated-id',
          });
        }
        
        // Create transaction history
        const historyRef = doc(collection(db, 'inventory_transactions'));
        transaction.set(historyRef, {
          transactionId: historyRef.id,
          sku,
          locationId,
          transactionType: reason,
          quantityChange,
          quantityBefore: currentQuantity,
          quantityAfter: newQuantity,
          timestamp: Timestamp.now(),
          userId,
        });
      });
    });
  }

  async getLowStockItems(locationId?: string): Promise<any[]> {
    return await retryFirestore(async () => {
      const inventoryRef = collection(db, this.inventoryCollection);
      let q = query(inventoryRef, where('quantityOnHand', '<', 10));
      
      if (locationId) {
        q = query(q, where('locationId', '==', locationId));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    });
  }
}

// ============================================================================
// EXAMPLE 14: POS Service with Offline Queue and Retry
// ============================================================================

export class POSServiceWithRetry {
  private offlineQueue: any[] = [];

  async createTransaction(transaction: any): Promise<void> {
    try {
      await retryFirestore(async () => {
        const transactionRef = doc(collection(db, 'pos_transactions'));
        await setDoc(transactionRef, {
          ...transaction,
          transactionId: transactionRef.id,
          timestamp: Timestamp.now(),
          syncStatus: 'synced',
        });
      });
    } catch (error) {
      // If all retries fail, queue for later sync
      console.error('Failed to sync transaction, queueing for later:', error);
      this.offlineQueue.push({
        ...transaction,
        syncStatus: 'pending',
        queuedAt: Date.now(),
      });
      throw error;
    }
  }

  async syncOfflineQueue(): Promise<void> {
    const toSync = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const transaction of toSync) {
      try {
        await this.createTransaction(transaction);
        // Successfully synced, remove from queue
      } catch (error) {
        // Failed again, put back in queue
        this.offlineQueue.push(transaction);
      }
    }
  }
}

// ============================================================================
// EXAMPLE 15: Monitoring and Metrics Integration
// ============================================================================

// Mock monitoring service
const monitoring = {
  trackMetric: (name: string, value: number, tags?: any) => {},
  trackError: (error: Error, context?: any) => {},
};

export async function operationWithMonitoring(data: any): Promise<void> {
  const startTime = Date.now();
  let retryCount = 0;
  
  try {
    await withRetry(
      async () => {
        const docRef = doc(db, 'data', data.id);
        await setDoc(docRef, data);
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt, delay) => {
          retryCount = attempt;
          
          // Track retry metrics
          monitoring.trackMetric('database.retry', 1, {
            attempt,
            collection: 'data',
            errorCode: (error as any).code || 'unknown',
          });
        },
      }
    );
    
    // Track success
    const duration = Date.now() - startTime;
    monitoring.trackMetric('database.operation.success', duration, {
      collection: 'data',
      retries: retryCount,
    });
  } catch (error) {
    // Track failure after all retries
    monitoring.trackError(error as Error, {
      operation: 'setDoc',
      collection: 'data',
      retriesAttempted: retryCount,
    });
    throw error;
  }
}
