/**
 * Examples of using Firestore query optimization utilities
 * 
 * This file demonstrates how to use the pagination helpers,
 * listener management, and query builders for optimal performance.
 */

import { collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  executePaginatedQuery,
  createRealtimeListener,
  ListenerManager,
  createQueryBuilder,
  PricelistItemQueries,
  PriceChangeQueries,
  InventoryTransactionQueries,
  POSTransactionQueries,
  ProductQueries,
  type PaginatedQueryResult,
} from './firestore';
import type {
  Product,
  PriceChange,
  InventoryTransaction,
  POSTransaction,
} from '../types/models';

/**
 * Example 1: Paginated Product Query
 * 
 * Shows how to implement cursor-based pagination for products.
 */
export async function paginatedProductsExample() {
  const productsRef = collection(db, 'products');
  
  // Build optimized query using QueryBuilder
  const builder = createQueryBuilder<Product>(productsRef)
    .where('category', '==', 'Electronics')
    .where('isActive', '==', true)
    .orderBy('sku', 'asc');
  
  // Get first page
  const firstPage = await builder.executePaginated(
    { pageSize: 50 },
    (doc) => doc.data() as Product
  );
  
  console.log(`First page: ${firstPage.data.length} products`);
  console.log(`Has more: ${firstPage.pagination.hasMore}`);
  
  // Get second page if available
  if (firstPage.pagination.hasMore && firstPage.pagination.lastDoc) {
    const secondPage = await builder.executePaginated(
      {
        pageSize: 50,
        startAfterDoc: firstPage.pagination.lastDoc,
      },
      (doc) => doc.data() as Product
    );
    
    console.log(`Second page: ${secondPage.data.length} products`);
  }
}

/**
 * Example 2: Real-time Listener with Cleanup
 * 
 * Shows how to set up a real-time listener for low stock items
 * with proper error handling and cleanup.
 */
export function realtimeInventoryListenerExample() {
  const inventoryRef = collection(db, 'inventory');
  
  // Create query for low stock items
  const lowStockQuery = createQueryBuilder(inventoryRef)
    .where('quantityOnHand', '<', 10)
    .orderBy('quantityOnHand', 'asc')
    .limit(100)
    .build();
  
  // Set up listener
  const unsubscribe = createRealtimeListener(
    lowStockQuery,
    (items, error) => {
      if (error) {
        console.error('Listener error:', error);
        return;
      }
      
      console.log(`Low stock items updated: ${items.length} items`);
      // Update UI with new data
      // updateLowStockUI(items);
    },
    (doc) => doc.data(),
    {
      includeMetadataChanges: false,
      onError: (error) => {
        console.error('Listener error:', error);
        // Show error notification to user
      },
    }
  );
  
  // Return cleanup function to call when component unmounts
  return unsubscribe;
}

/**
 * Example 3: Listener Manager for Multiple Listeners
 * 
 * Shows how to manage multiple listeners in a component or page.
 */
export function multipleListenersExample() {
  const manager = new ListenerManager();
  
  // Add inventory listener
  const inventoryQuery = createQueryBuilder(collection(db, 'inventory'))
    .where('quantityOnHand', '<', 10)
    .limit(100)
    .build();
  
  const inventoryListener = createRealtimeListener(
    inventoryQuery,
    (items) => {
      console.log('Inventory updated:', items.length);
      // Update inventory UI
    },
    (doc) => doc.data()
  );
  
  manager.add('inventory', inventoryListener);
  
  // Add price changes listener
  const priceChangesQuery = PriceChangeQueries.getSignificant(
    collection(db, 'price_changes'),
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    new Date(),
    100
  );
  
  const priceListener = createRealtimeListener(
    priceChangesQuery,
    (changes) => {
      console.log('Price changes updated:', changes.length);
      // Update price changes UI
    },
    (doc) => doc.data() as PriceChange
  );
  
  manager.add('price-changes', priceListener);
  
  // Add POS transactions listener
  const posQuery = POSTransactionQueries.getRecent(
    collection(db, 'pos_transactions'),
    new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    new Date(),
    200
  );
  
  const posListener = createRealtimeListener(
    posQuery,
    (transactions) => {
      console.log('Recent transactions:', transactions.length);
      // Update dashboard
    },
    (doc) => doc.data() as POSTransaction
  );
  
  manager.add('pos-transactions', posListener);
  
  console.log(`Active listeners: ${manager.count}`);
  
  // Clean up all listeners when component unmounts
  return () => {
    manager.removeAll();
    console.log('All listeners cleaned up');
  };
}

/**
 * Example 4: Using Pre-built Query Patterns
 * 
 * Shows how to use the pre-built query patterns that leverage
 * composite indexes for optimal performance.
 */
export async function prebuiltQueryPatternsExample() {
  // Get unmatched pricelist items for a supplier
  const unmatchedQuery = PricelistItemQueries.getUnmatched(
    collection(db, 'pricelist_items'),
    'supplier-123',
    100
  );
  
  const unmatchedSnapshot = await getDocs(unmatchedQuery);
  console.log(`Unmatched items: ${unmatchedSnapshot.size}`);
  
  // Get new products from a supplier
  const newProductsQuery = PricelistItemQueries.getNewProducts(
    collection(db, 'pricelist_items'),
    'supplier-123',
    50
  );
  
  const newProductsSnapshot = await getDocs(newProductsQuery);
  console.log(`New products: ${newProductsSnapshot.size}`);
  
  // Get price history for a product
  const priceHistoryQuery = PriceChangeQueries.getPriceHistory(
    collection(db, 'price_changes'),
    'SKU-12345',
    100
  );
  
  const priceHistorySnapshot = await getDocs(priceHistoryQuery);
  console.log(`Price history entries: ${priceHistorySnapshot.size}`);
  
  // Get inventory transactions for a product
  const inventoryHistoryQuery = InventoryTransactionQueries.getByProduct(
    collection(db, 'inventory_transactions'),
    'SKU-12345',
    200
  );
  
  const inventoryHistorySnapshot = await getDocs(inventoryHistoryQuery);
  console.log(`Inventory transactions: ${inventoryHistorySnapshot.size}`);
  
  // Get POS transactions by user
  const userTransactionsQuery = POSTransactionQueries.getByUser(
    collection(db, 'pos_transactions'),
    'user-789',
    100
  );
  
  const userTransactionsSnapshot = await getDocs(userTransactionsQuery);
  console.log(`User transactions: ${userTransactionsSnapshot.size}`);
  
  // Get active products
  const activeProductsQuery = ProductQueries.getActive(
    collection(db, 'products'),
    500
  );
  
  const activeProductsSnapshot = await getDocs(activeProductsQuery);
  console.log(`Active products: ${activeProductsSnapshot.size}`);
}

/**
 * Example 5: Complete Pagination Implementation
 * 
 * Shows a complete example of implementing pagination with
 * navigation controls.
 */
export async function completePaginationExample() {
  const productsRef = collection(db, 'products');
  
  // Build base query
  const baseQuery = createQueryBuilder<Product>(productsRef)
    .where('isActive', '==', true)
    .orderBy('sku', 'asc')
    .build();
  
  // State for pagination
  let currentPage = 1;
  let lastDoc = null;
  const pages: any[] = []; // Store page cursors for back navigation
  
  // Function to load a page
  async function loadPage(direction: 'next' | 'prev' | 'first') {
    let startAfterDoc = null;
    
    if (direction === 'next' && lastDoc) {
      startAfterDoc = lastDoc;
    } else if (direction === 'prev' && currentPage > 1) {
      // Get cursor for previous page
      startAfterDoc = pages[currentPage - 2] || null;
    } else if (direction === 'first') {
      startAfterDoc = null;
      currentPage = 1;
      pages.length = 0;
    }
    
    const result: PaginatedQueryResult<Product> = await executePaginatedQuery(
      baseQuery,
      { pageSize: 50, startAfterDoc },
      (doc) => doc.data() as Product
    );
    
    // Update pagination state
    if (direction === 'next') {
      pages[currentPage - 1] = lastDoc;
      currentPage++;
    } else if (direction === 'prev') {
      currentPage--;
    }
    
    lastDoc = result.pagination.lastDoc;
    
    console.log(`Page ${currentPage}: ${result.data.length} products`);
    console.log(`Has more: ${result.pagination.hasMore}`);
    
    return result;
  }
  
  // Load first page
  const firstPage = await loadPage('first');
  console.log('First page loaded:', firstPage.data.length);
  
  // Load next page
  if (firstPage.pagination.hasMore) {
    const secondPage = await loadPage('next');
    console.log('Second page loaded:', secondPage.data.length);
    
    // Go back to first page
    const backToFirst = await loadPage('prev');
    console.log('Back to first page:', backToFirst.data.length);
  }
}

/**
 * Example 6: Query Builder with Complex Filters
 * 
 * Shows how to build complex queries with multiple constraints.
 */
export async function complexQueryExample() {
  const posTransactionsRef = collection(db, 'pos_transactions');
  
  // Build complex query
  const transactions = await createQueryBuilder<POSTransaction>(posTransactionsRef)
    .where('userId', '==', 'user-123')
    .where('timestamp', '>=', new Date('2024-01-01'))
    .where('status', '==', 'completed')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .execute((doc) => doc.data() as POSTransaction);
  
  console.log(`Found ${transactions.length} transactions`);
  
  // Calculate total sales
  const totalSales = transactions.reduce((sum, tx) => sum + tx.total, 0);
  console.log(`Total sales: $${totalSales.toFixed(2)}`);
}

/**
 * Example 7: Optimized Dashboard Data Loading
 * 
 * Shows how to efficiently load multiple datasets for a dashboard
 * using parallel queries with proper limits.
 */
export async function dashboardDataLoadingExample() {
  const startTime = Date.now();
  
  // Load multiple datasets in parallel
  const [
    lowStockItems,
    recentTransactions,
    significantPriceChanges,
    unmatchedProducts,
  ] = await Promise.all([
    // Low stock items (limit 50)
    createQueryBuilder(collection(db, 'inventory'))
      .where('quantityOnHand', '<', 10)
      .orderBy('quantityOnHand', 'asc')
      .limit(50)
      .execute((doc) => doc.data()),
    
    // Recent POS transactions (limit 100)
    (async () => {
      const query = POSTransactionQueries.getRecent(
        collection(db, 'pos_transactions'),
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
        100
      );
      const snapshot = await getDocs(query);
      return snapshot.docs.map(doc => doc.data() as POSTransaction);
    })(),
    
    // Significant price changes (limit 50)
    (async () => {
      const query = PriceChangeQueries.getSignificant(
        collection(db, 'price_changes'),
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
        50
      );
      const snapshot = await getDocs(query);
      return snapshot.docs.map(doc => doc.data() as PriceChange);
    })(),
    
    // Unmatched products count (limit 100)
    (async () => {
      const query = PricelistItemQueries.getUnmatched(
        collection(db, 'pricelist_items'),
        'all-suppliers', // Would need to aggregate across suppliers in real implementation
        100
      );
      const snapshot = await getDocs(query);
      return snapshot.size;
    })(),
  ]);
  
  const loadTime = Date.now() - startTime;
  
  console.log('Dashboard data loaded in', loadTime, 'ms');
  console.log('- Low stock items:', lowStockItems.length);
  console.log('- Recent transactions:', recentTransactions.length);
  console.log('- Price changes:', significantPriceChanges.length);
  console.log('- Unmatched products:', unmatchedProducts);
  
  // All queries should complete well under 2 seconds (Requirement 17.2)
  if (loadTime < 2000) {
    console.log('✓ Performance requirement met (< 2 seconds)');
  } else {
    console.warn('✗ Performance requirement not met (>= 2 seconds)');
  }
}
