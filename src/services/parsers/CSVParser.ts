/**
 * CSV Parser for Supplier Pricelists
 * 
 * Extracts supplier product data from CSV files and returns structured PricelistData.
 * Handles various CSV formats (with/without UOM column) and provides descriptive
 * error messages for malformed data.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import type { PricelistData, PricelistItem } from '../../types/models';

/**
 * CSV Parser error types for specific failure scenarios
 */
export class CSVParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'CSVParseError';
  }
}

/**
 * CSV column names expected in pricelist files (case-insensitive)
 */
const EXPECTED_COLUMNS = {
  SUPPLIER_CODE: ['supplier_code', 'suppliercode', 'code', 'product_code', 'productcode'],
  DESCRIPTION: ['description', 'product_description', 'productdescription', 'product', 'name'],
  PRICE: ['price', 'unit_price', 'unitprice', 'cost'],
  UOM: ['uom', 'unit', 'unit_of_measure', 'unitofmeasure', 'um'],
};

/**
 * Parse CSV pricelist file and extract product data
 * 
 * @param file - CSV file to parse
 * @param supplierId - ID of the supplier this pricelist belongs to
 * @returns Promise resolving to structured PricelistData
 * @throws CSVParseError with descriptive message if parsing fails
 * 
 * Requirements 3.1, 3.2, 3.3
 */
export async function parseCSV(file: File, supplierId: string): Promise<PricelistData> {
  // Validate file is provided
  if (!file) {
    throw new CSVParseError('No file provided for parsing');
  }

  // Validate supplierId
  if (!supplierId || supplierId.trim() === '') {
    throw new CSVParseError('Supplier ID is required');
  }

  // Read file content
  let content: string;
  try {
    content = await file.text();
  } catch (error) {
    throw new CSVParseError(
      'Failed to read file content',
      `File may be corrupted or in an unsupported encoding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate file is not empty
  if (!content || content.trim() === '') {
    throw new CSVParseError('File is empty', 'CSV file contains no data');
  }

  // Parse CSV content
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new CSVParseError(
      'Insufficient data in CSV file',
      'CSV file must contain at least a header row and one data row'
    );
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  if (headers.length === 0) {
    throw new CSVParseError('Invalid CSV header', 'Header row is empty or malformed');
  }

  // Map column names to indices (case-insensitive matching)
  const columnIndices = mapColumnIndices(headers);

  // Validate required columns are present
  validateRequiredColumns(columnIndices);

  // Parse data rows
  const items: PricelistItem[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    try {
      const item = parseDataRow(line, columnIndices, lineNumber);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Row ${lineNumber}: ${errorMsg}`);
    }
  }

  // If all rows failed, throw error
  if (items.length === 0 && errors.length > 0) {
    throw new CSVParseError(
      'Failed to parse any valid rows from CSV file',
      `Errors encountered:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
    );
  }

  // If some rows failed, we still return what we could parse
  // This matches requirement 3.3 - descriptive errors but also allows partial success
  if (errors.length > 0) {
    console.warn(`CSV parsing completed with ${errors.length} row errors:`, errors.slice(0, 10));
  }

  return {
    supplierId,
    uploadDate: new Date(),
    items,
  };
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 * Preserves whitespace inside quoted fields, trims unquoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let wasQuoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        wasQuoted = true;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field - trim only if it was not quoted
      fields.push(wasQuoted ? currentField : currentField.trim());
      currentField = '';
      wasQuoted = false;
    } else {
      currentField += char;
    }
  }

  // Add last field - trim only if it was not quoted
  fields.push(wasQuoted ? currentField : currentField.trim());

  return fields;
}

/**
 * Map CSV column names to their indices
 * Uses case-insensitive matching with multiple possible column name variations
 */
function mapColumnIndices(headers: string[]): ColumnIndices {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  const findColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = normalizedHeaders.indexOf(name);
      if (index !== -1) return index;
    }
    return -1;
  };

  return {
    supplierCode: findColumnIndex(EXPECTED_COLUMNS.SUPPLIER_CODE),
    description: findColumnIndex(EXPECTED_COLUMNS.DESCRIPTION),
    price: findColumnIndex(EXPECTED_COLUMNS.PRICE),
    uom: findColumnIndex(EXPECTED_COLUMNS.UOM),
  };
}

/**
 * Column index mapping
 */
interface ColumnIndices {
  supplierCode: number;
  description: number;
  price: number;
  uom: number;
}

/**
 * Validate that required columns are present in the CSV
 */
function validateRequiredColumns(indices: ColumnIndices): void {
  const missing: string[] = [];

  if (indices.supplierCode === -1) {
    missing.push('supplier_code (or equivalent: code, product_code)');
  }
  if (indices.description === -1) {
    missing.push('description (or equivalent: product_description, product, name)');
  }
  if (indices.price === -1) {
    missing.push('price (or equivalent: unit_price, cost)');
  }

  if (missing.length > 0) {
    throw new CSVParseError(
      `Missing required columns in CSV file: ${missing.join(', ')}`,
      `The following required columns were not found: ${missing.join(', ')}`
    );
  }
}

/**
 * Parse a single data row from the CSV
 */
function parseDataRow(
  line: string,
  indices: ColumnIndices,
  lineNumber: number
): PricelistItem | null {
  const fields = parseCSVLine(line);

  // Skip empty rows
  if (fields.every(f => f.trim() === '')) {
    return null;
  }

  // Extract fields - only trim values that weren't already quoted
  const supplierCode = (fields[indices.supplierCode] || '').trim();
  const description = fields[indices.description] || '';
  const priceStr = (fields[indices.price] || '').trim();
  const uom = indices.uom !== -1 ? (fields[indices.uom] || '').trim() : undefined;

  // Validate required fields
  if (!supplierCode) {
    throw new Error('Missing supplier code');
  }
  if (!description || description.trim() === '') {
    throw new Error('Missing description');
  }
  if (!priceStr) {
    throw new Error('Missing price');
  }

  // Parse and validate price
  const price = parsePrice(priceStr);
  if (price === null) {
    throw new Error(`Invalid price value: "${priceStr}"`);
  }

  // Build item
  const item: PricelistItem = {
    supplierCode,
    description,
    price,
  };

  // Add UOM if present and non-empty
  if (uom && uom !== '') {
    item.uom = uom;
  }

  return item;
}

/**
 * Parse price string to number
 * Handles various formats: "123.45", "$123.45", "123,456.78", etc.
 */
function parsePrice(priceStr: string): number | null {
  // Remove currency symbols and spaces (but keep commas for now to check format)
  let cleaned = priceStr.replace(/[$€£¥\s]/g, '');

  // Check if commas are used as thousands separators (e.g., "1,234.56")
  // Pattern: digits, comma, 3 digits (repeating), optional decimal
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    // Remove commas (thousands separators)
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // If commas don't match thousands separator pattern, just remove them
    cleaned = cleaned.replace(/,/g, '');
  }

  // Check that cleaned string contains only valid numeric characters
  // Valid: digits, optional single decimal point, optional leading minus
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  // Parse as float
  const price = parseFloat(cleaned);

  // Validate
  if (isNaN(price) || price < 0) {
    return null;
  }

  // Round to 2 decimal places (requirement 21.6)
  return Math.round(price * 100) / 100;
}
