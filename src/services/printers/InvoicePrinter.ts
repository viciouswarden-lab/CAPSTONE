/**
 * Invoice Pretty Printer
 * 
 * Converts structured InvoiceData back into formatted document string.
 * Ensures round-trip preservation when used with InvoiceParser.
 * 
 * Requirements: 10.6, 10.7
 */

import type { InvoiceData, InvoiceLineItem } from '../../types/models';

/**
 * Invoice printer error types
 */
export class InvoicePrintError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'InvoicePrintError';
  }
}

/**
 * Print invoice data to formatted CSV document string
 * 
 * Format:
 * - Header lines with supplier_name, invoice_number, invoice_date
 * - Blank line
 * - Column headers for line items
 * - Line item rows
 * - Blank line
 * - Total line
 * 
 * @param data - Structured invoice data
 * @returns Promise resolving to formatted invoice document string
 * 
 * Requirements 10.6, 10.7
 */
export async function printInvoice(data: InvoiceData): Promise<string> {
  // Validate input
  if (!data) {
    throw new InvoicePrintError('No invoice data provided');
  }
  
  if (!data.supplierName || data.supplierName.trim() === '') {
    throw new InvoicePrintError('Missing required field: supplierName');
  }
  
  if (!data.invoiceNumber || data.invoiceNumber.trim() === '') {
    throw new InvoicePrintError('Missing required field: invoiceNumber');
  }
  
  if (!data.invoiceDate) {
    throw new InvoicePrintError('Missing required field: invoiceDate');
  }
  
  if (!data.lineItems || data.lineItems.length === 0) {
    throw new InvoicePrintError('Invoice must contain at least one line item');
  }
  
  if (typeof data.totalAmount !== 'number' || data.totalAmount < 0) {
    throw new InvoicePrintError('Invalid totalAmount: must be a non-negative number');
  }
  
  // Build invoice document
  const lines: string[] = [];
  
  // Header section
  lines.push(formatHeaderLine('supplier_name', escapeCSVValue(data.supplierName)));
  lines.push(formatHeaderLine('invoice_number', escapeCSVValue(data.invoiceNumber)));
  lines.push(formatHeaderLine('invoice_date', formatDate(data.invoiceDate)));
  lines.push(''); // Blank line after header
  
  // Line items table
  lines.push('product_code,description,quantity,unit_price,line_total');
  
  for (const item of data.lineItems) {
    validateLineItem(item);
    lines.push(formatLineItem(item));
  }
  
  lines.push(''); // Blank line before total
  
  // Total line
  lines.push(formatHeaderLine('total_amount', formatPrice(data.totalAmount)));
  
  return lines.join('\n');
}

/**
 * Format a header line as "field_name: value" or "field_name,value" for CSV
 */
function formatHeaderLine(fieldName: string, value: string): string {
  // Use comma-separated format for consistency with line items
  return `${fieldName},${value}`;
}

/**
 * Format date to ISO format (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new InvoicePrintError('Invalid date value');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format price to 2 decimal places
 */
function formatPrice(price: number): string {
  if (typeof price !== 'number' || isNaN(price) || price < 0) {
    throw new InvoicePrintError(`Invalid price value: ${price}`);
  }
  
  return price.toFixed(2);
}

/**
 * Validate a line item has all required fields
 */
function validateLineItem(item: InvoiceLineItem): void {
  if (!item.productCode || item.productCode.trim() === '') {
    throw new InvoicePrintError('Line item missing required field: productCode');
  }
  
  if (!item.description || item.description.trim() === '') {
    throw new InvoicePrintError('Line item missing required field: description');
  }
  
  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new InvoicePrintError(`Invalid quantity for product ${item.productCode}: must be positive`);
  }
  
  if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
    throw new InvoicePrintError(`Invalid unitPrice for product ${item.productCode}: must be non-negative`);
  }
  
  if (typeof item.lineTotal !== 'number' || item.lineTotal < 0) {
    throw new InvoicePrintError(`Invalid lineTotal for product ${item.productCode}: must be non-negative`);
  }
}

/**
 * Format a line item as CSV row
 */
function formatLineItem(item: InvoiceLineItem): string {
  const fields = [
    escapeCSVValue(item.productCode),
    escapeCSVValue(item.description),
    item.quantity.toString(),
    formatPrice(item.unitPrice),
    formatPrice(item.lineTotal),
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
