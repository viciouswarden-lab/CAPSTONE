# Integration Tests

## Overview

This directory contains integration tests that verify the complete flow of various system features by testing multiple components working together.

## Pricelist Processing Integration Tests

**File:** `pricelistProcessing.integration.test.ts`

**Coverage:** Tests the complete pricelist processing pipeline from file upload through data storage.

### Test Scenarios

1. **CSV Pricelist Processing**
   - Parses CSV files
   - Extracts product codes, descriptions, and prices
   - Stores data in Firestore (pricelists and pricelist_items collections)

2. **Excel Pricelist Processing**
   - Parses Excel (.xlsx) files
   - Handles UOM (unit of measure) fields
   - Verifies Firestore storage

3. **PDF Pricelist Processing** (Currently Skipped)
   - Would test PDF parsing
   - Requires proper PDF file generation setup

4. **Product Matching**
   - Tests exact matching via supplier codes
   - Tests fuzzy matching for similar descriptions
   - Verifies match confidence calculations

5. **Price Change Detection**
   - Compares old vs. new pricelists
   - Calculates percentage changes
   - Flags significant changes (>10%)
   - Stores price_changes in Firestore

6. **End-to-End Flow**
   - Complete pricelist upload → parse → match → price detection pipeline
   - Verifies data integrity across all Firestore collections

### Requirements Validated

- **Requirement 3.1:** File upload (CSV, Excel, PDF formats)
- **Requirement 3.2:** Parser extraction
- **Requirement 3.5:** Firestore storage
- **Requirement 4.1:** Product matching
- **Requirement 6.1:** Price change detection

## Running Integration Tests

### Prerequisites

These integration tests require Firebase Emulator to be running.

#### Option 1: Using Firebase Emulator (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Start Firebase Emulator:**
   ```bash
   firebase emulators:start
   ```

   This will start:
   - Firestore Emulator on `localhost:8080`
   - Authentication Emulator on `localhost:9099`
   - Functions Emulator on `localhost:5001`

3. **Run Integration Tests:**
   ```bash
   npm test -- src/tests/integration/pricelistProcessing.integration.test.ts --run
   ```

#### Option 2: Using Real Firebase Project

If you want to test against a real Firebase project:

1. Update `.env` with your Firebase project credentials:
   ```
   PUBLIC_FIREBASE_API_KEY=your-api-key
   PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

2. Comment out the `connectFirestoreEmulator` call in the test file

3. Run the tests:
   ```bash
   npm test -- src/tests/integration/pricelistProcessing.integration.test.ts --run
   ```

**Warning:** Using a real Firebase project will create test data in your production database. Make sure to use a dedicated test project.

### Test Timeout

Integration tests have a 30-second timeout per test case to account for:
- File parsing operations
- Multiple Firestore read/write operations
- Product matching algorithm execution
- Price change detection calculations

### Cleanup

Tests automatically clean up created documents after each test using the `afterEach` hook. If tests fail unexpectedly, some test data may remain in Firestore.

To manually clean up test data:
```javascript
// Test data uses identifiable patterns:
// - Supplier IDs: test-supplier-*
// - SKUs: SKU-TEST-*, SKU-MATCH-*, SKU-PRICE-*, etc.
```

## Troubleshooting

### Tests timeout with "PERMISSION_DENIED" errors

This means the tests are trying to connect to a Firebase project that doesn't exist or isn't accessible.

**Solution:** Start Firebase Emulator or configure a real Firebase project.

### "Failed to connect to Firestore Emulator" warning

This warning is informational. If the emulator is not running, tests will fail with timeout errors.

**Solution:** Start Firebase Emulator before running tests.

### PDF parsing tests fail

The PDF test is currently skipped because generating valid PDF files programmatically requires additional setup.

**Solution:** To enable PDF tests, you would need to:
1. Use a library like `pdfkit` to generate proper PDF files
2. Update the `createPDFFile()` helper function
3. Remove the `.skip` from the describe block

## Future Improvements

1. **Mock Firestore operations** for faster unit-style integration tests
2. **Add CI/CD integration** with automatic emulator setup
3. **Implement PDF test** with proper PDF generation
4. **Add performance benchmarks** for processing large pricelists
5. **Test error scenarios** (corrupted files, network failures, etc.)

## Related Files

- `src/services/parsers/CSVParser.ts` - CSV parsing logic
- `src/services/parsers/ExcelParser.ts` - Excel parsing logic
- `src/services/parsers/PDFParser.ts` - PDF parsing logic
- `src/services/matching/MatcherService.ts` - Product matching service
- `src/services/pricing/PriceMonitorService.ts` - Price monitoring service
