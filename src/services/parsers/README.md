# Document Parsers

This module provides document parsing services for PRO SYNAPSE. It extracts structured data from various file formats (CSV, Excel, PDF) to enable automated processing of supplier pricelists, invoices, and delivery receipts.

## Invoice Parser

The invoice parser (`InvoiceParser.ts`) extracts invoice data from supplier documents in CSV, Excel, and PDF formats.

### Features

- **Multi-Format Support**: Handles CSV, Excel (.xls, .xlsx), and PDF files
- **Comprehensive Data Extraction**:
  - Supplier name
  - Invoice number
  - Invoice date (multiple date formats)
  - Line items with product codes, descriptions, quantities, and prices
  - Total amount calculation and validation

- **Flexible Column Mapping**: Supports multiple field name variations
  - Supplier: `supplier_name`, `vendor`, `supplier`
  - Invoice Number: `invoice_number`, `invoice_no`, `invoice`
  - Date: `invoice_date`, `date`, `issued_date`
  - Product Code: `product_code`, `sku`, `code`, `item_code`
  - Quantity: `quantity`, `qty`, `units`
  - Price: `unit_price`, `price`, `cost`, `rate`

- **Intelligent Table Detection**: Automatically identifies line items table in complex documents
- **Total Validation**: Compares calculated totals against document totals
- **Decimal Precision**: Rounds all prices to 2 decimal places
- **Error Handling**: Descriptive error messages indicating which fields could not be extracted

### Usage

```typescript
import { parseInvoice } from './services/parsers';

// Parse an invoice file (CSV, Excel, or PDF)
const file = new File([fileContent], 'invoice.csv');
const result = await parseInvoice(file);

console.log(result.supplierName);    // 'ACME Supplies Inc'
console.log(result.invoiceNumber);   // 'INV-2024-001'
console.log(result.invoiceDate);     // Date object
console.log(result.lineItems);       // Array of line items
console.log(result.totalAmount);     // 605.50
```

### Data Structure

**Output**: `InvoiceData` object:
```typescript
{
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
}
```

**InvoiceLineItem**:
```typescript
{
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
```

### Example Invoice Formats

**CSV Format**:
```csv
supplier_name,ACME Supplies Inc
invoice_number,INV-2024-001
invoice_date,2024-01-15

product_code,description,quantity,unit_price,line_total
SKU001,Widget A,10,25.50,255.00
SKU002,Widget B,5,40.00,200.00

total_amount,605.50
```

**Alternative Format with Colons**:
```csv
supplier_name: ABC Corporation
invoice_number: 12345
invoice_date: 2024-02-20

product_code,description,quantity,unit_price
PROD-A,Product Alpha,3,10.00
PROD-B,Product Beta,7,15.50
```

### Error Handling

The parser throws `InvoiceParseError` for:
- Missing required fields (supplier name, invoice number, date)
- Missing or unidentifiable line items table
- Missing required columns (product_code, description, quantity, unit_price)
- No line items found
- Total validation failures (calculated vs. document total mismatch)
- Invalid numeric values
- Unsupported file formats

### Requirements Satisfied

- **Requirement 10.1**: Extract supplier name, invoice number, date, line items, quantities, prices, total
- **Requirement 10.2**: Return descriptive error messages for missing/invalid fields

## CSV Parser

The CSV parser (`CSVParser.ts`) extracts product information from supplier pricelist CSV files.

### Features

- **Flexible Column Mapping**: Supports multiple column name variations (case-insensitive)
  - Supplier Code: `supplier_code`, `code`, `product_code`, etc.
  - Description: `description`, `product`, `name`, etc.
  - Price: `price`, `unit_price`, `cost`, etc.
  - UOM (optional): `uom`, `unit`, `unit_of_measure`, etc.

- **Robust Price Parsing**: Handles various price formats
  - Decimal numbers: `10.50`, `1234.56`
  - Currency symbols: `$10.50`, `€25.99`, `£100.00`
  - Thousands separators (when quoted): `"1,234.56"`
  - Automatic rounding to 2 decimal places

- **CSV Format Handling**
  - Quoted fields with commas: `"Product A, Deluxe Edition"`
  - Escaped quotes: `"Product ""Special"" B"`
  - Windows and Unix line endings
  - Extra columns beyond required fields

- **Error Handling**
  - Descriptive errors for missing columns
  - Row-level error reporting with line numbers
  - Validates required fields (supplier code, description, price)
  - Skips invalid rows and returns valid data when possible
  - Returns detailed error messages for debugging

### Usage

```typescript
import { parseCSV } from './services/parsers';

// Parse a CSV file
const file = new File([csvContent], 'pricelist.csv');
const result = await parseCSV(file, 'supplier-123');

console.log(result.supplierId);  // 'supplier-123'
console.log(result.uploadDate);  // Current date/time
console.log(result.items);       // Array of PricelistItem objects
```

### Data Structure

**Input**: CSV file with columns:
- `supplier_code` (required): Product code from supplier
- `description` (required): Product description
- `price` (required): Product price
- `uom` (optional): Unit of measure

**Output**: `PricelistData` object:
```typescript
{
  supplierId: string;
  uploadDate: Date;
  items: PricelistItem[];
}
```

**PricelistItem**:
```typescript
{
  supplierCode: string;
  description: string;
  price: number;
  uom?: string;
}
```

### Error Handling

The parser throws `CSVParseError` with descriptive messages for:
- Missing or empty files
- Missing required columns
- Empty CSV files (header only)
- All rows invalid
- Corrupted file encoding

Partial success is supported - if some rows are valid and others invalid, the parser returns the valid rows and logs warnings about invalid rows.

### Example CSV Formats

**Basic Format**:
```csv
supplier_code,description,price
ABC123,Product A,10.50
DEF456,Product B,25.99
```

**With UOM**:
```csv
supplier_code,description,price,uom
ABC123,Product A,10.50,EA
DEF456,Product B,25.99,BOX
```

**With Quoted Fields**:
```csv
supplier_code,description,price
ABC123,"Product A, Deluxe Edition",10.50
DEF456,"Product ""Special"" B",25.99
```

**Alternative Column Names**:
```csv
code,product,unit_price,unit
ABC123,Product A,10.50,EA
```

### Testing

Comprehensive unit tests cover:
- Valid CSV parsing with various formats
- Column name variations
- Optional UOM handling
- Error cases (missing columns, invalid data)
- Edge cases (empty rows, special characters, large values)
- Price format variations

Run tests:
```bash
npm test -- src/services/parsers/CSVParser.test.ts --run
```

### Requirements Satisfied

- **Requirement 3.1**: Accept CSV format for pricelists
- **Requirement 3.2**: Extract product codes, descriptions, and prices
- **Requirement 3.3**: Return descriptive error messages for corrupted/unreadable files

### Future Enhancements

- Excel parser (`.xlsx`, `.xls`)
- PDF parser (using PDF.js)
- Invoice parser
- Delivery receipt parser
- Pretty printer for round-trip conversion
