/**
 * CSV Pretty Printer for Pricelists
 * 
 * Converts PricelistData structures back into valid CSV format strings.
 * Ensures round-trip preservation: parse → print → parse produces equivalent structure.
 * 
 * Requirements: 3.6, 3.7
 */

import type { PricelistData, PricelistItem } from '../../types/models';

/**
 * CSV Printer error types for formatting failures
 */
export class CSVPrintError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'CSVPrintError';
  }
}

/**
 * Convert PricelistData to CSV format string
 * 
 * @param data - Structured pricelist data
 * @returns CSV-formatted string with header and data rows
 * @throws CSVPrintError if data is invalid
 * 
 * Requirements 3.6, 3.7
 */
export async function printPricelistCSV(data: PricelistData): Promise<string> {
  // Validate input
  if (!data) {
    throw new CSVPrintError('No pricelist data provided');
  }

  if (!data.items || !Array.isArray(data.items)) {
    throw new CSVPrintError('Invalid pricelist data: items array is required');
  }

  if (data.items.length === 0) {
    throw new CSVPrintError('Pricelist data contains no items');
  }

  // Determine if any items have UOM field
  const hasUOM = data.items.some(item => item.uom !== undefined && item.uom !== null && item.uom !== '');

  // Build header row
  const headers = hasUOM 
    ? ['supplier_code', 'description', 'price', 'uom']
    : ['supplier_code', 'description', 'price'];

  const csvLines: string[] = [headers.join(',')];

  // Build data rows
  for (const item of data.items) {
    try {
      const row = formatCSVRow(item, hasUOM);
      csvLines.push(row);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new CSVPrintError(
        `Failed to format item with code "${item.supplierCode}"`,
        errorMsg
      );
    }
  }

  // Join lines with newline
  return csvLines.join('\n');
}

/**
 * Format a single PricelistItem as a CSV row
 */
function formatCSVRow(item: PricelistItem, includeUOM: boolean): string {
  // Validate required fields
  if (!item.supplierCode || item.supplierCode.trim() === '') {
    throw new Error('Missing supplier code');
  }
  if (!item.description || item.description.trim() === '') {
    throw new Error('Missing description');
  }
  if (item.price === undefined || item.price === null || isNaN(item.price)) {
    throw new Error('Missing or invalid price');
  }
  if (item.price < 0) {
    throw new Error('Price cannot be negative');
  }

  // Format fields with proper CSV escaping
  const supplierCode = escapeCSVField(item.supplierCode);
  const description = escapeCSVField(item.description);
  const price = formatPrice(item.price);

  if (includeUOM) {
    const uom = item.uom ? escapeCSVField(item.uom) : '';
    return `${supplierCode},${description},${price},${uom}`;
  } else {
    return `${supplierCode},${description},${price}`;
  }
}

/**
 * Escape a CSV field value
 * Wraps in quotes if it contains commas, quotes, newlines, or leading/trailing whitespace
 */
function escapeCSVField(value: string): string {
  // If field contains comma, quote, newline, or has leading/trailing whitespace, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r') || value !== value.trim()) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Format price value to string with 2 decimal places
 */
function formatPrice(price: number): string {
  // Round to 2 decimal places and format
  return price.toFixed(2);
}
