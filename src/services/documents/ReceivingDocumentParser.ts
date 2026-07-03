/**
 * Receiving Document Parser Service
 * 
 * Parses invoices and delivery receipts in various formats
 * to extract product information for receiving records.
 * 
 * Supported formats: CSV, Excel (XLS/XLSX), PDF, JPG, PNG
 */

export interface ParsedLineItem {
  supplierCode?: string;
  description: string;
  quantity: number;
  expectedQuantity?: number;
  price?: number;
  uom?: string;
}

export interface ParsedDocument {
  lineItems: ParsedLineItem[];
  documentType?: 'invoice' | 'delivery_receipt';
  warnings?: string[];
}

export class DocumentParseError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

/**
 * Expected column names for receiving documents
 */
const COLUMN_MAPPINGS = {
  SUPPLIER_CODE: ['supplier_code', 'suppliercode', 'code', 'product_code', 'productcode', 'item_code', 'sku'],
  DESCRIPTION: ['description', 'product', 'item', 'product_name', 'item_name', 'name'],
  QUANTITY: ['quantity', 'qty', 'received', 'received_qty', 'amount'],
  EXPECTED: ['expected', 'expected_qty', 'ordered', 'ordered_qty', 'po_qty'],
  PRICE: ['price', 'unit_price', 'unitprice', 'cost', 'unit_cost'],
  UOM: ['uom', 'unit', 'unit_of_measure', 'um'],
};

class ReceivingDocumentParser {
  /**
   * Parse uploaded file based on its type
   */
  async parseFile(file: File): Promise<ParsedDocument> {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      return this.parseCSV(file);
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
      return this.parseExcel(file);
    } else if (fileName.endsWith('.pdf')) {
      return this.parsePDF(file);
    } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
      return this.parseImage(file);
    } else {
      throw new DocumentParseError(
        'Unsupported file format',
        `Supported formats: CSV, Excel (.xls, .xlsx), PDF, JPG, PNG`
      );
    }
  }

  /**
   * Parse CSV file
   */
  private async parseCSV(file: File): Promise<ParsedDocument> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new DocumentParseError(
        'Invalid CSV file',
        'CSV must contain at least a header row and one data row'
      );
    }

    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const columnIndices = this.mapColumnIndices(headers);

    // Validate required columns
    if (columnIndices.description === -1 || columnIndices.quantity === -1) {
      throw new DocumentParseError(
        'Missing required columns',
        'CSV must contain at least "description" and "quantity" columns'
      );
    }

    // Parse data rows
    const lineItems: ParsedLineItem[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const item = this.parseCSVDataRow(lines[i], columnIndices);
        if (item) {
          lineItems.push(item);
        }
      } catch (error) {
        warnings.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    if (lineItems.length === 0) {
      throw new DocumentParseError(
        'No valid data found',
        warnings.length > 0 ? warnings.join('\n') : 'Could not parse any rows from CSV'
      );
    }

    return { lineItems, warnings };
  }

  /**
   * Parse Excel file using SheetJS (xlsx)
   */
  private async parseExcel(file: File): Promise<ParsedDocument> {
    try {
      // Dynamic import of xlsx library
      const XLSX = await import('xlsx');
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new DocumentParseError('Empty Excel file', 'No sheets found in workbook');
      }
      
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON with header row
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length < 2) {
        throw new DocumentParseError('Invalid Excel file', 'Must contain at least header and one data row');
      }
      
      // Parse as CSV-like structure
      const headers = data[0].map(h => String(h || '').trim());
      const columnIndices = this.mapColumnIndices(headers);
      
      if (columnIndices.description === -1 || columnIndices.quantity === -1) {
        throw new DocumentParseError(
          'Missing required columns',
          'Excel must contain at least "description" and "quantity" columns'
        );
      }
      
      const lineItems: ParsedLineItem[] = [];
      const warnings: string[] = [];
      
      for (let i = 1; i < data.length; i++) {
        try {
          const row = data[i];
          if (row.every((cell: any) => !cell || String(cell).trim() === '')) {
            continue; // Skip empty rows
          }
          
          const item = this.parseExcelDataRow(row, columnIndices);
          if (item) {
            lineItems.push(item);
          }
        } catch (error) {
          warnings.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
      }
      
      if (lineItems.length === 0) {
        throw new DocumentParseError('No valid data found', 'Could not parse any rows from Excel');
      }
      
      return { lineItems, warnings };
    } catch (error) {
      if (error instanceof DocumentParseError) throw error;
      throw new DocumentParseError(
        'Failed to parse Excel file',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Parse PDF file (OCR/text extraction)
   */
  private async parsePDF(file: File): Promise<ParsedDocument> {
    // For PDF parsing, we would need a PDF library like pdf.js or pdf-parse
    // This is a simplified version that returns instructions
    throw new DocumentParseError(
      'PDF parsing requires manual entry',
      'Please extract the data manually or convert to CSV/Excel format. ' +
      'Automatic PDF parsing is not yet implemented.'
    );
  }

  /**
   * Parse image file (OCR)
   */
  private async parseImage(file: File): Promise<ParsedDocument> {
    // For image parsing, we would need OCR like Tesseract.js
    // This is a simplified version that returns instructions
    throw new DocumentParseError(
      'Image OCR requires manual entry',
      'Please extract the data manually or convert to CSV/Excel format. ' +
      'Automatic image OCR is not yet implemented.'
    );
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    fields.push(currentField.trim());
    return fields;
  }

  /**
   * Map column names to indices
   */
  private mapColumnIndices(headers: string[]): any {
    const normalized = headers.map(h => h.toLowerCase().trim());

    const findIndex = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = normalized.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    return {
      supplierCode: findIndex(COLUMN_MAPPINGS.SUPPLIER_CODE),
      description: findIndex(COLUMN_MAPPINGS.DESCRIPTION),
      quantity: findIndex(COLUMN_MAPPINGS.QUANTITY),
      expected: findIndex(COLUMN_MAPPINGS.EXPECTED),
      price: findIndex(COLUMN_MAPPINGS.PRICE),
      uom: findIndex(COLUMN_MAPPINGS.UOM),
    };
  }

  /**
   * Parse CSV data row
   */
  private parseCSVDataRow(line: string, indices: any): ParsedLineItem | null {
    const fields = this.parseCSVLine(line);

    // Skip empty rows
    if (fields.every(f => f.trim() === '')) {
      return null;
    }

    const description = (fields[indices.description] || '').trim();
    const quantityStr = (fields[indices.quantity] || '').trim();

    if (!description) {
      throw new Error('Missing description');
    }
    if (!quantityStr) {
      throw new Error('Missing quantity');
    }

    const quantity = this.parseNumber(quantityStr);
    if (quantity === null || quantity <= 0) {
      throw new Error(`Invalid quantity: "${quantityStr}"`);
    }

    const item: ParsedLineItem = {
      description,
      quantity,
    };

    if (indices.supplierCode !== -1) {
      const code = fields[indices.supplierCode]?.trim();
      if (code) item.supplierCode = code;
    }

    if (indices.expected !== -1) {
      const expectedStr = fields[indices.expected]?.trim();
      if (expectedStr) {
        const expected = this.parseNumber(expectedStr);
        if (expected !== null && expected > 0) {
          item.expectedQuantity = expected;
        }
      }
    }

    if (indices.price !== -1) {
      const priceStr = fields[indices.price]?.trim();
      if (priceStr) {
        const price = this.parseNumber(priceStr);
        if (price !== null && price >= 0) {
          item.price = price;
        }
      }
    }

    if (indices.uom !== -1) {
      const uom = fields[indices.uom]?.trim();
      if (uom) item.uom = uom;
    }

    return item;
  }

  /**
   * Parse Excel data row
   */
  private parseExcelDataRow(row: any[], indices: any): ParsedLineItem | null {
    const description = String(row[indices.description] || '').trim();
    const quantityVal = row[indices.quantity];

    if (!description) {
      throw new Error('Missing description');
    }
    if (quantityVal === undefined || quantityVal === null || quantityVal === '') {
      throw new Error('Missing quantity');
    }

    const quantity = typeof quantityVal === 'number' ? quantityVal : this.parseNumber(String(quantityVal));
    if (quantity === null || quantity <= 0) {
      throw new Error(`Invalid quantity: "${quantityVal}"`);
    }

    const item: ParsedLineItem = {
      description,
      quantity,
    };

    if (indices.supplierCode !== -1 && row[indices.supplierCode]) {
      item.supplierCode = String(row[indices.supplierCode]).trim();
    }

    if (indices.expected !== -1 && row[indices.expected]) {
      const expectedVal = row[indices.expected];
      const expected = typeof expectedVal === 'number' ? expectedVal : this.parseNumber(String(expectedVal));
      if (expected !== null && expected > 0) {
        item.expectedQuantity = expected;
      }
    }

    if (indices.price !== -1 && row[indices.price]) {
      const priceVal = row[indices.price];
      const price = typeof priceVal === 'number' ? priceVal : this.parseNumber(String(priceVal));
      if (price !== null && price >= 0) {
        item.price = price;
      }
    }

    if (indices.uom !== -1 && row[indices.uom]) {
      item.uom = String(row[indices.uom]).trim();
    }

    return item;
  }

  /**
   * Parse number from string, handling various formats
   */
  private parseNumber(str: string): number | null {
    if (!str) return null;

    // Remove currency symbols and whitespace
    let cleaned = str.replace(/[$€£¥\s]/g, '');

    // Handle thousands separators
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  }
}

// Export singleton instance
export const receivingDocumentParser = new ReceivingDocumentParser();
