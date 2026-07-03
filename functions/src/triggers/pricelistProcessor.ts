/**
 * Pricelist Processing Cloud Function Trigger
 * 
 * Automatically processes pricelists when uploaded to Cloud Storage.
 * Parses the file, stores results in Firestore, and handles errors gracefully.
 * 
 * Requirements: 3.5
 */

import type { StorageEvent } from 'firebase-functions/v2/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import { detectFormat, parseCSVContent, parseExcelContent, parsePDFContent, ParseError } from '../utils/parser.js';
import type { PricelistData } from '../utils/parser.js';

/**
 * Extract supplier ID from file path
 * Expected format: pricelists/{supplierId}/{filename}
 */
function extractSupplierIdFromPath(filePath: string): string | null {
  const parts = filePath.split('/');
  if (parts.length >= 2 && parts[0] === 'pricelists') {
    return parts[1];
  }
  return null;
}

/**
 * Extract uploaded by user ID from metadata
 */
function extractUploadedBy(metadata: Record<string, string> | undefined): string {
  if (metadata && metadata.uploadedBy) {
    return metadata.uploadedBy;
  }
  return 'system'; // Default if not provided
}

/**
 * Process pricelist upload from Cloud Storage
 * 
 * @param event - Storage event triggered by file upload
 * @param firestore - Firestore instance
 * @param storage - Storage instance
 */
export async function processPricelistUpload(
  event: StorageEvent,
  firestore: Firestore,
  storage: Storage
): Promise<void> {
  const filePath = event.data.name;
  const metadata = event.data.metadata;
  
  console.log(`Processing pricelist upload: ${filePath}`);
  
  try {
    // Extract supplier ID from file path
    const supplierId = extractSupplierIdFromPath(filePath);
    if (!supplierId) {
      console.error(`Invalid file path format: ${filePath}. Expected: pricelists/{supplierId}/{filename}`);
      await logProcessingError(firestore, filePath, 'Invalid file path format');
      return;
    }

    // Extract filename
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Detect file format
    const format = detectFormat(fileName);
    if (format === 'unknown') {
      console.error(`Unsupported file format: ${fileName}`);
      await logProcessingError(firestore, filePath, `Unsupported file format: ${fileName}`);
      return;
    }

    // Download file from Cloud Storage
    const bucket = storage.bucket(event.data.bucket);
    const file = bucket.file(filePath);
    
    const [fileBuffer] = await file.download();
    console.log(`Downloaded file: ${fileName} (${fileBuffer.length} bytes)`);

    // Parse file based on format
    let pricelistData: PricelistData;
    
    try {
      switch (format) {
        case 'csv':
          const csvContent = fileBuffer.toString('utf-8');
          pricelistData = parseCSVContent(csvContent, supplierId);
          break;
        case 'excel':
          pricelistData = parseExcelContent(fileBuffer, supplierId);
          break;
        case 'pdf':
          pricelistData = parsePDFContent(fileBuffer, supplierId);
          break;
        default:
          throw new ParseError(`Unsupported format: ${format}`);
      }
    } catch (error) {
      if (error instanceof ParseError) {
        console.error(`Parse error for ${fileName}: ${error.message}`, error.details);
        await logProcessingError(firestore, filePath, `Parse error: ${error.message}`, error.details);
        return;
      }
      throw error; // Re-throw unexpected errors
    }

    console.log(`Parsed ${pricelistData.items.length} items from ${fileName}`);

    // Store pricelist in Firestore
    await storePricelistData(
      firestore,
      pricelistData,
      fileName,
      filePath,
      extractUploadedBy(metadata)
    );

    console.log(`Successfully processed pricelist: ${fileName}`);
    
  } catch (error) {
    console.error(`Unexpected error processing pricelist ${filePath}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logProcessingError(firestore, filePath, `Unexpected error: ${errorMessage}`);
    
    // Re-throw to mark function as failed
    throw error;
  }
}

/**
 * Store parsed pricelist data in Firestore
 * 
 * Creates documents in 'pricelists' and 'pricelist_items' collections.
 * Requirements: 3.5
 */
async function storePricelistData(
  firestore: Firestore,
  data: PricelistData,
  fileName: string,
  storageRef: string,
  uploadedBy: string
): Promise<void> {
  const now = new Date();
  
  // Create pricelist document
  const pricelistRef = firestore.collection('pricelists').doc();
  const pricelistId = pricelistRef.id;
  
  const pricelistDoc = {
    pricelistId,
    supplierId: data.supplierId,
    uploadDate: now,
    fileName,
    storageRef,
    itemCount: data.items.length,
    processedAt: now,
    uploadedBy,
  };
  
  // Create batch for atomic write
  const batch = firestore.batch();
  
  // Add pricelist document
  batch.set(pricelistRef, pricelistDoc);
  
  // Add pricelist item documents
  for (const item of data.items) {
    const itemRef = firestore.collection('pricelist_items').doc();
    const itemDoc = {
      itemId: itemRef.id,
      pricelistId,
      supplierId: data.supplierId,
      supplierCode: item.supplierCode,
      description: item.description,
      price: item.price,
      uom: item.uom,
      matchStatus: 'unmatched', // Initial status, will be updated by matcher
      isNewProduct: false, // Will be determined by new product detector
    };
    
    batch.set(itemRef, itemDoc);
  }
  
  // Commit all writes atomically
  await batch.commit();
  
  console.log(`Stored pricelist ${pricelistId} with ${data.items.length} items`);
}

/**
 * Log processing error to Firestore for debugging
 */
async function logProcessingError(
  firestore: Firestore,
  filePath: string,
  error: string,
  details?: string
): Promise<void> {
  try {
    await firestore.collection('pricelist_processing_errors').add({
      filePath,
      error,
      details: details || null,
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error('Failed to log processing error:', logError);
  }
}
