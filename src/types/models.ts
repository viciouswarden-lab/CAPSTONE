/**
 * Domain Model Types for PRO SYNAPSE
 * 
 * This module defines the core domain models used throughout the application.
 * These models represent business entities and value objects independent of
 * the database or service layer implementation.
 */

// ============================================================================
// User and Authentication Models (Requirements 2.1, 1.1)
// ============================================================================

/**
 * User roles defining access levels and permissions
 */
export type UserRole = 'Administrator' | 'Manager' | 'Analyst' | 'Clerk' | 'Sales_Associate';

/**
 * System permissions for role-based access control
 */
export type Permission = 
  | 'manage_users' 
  | 'manage_suppliers' 
  | 'upload_pricelists' 
  | 'approve_matches' 
  | 'adjust_inventory' 
  | 'process_sales' 
  | 'generate_reports';

/**
 * Domain model representing a system user
 */
export interface User {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

/**
 * User session information
 */
export interface UserSession {
  userId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
}

// ============================================================================
// Supplier Models (Requirement 2.1)
// ============================================================================

/**
 * Domain model representing a supplier
 */
export interface Supplier {
  supplierId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // userId
}

// ============================================================================
// Product Models (Requirement 7.1)
// ============================================================================

/**
 * Supplier mapping for a product
 */
export interface SupplierMapping {
  supplierId: string;
  supplierCode: string;
  lastCost: number;
  lastCostDate: Date;
}

/**
 * Domain model representing a product
 */
export interface Product {
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  reorderPoint: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  supplierMappings: SupplierMapping[];
}

/**
 * Product information for POS operations
 */
export interface ProductPOS {
  sku: string;
  description: string;
  price: number;
  availableQuantity: number;
  category: string;
}

// ============================================================================
// Document Processing Models (Requirements 3.2, 10.1, 11.1)
// ============================================================================

/**
 * Document format types
 */
export type DocumentFormat = 'csv' | 'excel' | 'pdf';

/**
 * Pricelist item from supplier
 */
export interface PricelistItem {
  supplierCode: string;
  description: string;
  price: number;
  uom?: string;
}

/**
 * Pricelist data structure (Requirement 3.2)
 */
export interface PricelistData {
  supplierId: string;
  uploadDate: Date;
  items: PricelistItem[];
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Invoice data structure (Requirement 10.1)
 */
export interface InvoiceData {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
}

/**
 * Delivery receipt line item
 */
export interface DeliveryLineItem {
  productCode: string;
  description: string;
  quantity: number;
}

/**
 * Delivery receipt data structure (Requirement 11.1)
 */
export interface DeliveryReceiptData {
  supplierName: string;
  deliveryDate: Date;
  lineItems: DeliveryLineItem[];
}

// ============================================================================
// Product Matching Models (Requirement 4.2)
// ============================================================================

/**
 * Match types
 */
export type MatchType = 'exact' | 'fuzzy' | 'confirmed';

/**
 * Matched product result
 */
export interface MatchedProduct {
  supplierCode: string;
  internalSKU: string;
  confidence: number; // 1.0 for exact, <1.0 for fuzzy
  matchType: MatchType;
}

/**
 * Unmatched product requiring review
 */
export interface UnmatchedProduct {
  supplierCode: string;
  description: string;
  supplierId: string;
  uploadDate: Date;
}

/**
 * Match suggestion for user review
 */
export interface MatchSuggestion {
  supplierCode: string;
  suggestedSKU: string;
  productName: string;
  confidence: number; // 0.0 to 1.0
  reason: string; // explanation of match basis
}

/**
 * Complete matching result (Requirement 4.2)
 */
export interface MatchingResult {
  matched: MatchedProduct[];
  unmatched: UnmatchedProduct[];
  suggestions: MatchSuggestion[];
}

// ============================================================================
// Price Monitoring Models (Requirement 6.2)
// ============================================================================

/**
 * Price change record (Requirement 6.2)
 */
export interface PriceChange {
  sku: string;
  supplierId: string;
  oldPrice: number;
  newPrice: number;
  absoluteChange: number;
  percentageChange: number;
  changeDate: Date;
  isSignificant: boolean; // >10%
}

/**
 * Price history entry
 */
export interface PriceHistoryEntry {
  price: number;
  effectiveDate: Date;
  source: string; // pricelist reference
}

/**
 * Date range for queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Inventory Models (Requirement 8.2)
// ============================================================================

/**
 * Inventory adjustment reasons
 */
export type InventoryAdjustmentReason = 'receiving' | 'sale' | 'adjustment' | 'return';

/**
 * Inventory adjustment record (Requirement 8.2)
 */
export interface InventoryAdjustment {
  sku: string;
  locationId: string;
  quantityChange: number;
  reason: InventoryAdjustmentReason;
  userId: string;
  timestamp: Date;
  notes?: string;
}

/**
 * Low stock alert
 */
export interface LowStockAlert {
  sku: string;
  currentQuantity: number;
  reorderPoint: number;
  locationId: string;
}

/**
 * Inventory transaction record
 */
export interface InventoryTransaction {
  transactionId: string;
  sku: string;
  quantityBefore: number;
  quantityAfter: number;
  transactionType: string;
  timestamp: Date;
  userId: string;
}

// ============================================================================
// Receiving Models (Requirement 8.2)
// ============================================================================

/**
 * Receiving document types
 */
export type ReceivingDocumentType = 'invoice' | 'delivery_receipt';

/**
 * Receiving record status
 */
export type ReceivingStatus = 'pending' | 'completed';

/**
 * Receiving line item
 */
export interface ReceivingLineItem {
  sku: string;
  quantity: number;
  locationId: string;
  expectedQuantity?: number; // for variance detection
}

/**
 * Receiving record
 */
export interface ReceivingRecord {
  receivingId: string;
  supplierId: string;
  receivingDate: Date;
  documentType: ReceivingDocumentType;
  lineItems: ReceivingLineItem[];
  status: ReceivingStatus;
}

// ============================================================================
// POS Models (Requirement 10.1, 11.1)
// ============================================================================

/**
 * Payment method types
 */
export type PaymentMethod = 'cash' | 'card' | 'mobile';

/**
 * POS transaction status
 */
export type POSTransactionStatus = 'completed' | 'voided';

/**
 * POS line item
 */
export interface POSLineItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * POS transaction draft (before completion)
 */
export interface POSTransactionDraft {
  lineItems: POSLineItem[];
  paymentMethod: PaymentMethod;
  userId: string;
}

/**
 * Complete POS transaction record (Requirements 10.1, 11.1)
 */
export interface POSTransaction {
  transactionId: string;
  timestamp: Date;
  lineItems: POSLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  userId: string;
  status: POSTransactionStatus;
}

// ============================================================================
// Reporting Models (Requirement 13.2)
// ============================================================================

/**
 * Report types
 */
export type ReportType = 'sales' | 'inventory' | 'supplier';

/**
 * Report grouping options for sales reports
 */
export type SalesReportGrouping = 'product' | 'category' | 'day' | 'week' | 'month';

/**
 * Supplier report metric types
 */
export type SupplierReportMetric = 'price_stability' | 'delivery_reliability' | 'product_range';

/**
 * Report summary statistics
 */
export interface ReportSummary {
  totalRecords: number;
  aggregates: Record<string, number>;
}

/**
 * Base report configuration
 */
export interface ReportConfig {
  dateRange: DateRange;
  filters: Record<string, any>;
}

/**
 * Sales report configuration
 */
export interface SalesReportConfig extends ReportConfig {
  groupBy: SalesReportGrouping;
  includeMargin: boolean;
}

/**
 * Inventory report configuration
 */
export interface InventoryReportConfig extends ReportConfig {
  includeValue: boolean;
  includeTurnover: boolean;
}

/**
 * Supplier report configuration
 */
export interface SupplierReportConfig extends ReportConfig {
  metrics: SupplierReportMetric[];
}

/**
 * Generated report (Requirement 13.2)
 */
export interface Report {
  reportId: string;
  title: string;
  generatedAt: Date;
  data: any; // report-specific data structure
  summary: ReportSummary;
}
