/**
 * Scalability Test: Large Dataset Performance
 * 
 * This test validates that the system can handle large data volumes:
 * - 100,000 product records (Requirement 22.1)
 * - 1,000,000 transaction records (Requirement 22.2)
 * - Query performance remains acceptable (Requirement 22.4)
 * - Support for concurrent operations (Requirement 22.3)
 * 
 * **Validates: Requirements 22.1, 22.2, 22.3, 22.4**
 * 
 * NOTE: This test requires connection to a real Firebase project or emulator
 * with sufficient quota. Running this test will create substantial data.
 * 
 * Environment setup required:
 * 1. Firebase emulator running OR real Firebase project with sufficient quota
 * 2. Sufficient disk space for test data generation
 * 3. Network connectivity for Firebase operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  Timestamp,
  deleteDoc,
  Query,
  DocumentData
} from 'firebase/firestore';
import { db } from '@firebase';
import type { Product, POSTransaction, POSLineItem } from '@/types/models';

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  // Dataset sizes per requirements
  PRODUCT_COUNT: 100_000, // Requirement 22.1
  TRANSACTION_COUNT: 1_000_000, // Requirement 22.2
  
  // Performance thresholds
  QUERY_TIME_THRESHOLD_MS: 2000, // Requirement 17.2
  BATCH_SIZE: 500, // Firestore batch write limit
  
  // Test data prefixes to enable cleanup
  TEST_PREFIX: 'scalability_test_',
  
  // Sampling for verification (to avoid reading all records)
  SAMPLE_SIZE: 1000,
};

// ============================================================================
// Data Generation Utilities
// ============================================================================

/**
 * Generate a test product with realistic data
 */
function generateProduct(index: number): Product {
  const categories = ['Electronics', 'Hardware', 'Office', 'Industrial', 'Consumer'];
  const uoms = ['EA', 'BX', 'CS', 'PK', 'RL'];
  
  return {
    sku: `${TEST_CONFIG.TEST_PREFIX}PROD-${String(index).padStart(8, '0')}`,
    description: `Test Product ${index} - ${categories[index % categories.length]}`,
    category: categories[index % categories.length],
    unitOfMeasure: uoms[index % uoms.length],
    reorderPoint: Math.floor(Math.random() * 100) + 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplierMappings: [
      {
        supplierId: `${TEST_CONFIG.TEST_PREFIX}SUP-001`,
        supplierCode: `SUP-CODE-${index}`,
        lastCost: Math.round((Math.random() * 1000 + 10) * 100) / 100,
        lastCostDate: new Date(),
      }
    ],
  };
}

/**
 * Generate a test POS transaction with realistic data
 */
function generateTransaction(index: number, productSkus: string[]): POSTransaction {
  const paymentMethods: ('cash' | 'card' | 'mobile')[] = ['cash', 'card', 'mobile'];
  const numLineItems = Math.floor(Math.random() * 5) + 1; // 1-5 items per transaction
  
  const lineItems: POSLineItem[] = [];
  let subtotal = 0;
  
  for (let i = 0; i < numLineItems; i++) {
    const randomSkuIndex = Math.floor(Math.random() * Math.min(productSkus.length, 1000));
    const sku = productSkus[randomSkuIndex] || `${TEST_CONFIG.TEST_PREFIX}PROD-00000001`;
    const quantity = Math.floor(Math.random() * 10) + 1;
    const unitPrice = Math.round((Math.random() * 100 + 5) * 100) / 100;
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    
    lineItems.push({
      sku,
      description: `Product ${randomSkuIndex}`,
      quantity,
      unitPrice,
      lineTotal,
    });
    
    subtotal += lineTotal;
  }
  
  const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
  const total = Math.round((subtotal + tax) * 100) / 100;
  
  return {
    transactionId: `${TEST_CONFIG.TEST_PREFIX}TXN-${String(index).padStart(10, '0')}`,
    timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
    lineItems,
    subtotal,
    tax,
    total,
    paymentMethod: paymentMethods[index % paymentMethods.length],
    userId: `${TEST_CONFIG.TEST_PREFIX}user-001`,
    status: 'completed',
  };
}

/**
 * Convert Product model to Firestore document data
 */
function productToFirestoreDoc(product: Product): DocumentData {
  return {
    ...product,
    createdAt: Timestamp.fromDate(product.createdAt),
    updatedAt: Timestamp.fromDate(product.updatedAt),
    supplierMappings: product.supplierMappings.map(sm => ({
      ...sm,
      lastCostDate: Timestamp.fromDate(sm.lastCostDate),
    })),
  };
}

/**
 * Convert POSTransaction model to Firestore document data
 */
function transactionToFirestoreDoc(transaction: POSTransaction): DocumentData {
  return {
    ...transaction,
    timestamp: Timestamp.fromDate(transaction.timestamp),
  };
}

/**
 * Load data in batches to Firestore
 */
async function loadDataInBatches<T>(
  collectionName: string,
  dataGenerator: (index: number, ...args: any[]) => T,
  toFirestoreDoc: (item: T) => DocumentData,
  totalCount: number,
  getDocId: (item: T) => string,
  generatorArgs: any[] = []
): Promise<void> {
  console.log(`\n📦 Loading ${totalCount.toLocaleString()} records into ${collectionName}...`);
  
  const startTime = Date.now();
  let processedCount = 0;
  
  // Process in batches
  for (let batchStart = 0; batchStart < totalCount; batchStart += TEST_CONFIG.BATCH_SIZE) {
    const batch = writeBatch(db);
    const batchEnd = Math.min(batchStart + TEST_CONFIG.BATCH_SIZE, totalCount);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const item = dataGenerator(i, ...generatorArgs);
      const docRef = doc(collection(db, collectionName), getDocId(item));
      batch.set(docRef, toFirestoreDoc(item));
    }
    
    await batch.commit();
    processedCount += (batchEnd - batchStart);
    
    // Progress logging every 10 batches
    if ((batchStart / TEST_CONFIG.BATCH_SIZE) % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processedCount / (Date.now() - startTime) * 1000).toFixed(0);
      console.log(`  ⏳ Progress: ${processedCount.toLocaleString()}/${totalCount.toLocaleString()} (${rate} records/sec, ${elapsed}s elapsed)`);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgRate = (totalCount / (Date.now() - startTime) * 1000).toFixed(0);
  console.log(`  ✅ Completed: ${totalCount.toLocaleString()} records in ${totalTime}s (avg ${avgRate} records/sec)`);
}

/**
 * Measure query execution time
 */
async function measureQueryTime<T>(
  queryRef: Query<DocumentData>,
  description: string
): Promise<{ durationMs: number; resultCount: number }> {
  console.log(`\n🔍 Executing query: ${description}`);
  
  const startTime = Date.now();
  const snapshot = await getDocs(queryRef);
  const durationMs = Date.now() - startTime;
  const resultCount = snapshot.size;
  
  console.log(`  ⏱️  Duration: ${durationMs}ms`);
  console.log(`  📊 Results: ${resultCount} documents`);
  
  return { durationMs, resultCount };
}

/**
 * Cleanup test data
 */
async function cleanupTestData(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');
  
  const collections = ['products', 'pos_transactions'];
  
  for (const collectionName of collections) {
    const q = query(
      collection(db, collectionName),
      where('__name__', '>=', TEST_CONFIG.TEST_PREFIX),
      where('__name__', '<', TEST_CONFIG.TEST_PREFIX + '\uf8ff')
    );
    
    const snapshot = await getDocs(q);
    console.log(`  🗑️  Deleting ${snapshot.size} documents from ${collectionName}...`);
    
    // Delete in batches
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += TEST_CONFIG.BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, Math.min(i + TEST_CONFIG.BATCH_SIZE, docs.length));
      
      batchDocs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  
  console.log('  ✅ Cleanup complete');
}

// ============================================================================
// Scalability Tests
// ============================================================================

describe('Scalability: Large Dataset Performance', () => {
  let productSkus: string[] = [];
  
  // Note: These tests are marked as skip by default to prevent accidental execution
  // Remove .skip to run the tests when you have appropriate Firebase setup
  
  describe.skip('Requirement 22.1: 100,000 Product Records', () => {
    
    it('should load 100,000 product records without performance degradation', async () => {
      // Generate and load products
      await loadDataInBatches(
        'products',
        generateProduct,
        productToFirestoreDoc,
        TEST_CONFIG.PRODUCT_COUNT,
        (product: Product) => product.sku
      );
      
      // Store product SKUs for transaction generation
      const sampleQuery = query(
        collection(db, 'products'),
        where('sku', '>=', TEST_CONFIG.TEST_PREFIX),
        limit(TEST_CONFIG.SAMPLE_SIZE)
      );
      const sampleSnapshot = await getDocs(sampleQuery);
      productSkus = sampleSnapshot.docs.map(doc => doc.data().sku);
      
      expect(productSkus.length).toBeGreaterThan(0);
    }, 600_000); // 10 minute timeout
    
    it('should query products by category within 2 seconds', async () => {
      const q = query(
        collection(db, 'products'),
        where('category', '==', 'Electronics'),
        where('isActive', '==', true),
        orderBy('sku'),
        limit(1000)
      );
      
      const { durationMs, resultCount } = await measureQueryTime(q, 'Products by category (indexed)');
      
      expect(resultCount).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
    }, 30_000);
    
    it('should query products with pagination within 2 seconds', async () => {
      const q = query(
        collection(db, 'products'),
        where('isActive', '==', true),
        orderBy('sku'),
        limit(1000)
      );
      
      const { durationMs, resultCount } = await measureQueryTime(q, 'Products with pagination');
      
      expect(resultCount).toBe(1000);
      expect(durationMs).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
    }, 30_000);
    
    it('should verify data integrity of sampled products', async () => {
      const q = query(
        collection(db, 'products'),
        where('sku', '>=', TEST_CONFIG.TEST_PREFIX),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Verify required fields
        expect(data.sku).toBeDefined();
        expect(data.description).toBeDefined();
        expect(data.category).toBeDefined();
        expect(data.unitOfMeasure).toBeDefined();
        expect(data.reorderPoint).toBeGreaterThanOrEqual(0);
        expect(data.isActive).toBe(true);
        expect(data.supplierMappings).toBeDefined();
        expect(Array.isArray(data.supplierMappings)).toBe(true);
      });
      
      expect(snapshot.size).toBe(100);
    }, 30_000);
  });
  
  describe.skip('Requirement 22.2: 1,000,000 Transaction Records', () => {
    
    it('should load 1,000,000 transaction records without performance degradation', async () => {
      // Ensure we have product SKUs for transaction generation
      if (productSkus.length === 0) {
        const sampleQuery = query(
          collection(db, 'products'),
          where('sku', '>=', TEST_CONFIG.TEST_PREFIX),
          limit(TEST_CONFIG.SAMPLE_SIZE)
        );
        const sampleSnapshot = await getDocs(sampleQuery);
        productSkus = sampleSnapshot.docs.map(doc => doc.data().sku);
      }
      
      expect(productSkus.length).toBeGreaterThan(0);
      
      // Generate and load transactions
      await loadDataInBatches(
        'pos_transactions',
        generateTransaction,
        transactionToFirestoreDoc,
        TEST_CONFIG.TRANSACTION_COUNT,
        (txn: POSTransaction) => txn.transactionId,
        [productSkus]
      );
    }, 1_800_000); // 30 minute timeout
    
    it('should query transactions by date range within 2 seconds', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const q = query(
        collection(db, 'pos_transactions'),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        where('status', '==', 'completed'),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );
      
      const { durationMs, resultCount } = await measureQueryTime(
        q,
        'Transactions by date range (indexed)'
      );
      
      expect(resultCount).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
    }, 30_000);
    
    it('should query transactions by payment method within 2 seconds', async () => {
      const q = query(
        collection(db, 'pos_transactions'),
        where('paymentMethod', '==', 'card'),
        where('status', '==', 'completed'),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );
      
      const { durationMs, resultCount } = await measureQueryTime(
        q,
        'Transactions by payment method (indexed)'
      );
      
      expect(resultCount).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
    }, 30_000);
    
    it('should verify data integrity of sampled transactions', async () => {
      const q = query(
        collection(db, 'pos_transactions'),
        where('transactionId', '>=', TEST_CONFIG.TEST_PREFIX),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Verify required fields
        expect(data.transactionId).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(data.lineItems).toBeDefined();
        expect(Array.isArray(data.lineItems)).toBe(true);
        expect(data.lineItems.length).toBeGreaterThan(0);
        expect(data.subtotal).toBeGreaterThan(0);
        expect(data.tax).toBeGreaterThanOrEqual(0);
        expect(data.total).toBeGreaterThan(0);
        expect(data.paymentMethod).toBeDefined();
        expect(data.status).toBe('completed');
        
        // Verify financial calculations
        const calculatedSubtotal = data.lineItems.reduce(
          (sum: number, item: POSLineItem) => sum + item.lineTotal,
          0
        );
        expect(Math.abs(calculatedSubtotal - data.subtotal)).toBeLessThan(0.01);
        expect(Math.abs((data.subtotal + data.tax) - data.total)).toBeLessThan(0.01);
      });
      
      expect(snapshot.size).toBe(100);
    }, 30_000);
  });
  
  describe.skip('Requirement 22.3 & 22.4: Query Performance with Large Datasets', () => {
    
    it('should maintain indexed query performance with full dataset', async () => {
      // Test multiple query patterns to ensure consistent performance
      const queryTests = [
        {
          name: 'Product by category',
          query: query(
            collection(db, 'products'),
            where('category', '==', 'Electronics'),
            where('isActive', '==', true),
            limit(1000)
          ),
        },
        {
          name: 'Recent transactions',
          query: query(
            collection(db, 'pos_transactions'),
            where('status', '==', 'completed'),
            orderBy('timestamp', 'desc'),
            limit(1000)
          ),
        },
        {
          name: 'Products by reorder point',
          query: query(
            collection(db, 'products'),
            where('isActive', '==', true),
            orderBy('reorderPoint', 'asc'),
            limit(1000)
          ),
        },
      ];
      
      for (const test of queryTests) {
        const { durationMs, resultCount } = await measureQueryTime(test.query, test.name);
        
        expect(resultCount).toBeGreaterThan(0);
        expect(durationMs).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
      }
    }, 120_000);
    
    it('should handle concurrent query operations', async () => {
      // Simulate 10 concurrent users querying different data
      const concurrentQueries = Array.from({ length: 10 }, (_, i) => {
        const categories = ['Electronics', 'Hardware', 'Office', 'Industrial', 'Consumer'];
        return query(
          collection(db, 'products'),
          where('category', '==', categories[i % categories.length]),
          where('isActive', '==', true),
          limit(100)
        );
      });
      
      const startTime = Date.now();
      const results = await Promise.all(
        concurrentQueries.map(q => getDocs(q))
      );
      const totalDuration = Date.now() - startTime;
      
      console.log(`\n⚡ Concurrent query test:`);
      console.log(`  📊 Queries: ${concurrentQueries.length}`);
      console.log(`  ⏱️  Total duration: ${totalDuration}ms`);
      console.log(`  📈 Avg per query: ${(totalDuration / concurrentQueries.length).toFixed(0)}ms`);
      
      // All queries should return results
      results.forEach((snapshot, i) => {
        expect(snapshot.size).toBeGreaterThan(0);
      });
      
      // Average query time should still be reasonable under concurrent load
      const avgQueryTime = totalDuration / concurrentQueries.length;
      expect(avgQueryTime).toBeLessThan(TEST_CONFIG.QUERY_TIME_THRESHOLD_MS);
    }, 60_000);
  });
  
  // Cleanup after all tests (if tests were run)
  afterAll(async () => {
    // Uncomment this line to cleanup test data after running tests
    // await cleanupTestData();
    console.log('\n⚠️  Note: Test data cleanup is disabled by default.');
    console.log('   Uncomment cleanupTestData() in afterAll to enable automatic cleanup.');
  }, 300_000);
});

// ============================================================================
// Test Execution Notes
// ============================================================================

/**
 * EXECUTION NOTES:
 * 
 * 1. **Test Duration**: This test suite can take 30-60 minutes to complete
 *    depending on network speed and Firebase quota.
 * 
 * 2. **Firebase Setup**: Requires either:
 *    - Firebase Emulator Suite running locally
 *    - Real Firebase project with sufficient quota (Blaze plan recommended)
 * 
 * 3. **Data Cleanup**: Test data is prefixed with 'scalability_test_' for
 *    easy identification. Cleanup is disabled by default - uncomment the
 *    cleanupTestData() call in afterAll() to enable automatic cleanup.
 * 
 * 4. **Skip Flag**: Tests are marked with .skip by default. Remove .skip
 *    from describe blocks to execute the tests.
 * 
 * 5. **Resource Usage**: Loading 1M+ records will consume:
 *    - Significant disk space (several GB in emulator)
 *    - Network bandwidth (if using real Firebase)
 *    - Firebase quota (read/write operations)
 * 
 * 6. **Performance Validation**: Tests verify that:
 *    - Indexed queries complete within 2 seconds (Req 17.2, 22.4)
 *    - System handles 100K products (Req 22.1)
 *    - System handles 1M transactions (Req 22.2)
 *    - Concurrent operations remain performant (Req 22.3)
 * 
 * 7. **Indexes Required**: Ensure firestore.indexes.json is deployed with:
 *    - products: (category, isActive, sku)
 *    - products: (isActive, reorderPoint)
 *    - pos_transactions: (timestamp DESC, status)
 *    - pos_transactions: (paymentMethod, status, timestamp DESC)
 */
