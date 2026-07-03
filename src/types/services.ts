/**
 * Service Layer Interfaces for PRO SYNAPSE
 * 
 * This module defines all service interfaces and their contracts.
 * These interfaces abstract business logic and provide a clear API
 * for the presentation layer to interact with backend services.
 * 
 * Requirements: 1.1, 3.1, 4.1, 6.1, 8.2, 13.1
 */

import type {
  User,
  UserSession,
  UserRole,
  Permission,
  PricelistData,
  InvoiceData,
  DeliveryReceiptData,
  DocumentFormat,
  MatchingResult,
  MatchSuggestion,
  UnmatchedProduct,
  PriceChange,
  PriceHistoryEntry,
  DateRange,
  InventoryAdjustment,
  LowStockAlert,
  InventoryTransaction,
  ReceivingRecord,
  POSTransaction,
  POSTransactionDraft,
  ProductPOS,
  PaymentMethod,
  Report,
  SalesReportConfig,
  InventoryReportConfig,
  SupplierReportConfig,
  ReportConfig,
  PricelistItem,
} from './models';

import type { ReportConfigDoc } from './firestore';

// ============================================================================
// Authentication Service (Requirement 1.1)
// ============================================================================

/**
 * Authentication service interface
 * 
 * Manages user authentication, session management, and authorization.
 * 
 * Requirement 1.1: User Authentication and Access Control
 */
export interface AuthService {
  /**
   * Authenticate a user with email and password
   * 
   * @param email - User email address
   * @param password - User password
   * @returns Promise resolving to user session on success
   * @throws Error if credentials are invalid or account is locked
   * 
   * Requirement 1.1, 1.2
   */
  login(email: string, password: string): Promise<UserSession>;

  /**
   * Log out the current user and terminate their session
   * 
   * @returns Promise resolving when logout is complete
   * 
   * Requirement 1.5
   */
  logout(): Promise<void>;

  /**
   * Get the currently authenticated user
   * 
   * @returns Promise resolving to User object or null if not authenticated
   * 
   * Requirement 1.6
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Check if a user has a specific permission
   * 
   * @param user - User to check
   * @param permission - Permission to verify
   * @returns true if user has the permission, false otherwise
   * 
   * Requirement 1.4
   */
  checkPermission(user: User, permission: Permission): boolean;

  /**
   * Lock a user account after failed login attempts
   * 
   * @param userId - ID of user to lock
   * @param duration - Lock duration in milliseconds
   * @returns Promise resolving when lock is applied
   * 
   * Requirement 19.6
   */
  lockAccount(userId: string, duration: number): Promise<void>;
}

// ============================================================================
// Document Parser Service (Requirement 3.1)
// ============================================================================

/**
 * Document parser service interface
 * 
 * Extracts structured data from various document formats.
 * 
 * Requirement 3.1: Supplier Pricelist Upload and Processing
 */
export interface ParserService {
  /**
   * Parse a pricelist document and extract product data
   * 
   * @param file - File to parse (CSV, Excel, or PDF)
   * @returns Promise resolving to structured pricelist data
   * @throws Error with descriptive message if parsing fails
   * 
   * Requirements 3.1, 3.2, 3.3
   */
  parsePricelist(file: File): Promise<PricelistData>;

  /**
   * Parse an invoice document and extract line items
   * 
   * @param file - Invoice file to parse
   * @returns Promise resolving to structured invoice data
   * @throws Error with descriptive message if parsing fails
   * 
   * Requirements 10.1, 10.2
   */
  parseInvoice(file: File): Promise<InvoiceData>;

  /**
   * Parse a delivery receipt document
   * 
   * @param file - Delivery receipt file to parse
   * @returns Promise resolving to structured delivery receipt data
   * @throws Error with descriptive message if parsing fails
   * 
   * Requirements 11.1, 11.2
   */
  parseDeliveryReceipt(file: File): Promise<DeliveryReceiptData>;

  /**
   * Detect the format of a document file
   * 
   * @param file - File to analyze
   * @returns Promise resolving to detected document format
   * 
   * Requirement 3.1
   */
  detectFormat(file: File): Promise<DocumentFormat>;
}

// ============================================================================
// Pretty Printer Service (Requirement 3.6)
// ============================================================================

/**
 * Pretty printer service interface
 * 
 * Converts structured data back into formatted document strings.
 * Ensures round-trip preservation (parse → print → parse).
 * 
 * Requirements 3.6, 10.6, 11.6
 */
export interface PrettyPrinterService {
  /**
   * Convert pricelist data to CSV format string
   * 
   * @param data - Structured pricelist data
   * @returns Promise resolving to CSV-formatted string
   * 
   * Requirement 3.6
   */
  printPricelist(data: PricelistData): Promise<string>;

  /**
   * Convert invoice data to formatted document string
   * 
   * @param data - Structured invoice data
   * @returns Promise resolving to formatted invoice document
   * 
   * Requirement 10.6
   */
  printInvoice(data: InvoiceData): Promise<string>;

  /**
   * Convert delivery receipt data to formatted document string
   * 
   * @param data - Structured delivery receipt data
   * @returns Promise resolving to formatted delivery receipt document
   * 
   * Requirement 11.6
   */
  printDeliveryReceipt(data: DeliveryReceiptData): Promise<string>;
}

// ============================================================================
// Product Matcher Service (Requirement 4.1)
// ============================================================================

/**
 * Product matcher service interface
 * 
 * Performs AI-powered product matching between supplier codes and internal SKUs.
 * Uses exact matching, fuzzy matching, and machine learning for identification.
 * 
 * Requirement 4.1: Product Matching and Identification
 */
export interface MatcherService {
  /**
   * Match all products in a pricelist to internal SKUs
   * 
   * Uses exact matching first, then fuzzy/AI matching for unmatched items.
   * Applies 0.85 confidence threshold for suggestions.
   * 
   * @param pricelist - Pricelist data to match
   * @returns Promise resolving to matching results
   * 
   * Requirements 4.1, 4.2, 4.3, 4.4, 4.5
   */
  matchProducts(pricelist: PricelistData): Promise<MatchingResult>;

  /**
   * Get match suggestions for a single supplier product
   * 
   * @param supplierProduct - Supplier product to match
   * @returns Promise resolving to array of match suggestions
   * 
   * Requirement 4.3
   */
  suggestMatch(supplierProduct: PricelistItem): Promise<MatchSuggestion[]>;

  /**
   * Confirm a match between supplier code and internal SKU
   * 
   * Creates a Matched_Product link and stores confirmation to improve learning.
   * 
   * @param supplierCode - Supplier's product code
   * @param internalSKU - Internal SKU to link
   * @param supplierId - Supplier ID
   * @param price - Price from pricelist item (optional)
   * @returns Promise resolving when match is confirmed
   * 
   * Requirement 4.6
   */
  confirmMatch(supplierCode: string, internalSKU: string, supplierId: string, price?: number): Promise<void>;

  /**
   * Find all unmatched products for a supplier
   * 
   * @param supplierId - Supplier ID to query
   * @returns Promise resolving to array of unmatched products
   * 
   * Requirement 4.7
   */
  findUnmatchedProducts(supplierId: string): Promise<UnmatchedProduct[]>;
}

// ============================================================================
// Price Monitor Service (Requirement 6.1)
// ============================================================================

/**
 * Price monitoring service interface
 * 
 * Detects and tracks supplier price changes over time.
 * Flags significant price increases (>10%) for review.
 * 
 * Requirement 6.1: Supplier Price Change Detection
 */
export interface PriceMonitorService {
  /**
   * Detect price changes in a new pricelist compared to previous
   * 
   * Compares current prices against the most recent pricelist from the same supplier.
   * Calculates percentage change and flags significant increases (>10%).
   * 
   * @param newPricelist - New pricelist to analyze
   * @returns Promise resolving to array of detected price changes
   * 
   * Requirements 6.1, 6.2, 6.3
   */
  detectPriceChanges(newPricelist: PricelistData): Promise<PriceChange[]>;

  /**
   * Get price history for a product from a specific supplier
   * 
   * @param sku - Internal product SKU
   * @param supplierId - Supplier ID
   * @returns Promise resolving to chronological price history
   * 
   * Requirement 6.5
   */
  getPriceHistory(sku: string, supplierId: string): Promise<PriceHistoryEntry[]>;

  /**
   * Get all significant price changes within a date range
   * 
   * @param threshold - Percentage threshold for significance (e.g., 10)
   * @param dateRange - Date range to query
   * @returns Promise resolving to significant price changes
   * 
   * Requirement 6.3
   */
  getSignificantChanges(threshold: number, dateRange: DateRange): Promise<PriceChange[]>;
}

// ============================================================================
// Inventory Service (Requirement 8.2)
// ============================================================================

/**
 * Inventory management service interface
 * 
 * Manages inventory quantities, locations, and transactions.
 * Provides real-time stock tracking and low stock alerts.
 * 
 * Requirement 8.2: Inventory Management
 */
export interface InventoryService {
  /**
   * Get current quantity on hand for a product
   * 
   * @param sku - Product SKU
   * @param locationId - Optional location filter
   * @returns Promise resolving to current quantity
   * 
   * Requirements 8.1, 8.5
   */
  getQuantityOnHand(sku: string, locationId?: string): Promise<number>;

  /**
   * Adjust inventory quantity with atomic transaction
   * 
   * Uses formula: new_quantity = current_quantity + quantity_change
   * 
   * @param adjustment - Adjustment details
   * @returns Promise resolving when adjustment is complete
   * 
   * Requirements 8.2, 8.7
   */
  adjustInventory(adjustment: InventoryAdjustment): Promise<void>;

  /**
   * Process a receiving transaction and update inventory
   * 
   * @param receiving - Receiving record to process
   * @returns Promise resolving when receiving is complete
   * 
   * Requirements 8.2, 9.3
   */
  processReceiving(receiving: ReceivingRecord): Promise<void>;

  /**
   * Process a sale transaction and decrease inventory
   * 
   * @param transaction - POS transaction to process
   * @returns Promise resolving when sale is processed
   * 
   * Requirements 8.3, 13.3
   */
  processSale(transaction: POSTransaction): Promise<void>;

  /**
   * Get all products with inventory below reorder point
   * 
   * Generates alerts when quantity < reorder_point.
   * 
   * @param locationId - Optional location filter
   * @returns Promise resolving to low stock alerts
   * 
   * Requirement 8.4
   */
  getLowStockItems(locationId?: string): Promise<LowStockAlert[]>;

  /**
   * Get inventory transaction history for a product
   * 
   * @param sku - Product SKU
   * @param dateRange - Date range to query
   * @returns Promise resolving to transaction history
   * 
   * Requirement 8.6
   */
  getInventoryHistory(sku: string, dateRange: DateRange): Promise<InventoryTransaction[]>;
}

// ============================================================================
// POS Service (Requirement 13.1)
// ============================================================================

/**
 * Point-of-sale service interface
 * 
 * Manages sales transactions, product lookups, and inventory updates.
 * Supports offline transaction queueing and void functionality.
 * 
 * Requirement 13.1: Point-of-Sale Operations
 */
export interface POSService {
  /**
   * Look up product information by SKU for POS display
   * 
   * Fast SKU-based retrieval with price and availability.
   * 
   * @param sku - Product SKU to look up
   * @returns Promise resolving to product details
   * 
   * Requirement 13.1
   */
  lookupProduct(sku: string): Promise<ProductPOS>;

  /**
   * Create a new POS transaction
   * 
   * Calculates line totals: line_total = quantity * unit_price (rounded to 2 decimals)
   * Updates inventory atomically on completion.
   * 
   * @param transaction - Transaction draft to create
   * @returns Promise resolving to completed transaction
   * 
   * Requirements 13.2, 13.3, 13.6
   */
  createTransaction(transaction: POSTransactionDraft): Promise<POSTransaction>;

  /**
   * Void a completed transaction
   * 
   * Reverses inventory adjustments and maintains audit trail.
   * 
   * @param transactionId - Transaction ID to void
   * @param userId - User performing the void
   * @returns Promise resolving when void is complete
   * 
   * Requirement 13.5
   */
  voidTransaction(transactionId: string, userId: string): Promise<void>;

  /**
   * Get transaction history within a date range
   * 
   * @param dateRange - Date range to query
   * @returns Promise resolving to transaction history
   * 
   * Requirement 13.1
   */
  getTransactionHistory(dateRange: DateRange): Promise<POSTransaction[]>;
}

// ============================================================================
// Reporting Service (Requirement 13.1)
// ============================================================================

/**
 * Reporting and analytics service interface
 * 
 * Generates customizable reports on sales, inventory, and supplier performance.
 * Supports export to PDF and Excel formats.
 * 
 * Requirement 13.1: Reporting and Analytics
 */
export interface ReportingService {
  /**
   * Generate a sales report
   * 
   * Shows revenue, units sold, and margin by product, category, or time period.
   * 
   * @param config - Sales report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.1
   */
  generateSalesReport(config: SalesReportConfig): Promise<Report>;

  /**
   * Generate an inventory report
   * 
   * Shows current stock levels, inventory value, and turnover rates.
   * 
   * @param config - Inventory report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.2
   */
  generateInventoryReport(config: InventoryReportConfig): Promise<Report>;

  /**
   * Generate a supplier performance report
   * 
   * Shows price stability, delivery reliability, and product range metrics.
   * 
   * @param config - Supplier report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.3
   */
  generateSupplierReport(config: SupplierReportConfig): Promise<Report>;

  /**
   * Export a report to PDF or Excel format
   * 
   * @param reportId - Report ID to export
   * @param format - Export format ('pdf' or 'excel')
   * @returns Promise resolving to file blob
   * 
   * Requirement 15.4
   */
  exportReport(reportId: string, format: 'pdf' | 'excel'): Promise<Blob>;

  /**
   * Export a report from report data to PDF or Excel format
   * 
   * This method accepts the report object directly and exports it to the specified format.
   * 
   * @param report - Report object to export
   * @param format - Export format ('pdf' or 'excel')
   * @returns Promise resolving to file blob
   * 
   * Requirement 15.4
   */
  exportReportFromData(report: Report, format: 'pdf' | 'excel'): Promise<Blob>;

  /**
   * Save a report configuration for reuse
   * 
   * @param config - Report configuration to save
   * @param userId - User ID who is saving the configuration
   * @param name - Name for the saved configuration
   * @returns Promise resolving to config ID
   * 
   * Requirement 15.6
   */
  saveReportConfig(config: ReportConfig, userId: string, name: string): Promise<string>;

  /**
   * Load a saved report configuration
   * 
   * @param configId - Configuration ID to load
   * @returns Promise resolving to report configuration
   * 
   * Requirement 15.6
   */
  loadReportConfig(configId: string): Promise<ReportConfig>;

  /**
   * Get all saved report configurations for a user
   * 
   * @param userId - User ID to get configurations for
   * @returns Promise resolving to array of report configurations
   * 
   * Requirement 15.6
   */
  getUserReportConfigs(userId: string): Promise<ReportConfigDoc[]>;

  /**
   * Delete a saved report configuration
   * 
   * @param configId - Configuration ID to delete
   * @param userId - User ID (for authorization check)
   * @returns Promise resolving when delete is complete
   * 
   * Requirement 15.6
   */
  deleteReportConfig(configId: string, userId: string): Promise<void>;
}


