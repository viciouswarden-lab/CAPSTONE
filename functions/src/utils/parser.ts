/**
 * Pricelist Parser Utilities for Cloud Functions
 * 
 * Provides file format detection and parsing logic for pricelists.
 * These are simplified versions adapted for the Cloud Functions environment.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

/**
 * Pricelist item structure
 */
export interface PricelistItem {
  supplierCode: string;
  description: string;
  price: number;
  uom?: string;
}

/**
 * Pricelist data structure
 */
export interface PricelistData {
  supplierId: string;
  uploadDate: Date;
  items: PricelistItem[];
}

/**
 * Parser error class
 */
export class ParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Detect file format from filename or content
 */
export function detectFormat(filename: string): 'csv' | 'excel' | 'pdf' | 'unknown' {
  const lower = filename.toLowerCase();
  
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'excel';
  if (lower.endsWith('.pdf')) return 'pdf';
  
  return 'unknown';
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
 * Parse CSV content into structured pricelist data
 */
export function parseCSVContent(content: string, supplierId: string): PricelistData {
  if (!content || content.trim() === '') {
    throw new ParseError('File is empty', 'CSV file contains no data');
  }

  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new ParseError(
      'Insufficient data in CSV file',
      'CSV file must contain at least a header row and one data row'
    );
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  if (headers.length === 0) {
    throw new ParseError('Invalid CSV header', 'Header row is empty or malformed');
  }

  // Map column names to indices
  const columnIndices = mapColumnIndices(headers);

  // Validate required columns
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
    throw new ParseError(
      'Failed to parse any valid rows from CSV file',
      `Errors encountered:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
    );
  }

  return {
    supplierId,
    uploadDate: new Date(),
    items,
  };
}

/**
 * Parse Excel content (placeholder - requires xlsx library)
 */
export function parseExcelContent(buffer: Buffer, supplierId: string): PricelistData {
  // For now, throw error as Excel parsing requires additional dependencies
  // This can be implemented when xlsx is added to functions package.json
  throw new ParseError(
    'Excel parsing not yet implemented in Cloud Functions',
    'Please upload CSV files for automatic processing'
  );
}

/**
 * Parse PDF content (placeholder - requires pdf parsing library)
 */
export function parsePDFContent(buffer: Buffer, supplierId: string): PricelistData {
  // For now, throw error as PDF parsing requires additional dependencies
  // This can be implemented when pdfjs-dist is added to functions package.json
  throw new ParseError(
    'PDF parsing not yet implemented in Cloud Functions',
    'Please upload CSV files for automatic processing'
  );
}

/**
 * Parse a single CSV line, handling quoted fields with commas
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
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
        wasQuoted = true;
      }
    } else if (char === ',' && !insideQuotes) {
      fields.push(wasQuoted ? currentField : currentField.trim());
      currentField = '';
      wasQuoted = false;
    } else {
      currentField += char;
    }
  }

  fields.push(wasQuoted ? currentField : currentField.trim());

  return fields;
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
 * Map CSV column names to their indices
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
 * Validate that required columns are present
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
    throw new ParseError(
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

  const item: PricelistItem = {
    supplierCode,
    description,
    price,
  };

  if (uom && uom !== '') {
    item.uom = uom;
  }

  return item;
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string): number | null {
  let cleaned = priceStr.replace(/[$€£¥\s]/g, '');

  // Handle thousands separators
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const price = parseFloat(cleaned);

  if (isNaN(price) || price < 0) {
    return null;
  }

  return Math.round(price * 100) / 100;
}
