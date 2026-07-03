/**
 * Price Change Notification Cloud Function Trigger
 * 
 * Automatically processes price changes when written to Firestore.
 * Sends notifications for significant price changes and updates dashboard metrics.
 * 
 * Requirements: 6.6
 */

import type { FirestoreEvent } from 'firebase-functions/v2/firestore';
import type { Firestore, Timestamp, DocumentSnapshot } from 'firebase-admin/firestore';

/**
 * Price change document structure from Firestore
 */
interface PriceChangeDoc {
  changeId: string;
  sku: string;
  supplierId: string;
  oldPrice: number;
  newPrice: number;
  absoluteChange: number;
  percentageChange: number;
  changeDate: Timestamp;
  isSignificant: boolean;
  oldPricelistId: string;
  newPricelistId: string;
}

/**
 * Dashboard metrics document structure
 */
interface DashboardMetricsDoc {
  metricId: string;
  month: string; // Format: YYYY-MM
  significantPriceIncreases: PriceChangesSummary;
  lastUpdated: Timestamp;
}

interface PriceChangesSummary {
  count: number;
  changes: SignificantChangeEntry[];
}

interface SignificantChangeEntry {
  changeId: string;
  sku: string;
  supplierId: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  changeDate: Timestamp;
}

/**
 * Process price change notification
 * 
 * @param event - Firestore event triggered by price_changes document creation
 * @param firestore - Firestore instance
 */
export async function processPriceChangeNotification(
  event: FirestoreEvent<DocumentSnapshot | undefined, { changeId: string }>,
  firestore: Firestore
): Promise<void> {
  // Get the price change data
  const priceChange = event.data?.data() as PriceChangeDoc | undefined;
  
  if (!priceChange) {
    console.log('No price change data found in event');
    return;
  }

  console.log(`Processing price change: ${priceChange.changeId} for SKU ${priceChange.sku}`);

  try {
    // Check if this is a significant price change
    if (priceChange.isSignificant) {
      console.log(
        `Significant price change detected: SKU ${priceChange.sku} - ` +
        `${priceChange.percentageChange.toFixed(2)}% increase ` +
        `($${priceChange.oldPrice} → $${priceChange.newPrice})`
      );

      // Send notification (currently logging, can be extended to email/push)
      await sendNotification(priceChange);

      // Update dashboard metrics
      await updateDashboardMetrics(firestore, priceChange);
    } else {
      console.log(
        `Price change for SKU ${priceChange.sku} is not significant ` +
        `(${priceChange.percentageChange.toFixed(2)}% change)`
      );
    }

    console.log(`Successfully processed price change notification: ${priceChange.changeId}`);
    
  } catch (error) {
    console.error(`Error processing price change notification ${priceChange.changeId}:`, error);
    
    // Log error but don't throw to avoid function retries
    await logNotificationError(firestore, priceChange.changeId, error);
  }
}

/**
 * Send notification for significant price change
 * Currently logs to console; can be extended to send email/push notifications
 * 
 * Requirements: 6.6
 */
async function sendNotification(priceChange: PriceChangeDoc): Promise<void> {
  // TODO: Integrate with notification service (email, push notifications, etc.)
  
  const notification = {
    type: 'significant_price_increase',
    title: `Price Alert: ${priceChange.sku}`,
    message: 
      `Supplier price increased by ${priceChange.percentageChange.toFixed(2)}% ` +
      `from $${priceChange.oldPrice.toFixed(2)} to $${priceChange.newPrice.toFixed(2)}`,
    metadata: {
      sku: priceChange.sku,
      supplierId: priceChange.supplierId,
      oldPrice: priceChange.oldPrice,
      newPrice: priceChange.newPrice,
      percentageChange: priceChange.percentageChange,
      changeDate: priceChange.changeDate,
    },
    timestamp: new Date(),
  };

  // Log notification (placeholder for actual notification service)
  console.log('NOTIFICATION:', JSON.stringify(notification, null, 2));

  // Future implementation could include:
  // - await emailService.send(notification);
  // - await pushNotificationService.send(notification);
  // - await slackWebhook.post(notification);
}

/**
 * Update dashboard metrics with significant price change
 * Maintains monthly aggregation for quick dashboard queries
 * 
 * Requirements: 6.6
 */
async function updateDashboardMetrics(
  firestore: Firestore,
  priceChange: PriceChangeDoc
): Promise<void> {
  // Get month key from change date
  const changeDate = priceChange.changeDate.toDate();
  const monthKey = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}`;
  
  const metricsRef = firestore.collection('dashboard_metrics').doc(monthKey);

  // Use transaction to ensure atomic update
  await firestore.runTransaction(async (transaction) => {
    const metricsDoc = await transaction.get(metricsRef);
    
    const changeEntry: SignificantChangeEntry = {
      changeId: priceChange.changeId,
      sku: priceChange.sku,
      supplierId: priceChange.supplierId,
      oldPrice: priceChange.oldPrice,
      newPrice: priceChange.newPrice,
      percentageChange: priceChange.percentageChange,
      changeDate: priceChange.changeDate,
    };

    if (!metricsDoc.exists) {
      // Create new metrics document for this month
      const newMetrics: DashboardMetricsDoc = {
        metricId: monthKey,
        month: monthKey,
        significantPriceIncreases: {
          count: 1,
          changes: [changeEntry],
        },
        lastUpdated: priceChange.changeDate,
      };
      
      transaction.set(metricsRef, newMetrics);
      console.log(`Created new dashboard metrics for month: ${monthKey}`);
    } else {
      // Update existing metrics document
      const existingMetrics = metricsDoc.data() as DashboardMetricsDoc;
      
      // Check if this change is already recorded (idempotency)
      const alreadyRecorded = existingMetrics.significantPriceIncreases.changes.some(
        (change) => change.changeId === priceChange.changeId
      );
      
      if (!alreadyRecorded) {
        transaction.update(metricsRef, {
          'significantPriceIncreases.count': existingMetrics.significantPriceIncreases.count + 1,
          'significantPriceIncreases.changes': [
            ...existingMetrics.significantPriceIncreases.changes,
            changeEntry,
          ],
          lastUpdated: priceChange.changeDate,
        });
        console.log(`Updated dashboard metrics for month: ${monthKey}`);
      } else {
        console.log(`Price change ${priceChange.changeId} already recorded in dashboard metrics`);
      }
    }
  });
}

/**
 * Log notification processing error to Firestore for debugging
 */
async function logNotificationError(
  firestore: Firestore,
  changeId: string,
  error: unknown
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await firestore.collection('notification_errors').add({
      changeId,
      error: errorMessage,
      stack: errorStack || null,
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error('Failed to log notification error:', logError);
  }
}
