/**
 * Offline Transaction Queue Service
 * 
 * Manages offline transaction queuing and synchronization for the POS system.
 * Stores transactions locally when network is unavailable and syncs when connectivity is restored.
 * 
 * Requirements: 13.7, 18.4
 */

import {
  doc,
  setDoc,
  Timestamp,
  runTransaction,
  type Transaction as FirestoreTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { POSTransaction, POSTransactionDraft } from '../../types/models';
import type { POSTransactionDoc, InventoryDoc } from '../../types/firestore';

/**
 * Queue status for sync reporting
 */
export interface QueueStatus {
  /** Number of transactions pending sync */
  pendingCount: number;
  /** Number of transactions currently syncing */
  syncingCount: number;
  /** Number of failed transactions */
  failedCount: number;
  /** Whether currently online */
  isOnline: boolean;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Last sync attempt timestamp */
  lastSyncAttempt?: Date;
  /** Last successful sync timestamp */
  lastSuccessfulSync?: Date;
}

/**
 * Queued transaction with sync metadata
 */
interface QueuedTransaction {
  /** Local transaction ID */
  localId: string;
  /** Transaction data */
  transaction: POSTransactionDraft;
  /** Timestamp when queued */
  queuedAt: Date;
  /** Number of sync attempts */
  attempts: number;
  /** Last sync attempt timestamp */
  lastAttempt?: Date;
  /** Error message from last attempt */
  lastError?: string;
  /** Sync status */
  status: 'pending' | 'syncing' | 'failed';
}

/**
 * Offline Queue Service for POS transactions
 * 
 * Provides local transaction queuing with automatic background sync
 * when network connectivity is restored. Implements exponential backoff
 * retry logic and last-write-wins conflict resolution.
 * 
 * Requirements: 13.7, 18.4
 */
export class OfflineQueue {
  private readonly storageKey = 'pos_offline_queue';
  private readonly transactionsCollection = 'pos_transactions';
  private readonly inventoryCollection = 'inventory';
  private readonly defaultLocationId = 'default';
  
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncIntervalId?: number;
  
  // Retry configuration (exponential backoff)
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 60000; // 60 seconds

  /**
   * Initialize the offline queue
   * 
   * Sets up network status listeners and starts background sync.
   */
  constructor() {
    this.setupNetworkListeners();
    this.startBackgroundSync();
  }

  /**
   * Set up network status change listeners
   * 
   * Monitors online/offline events and triggers sync when online.
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.isOnline = false;
    });
  }

  /**
   * Start background sync process
   * 
   * Periodically attempts to sync queued transactions every 30 seconds.
   */
  private startBackgroundSync(): void {
    // Attempt sync every 30 seconds if online
    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncQueue();
      }
    }, 30000);
  }

  /**
   * Stop background sync process
   */
  public stopBackgroundSync(): void {
    if (this.syncIntervalId) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  /**
   * Queue a transaction for later sync
   * 
   * Stores transaction in localStorage for persistence across page reloads.
   * 
   * @param transaction - Transaction draft to queue
   * @returns Local transaction ID
   * 
   * Requirement 13.7
   */
  public queueTransaction(transaction: POSTransactionDraft): string {
    const localId = `OFFLINE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const queuedTransaction: QueuedTransaction = {
      localId,
      transaction,
      queuedAt: new Date(),
      attempts: 0,
      status: 'pending',
    };

    // Get existing queue
    const queue = this.getQueue();
    queue.push(queuedTransaction);
    
    // Save to localStorage
    this.saveQueue(queue);
    
    console.log(`Transaction ${localId} queued for sync`);
    
    // Trigger immediate sync if online
    if (this.isOnline && !this.isSyncing) {
      this.syncQueue();
    }
    
    return localId;
  }

  /**
   * Get the current transaction queue from localStorage
   * 
   * @returns Array of queued transactions
   */
  private getQueue(): QueuedTransaction[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const queue = JSON.parse(stored) as QueuedTransaction[];
      
      // Deserialize dates
      return queue.map(item => ({
        ...item,
        queuedAt: new Date(item.queuedAt),
        lastAttempt: item.lastAttempt ? new Date(item.lastAttempt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load queue from localStorage:', error);
      return [];
    }
  }

  /**
   * Save the transaction queue to localStorage
   * 
   * @param queue - Queue to save
   */
  private saveQueue(queue: QueuedTransaction[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save queue to localStorage:', error);
    }
  }

  /**
   * Synchronize queued transactions with Firestore
   * 
   * Attempts to sync all pending transactions with exponential backoff retry logic.
   * Uses last-write-wins strategy for conflict resolution.
   * 
   * Requirements: 13.7, 18.4
   */
  public async syncQueue(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!this.isOnline) {
      console.log('Cannot sync: offline');
      return;
    }

    this.isSyncing = true;
    const queue = this.getQueue();
    const pendingTransactions = queue.filter(item => item.status === 'pending' || item.status === 'failed');

    if (pendingTransactions.length === 0) {
      this.isSyncing = false;
      return;
    }

    console.log(`Syncing ${pendingTransactions.length} queued transactions`);

    for (const queuedTx of pendingTransactions) {
      // Check if max retries exceeded
      if (queuedTx.attempts >= this.maxRetries) {
        console.error(`Transaction ${queuedTx.localId} exceeded max retries`);
        queuedTx.status = 'failed';
        queuedTx.lastError = 'Max retry attempts exceeded';
        continue;
      }

      // Calculate exponential backoff delay
      if (queuedTx.lastAttempt) {
        const delay = Math.min(
          this.baseDelay * Math.pow(2, queuedTx.attempts),
          this.maxDelay
        );
        const timeSinceLastAttempt = Date.now() - queuedTx.lastAttempt.getTime();
        
        if (timeSinceLastAttempt < delay) {
          console.log(`Skipping ${queuedTx.localId}: waiting for backoff delay`);
          continue;
        }
      }

      // Attempt to sync transaction
      queuedTx.status = 'syncing';
      queuedTx.attempts++;
      queuedTx.lastAttempt = new Date();
      this.saveQueue(queue);

      try {
        await this.syncTransaction(queuedTx);
        
        // Remove successfully synced transaction from queue
        const updatedQueue = queue.filter(item => item.localId !== queuedTx.localId);
        this.saveQueue(updatedQueue);
        
        console.log(`Transaction ${queuedTx.localId} synced successfully`);
      } catch (error) {
        console.error(`Failed to sync transaction ${queuedTx.localId}:`, error);
        queuedTx.status = 'failed';
        queuedTx.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.saveQueue(queue);
      }
    }

    this.isSyncing = false;
  }

  /**
   * Sync a single transaction to Firestore
   * 
   * Creates POS transaction record and updates inventory atomically.
   * Uses last-write-wins strategy for conflict resolution.
   * 
   * @param queuedTx - Queued transaction to sync
   * 
   * Requirements: 13.7, 18.4
   */
  private async syncTransaction(queuedTx: QueuedTransaction): Promise<void> {
    const { transaction } = queuedTx;
    
    // Generate transaction ID (use local ID for consistency)
    const transactionId = queuedTx.localId;
    const timestamp = Timestamp.now();

    // Calculate line totals
    const lineItems = transaction.lineItems.map((item) => {
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

    const taxRate = 0;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    // Use Firestore transaction for atomic operations
    await runTransaction(db, async (firestoreTransaction: FirestoreTransaction) => {
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
      
      // Check if transaction already exists (conflict detection)
      const existingTx = await firestoreTransaction.get(transactionRef);
      
      if (existingTx.exists()) {
        // Last-write-wins strategy: overwrite existing transaction
        console.log(`Transaction ${transactionId} already exists, applying last-write-wins`);
      }
      
      firestoreTransaction.set(transactionRef, transactionDoc);

      // Update inventory for each line item
      for (const item of lineItems) {
        const inventoryId = `${item.sku}_${this.defaultLocationId}`;
        const inventoryRef = doc(db, this.inventoryCollection, inventoryId);
        const inventorySnap = await firestoreTransaction.get(inventoryRef);

        if (!inventorySnap.exists()) {
          throw new Error(`No inventory record found for product ${item.sku}`);
        }

        const inventoryData = inventorySnap.data() as InventoryDoc;
        
        // Check if sufficient quantity available (may have changed since queueing)
        if (inventoryData.quantityOnHand < item.quantity) {
          console.warn(
            `Low inventory for ${item.sku}. Available: ${inventoryData.quantityOnHand}, Requested: ${item.quantity}`
          );
          // Continue with sync (business decision: complete sale even with low inventory)
        }

        const newQuantity = inventoryData.quantityOnHand - item.quantity;

        firestoreTransaction.update(inventoryRef, {
          quantityOnHand: newQuantity,
          lastUpdated: timestamp,
          lastTransactionId: transactionId,
        });
      }
    });
  }

  /**
   * Get current queue status
   * 
   * @returns Queue status information
   * 
   * Requirement 13.7
   */
  public getStatus(): QueueStatus {
    const queue = this.getQueue();
    
    const pendingCount = queue.filter(item => item.status === 'pending').length;
    const syncingCount = queue.filter(item => item.status === 'syncing').length;
    const failedCount = queue.filter(item => item.status === 'failed').length;
    
    // Find last sync attempt and successful sync
    let lastSyncAttempt: Date | undefined;
    let lastSuccessfulSync: Date | undefined;
    
    for (const item of queue) {
      if (item.lastAttempt) {
        if (!lastSyncAttempt || item.lastAttempt > lastSyncAttempt) {
          lastSyncAttempt = item.lastAttempt;
        }
      }
    }
    
    return {
      pendingCount,
      syncingCount,
      failedCount,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncAttempt,
      lastSuccessfulSync,
    };
  }

  /**
   * Get all queued transactions
   * 
   * @returns Array of queued transactions
   */
  public getQueuedTransactions(): QueuedTransaction[] {
    return this.getQueue();
  }

  /**
   * Clear all successfully synced transactions from queue
   * 
   * Utility method for maintenance.
   */
  public clearSyncedTransactions(): void {
    const queue = this.getQueue();
    const pendingQueue = queue.filter(
      item => item.status === 'pending' || item.status === 'syncing' || item.status === 'failed'
    );
    this.saveQueue(pendingQueue);
  }

  /**
   * Retry failed transactions
   * 
   * Resets failed transactions to pending status for retry.
   */
  public retryFailedTransactions(): void {
    const queue = this.getQueue();
    
    for (const item of queue) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.lastAttempt = undefined;
        item.lastError = undefined;
      }
    }
    
    this.saveQueue(queue);
    
    // Trigger sync
    if (this.isOnline && !this.isSyncing) {
      this.syncQueue();
    }
  }

  /**
   * Clear the entire queue (use with caution)
   * 
   * Removes all transactions from the queue including pending ones.
   */
  public clearQueue(): void {
    localStorage.removeItem(this.storageKey);
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
