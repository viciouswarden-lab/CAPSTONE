/**
 * Price Monitor Service
 * 
 * Orchestrates price monitoring functionality by detecting price changes
 * and managing price change records in Firestore.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc,
  Timestamp,
  limit as firestoreLimit,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  type Firestore
} from 'firebase/firestore';
import type { PricelistData, PriceChange, PriceHistoryEntry, DateRange } from '../../types/models';
import type { PriceChangeDoc, DashboardMetricsDoc, SignificantChangeEntry } from '../../types/firestore';
import { PriceChangeDetector } from './PriceChangeDetector';

/**
 * Service for monitoring price changes and managing price history
 * 
 * This service:
 * - Detects price changes between pricelists using PriceChangeDetector
 * - Stores price change records in Firestore
 * - Retrieves price history for products
 * - Identifies significant price changes (>10%)
 */
export class PriceMonitorService {
  private detector: PriceChangeDetector;
  private db: Firestore;
  
  /**
   * Create a new PriceMonitorService
   * 
   * @param db - Firestore database instance
   */
  constructor(db: Firestore) {
    this.db = db;
    this.detector = new PriceChangeDetector();
  }
  
  /**
   * Detect price changes between current and previous pricelists
   * 
   * Compares the new pricelist against the most recent previous pricelist
   * from the same supplier, calculates changes, and stores them in Firestore.
   * After storing changes, processes notifications for significant changes
   * and updates dashboard metrics.
   * 
   * @param newPricelist - Current pricelist data
   * @param previousPricelist - Previous pricelist data from the same supplier
   * @param newPricelistId - Firestore document ID of the new pricelist
   * @param oldPricelistId - Firestore document ID of the old pricelist
   * @returns Array of detected price changes
   * 
   * Requirements 6.1, 6.2, 6.3, 6.4, 6.6
   */
  async detectPriceChanges(
    newPricelist: PricelistData,
    previousPricelist: PricelistData,
    newPricelistId: string,
    oldPricelistId: string
  ): Promise<PriceChange[]> {
    // Use detector to identify changes
    const changes = this.detector.detectChanges(newPricelist, previousPricelist);
    
    // Store each change in Firestore
    const priceChangesCollection = collection(this.db, 'price_changes');
    
    // Track change IDs for notification processing
    const changeIds: string[] = [];
    
    for (const change of changes) {
      const priceChangeDoc: Omit<PriceChangeDoc, 'changeId'> = {
        sku: change.sku,
        supplierId: change.supplierId,
        oldPrice: change.oldPrice,
        newPrice: change.newPrice,
        absoluteChange: change.absoluteChange,
        percentageChange: change.percentageChange,
        changeDate: Timestamp.fromDate(change.changeDate),
        isSignificant: change.isSignificant,
        oldPricelistId,
        newPricelistId,
      };
      
      const docRef = await addDoc(priceChangesCollection, priceChangeDoc);
      changeIds.push(docRef.id);
    }
    
    // Process notifications for significant changes
    const significantChanges = changes.filter(c => c.isSignificant);
    
    if (significantChanges.length > 0) {
      // Add change IDs to the price changes for dashboard updates
      const changesWithIds = significantChanges.map((change, index) => ({
        ...change,
        changeId: changeIds[changes.indexOf(change)],
      }));
      
      await this.processNotifications(changesWithIds);
      await this.updateDashboardMetrics(changesWithIds);
    }
    
    return changes;
  }
  
  /**
   * Get price history for a specific product from a supplier
   * 
   * Retrieves all recorded price changes for a product, ordered chronologically.
   * Returns results within 3 seconds as per Requirement 6.5.
   * 
   * Requirement 6.5, 17.2: Optimized query with composite index and limit
   * Uses composite index: price_changes (sku ASC, changeDate DESC)
   * 
   * @param sku - Product SKU
   * @param supplierId - Supplier ID
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Array of price history entries, ordered by date (oldest first)
   * 
   * Requirement 6.5
   */
  async getPriceHistory(
    sku: string,
    supplierId: string,
    maxResults: number = 1000
  ): Promise<PriceHistoryEntry[]> {
    const priceChangesCollection = collection(this.db, 'price_changes');
    
    // Query for all price changes for this SKU and supplier, ordered by date
    // Uses composite index: price_changes (sku ASC, changeDate DESC)
    const q = query(
      priceChangesCollection,
      where('sku', '==', sku),
      where('supplierId', '==', supplierId),
      orderBy('changeDate', 'asc'),
      firestoreLimit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert to PriceHistoryEntry format
    const history: PriceHistoryEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as PriceChangeDoc;
      
      // Add entry for the old price (unless it's already in history)
      if (history.length === 0 || history[history.length - 1].price !== data.oldPrice) {
        history.push({
          price: data.oldPrice,
          effectiveDate: data.changeDate.toDate(),
          source: data.oldPricelistId,
        });
      }
      
      // Add entry for the new price
      history.push({
        price: data.newPrice,
        effectiveDate: data.changeDate.toDate(),
        source: data.newPricelistId,
      });
    });
    
    return history;
  }
  
  /**
   * Get significant price changes within a date range
   * 
   * Retrieves all price changes that exceed the specified threshold percentage.
   * By default, returns changes flagged as significant (>10% increase).
   * 
   * Requirement 6.3, 6.6 (Dashboard display), 17.2: Optimized query with composite index
   * Uses composite index: price_changes (changeDate DESC, isSignificant ASC)
   * 
   * @param threshold - Percentage threshold (default: 10)
   * @param dateRange - Date range to search within
   * @param maxResults - Maximum number of results to return (default: 1000)
   * @returns Array of significant price changes
   * 
   * Requirement 6.3, 6.6 (Dashboard display)
   */
  async getSignificantChanges(
    threshold: number = 10,
    dateRange: DateRange,
    maxResults: number = 1000
  ): Promise<PriceChange[]> {
    const priceChangesCollection = collection(this.db, 'price_changes');
    
    // Query for significant changes within date range
    // Uses composite index: price_changes (changeDate DESC, isSignificant ASC)
    const q = query(
      priceChangesCollection,
      where('isSignificant', '==', true),
      where('changeDate', '>=', Timestamp.fromDate(dateRange.start)),
      where('changeDate', '<=', Timestamp.fromDate(dateRange.end)),
      orderBy('changeDate', 'desc'),
      firestoreLimit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert to PriceChange array and filter by threshold
    const changes: PriceChange[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as PriceChangeDoc;
      
      // Additional threshold filtering (in case threshold differs from 10%)
      if (data.percentageChange > threshold) {
        changes.push({
          sku: data.sku,
          supplierId: data.supplierId,
          oldPrice: data.oldPrice,
          newPrice: data.newPrice,
          absoluteChange: data.absoluteChange,
          percentageChange: data.percentageChange,
          changeDate: data.changeDate.toDate(),
          isSignificant: data.isSignificant,
        });
      }
    });
    
    return changes;
  }
  
  /**
   * Process notifications for significant price changes
   * 
   * Sends notifications (currently logs to console) for significant price increases.
   * Can be extended to send email/push notifications in the future.
   * 
   * @param changes - Array of significant price changes with change IDs
   * 
   * Requirement 6.6
   */
  private async processNotifications(
    changes: Array<PriceChange & { changeId: string }>
  ): Promise<void> {
    // Send notifications for each significant change
    for (const change of changes) {
      const notification = {
        type: 'significant_price_increase',
        title: `Price Alert: ${change.sku}`,
        message: 
          `Supplier price increased by ${change.percentageChange.toFixed(2)}% ` +
          `from $${change.oldPrice.toFixed(2)} to $${change.newPrice.toFixed(2)}`,
        metadata: {
          changeId: change.changeId,
          sku: change.sku,
          supplierId: change.supplierId,
          oldPrice: change.oldPrice,
          newPrice: change.newPrice,
          percentageChange: change.percentageChange,
          changeDate: change.changeDate,
        },
        timestamp: new Date(),
      };
      
      // Log notification (placeholder for actual notification service)
      console.log('PRICE ALERT:', JSON.stringify(notification, null, 2));
      
      // TODO: Integrate with notification service
      // - await emailService.send(notification);
      // - await pushNotificationService.send(notification);
      // - await slackWebhook.post(notification);
    }
  }
  
  /**
   * Update dashboard metrics with significant price changes
   * 
   * Maintains monthly aggregation of significant price increases for quick dashboard queries.
   * Uses Firestore transactions to ensure atomic updates and prevent duplicate entries.
   * 
   * @param changes - Array of significant price changes with change IDs
   * 
   * Requirement 6.6
   */
  private async updateDashboardMetrics(
    changes: Array<PriceChange & { changeId: string }>
  ): Promise<void> {
    // Group changes by month for efficient batch updates
    const changesByMonth = new Map<string, Array<PriceChange & { changeId: string }>>();
    
    for (const change of changes) {
      const monthKey = this.getMonthKey(change.changeDate);
      
      if (!changesByMonth.has(monthKey)) {
        changesByMonth.set(monthKey, []);
      }
      
      changesByMonth.get(monthKey)!.push(change);
    }
    
    // Update dashboard metrics for each affected month
    for (const [monthKey, monthChanges] of changesByMonth.entries()) {
      await this.updateMonthMetrics(monthKey, monthChanges);
    }
  }
  
  /**
   * Get month key from date in YYYY-MM format
   * 
   * @param date - Date to convert
   * @returns Month key string (e.g., "2024-01")
   */
  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  
  /**
   * Update dashboard metrics for a specific month
   * 
   * Uses Firestore transaction to ensure atomic updates and prevent duplicate entries.
   * 
   * @param monthKey - Month key (YYYY-MM)
   * @param changes - Array of price changes for this month
   */
  private async updateMonthMetrics(
    monthKey: string,
    changes: Array<PriceChange & { changeId: string }>
  ): Promise<void> {
    const metricsRef = doc(this.db, 'dashboard_metrics', monthKey);
    
    await runTransaction(this.db, async (transaction) => {
      const metricsDoc = await transaction.get(metricsRef);
      
      // Convert changes to SignificantChangeEntry format
      const changeEntries: SignificantChangeEntry[] = changes.map((change) => ({
        changeId: change.changeId,
        sku: change.sku,
        supplierId: change.supplierId,
        oldPrice: change.oldPrice,
        newPrice: change.newPrice,
        percentageChange: change.percentageChange,
        changeDate: Timestamp.fromDate(change.changeDate),
      }));
      
      if (!metricsDoc.exists()) {
        // Create new metrics document for this month
        const newMetrics: DashboardMetricsDoc = {
          metricId: monthKey,
          month: monthKey,
          significantPriceIncreases: {
            count: changeEntries.length,
            changes: changeEntries,
          },
          lastUpdated: Timestamp.fromDate(changes[0].changeDate),
        };
        
        transaction.set(metricsRef, newMetrics);
        console.log(`Created dashboard metrics for month: ${monthKey} with ${changeEntries.length} changes`);
      } else {
        // Update existing metrics document
        const existingMetrics = metricsDoc.data() as DashboardMetricsDoc;
        
        // Filter out changes that are already recorded (idempotency)
        const existingChangeIds = new Set(
          existingMetrics.significantPriceIncreases.changes.map(c => c.changeId)
        );
        
        const newChangeEntries = changeEntries.filter(
          entry => !existingChangeIds.has(entry.changeId)
        );
        
        if (newChangeEntries.length > 0) {
          const updatedMetrics: DashboardMetricsDoc = {
            ...existingMetrics,
            significantPriceIncreases: {
              count: existingMetrics.significantPriceIncreases.count + newChangeEntries.length,
              changes: [
                ...existingMetrics.significantPriceIncreases.changes,
                ...newChangeEntries,
              ],
            },
            lastUpdated: Timestamp.fromDate(changes[changes.length - 1].changeDate),
          };
          
          transaction.set(metricsRef, updatedMetrics);
          console.log(`Updated dashboard metrics for month: ${monthKey} with ${newChangeEntries.length} new changes`);
        } else {
          console.log(`All price changes for month ${monthKey} already recorded in dashboard metrics`);
        }
      }
    });
  }
}
