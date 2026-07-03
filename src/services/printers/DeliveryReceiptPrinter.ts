/**
 * Delivery Receipt Pretty Printer
 * 
 * Converts structured DeliveryReceiptData back into formatted document string.
 * Ensures round-trip preservation when used with DeliveryReceiptParser.
 * 
 * Requirements: 11.6, 11.7
 */

import type { DeliveryReceiptData, DeliveryLineItem } from '../../types/models';

/**
 * Delivery receipt printer error types
 */
export class DeliveryReceiptPrintError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'DeliveryReceiptPrintError';
  }
}

/**
 * Print delivery receipt data to formatted CSV document string
 * 
 * Format:
 * - Header lines with supplier_name, delivery_date
 * - Blank line
 * - Column headers for line items
 * - Line item rows
 * 
 * @param data - Structured delivery receipt data
 * @returns Promise resolving to formatted delivery receipt document string
 * 
 * Requirements 11.6, 11.7
 */
export async function printDeliveryReceipt(data: DeliveryReceiptData): Promise<string> {
  // Validate input
  if (!data) {
    throw new DeliveryReceiptPrintError('No delivery receipt data provided');
  }
  
  if (!data.supplierName || data.supplierName.trim() === '') {
    throw new DeliveryReceiptPrintError('Missing required field: supplierName');
  }
  
  if (!data.deliveryDate) {
    throw new DeliveryReceiptPrintError('Missing required field: deliveryDate');
  }
  
  if (!data.lineItems || data.lineItems.length === 0) {
    throw new DeliveryReceiptPrintError('Delivery receipt must contain at least one line item');
  }
  
  // Build delivery receipt document
  const lines: string[] = [];
  
  // Header section
  lines.push(formatHeaderLine('supplier_name', escapeCSVValue(data.supplierName)));
  lines.push(formatHeaderLine('delivery_date', formatDate(data.deliveryDate)));
  lines.push(''); // Blank line after header
  
  // Line items table
  lines.push('product_code,description,quantity');
  
  for (const item of data.lineItems) {
    validateLineItem(item);
    lines.push(formatLineItem(item));
  }
  
  return lines.join('\n');
}

/**
 * Format a header line as "field_name,value" for CSV consistency
 */
function formatHeaderLine(fieldName: string, value: string): string {
  return `${fieldName},${value}`;
}

/**
 * Format date to ISO format (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new DeliveryReceiptPrintError('Invalid date value');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Validate a line item has all required fields
 */
function validateLineItem(item: DeliveryLineItem): void {
  if (!item.productCode || item.productCode.trim() === '') {
    throw new DeliveryReceiptPrintError('Line item missing required field: productCode');
  }
  
  if (!item.description || item.description.trim() === '') {
    throw new DeliveryReceiptPrintError('Line item missing required field: description');
  }
  
  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new DeliveryReceiptPrintError(`Invalid quantity for product ${item.productCode}: must be positive`);
  }
}

/**
 * Format a line item as CSV row
 */
function formatLineItem(item: DeliveryLineItem): string {
  const fields = [
    escapeCSVValue(item.productCode),
    escapeCSVValue(item.description),
    item.quantity.toString(),
  ];
  
  return fields.join(',');
}

/**
 * Escape CSV value by wrapping in quotes if needed
 * 
 * Quotes are needed if the value contains:
 * - Commas
 * - Double quotes
 * - Newlines
 * - Leading/trailing whitespace
 */
function escapeCSVValue(value: string): string {
  if (!value) return '""'; // Empty string should be quoted to preserve it
  
  // Check if escaping is needed
  const needsEscaping = 
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.trim() !== value;
  
  if (!needsEscaping) {
    return value;
  }
  
  // Escape double quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  
  // Wrap in double quotes
  return `"${escaped}"`;
}
