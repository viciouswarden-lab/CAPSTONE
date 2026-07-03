/**
 * PDF Parser for Supplier Pricelists
 * 
 * Extracts supplier product data from PDF files and returns structured PricelistData.
 * Handles multi-page PDF documents with tabular data and provides descriptive
 * error messages for malformed data.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

// Use legacy build for Node.js compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PricelistData, PricelistItem } from '../../types/models';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * PDF Parser error types for specific failure scenarios
 */
export class PDFParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'PDFParseError';
  }
}

/**
 * PDF column names expected in pricelist files (case-insensitive)
 */
const EXPECTED_COLUMNS = {
  SUPPLIER_CODE: ['supplier_code', 'suppliercode', 'code', 'product_code', 'productcode'],
  DESCRIPTION: ['description', 'product_description', 'productdescription', 'product', 'name'],
  PRICE: ['price', 'unit_price', 'unitprice', 'cost'],
  UOM: ['uom', 'unit', 'unit_of_measure', 'unitofmeasure', 'um'],
};

/**
 * Parse PDF pricelist file and extract product data
 * 
 * Supports multi-page PDF documents. Extracts text content and parses tabular data.
 * 
 * @param file - PDF file to parse
 * @param supplierId - ID of the supplier this pricelist belongs to
 * @returns Promise resolving to structured PricelistData
 * @throws PDFParseError with descriptive message if parsing fails
 * 
 * Requirements 3.1, 3.2, 3.3
 */
export async function parsePDF(file: File, supplierId: string): Promise<PricelistData> {
  // Validate file is provided
  if (!file) {
    throw new PDFParseError('No file provided for parsing');
  }

  // Validate supplierId
  if (!supplierId || supplierId.trim() === '') {
    throw new PDFParseError('Supplier ID is required');
  }

  // Validate file extension
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.pdf')) {
    throw new PDFParseError(
      'Invalid file format',
      'File must have .pdf extension'
    );
  }

  // Read file content as ArrayBuffer
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (error) {
    throw new PDFParseError(
      'Failed to read file content',
      `File may be corrupted or in an unsupported format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate file is not empty
  if (arrayBuffer.byteLength === 0) {
    throw new PDFParseError('File is empty', 'PDF file contains no data');
  }

  // Load PDF document
  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
  } catch (error) {
    throw new PDFParseError(
      'Failed to parse PDF file',
      `File may be corrupted or in an invalid PDF format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate PDF has pages
  if (!pdfDoc.numPages || pdfDoc.numPages === 0) {
    throw new PDFParseError(
      'No pages found in PDF file',
      'PDF file must contain at least one page'
    );
  }

  // Extract text from all pages
  let allText = '';
  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      allText += pageText + '\n';
    }
  } catch (error) {
    throw new PDFParseError(
      'Failed to extract text from PDF',
      `Error reading PDF pages: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate extracted text is not empty
  if (!allText || allText.trim() === '') {
    throw new PDFParseError(
      'No text content found in PDF',
      'PDF may be image-based or contain no extractable text'
    );
  }

  // Parse extracted text as tabular data
  try {
    const items = parseTextAsTable(allText);
    
    if (items.length === 0) {
      throw new PDFParseError(
        'No valid product data found in PDF',
        'PDF does not contain recognizable tabular pricelist data'
      );
    }

    return {
      supplierId,
      uploadDate: new Date(),
      items,
    };
  } catch (error) {
    if (error instanceof PDFParseError) {
      throw error;
    }
    throw new PDFParseError(
      'Failed to parse PDF content',
      `Error processing extracted text: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse extracted text as tabular data
 * Attempts to identify table structure and extract product information
 */
function parseTextAsTable(text: string): PricelistItem[] {
  // Split text into lines
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new PDFParseError(
      'Insufficient data in PDF',
      'PDF must contain at least a header row and one data row'
    );
  }

  // Try to find header row by looking for expected column names
  let headerIndex = -1;
  let headerTokens: string[] = [];

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const tokens = tokenizeLine(lines[i]);
    const normalizedTokens = tokens.map(t => t.toLowerCase().trim());

    // Check if this line contains column headers
    const hasSupplierCode = EXPECTED_COLUMNS.SUPPLIER_CODE.some(col => 
      normalizedTokens.some(token => token.includes(col))
    );
    const hasDescription = EXPECTED_COLUMNS.DESCRIPTION.some(col => 
      normalizedTokens.some(token => token.includes(col))
    );
    const hasPrice = EXPECTED_COLUMNS.PRICE.some(col => 
      normalizedTokens.some(token => token.includes(col))
    );

    if (hasSupplierCode && hasDescription && hasPrice) {
      headerIndex = i;
      headerTokens = tokens;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new PDFParseError(
      'Could not identify table headers in PDF',
      'PDF must contain recognizable column headers: supplier_code, description, price'
    );
  }

  // Map column names to indices
  const columnIndices = mapColumnIndices(headerTokens);

  // Validate required columns are present
  validateRequiredColumns(columnIndices);

  // Parse data rows
  const items: PricelistItem[] = [];
  const errors: string[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    try {
      const tokens = tokenizeLine(line);
      const item = parseDataRow(tokens, columnIndices, lineNumber);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Line ${lineNumber}: ${errorMsg}`);
    }
  }

  // If all rows failed, throw error
  if (items.length === 0 && errors.length > 0) {
    throw new PDFParseError(
      'Failed to parse any valid rows from PDF',
      `Errors encountered:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
    );
  }

  // If some rows failed, we still return what we could parse
  if (errors.length > 0) {
    console.warn(`PDF parsing completed with ${errors.length} row errors:`, errors.slice(0, 10));
  }

  return items;
}

/**
 * Tokenize a line into fields
 * Uses whitespace and common delimiters to split the line
 */
function tokenizeLine(line: string): string[] {
  // Try to detect if the line uses tabs or multiple spaces as delimiters
  const trimmed = line.trim();
  
  // If line contains tabs, split by tabs
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map(t => t.trim()).filter(t => t !== '');
  }

  // Split by multiple spaces (2 or more) - common in PDF text extraction
  const tokens = trimmed.split(/\s{2,}/).map(t => t.trim()).filter(t => t !== '');
  
  // If we got very few tokens, try splitting by single space as fallback
  if (tokens.length < 3) {
    return trimmed.split(/\s+/).map(t => t.trim()).filter(t => t !== '');
  }

  return tokens;
}

/**
 * Map column names to their indices
 * Uses case-insensitive matching with multiple possible column name variations
 */
function mapColumnIndices(headers: string[]): ColumnIndices {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  const findColumnIndex = (possibleNames: string[]): number => {
    // First try exact match
    for (const name of possibleNames) {
      const index = normalizedHeaders.indexOf(name);
      if (index !== -1) return index;
    }
    // Then try contains match (but prioritize longer matches)
    for (const name of possibleNames) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        // Ensure we're matching the full word, not partial matches
        if (header === name || header.includes(name) && name.length > 3) {
          return i;
        }
      }
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
 * Validate that required columns are present in the PDF
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
    throw new PDFParseError(
      `Missing required columns in PDF: ${missing.join(', ')}`,
      `The following required columns were not found: ${missing.join(', ')}`
    );
  }
}

/**
 * Parse a single data row from the PDF
 */
function parseDataRow(
  tokens: string[],
  indices: ColumnIndices,
  lineNumber: number
): PricelistItem | null {
  // Skip empty rows
  if (tokens.length === 0 || tokens.every(t => t === '')) {
    return null;
  }

  // Check if we have enough tokens
  const maxIndex = Math.max(
    indices.supplierCode,
    indices.description,
    indices.price,
    indices.uom === -1 ? 0 : indices.uom
  );

  if (tokens.length <= maxIndex) {
    // Not enough tokens, skip this row
    return null;
  }

  // Extract fields
  const supplierCode = tokens[indices.supplierCode]?.trim() || '';
  const description = tokens[indices.description]?.trim() || '';
  const priceValue = tokens[indices.price]?.trim() || '';
  const uom = indices.uom !== -1 ? tokens[indices.uom]?.trim() : undefined;

  // Validate required fields
  if (!supplierCode) {
    throw new Error('Missing supplier code');
  }
  if (!description) {
    throw new Error('Missing description');
  }
  if (!priceValue) {
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
function parsePrice(priceValue: string): number | null {
  if (!priceValue) {
    return null;
  }

  // Remove currency symbols and spaces (but keep commas for now to check format)
  let cleaned = priceValue.replace(/[$€£¥\s]/g, '');

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
