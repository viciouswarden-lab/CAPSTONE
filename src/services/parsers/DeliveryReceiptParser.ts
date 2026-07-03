/**
 * Delivery Receipt Parser
 * 
 * Extracts delivery receipt data from supplier documents and returns structured DeliveryReceiptData.
 * Delegates to format-specific parsers (CSV, Excel, PDF) and transforms the output
 * to delivery receipt structure with validation.
 * 
 * Requirements: 11.1, 11.2
 */

import type { DeliveryReceiptData, DeliveryLineItem, DocumentFormat } from '../../types/models';

/**
 * Delivery Receipt Parser error types for specific failure scenarios
 */
export class DeliveryReceiptParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'DeliveryReceiptParseError';
  }
}

/**
 * Expected column names for delivery receipt parsing (case-insensitive)
 */
const DELIVERY_RECEIPT_COLUMNS = {
  SUPPLIER_NAME: ['supplier_name', 'supplier', 'vendor', 'vendor_name'],
  DELIVERY_DATE: ['delivery_date', 'date', 'deliverydate', 'received_date', 'receipt_date'],
  PRODUCT_CODE: ['product_code', 'productcode', 'code', 'sku', 'item_code'],
  DESCRIPTION: ['description', 'product_description', 'productdescription', 'product', 'item'],
  QUANTITY: ['quantity', 'qty', 'amount', 'units', 'received_qty'],
};

/**
 * Parse delivery receipt file and extract delivery receipt data
 * 
 * Supports CSV, Excel (.xls, .xlsx), and PDF formats.
 * 
 * @param file - Delivery receipt file to parse
 * @returns Promise resolving to structured DeliveryReceiptData
 * @throws DeliveryReceiptParseError with descriptive message if parsing fails
 * 
 * Requirements 11.1, 11.2
 */
export async function parseDeliveryReceipt(file: File): Promise<DeliveryReceiptData> {
  // Validate file is provided
  if (!file) {
    throw new DeliveryReceiptParseError('No file provided for parsing');
  }

  // Detect format from file extension
  const format = detectFormat(file);

  // Read file content based on format
  let content: string;
  try {
    if (format === 'pdf') {
      content = await extractPDFText(file);
    } else if (format === 'excel') {
      content = await extractExcelText(file);
    } else {
      content = await file.text();
    }
  } catch (error) {
    throw new DeliveryReceiptParseError(
      'Failed to read file content',
      `File may be corrupted or in an unsupported format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate content is not empty
  if (!content || content.trim() === '') {
    throw new DeliveryReceiptParseError('File is empty', 'Delivery receipt file contains no data');
  }

  // Parse delivery receipt data from content
  try {
    return parseDeliveryReceiptContent(content, format);
  } catch (error) {
    if (error instanceof DeliveryReceiptParseError) {
      throw error;
    }
    throw new DeliveryReceiptParseError(
      'Failed to parse delivery receipt data',
      `Error processing delivery receipt content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Detect document format from file extension
 */
function detectFormat(file: File): DocumentFormat {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.pdf')) {
    return 'pdf';
  } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
    return 'excel';
  } else if (fileName.endsWith('.csv')) {
    return 'csv';
  } else {
    throw new DeliveryReceiptParseError(
      'Unsupported file format',
      'Delivery receipt must be in CSV, Excel (.xls, .xlsx), or PDF format'
    );
  }
}

/**
 * Extract text content from PDF file
 */
async function extractPDFText(file: File): Promise<string> {
  // Use legacy build for Node.js compatibility
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  let allText = '';
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    allText += pageText + '\n';
  }
  
  return allText;
}

/**
 * Extract text content from Excel file
 */
async function extractExcelText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to CSV format for unified parsing
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Parse delivery receipt content and extract structured data
 */
function parseDeliveryReceiptContent(content: string, format: DocumentFormat): DeliveryReceiptData {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 3) {
    throw new DeliveryReceiptParseError(
      'Insufficient data in delivery receipt file',
      'Delivery receipt file must contain header information and at least one line item'
    );
  }

  // Extract header information (supplier, delivery date)
  const headerData = extractHeaderData(lines);
  
  // Find line items table
  const { headerIndex, columnIndices } = findLineItemsTable(lines);
  
  // Parse line items
  const lineItems = parseLineItems(lines, headerIndex, columnIndices);
  
  if (lineItems.length === 0) {
    throw new DeliveryReceiptParseError(
      'No line items found in delivery receipt',
      'Delivery receipt must contain at least one product line item'
    );
  }
  
  return {
    supplierName: headerData.supplierName,
    deliveryDate: headerData.deliveryDate,
    lineItems,
  };
}

/**
 * Extract header data (supplier name, delivery date)
 */
interface HeaderData {
  supplierName: string;
  deliveryDate: Date;
}

function extractHeaderData(lines: string[]): HeaderData {
  let supplierName: string | null = null;
  let deliveryDate: Date | null = null;

  // Search first 15 lines for header information
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].toLowerCase();
    
    // Extract supplier name (check longest matches first to avoid partial matches)
    if (!supplierName) {
      for (const col of DELIVERY_RECEIPT_COLUMNS.SUPPLIER_NAME) {
        if (line.includes(col) && !line.includes('supplier_code')) {
          supplierName = extractFieldValue(lines[i], col);
          break;
        }
      }
    }
    
    // Extract delivery date
    if (!deliveryDate) {
      for (const col of DELIVERY_RECEIPT_COLUMNS.DELIVERY_DATE) {
        if (line.includes(col)) {
          const dateStr = extractFieldValue(lines[i], col);
          deliveryDate = parseDate(dateStr);
          break;
        }
      }
    }
    
    // Stop if we found everything
    if (supplierName && deliveryDate) {
      break;
    }
  }
  
  // Validate required fields
  const missing: string[] = [];
  if (!supplierName) missing.push('supplier name');
  if (!deliveryDate) missing.push('delivery date');
  
  if (missing.length > 0) {
    throw new DeliveryReceiptParseError(
      `Missing required delivery receipt fields: ${missing.join(', ')}`,
      `Could not extract: ${missing.join(', ')}`
    );
  }

  return {
    supplierName: supplierName!,
    deliveryDate: deliveryDate!,
  };
}

/**
 * Extract field value from a line containing "field_name: value" or "field_name,value"
 */
function extractFieldValue(line: string, fieldName: string): string {
  const lowerLine = line.toLowerCase();
  const index = lowerLine.indexOf(fieldName);
  
  if (index === -1) return '';
  
  // Find the value after the field name
  let valueStart = index + fieldName.length;
  
  // Skip separators (colon, comma, equals, spaces)
  while (valueStart < line.length && /[:,=\s]/.test(line[valueStart])) {
    valueStart++;
  }
  
  // Extract until end of line or next comma (for CSV format)
  let valueEnd = line.indexOf(',', valueStart);
  if (valueEnd === -1) {
    valueEnd = line.length;
  }
  
  return line.substring(valueStart, valueEnd).trim();
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(dateStr);
  }
  
  // Try MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try parsing as is
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

/**
 * Find the line items table in the delivery receipt
 */
interface TableLocation {
  headerIndex: number;
  columnIndices: ColumnIndices;
}

interface ColumnIndices {
  productCode: number;
  description: number;
  quantity: number;
}

function findLineItemsTable(lines: string[]): TableLocation {
  // Look for table header row containing product/item columns
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    const tokens = tokenizeLine(line);
    const normalizedTokens = tokens.map(t => t.toLowerCase().trim());
    
    // Check if this line contains line item headers
    const hasProductCode = DELIVERY_RECEIPT_COLUMNS.PRODUCT_CODE.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    const hasDescription = DELIVERY_RECEIPT_COLUMNS.DESCRIPTION.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    const hasQuantity = DELIVERY_RECEIPT_COLUMNS.QUANTITY.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    
    if (hasProductCode && hasDescription && hasQuantity) {
      // Map columns
      const columnIndices = mapColumnIndices(tokens);
      validateRequiredColumns(columnIndices);
      
      return {
        headerIndex: i,
        columnIndices,
      };
    }
  }
  
  throw new DeliveryReceiptParseError(
    'Could not identify line items table in delivery receipt',
    'Delivery receipt must contain table headers: product_code, description, quantity'
  );
}

/**
 * Tokenize a line into fields (handles CSV, space-separated, tab-separated)
 */
function tokenizeLine(line: string): string[] {
  const trimmed = line.trim();
  
  // If line contains commas, parse as CSV
  if (trimmed.includes(',')) {
    return parseCSVLine(trimmed);
  }
  
  // If line contains tabs, split by tabs
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map(t => t.trim()).filter(t => t !== '');
  }
  
  // Split by multiple spaces (2 or more)
  const tokens = trimmed.split(/\s{2,}/).map(t => t.trim()).filter(t => t !== '');
  
  // If we got very few tokens, try splitting by single space
  if (tokens.length < 3) {
    return trimmed.split(/\s+/).map(t => t.trim()).filter(t => t !== '');
  }
  
  return tokens;
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 * Preserves whitespace within quoted fields, trims unquoted fields
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
        // Escaped quote within quoted field
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        wasQuoted = true;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field - trim only if it wasn't quoted
      fields.push(wasQuoted ? currentField : currentField.trim());
      currentField = '';
      wasQuoted = false;
    } else {
      currentField += char;
    }
  }

  // Push last field - trim only if it wasn't quoted
  fields.push(wasQuoted ? currentField : currentField.trim());
  return fields;
}

/**
 * Map column names to their indices
 */
function mapColumnIndices(headers: string[]): ColumnIndices {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  const findColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = normalizedHeaders.indexOf(name);
      if (index !== -1) return index;
    }
    // Try partial match
    for (const name of possibleNames) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (header.includes(name) && name.length > 3) {
          return i;
        }
      }
    }
    return -1;
  };

  return {
    productCode: findColumnIndex(DELIVERY_RECEIPT_COLUMNS.PRODUCT_CODE),
    description: findColumnIndex(DELIVERY_RECEIPT_COLUMNS.DESCRIPTION),
    quantity: findColumnIndex(DELIVERY_RECEIPT_COLUMNS.QUANTITY),
  };
}

/**
 * Validate that required columns are present
 */
function validateRequiredColumns(indices: ColumnIndices): void {
  const missing: string[] = [];

  if (indices.productCode === -1) {
    missing.push('product_code (or equivalent: sku, code, item_code)');
  }
  if (indices.description === -1) {
    missing.push('description (or equivalent: product_description, item)');
  }
  if (indices.quantity === -1) {
    missing.push('quantity (or equivalent: qty, units, received_qty)');
  }

  if (missing.length > 0) {
    throw new DeliveryReceiptParseError(
      `Missing required columns in delivery receipt: ${missing.join(', ')}`,
      `The following required columns were not found: ${missing.join(', ')}`
    );
  }
}

/**
 * Parse line items from the delivery receipt
 */
function parseLineItems(
  lines: string[],
  headerIndex: number,
  columnIndices: ColumnIndices
): DeliveryLineItem[] {
  const items: DeliveryLineItem[] = [];
  const errors: string[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    // Stop if we hit a footer
    if (isFooterLine(line)) {
      break;
    }

    try {
      const item = parseLineItem(line, columnIndices, lineNumber);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Line ${lineNumber}: ${errorMsg}`);
    }
  }

  // If we got some items, return them even if some rows failed
  if (items.length > 0 && errors.length > 0) {
    console.warn(`Delivery receipt parsing completed with ${errors.length} row errors:`, errors.slice(0, 10));
  }

  return items;
}

/**
 * Check if a line is a footer line (notes, signatures, etc.)
 */
function isFooterLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return (
    lowerLine.includes('total') ||
    lowerLine.includes('subtotal') ||
    lowerLine.includes('thank you') ||
    lowerLine.includes('notes') ||
    lowerLine.includes('terms') ||
    lowerLine.includes('signature') ||
    lowerLine.includes('received by') ||
    lowerLine.includes('authorized')
  );
}

/**
 * Parse a single line item
 */
function parseLineItem(
  line: string,
  indices: ColumnIndices,
  lineNumber: number
): DeliveryLineItem | null {
  const tokens = tokenizeLine(line);

  // Skip empty rows
  if (tokens.length === 0 || tokens.every(t => t === '')) {
    return null;
  }

  // Check if we have enough tokens
  const maxIndex = Math.max(
    indices.productCode,
    indices.description,
    indices.quantity
  );

  if (tokens.length <= maxIndex) {
    return null;
  }

  // Extract fields - check that indices are valid
  if (indices.productCode < 0 || indices.productCode >= tokens.length) {
    throw new Error('Product code column not found or out of range');
  }
  if (indices.description < 0 || indices.description >= tokens.length) {
    throw new Error('Description column not found or out of range');
  }
  if (indices.quantity < 0 || indices.quantity >= tokens.length) {
    throw new Error('Quantity column not found or out of range');
  }

  // Don't trim - the CSV parser already handles quoted fields properly
  // Trimming here would lose intentional leading/trailing spaces
  const productCode = tokens[indices.productCode] || '';
  const description = tokens[indices.description] || '';
  const quantityStr = tokens[indices.quantity] || '';

  // Validate required fields
  if (!productCode) {
    throw new Error('Missing product code');
  }
  if (!description) {
    throw new Error('Missing description');
  }
  if (!quantityStr) {
    throw new Error('Missing quantity');
  }

  // Parse numeric values
  const quantity = parseNumber(quantityStr);
  if (quantity === null || quantity <= 0) {
    throw new Error(`Invalid quantity: "${quantityStr}"`);
  }

  return {
    productCode,
    description,
    quantity,
  };
}

/**
 * Parse a number from string (handles integers and decimals)
 */
function parseNumber(value: string): number | null {
  if (!value) return null;

  // Remove commas and spaces
  const cleaned = value.replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) return null;
  return num;
}
