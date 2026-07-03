/**
 * Low Stock Alert Cloud Function Trigger
 * 
 * Automatically generates alerts when inventory quantities fall below reorder points.
 * Triggered on inventory document updates.
 * 
 * Requirements: 8.4
 */

import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

/**
 * Inventory document structure from Firestore
 */
interface InventoryDoc {
  inventoryId: string;
  sku: string;
  locationId: string;
  quantityOnHand: number;
  lastUpdated: Date;
  lastTransactionId: string;
}

/**
 * Product document structure (to get reorder point)
 */
interface ProductDoc {
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  reorderPoint: number;
  isActive: boolean;
}

/**
 * Low stock alert document structure
 */
interface LowStockAlertDoc {
  alertId: string;
  sku: string;
  locationId: string;
  currentQuantity: number;
  reorderPoint: number;
  status: 'active' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

/**
 * Process low stock alert on inventory update
 * 
 * @param event - Firestore event triggered by inventory document update
 * @param firestore - Firestore instance
 */
export async function processLowStockAlert(
  event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { inventoryId: string }>,
  firestore: Firestore
): Promise<void> {
  // Get the inventory data after the update
  const inventoryData = event.data?.after.data() as InventoryDoc | undefined;
  
  if (!inventoryData) {
    console.log('No inventory data found in event');
    return;
  }

  const { sku, locationId, quantityOnHand } = inventoryData;
  
  console.log(
    `Processing inventory update: SKU ${sku} at ${locationId} - ` +
    `Quantity: ${quantityOnHand}`
  );

  try {
    // Fetch product to get reorder point
    const productRef = firestore.collection('products').doc(sku);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.log(`Product ${sku} not found, skipping alert check`);
      return;
    }

    const productData = productDoc.data() as ProductDoc;
    
    // Check if product is active
    if (!productData.isActive) {
      console.log(`Product ${sku} is inactive, skipping alert check`);
      return;
    }

    const { reorderPoint } = productData;
    
    console.log(
      `Checking alert condition: Quantity ${quantityOnHand} vs Reorder Point ${reorderPoint}`
    );

    // Check if low stock condition exists
    if (quantityOnHand < reorderPoint) {
      // Low stock detected - create or update alert
      await createOrUpdateAlert(
        firestore,
        sku,
        locationId,
        quantityOnHand,
        reorderPoint,
        'active'
      );
      
      console.log(
        `LOW STOCK ALERT: SKU ${sku} at ${locationId} - ` +
        `Current: ${quantityOnHand}, Reorder Point: ${reorderPoint}`
      );
    } else {
      // Stock is sufficient - resolve any existing alerts
      await resolveAlert(firestore, sku, locationId);
      
      console.log(
        `Stock sufficient for SKU ${sku} at ${locationId} - ` +
        `Current: ${quantityOnHand}, Reorder Point: ${reorderPoint}`
      );
    }

    console.log(`Successfully processed low stock alert check for ${sku} at ${locationId}`);
    
  } catch (error) {
    console.error(
      `Error processing low stock alert for ${sku} at ${locationId}:`,
      error
    );
    
    // Log error but don't throw to avoid function retries
    await logAlertError(firestore, sku, locationId, error);
  }
}

/**
 * Create or update low stock alert
 * Uses composite key to ensure one alert per SKU-location combination
 * 
 * Requirements: 8.4
 */
async function createOrUpdateAlert(
  firestore: Firestore,
  sku: string,
  locationId: string,
  currentQuantity: number,
  reorderPoint: number,
  status: 'active' | 'resolved'
): Promise<void> {
  // Use composite key: {sku}_{locationId}
  const alertId = `${sku}_${locationId}`;
  const alertRef = firestore.collection('low_stock_alerts').doc(alertId);
  
  // Check if alert already exists
  const existingAlert = await alertRef.get();
  const now = new Date();
  
  if (!existingAlert.exists) {
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
    
    await alertRef.set(newAlert);
    console.log(`Created new low stock alert: ${alertId}`);
  } else {
    // Update existing alert
    const existingData = existingAlert.data() as LowStockAlertDoc;
    
    // Only update if values changed or status needs to change
    if (
      existingData.currentQuantity !== currentQuantity ||
      existingData.status !== status
    ) {
      await alertRef.update({
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
}

/**
 * Resolve existing low stock alert when stock is replenished
 * 
 * Requirements: 8.4
 */
async function resolveAlert(
  firestore: Firestore,
  sku: string,
  locationId: string
): Promise<void> {
  const alertId = `${sku}_${locationId}`;
  const alertRef = firestore.collection('low_stock_alerts').doc(alertId);
  
  const existingAlert = await alertRef.get();
  
  if (existingAlert.exists) {
    const alertData = existingAlert.data() as LowStockAlertDoc;
    
    // Only update if currently active
    if (alertData.status === 'active') {
      const now = new Date();
      
      await alertRef.update({
        status: 'resolved',
        updatedAt: now,
        resolvedAt: now,
      });
      
      console.log(`Resolved low stock alert: ${alertId}`);
    }
  }
}

/**
 * Log alert processing error to Firestore for debugging
 */
async function logAlertError(
  firestore: Firestore,
  sku: string,
  locationId: string,
  error: unknown
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await firestore.collection('low_stock_alert_errors').add({
      sku,
      locationId,
      error: errorMessage,
      stack: errorStack || null,
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error('Failed to log alert error:', logError);
  }
}
