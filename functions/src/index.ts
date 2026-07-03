/**
 * Firebase Cloud Functions for PRO SYNAPSE
 * 
 * Entry point for all cloud functions.
 */

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { processPricelistUpload } from './triggers/pricelistProcessor.js';
import { processPriceChangeNotification } from './triggers/priceChangeNotifier.js';
import { processLowStockAlert } from './triggers/lowStockAlert.js';

// Initialize Firebase Admin
initializeApp();

export const firestore = getFirestore();
export const storage = getStorage();

/**
 * Cloud Function: Process pricelist on upload
 * 
 * Triggered when a file is uploaded to the pricelists storage bucket.
 * Automatically parses the pricelist and stores results in Firestore.
 * 
 * Requirements: 3.5
 */
export const onPricelistUpload = onObjectFinalized(
  {
    bucket: 'pricelists',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    await processPricelistUpload(event, firestore, storage);
  }
);

/**
 * Cloud Function: Process price change notifications
 * 
 * Triggered when a price change document is created in Firestore.
 * Sends notifications for significant price changes and updates dashboard metrics.
 * 
 * Requirements: 6.6
 */
export const onPriceChange = onDocumentCreated(
  {
    document: 'price_changes/{changeId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    await processPriceChangeNotification(event, firestore);
  }
);

/**
 * Cloud Function: Process low stock alerts
 * 
 * Triggered when an inventory document is updated in Firestore.
 * Checks if quantity falls below reorder point and generates alerts.
 * 
 * Requirements: 8.4
 */
export const onInventoryUpdate = onDocumentUpdated(
  {
    document: 'inventory/{inventoryId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    await processLowStockAlert(event, firestore);
  }
);
