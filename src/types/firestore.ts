/**
 * Firestore Document Type Definitions
 * 
 * This file contains all Firestore collection document interfaces for the PRO SYNAPSE system.
 * These types represent the structure of documents stored in Firebase Firestore.
 * 
 * Requirements: 7.1, 7.4, 2.1, 8.1
 */

import { Timestamp } from 'firebase/firestore';

/**
 * User role types for role-based access control
 */
export type UserRole = 'Administrator' | 'Manager' | 'Analyst' | 'Clerk' | 'Sales_Associate';

/**
 * Payment methods supported by the POS system
 */
export type PaymentMethod = 'cash' | 'card' | 'mobile';

/**
 * Document format types for parsing
 */
export type DocumentFormat = 'csv' | 'excel' | 'pdf';

/**
 * User document stored in the 'users' collection
 * 
 * Requirements: 1.1, 16.1
 */
export interface UserDoc {
  /** Document ID - unique user identifier */
  userId: string;
  /** User email address */
  email: string;
  /** Display name for the user */
  displayName: string;
  /** Assigned role for access control */
  role: UserRole;
  /** Whether the user account is active */
  isActive: boolean;
  /** Timestamp when the user was created */
  createdAt: Timestamp;
  /** Timestamp of the user's last login */
  lastLoginAt: Timestamp;
  /** Count of consecutive failed login attempts */
  failedLoginAttempts: number;
  /** Timestamp until which the account is locked (optional) */
  lockedUntil?: Timestamp;
}

/**
 * Supplier document stored in the 'suppliers' collection
 * 
 * Requirements: 2.1
 */
export interface SupplierDoc {
  /** Document ID - unique supplier identifier */
  supplierId: string;
  /** Supplier company name */
  name: string;
  /** Contact person name */
  contactPerson: string;
  /** Contact email address */
  email: string;
  /** Contact phone number */
  phone: string;
  /** Physical address */
  address: string;
  /** Whether the supplier is active */
  isActive: boolean;
  /** Timestamp when the supplier was created */
  createdAt: Timestamp;
  /** Timestamp when the supplier was last updated */
  updatedAt: Timestamp;
  /** User ID who created the supplier record */
  createdBy: string;
}

/**
 * Supplier mapping for product documents
 */
export interface SupplierMapping {
  /** Supplier ID reference */
  supplierId: string;
  /** Supplier's product code */
  supplierCode: string;
  /** Last known cost from this supplier */
  lastCost: number;
  /** Date of the last cost update */
  lastCostDate: Timestamp;
}

/**
 * Product document stored in the 'products' collection
 * 
 * Requirements: 7.1, 7.2
 */
export interface ProductDoc {
  /** Document ID - Stock Keeping Unit (unique) */
  sku: string;
  /** Product description */
  description: string;
  /** Product category */
  category: string;
  /** Unit of measure (e.g., 'each', 'box', 'kg') */
  unitOfMeasure: string;
  /** Quantity threshold for reorder alerts */
  reorderPoint: number;
  /** Whether the product is active */
  isActive: boolean;
  /** Timestamp when the product was created */
  createdAt: Timestamp;
  /** Timestamp when the product was last updated */
  updatedAt: Timestamp;
  /** Supplier mappings for this product */
  supplierMappings: SupplierMapping[];
}

/**
 * Pricelist document stored in the 'pricelists' collection
 * 
 * Requirements: 3.1, 3.5
 */
export interface PricelistDoc {
  /** Document ID - unique pricelist identifier */
  pricelistId: string;
  /** Supplier ID reference */
  supplierId: string;
  /** Date the pricelist was uploaded */
  uploadDate: Timestamp;
  /** Original filename */
  fileName: string;
  /** Local file path (relative to uploads directory) */
  filePath: string;
  /** Number of items in the pricelist */
  itemCount: number;
  /** Timestamp when processing completed */
  processedAt: Timestamp;
  /** User ID who uploaded the pricelist */
  uploadedBy: string;
}

/**
 * Match status for pricelist items
 */
export type MatchStatus = 'matched' | 'unmatched' | 'suggested';

/**
 * Pricelist item document stored in the 'pricelist_items' collection
 * 
 * Requirements: 3.2, 4.1, 5.1
 */
export interface PricelistItemDoc {
  /** Document ID - unique item identifier */
  itemId: string;
  /** Parent pricelist ID reference */
  pricelistId: string;
  /** Supplier ID reference */
  supplierId: string;
  /** Supplier's product code */
  supplierCode: string;
  /** Product description */
  description: string;
  /** Product price */
  price: number;
  /** Unit of measure (optional) */
  uom?: string;
  /** Match status for this item */
  matchStatus: MatchStatus;
  /** Matched internal SKU (if matched) */
  matchedSKU?: string;
  /** Confidence score for the match (0-1) */
  matchConfidence?: number;
  /** Whether this is a new product from the supplier */
  isNewProduct: boolean;
}

/**
 * Price change document stored in the 'price_changes' collection
 * 
 * Requirements: 6.1, 6.2, 6.3
 */
export interface PriceChangeDoc {
  /** Document ID - unique change identifier */
  changeId: string;
  /** Internal SKU reference */
  sku: string;
  /** Supplier ID reference */
  supplierId: string;
  /** Previous price */
  oldPrice: number;
  /** New price */
  newPrice: number;
  /** Absolute price difference */
  absoluteChange: number;
  /** Percentage change */
  percentageChange: number;
  /** Date the change was detected */
  changeDate: Timestamp;
  /** Whether the change exceeds 10% threshold */
  isSignificant: boolean;
  /** Reference to the old pricelist */
  oldPricelistId: string;
  /** Reference to the new pricelist */
  newPricelistId: string;
}

/**
 * Inventory document stored in the 'inventory' collection
 * Document ID format: {sku}_{locationId}
 * 
 * Requirements: 8.1, 8.2
 */
export interface InventoryDoc {
  /** Document ID - composite key */
  inventoryId: string;
  /** Product SKU reference */
  sku: string;
  /** Location identifier */
  locationId: string;
  /** Current quantity available */
  quantityOnHand: number;
  /** Timestamp of last update */
  lastUpdated: Timestamp;
  /** Reference to the last transaction */
  lastTransactionId: string;
}

/**
 * Transaction types for inventory movements
 */
export type TransactionType = 'receiving' | 'sale' | 'adjustment' | 'void';

/**
 * Inventory transaction document stored in the 'inventory_transactions' collection
 * 
 * Requirements: 8.2, 8.3, 8.6
 */
export interface InventoryTransactionDoc {
  /** Document ID - unique transaction identifier */
  transactionId: string;
  /** Product SKU reference */
  sku: string;
  /** Location identifier */
  locationId: string;
  /** Type of transaction */
  transactionType: TransactionType;
  /** Quantity change (positive or negative) */
  quantityChange: number;
  /** Quantity before the transaction */
  quantityBefore: number;
  /** Quantity after the transaction */
  quantityAfter: number;
  /** Timestamp of the transaction */
  timestamp: Timestamp;
  /** User ID who performed the transaction */
  userId: string;
  /** Reference to related document (receiving ID or POS transaction ID) */
  referenceId?: string;
  /** Optional notes */
  notes?: string;
}

/**
 * Receiving line item for receiving records
 */
export interface ReceivingLineItem {
  /** Product SKU */
  sku: string;
  /** Quantity received */
  quantity: number;
  /** Location where received */
  locationId: string;
  /** Expected quantity (for variance detection) */
  expectedQuantity?: number;
}

/**
 * Document type for receiving operations
 */
export type ReceivingDocumentType = 'invoice' | 'delivery_receipt';

/**
 * Receiving record status
 */
export type ReceivingStatus = 'pending' | 'completed';

/**
 * Receiving record document stored in the 'receiving_records' collection
 * 
 * Requirements: 9.1, 9.2, 9.3
 */
export interface ReceivingRecordDoc {
  /** Document ID - unique receiving identifier */
  receivingId: string;
  /** Supplier ID reference */
  supplierId: string;
  /** Date goods were received */
  receivingDate: Timestamp;
  /** Type of document being processed */
  documentType: ReceivingDocumentType;
  /** Local file path (relative to uploads directory, optional) */
  documentFilePath?: string;
  /** Line items received */
  lineItems: ReceivingLineItem[];
  /** Status of the receiving record */
  status: ReceivingStatus;
  /** User ID who created the record */
  createdBy: string;
  /** Timestamp when created */
  createdAt: Timestamp;
  /** Timestamp when completed (optional) */
  completedAt?: Timestamp;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  /** Product code */
  productCode: string;
  /** Product description */
  description: string;
  /** Quantity invoiced */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Line total amount */
  lineTotal: number;
}

/**
 * Invoice document stored in the 'invoices' collection
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
export interface InvoiceDoc {
  /** Document ID - unique invoice identifier */
  invoiceId: string;
  /** Supplier ID reference */
  supplierId: string;
  /** Supplier's invoice number */
  invoiceNumber: string;
  /** Invoice date */
  invoiceDate: Timestamp;
  /** Local file path (relative to uploads directory) */
  filePath: string;
  /** Invoice line items */
  lineItems: InvoiceLineItem[];
  /** Total invoice amount */
  totalAmount: number;
  /** Reference to related receiving record (optional) */
  receivingId?: string;
  /** Whether variance was detected */
  hasVariance: boolean;
  /** Timestamp when processed */
  processedAt: Timestamp;
  /** User ID who uploaded the invoice */
  uploadedBy: string;
}

/**
 * POS line item
 */
export interface POSLineItem {
  /** Product SKU */
  sku: string;
  /** Product description */
  description: string;
  /** Quantity sold */
  quantity: number;
  /** Unit price at time of sale */
  unitPrice: number;
  /** Line total (quantity * unitPrice) */
  lineTotal: number;
}

/**
 * POS transaction status
 */
export type POSTransactionStatus = 'completed' | 'voided';

/**
 * Sync status for offline transactions
 */
export type SyncStatus = 'synced' | 'pending' | 'failed';

/**
 * POS transaction document stored in the 'pos_transactions' collection
 * 
 * Requirements: 13.1, 13.2, 13.5
 */
export interface POSTransactionDoc {
  /** Document ID - unique transaction identifier */
  transactionId: string;
  /** Transaction timestamp */
  timestamp: Timestamp;
  /** Transaction line items */
  lineItems: POSLineItem[];
  /** Subtotal before tax */
  subtotal: number;
  /** Tax amount */
  tax: number;
  /** Total amount */
  total: number;
  /** Payment method used */
  paymentMethod: PaymentMethod;
  /** User ID who processed the sale */
  userId: string;
  /** Transaction status */
  status: POSTransactionStatus;
  /** Timestamp when voided (optional) */
  voidedAt?: Timestamp;
  /** User ID who voided the transaction (optional) */
  voidedBy?: string;
  /** Sync status for offline support */
  syncStatus: SyncStatus;
}

/**
 * Price tier types
 */
export type PriceTier = 'standard' | 'wholesale' | 'vip';

/**
 * Pricing document stored in the 'pricing' collection
 * Document ID format: {sku}_{tier}
 * 
 * Requirements: 12.1, 12.2, 12.3
 */
export interface PricingDoc {
  /** Document ID - composite key */
  pricingId: string;
  /** Product SKU reference */
  sku: string;
  /** Price tier */
  priceTier: PriceTier;
  /** Retail price for this tier */
  retailPrice: number;
  /** Date the price becomes effective */
  effectiveDate: Timestamp;
  /** User ID who updated the price */
  updatedBy: string;
  /** Timestamp when updated */
  updatedAt: Timestamp;
}

/**
 * Report types
 */
export type ReportType = 'sales' | 'inventory' | 'supplier';

/**
 * Report configuration document stored in the 'report_configs' collection
 * 
 * Requirements: 15.6
 */
export interface ReportConfigDoc {
  /** Document ID - unique config identifier */
  configId: string;
  /** User ID who created the config */
  userId: string;
  /** Configuration name */
  name: string;
  /** Type of report */
  reportType: ReportType;
  /** Report-specific configuration object */
  config: any;
  /** Timestamp when created */
  createdAt: Timestamp;
  /** Timestamp when last used */
  lastUsed: Timestamp;
}

/**
 * Authentication event types
 */
export type AuthEventType = 
  | 'login_success' 
  | 'login_failure' 
  | 'logout' 
  | 'token_refresh' 
  | 'account_locked';

/**
 * Authentication log document stored in the 'auth_logs' collection
 * 
 * Logs all authentication attempts including successes and failures
 * with IP addresses and timestamps for security auditing.
 * 
 * Requirements: 19.5
 */
export interface AuthLogDoc {
  /** Document ID - unique log entry identifier */
  logId: string;
  /** Type of authentication event */
  eventType: AuthEventType;
  /** User email address */
  email: string;
  /** User ID (only present for successful events) */
  userId?: string;
  /** Client IP address */
  ipAddress: string;
  /** Client user agent string */
  userAgent?: string;
  /** Event timestamp */
  timestamp: Timestamp;
  /** Failure reason (only for failures) */
  failureReason?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Significant price change entry for dashboard metrics
 */
export interface SignificantChangeEntry {
  /** Price change document ID reference */
  changeId: string;
  /** Product SKU */
  sku: string;
  /** Supplier ID */
  supplierId: string;
  /** Previous price */
  oldPrice: number;
  /** New price */
  newPrice: number;
  /** Percentage change */
  percentageChange: number;
  /** Date the change was detected */
  changeDate: Timestamp;
}

/**
 * Price changes summary for dashboard metrics
 */
export interface PriceChangesSummary {
  /** Total count of significant price increases */
  count: number;
  /** Array of significant price change entries */
  changes: SignificantChangeEntry[];
}

/**
 * Dashboard metrics document stored in the 'dashboard_metrics' collection
 * Document ID format: YYYY-MM (e.g., "2024-01")
 * 
 * Aggregates monthly metrics for fast dashboard queries.
 * 
 * Requirements: 6.6
 */
export interface DashboardMetricsDoc {
  /** Document ID - month key (YYYY-MM) */
  metricId: string;
  /** Month key (YYYY-MM) */
  month: string;
  /** Summary of significant price increases for the month */
  significantPriceIncreases: PriceChangesSummary;
  /** Timestamp of last update */
  lastUpdated: Timestamp;
}

/**
 * Alert status types
 */
export type AlertStatus = 'active' | 'resolved';

/**
 * Low stock alert document stored in the 'low_stock_alerts' collection
 * Document ID format: {sku}_{locationId}
 * 
 * Tracks products that have fallen below their reorder points.
 * 
 * Requirements: 8.4
 */
export interface LowStockAlertDoc {
  /** Document ID - composite key */
  alertId: string;
  /** Product SKU reference */
  sku: string;
  /** Location identifier */
  locationId: string;
  /** Current quantity on hand */
  currentQuantity: number;
  /** Reorder point threshold */
  reorderPoint: number;
  /** Alert status */
  status: AlertStatus;
  /** Timestamp when alert was created */
  createdAt: Timestamp;
  /** Timestamp when alert was last updated */
  updatedAt: Timestamp;
  /** Timestamp when alert was resolved (optional) */
  resolvedAt?: Timestamp;
}
