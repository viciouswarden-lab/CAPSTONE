/**
 * Excel Parser for Supplier Pricelists
 * 
 * Extracts supplier product data from Excel files (.xls and .xlsx) and returns
 * structured PricelistData. Handles various Excel formats (with/without UOM column)
 * and provides descriptive error messages for malformed data.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import * as XLSX from 'xlsx';
import type { PricelistData, PricelistItem } from '../../types/models';

/**
 * Excel Parser error types for specific failure scenarios
 */
export class ExcelParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'ExcelParseError';
  }
}

/**
 * Excel column names expected in pricelist files (case-insensitive)
 */
const EXPECTED_COLUMNS = {
  SUPPLIER_CODE: ['supplier_code', 'suppliercode', 'code', 'product_code', 'productcode'],
  DESCRIPTION: ['description', 'product_description', 'productdescription', 'product', 'name'],
  PRICE: ['price', 'unit_price', 'unitprice', 'cost'],
  UOM: ['uom', 'unit', 'unit_of_measure', 'unitofmeasure', 'um'],
};

/**
 * Parse Excel pricelist file and extract product data
 * 
 * Supports both .xls and .xlsx formats. Reads the first worksheet by default.
 * 
 * @param file - Excel file to parse (.xls or .xlsx)
 * @param supplierId - ID of the supplier this pricelist belongs to
 * @returns Promise resolving to structured PricelistData
 * @throws ExcelParseError with descriptive message if parsing fails
 * 
 * Requirements 3.1, 3.2, 3.3
 */
export async function parseExcel(file: File, supplierId: string): Promise<PricelistData> {
  // Validate file is provided
  if (!file) {
    throw new ExcelParseError('No file provided for parsing');
  }

  // Validate supplierId
  if (!supplierId || supplierId.trim() === '') {
    throw new ExcelParseError('Supplier ID is required');
  }

  // Validate file extension
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
    throw new ExcelParseError(
      'Invalid file format',
      'File must have .xls or .xlsx extension'
    );
  }

  // Read file content as ArrayBuffer
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (error) {
    throw new ExcelParseError(
      'Failed to read file content',
      `File may be corrupted or in an unsupported format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate file is not empty
  if (arrayBuffer.byteLength === 0) {
    throw new ExcelParseError('File is empty', 'Excel file contains no data');
  }

  // Parse Excel workbook
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  } catch (error) {
    throw new ExcelParseError(
      'Failed to parse Excel file',
      `File may be corrupted or in an invalid Excel format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate workbook has sheets
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ExcelParseError(
      'No worksheets found in Excel file',
      'Excel file must contain at least one worksheet'
    );
  }

  // Get first worksheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new ExcelParseError(
      'Failed to read worksheet',
      `Worksheet "${firstSheetName}" could not be accessed`
    );
  }

  // Convert worksheet to array of arrays
  let rows: any[][];
  try {
    rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  } catch (error) {
    throw new ExcelParseError(
      'Failed to extract data from worksheet',
      `Error converting worksheet to data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Filter out completely empty rows
  rows = rows.filter(row => row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined));

  if (rows.length < 2) {
    throw new ExcelParseError(
      'Insufficient data in Excel file',
      'Excel file must contain at least a header row and one data row'
    );
  }

  // Parse header row
  const headers = rows[0].map((cell: any) => String(cell).trim());
  
  if (headers.length === 0 || headers.every(h => h === '')) {
    throw new ExcelParseError('Invalid Excel header', 'Header row is empty or malformed');
  }

  // Map column names to indices (case-insensitive matching)
  const columnIndices = mapColumnIndices(headers);

  // Validate required columns are present
  validateRequiredColumns(columnIndices);

  // Parse data rows
  const items: PricelistItem[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i + 1;
    const row = rows[i];

    try {
      const item = parseDataRow(row, columnIndices, rowNumber);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Row ${rowNumber}: ${errorMsg}`);
    }
  }

  // If all rows failed, throw error
  if (items.length === 0 && errors.length > 0) {
    throw new ExcelParseError(
      'Failed to parse any valid rows from Excel file',
      `Errors encountered:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
    );
  }

  // If some rows failed, we still return what we could parse
  // This matches requirement 3.3 - descriptive errors but also allows partial success
  if (errors.length > 0) {
    console.warn(`Excel parsing completed with ${errors.length} row errors:`, errors.slice(0, 10));
  }

  return {
    supplierId,
    uploadDate: new Date(),
    items,
  };
}

/**
 * Map Excel column names to their indices
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
 * Validate that required columns are present in the Excel file
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
    throw new ExcelParseError(
      `Missing required columns in Excel file: ${missing.join(', ')}`,
      `The following required columns were not found: ${missing.join(', ')}`
    );
  }
}

/**
 * Parse a single data row from the Excel worksheet
 */
function parseDataRow(
  row: any[],
  indices: ColumnIndices,
  rowNumber: number
): PricelistItem | null {
  // Skip empty rows
  if (row.every(cell => cell === '' || cell === null || cell === undefined)) {
    return null;
  }

  // Extract fields
  const supplierCode = String(row[indices.supplierCode] || '').trim();
  const description = String(row[indices.description] || '').trim();
  const priceValue = row[indices.price];
  const uom = indices.uom !== -1 ? String(row[indices.uom] || '').trim() : undefined;

  // Validate required fields
  if (!supplierCode) {
    throw new Error('Missing supplier code');
  }
  if (!description) {
    throw new Error('Missing description');
  }
  if (priceValue === '' || priceValue === null || priceValue === undefined) {
    throw new Error('Missing price');
  }

  // Parse and validate price
  const price = parsePrice(priceValue);
  if (price === null) {
    throw new Error(`Invalid price value: "${priceValue}"`);
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
 * Parse price value to number
 * Handles various formats: number, string with currency symbols, formatted numbers, etc.
 */
function parsePrice(priceValue: any): number | null {
  // If already a number, validate and return
  if (typeof priceValue === 'number') {
    if (isNaN(priceValue) || priceValue < 0) {
      return null;
    }
    // Round to 2 decimal places (requirement 21.6)
    return Math.round(priceValue * 100) / 100;
  }

  // Convert to string for parsing
  const priceStr = String(priceValue).trim();
  
  if (priceStr === '') {
    return null;
  }

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

  // Parse as float
  const price = parseFloat(cleaned);

  // Validate
  if (isNaN(price) || price < 0) {
    return null;
  }

  // Round to 2 decimal places (requirement 21.6)
  return Math.round(price * 100) / 100;
}
