# Document Upload & Parsing Feature

## Overview

The receiving page now supports uploading and automatically parsing invoices and delivery receipts in multiple formats.

## ✅ Supported Formats

### Fully Implemented:
- **CSV** - Comma-separated values
- **Excel** - .xls and .xlsx files

### Placeholder (Manual Entry Required):
- **PDF** - Not yet implemented (requires PDF parsing library)
- **JPG/PNG** - Not yet implemented (requires OCR library)

## How It Works

### 1. Upload Document
On the `/receiving/new` page:
- Click or drag-and-drop a file into the upload area
- Supported formats: CSV, Excel, PDF, JPG, PNG
- File name is displayed once selected

### 2. Parse Document
- Click "Parse Document" button
- System automatically:
  - Detects file format
  - Extracts line items
  - Matches products by SKU/supplier code
  - Populates line items in the form
  - Detects variances (if expected qty provided)

### 3. Review & Submit
- Review auto-populated line items
- Make adjustments if needed
- Add/remove line items manually
- Submit to create receiving record

## CSV Format

### Required Columns:
- `description` - Product name/description
- `quantity` - Received quantity

### Optional Columns:
- `supplier_code` or `code` - SKU/product code (for automatic matching)
- `expected_qty` or `expected` - Expected quantity (for variance detection)
- `price` or `unit_price` - Unit cost
- `uom` or `unit` - Unit of measure

### Column Name Variations:
The parser is flexible and recognizes various column names (case-insensitive):

**Supplier Code:**
- supplier_code, suppliercode, code, product_code, productcode, item_code, sku

**Description:**
- description, product, item, product_name, item_name, name

**Quantity:**
- quantity, qty, received, received_qty, amount

**Expected:**
- expected, expected_qty, ordered, ordered_qty, po_qty

**Price:**
- price, unit_price, unitprice, cost, unit_cost

**UOM:**
- uom, unit, unit_of_measure, um

### Example CSV:
```csv
supplier_code,description,quantity,expected_qty,unit_price,uom
HW-HAM-001,Claw Hammer 16oz,50,48,125.50,PCS
HW-SCR-001,Phillips Screwdriver Set,25,25,220.00,SET
HW-WRE-001,Adjustable Wrench 10 inch,30,30,180.75,PCS
```

## Excel Format

Same column requirements as CSV. The parser:
- Reads the first sheet
- Treats first row as headers
- Parses subsequent rows as data
- Skips empty rows automatically

## Product Matching

When parsing documents, the system attempts to match products:

### Automatic Matching:
If `supplier_code` column exists:
- Searches for product with matching SKU
- If found: Selects product automatically
- If not found: Shows description only (manual matching required)

### Manual Matching:
- User can select the correct product from dropdown
- Description is shown to help identification
- Quantities are pre-filled from document

## Variance Detection

If the document includes `expected_qty`:
- System compares received vs expected quantities
- Flags variances >5% automatically
- Shows warnings on individual line items
- Sets `hasVariance` flag on receiving record

## Error Handling

### Parse Warnings:
- Invalid rows are skipped
- Warnings are collected and shown to user
- Successfully parsed items are still processed

### Parse Errors:
- Missing required columns → Error message with details
- Empty file → Error message
- Unsupported format → Error message with supported formats
- PDF/Image → Instructional message (not yet implemented)

## Technical Implementation

### Files Created:
1. `src/services/documents/ReceivingDocumentParser.ts` - Parser service
2. `sample_receiving_invoice.csv` - Sample file for testing

### Dependencies:
- `xlsx` - Excel file parsing (installed via npm)

### File Modified:
- `src/pages/receiving/new.astro` - Added upload UI and parsing logic

### Key Features:
- Flexible column name recognition
- Robust error handling
- Support for various number formats
- Automatic product matching
- Variance detection
- Real-time parsing feedback

## Usage Example

### Step 1: Prepare Document
Create a CSV or Excel file with your invoice/receipt data:
```
code,description,quantity,expected
HW-001,Hammer,50,48
HW-002,Screwdriver,25,25
```

### Step 2: Upload
1. Go to `/receiving/new`
2. Fill in basic info (Supplier, Date, Document Type, Location)
3. Click "Choose a file" or drag-and-drop

### Step 3: Parse
1. Click "Parse Document" button
2. Wait for parsing (1-2 seconds)
3. Review auto-populated line items

### Step 4: Verify & Submit
1. Check product matches
2. Verify quantities
3. Add/remove/edit items as needed
4. Submit to create receiving record

## Benefits

✅ **Time Saving** - No manual data entry for bulk items
✅ **Accuracy** - Reduces human input errors
✅ **Flexibility** - Supports multiple file formats
✅ **Smart Matching** - Automatic product SKU matching
✅ **Variance Detection** - Automatic flagging of discrepancies
✅ **User Friendly** - Drag-and-drop interface

## Future Enhancements

Potential improvements:
- **PDF Parsing** - Implement PDF text extraction using pdf.js
- **OCR Support** - Add Tesseract.js for image/photo parsing
- **Template Learning** - Learn supplier-specific formats
- **Barcode Recognition** - Extract barcodes from images
- **Multi-page Support** - Handle multi-page invoices
- **Confidence Scoring** - Show match confidence for parsed items
- **Preview Before Parse** - Show file preview before parsing

## Testing Files

Sample files for testing:
- `sample_receiving_invoice.csv` - Sample CSV invoice with 5 items

## Notes

- PDF and Image parsing are placeholders - will show instructional messages
- Excel parsing uses SheetJS (xlsx library)
- CSV parsing is custom-built for flexibility
- All parsing happens client-side (no server upload)
- File size limits apply (typically 5-10MB browser limit)

## Error Messages

Common errors and solutions:

**"Missing required columns"**
→ Ensure file has 'description' and 'quantity' columns

**"Invalid CSV file"**
→ Check file has header row and at least one data row

**"No valid data found"**
→ Check that rows contain actual data (not all empty)

**"PDF parsing requires manual entry"**
→ PDF support not yet implemented, extract data manually

**"Image OCR requires manual entry"**
→ OCR support not yet implemented, type data manually

---

**Status:** ✅ CSV and Excel parsing fully implemented
**Next:** Test with real supplier documents
