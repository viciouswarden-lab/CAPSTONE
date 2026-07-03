/**
 * Invoice Parser
 * 
 * Extracts invoice data from supplier documents and returns structured InvoiceData.
 * Delegates to format-specific parsers (CSV, Excel, PDF) and transforms the output
 * to invoice structure with validation.
 * 
 * Requirements: 10.1, 10.2
 */

import type { InvoiceData, InvoiceLineItem, DocumentFormat } from '../../types/models';
import { parseCSV, CSVParseError } from './CSVParser';
import { parseExcel, ExcelParseError } from './ExcelParser';
import { parsePDF, PDFParseError } from './PDFParser';

/**
 * Invoice Parser error types for specific failure scenarios
 */
export class InvoiceParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'InvoiceParseError';
  }
}

/**
 * Expected column names for invoice parsing (case-insensitive)
 */
const INVOICE_COLUMNS = {
  SUPPLIER_NAME: ['supplier_name', 'supplier', 'vendor', 'vendor_name'],
  INVOICE_NUMBER: ['invoice_number', 'invoice_no', 'invoicenumber', 'invoice', 'invoice_id'],
  INVOICE_DATE: ['invoice_date', 'date', 'invoicedate', 'issued_date'],
  PRODUCT_CODE: ['product_code', 'productcode', 'code', 'sku', 'item_code'],
  DESCRIPTION: ['description', 'product_description', 'productdescription', 'product', 'item'],
  QUANTITY: ['quantity', 'qty', 'amount', 'units'],
  UNIT_PRICE: ['unit_price', 'unitprice', 'price', 'cost', 'rate'],
  LINE_TOTAL: ['line_total', 'linetotal', 'total', 'amount', 'extended'],
  TOTAL_AMOUNT: ['total_amount', 'totalamount', 'invoice_total', 'grand_total', 'total'],
};

/**
 * Parse invoice file and extract invoice data
 * 
 * Supports CSV, Excel (.xls, .xlsx), and PDF formats.
 * 
 * @param file - Invoice file to parse
 * @returns Promise resolving to structured InvoiceData
 * @throws InvoiceParseError with descriptive message if parsing fails
 * 
 * Requirements 10.1, 10.2
 */
export async function parseInvoice(file: File): Promise<InvoiceData> {
  // Validate file is provided
  if (!file) {
    throw new InvoiceParseError('No file provided for parsing');
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
    throw new InvoiceParseError(
      'Failed to read file content',
      `File may be corrupted or in an unsupported format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate content is not empty
  if (!content || content.trim() === '') {
    throw new InvoiceParseError('File is empty', 'Invoice file contains no data');
  }

  // Parse invoice data from content
  try {
    return parseInvoiceContent(content, format);
  } catch (error) {
    if (error instanceof InvoiceParseError) {
      throw error;
    }
    throw new InvoiceParseError(
      'Failed to parse invoice data',
      `Error processing invoice content: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    throw new InvoiceParseError(
      'Unsupported file format',
      'Invoice must be in CSV, Excel (.xls, .xlsx), or PDF format'
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
 * Parse invoice content and extract structured data
 */
function parseInvoiceContent(content: string, format: DocumentFormat): InvoiceData {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 3) {
    throw new InvoiceParseError(
      'Insufficient data in invoice file',
      'Invoice file must contain header information and at least one line item'
    );
  }

  // Extract header information (supplier, invoice number, date)
  const headerData = extractHeaderData(lines);
  
  // Find line items table
  const { headerIndex, columnIndices } = findLineItemsTable(lines);
  
  // Parse line items
  const lineItems = parseLineItems(lines, headerIndex, columnIndices);
  
  if (lineItems.length === 0) {
    throw new InvoiceParseError(
      'No line items found in invoice',
      'Invoice must contain at least one product line item'
    );
  }
  
  // Calculate total from line items
  const calculatedTotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const roundedTotal = Math.round(calculatedTotal * 100) / 100;
  
  // Try to extract total from document for validation
  const documentTotal = extractTotalAmount(lines);
  
  // Validate totals match (within 1 cent tolerance for rounding)
  if (documentTotal !== null && Math.abs(roundedTotal - documentTotal) > 0.01) {
    throw new InvoiceParseError(
      'Invoice total validation failed',
      `Calculated total ($${roundedTotal.toFixed(2)}) does not match document total ($${documentTotal.toFixed(2)})`
    );
  }
  
  return {
    supplierName: headerData.supplierName,
    invoiceNumber: headerData.invoiceNumber,
    invoiceDate: headerData.invoiceDate,
    lineItems,
    totalAmount: roundedTotal,
  };
}

/**
 * Extract header data (supplier name, invoice number, date)
 */
interface HeaderData {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
}

function extractHeaderData(lines: string[]): HeaderData {
  let supplierName: string | null = null;
  let invoiceNumber: string | null = null;
  let invoiceDate: Date | null = null;

  // Search first 15 lines for header information
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].toLowerCase();
    
    // Extract supplier name (check longest matches first to avoid partial matches)
    if (!supplierName) {
      for (const col of INVOICE_COLUMNS.SUPPLIER_NAME) {
        if (line.includes(col) && !line.includes('supplier_code')) {
          supplierName = extractFieldValue(lines[i], col);
          break;
        }
      }
    }
    
    // Extract invoice date first (to avoid "invoice" matching in "invoice_date")
    if (!invoiceDate) {
      for (const col of INVOICE_COLUMNS.INVOICE_DATE) {
        if (line.includes(col)) {
          const dateStr = extractFieldValue(lines[i], col);
          invoiceDate = parseDate(dateStr);
          break;
        }
      }
    }
    
    // Extract invoice number (check that it's not "invoice_date")
    if (!invoiceNumber) {
      for (const col of INVOICE_COLUMNS.INVOICE_NUMBER) {
        if (line.includes(col) && !line.includes('invoice_date')) {
          invoiceNumber = extractFieldValue(lines[i], col);
          break;
        }
      }
    }
    
    // Stop if we found everything
    if (supplierName && invoiceNumber && invoiceDate) {
      break;
    }
  }
  
  // Validate required fields
  const missing: string[] = [];
  if (!supplierName) missing.push('supplier name');
  if (!invoiceNumber) missing.push('invoice number');
  if (!invoiceDate) missing.push('invoice date');
  
  if (missing.length > 0) {
    throw new InvoiceParseError(
      `Missing required invoice fields: ${missing.join(', ')}`,
      `Could not extract: ${missing.join(', ')}`
    );
  }

  return {
    supplierName: supplierName!,
    invoiceNumber: invoiceNumber!,
    invoiceDate: invoiceDate!,
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
 * Find the line items table in the invoice
 */
interface TableLocation {
  headerIndex: number;
  columnIndices: ColumnIndices;
}

interface ColumnIndices {
  productCode: number;
  description: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

function findLineItemsTable(lines: string[]): TableLocation {
  // Look for table header row containing product/item columns
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    const tokens = tokenizeLine(line);
    const normalizedTokens = tokens.map(t => t.toLowerCase().trim());
    
    // Check if this line contains line item headers
    const hasProductCode = INVOICE_COLUMNS.PRODUCT_CODE.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    const hasDescription = INVOICE_COLUMNS.DESCRIPTION.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    const hasQuantity = INVOICE_COLUMNS.QUANTITY.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    const hasPrice = INVOICE_COLUMNS.UNIT_PRICE.some(col =>
      normalizedTokens.some(token => token.includes(col))
    );
    
    if (hasProductCode && hasDescription && hasQuantity && hasPrice) {
      // Map columns
      const columnIndices = mapColumnIndices(tokens);
      validateRequiredColumns(columnIndices);
      
      return {
        headerIndex: i,
        columnIndices,
      };
    }
  }
  
  throw new InvoiceParseError(
    'Could not identify line items table in invoice',
    'Invoice must contain table headers: product_code, description, quantity, unit_price'
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
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let wasQuoted = false;
  let afterClosingQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        currentField += '"';
        i++;
      } else if (!insideQuotes && !afterClosingQuote) {
        // Opening quote
        insideQuotes = true;
        wasQuoted = true;
      } else if (insideQuotes) {
        // Closing quote
        insideQuotes = false;
        afterClosingQuote = true;
      }
      // Ignore quotes that appear after a closing quote but before comma
    } else if (char === ',' && !insideQuotes) {
      // Field separator - push current field
      // Only trim unquoted fields, preserve all characters in quoted fields
      const fieldValue = wasQuoted ? currentField : currentField.trim();
      fields.push(fieldValue);
      currentField = '';
      wasQuoted = false;
      afterClosingQuote = false;
    } else if (!afterClosingQuote) {
      // Add character to field only if we're not after a closing quote
      currentField += char;
    }
    // If afterClosingQuote is true and we're not at a comma, skip the character
  }

  // Push the last field
  const lastFieldValue = wasQuoted ? currentField : currentField.trim();
  fields.push(lastFieldValue);
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
    productCode: findColumnIndex(INVOICE_COLUMNS.PRODUCT_CODE),
    description: findColumnIndex(INVOICE_COLUMNS.DESCRIPTION),
    quantity: findColumnIndex(INVOICE_COLUMNS.QUANTITY),
    unitPrice: findColumnIndex(INVOICE_COLUMNS.UNIT_PRICE),
    lineTotal: findColumnIndex(INVOICE_COLUMNS.LINE_TOTAL),
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
    missing.push('quantity (or equivalent: qty, units)');
  }
  if (indices.unitPrice === -1) {
    missing.push('unit_price (or equivalent: price, cost, rate)');
  }

  if (missing.length > 0) {
    throw new InvoiceParseError(
      `Missing required columns in invoice: ${missing.join(', ')}`,
      `The following required columns were not found: ${missing.join(', ')}`
    );
  }
}

/**
 * Parse line items from the invoice
 */
function parseLineItems(
  lines: string[],
  headerIndex: number,
  columnIndices: ColumnIndices
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const errors: string[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    // Stop if we hit a total line or footer
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
    console.warn(`Invoice parsing completed with ${errors.length} row errors:`, errors.slice(0, 10));
  }

  return items;
}

/**
 * Check if a line is a footer line (total, subtotal, etc.)
 */
function isFooterLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return (
    lowerLine.includes('total') ||
    lowerLine.includes('subtotal') ||
    lowerLine.includes('tax') ||
    lowerLine.includes('due') ||
    lowerLine.includes('balance') ||
    lowerLine.includes('thank you') ||
    lowerLine.includes('notes') ||
    lowerLine.includes('terms')
  );
}

/**
 * Parse a single line item
 */
function parseLineItem(
  line: string,
  indices: ColumnIndices,
  lineNumber: number
): InvoiceLineItem | null {
  const tokens = tokenizeLine(line);

  // Skip empty rows
  if (tokens.length === 0 || tokens.every(t => t === '')) {
    return null;
  }

  // Check if we have enough tokens
  const maxIndex = Math.max(
    indices.productCode,
    indices.description,
    indices.quantity,
    indices.unitPrice,
    indices.lineTotal === -1 ? 0 : indices.lineTotal
  );

  if (tokens.length <= maxIndex) {
    return null;
  }

  // Extract fields
  // Note: tokenizeLine already handles trimming for non-CSV formats
  // For CSV, parseCSVLine preserves spaces in quoted fields and trims unquoted fields
  const productCode = tokens[indices.productCode] || '';
  const description = tokens[indices.description] || '';
  const quantityStr = tokens[indices.quantity] || '';
  const unitPriceStr = tokens[indices.unitPrice] || '';
  const lineTotalStr = indices.lineTotal !== -1 ? tokens[indices.lineTotal] : undefined;

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
  if (!unitPriceStr) {
    throw new Error('Missing unit price');
  }

  // Parse numeric values
  const quantity = parseNumber(quantityStr);
  if (quantity === null || quantity <= 0) {
    throw new Error(`Invalid quantity: "${quantityStr}"`);
  }

  const unitPrice = parsePrice(unitPriceStr);
  if (unitPrice === null || unitPrice < 0) {
    throw new Error(`Invalid unit price: "${unitPriceStr}"`);
  }

  // Calculate line total
  let lineTotal = Math.round(quantity * unitPrice * 100) / 100;

  // If line total is provided in document, validate it matches
  if (lineTotalStr) {
    const documentLineTotal = parsePrice(lineTotalStr);
    if (documentLineTotal !== null && Math.abs(lineTotal - documentLineTotal) > 0.01) {
      // Use document total if provided and different
      lineTotal = documentLineTotal;
    }
  }

  return {
    productCode,
    description,
    quantity,
    unitPrice,
    lineTotal,
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

/**
 * Parse price value to number
 */
function parsePrice(priceValue: string): number | null {
  if (!priceValue) return null;

  // Remove currency symbols and spaces
  let cleaned = priceValue.replace(/[$€£¥\s]/g, '');

  // Check if commas are used as thousands separators
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const price = parseFloat(cleaned);

  if (isNaN(price) || price < 0) return null;

  // Round to 2 decimal places
  return Math.round(price * 100) / 100;
}

/**
 * Extract total amount from invoice document
 */
function extractTotalAmount(lines: string[]): number | null {
  // Search from bottom up for total line
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
    const line = lines[i].toLowerCase();
    
    // Look for total amount field
    for (const col of INVOICE_COLUMNS.TOTAL_AMOUNT) {
      if (line.includes(col)) {
        const valueStr = extractFieldValue(lines[i], col);
        const total = parsePrice(valueStr);
        if (total !== null && total > 0) {
          return total;
        }
      }
    }
  }
  
  return null;
}
