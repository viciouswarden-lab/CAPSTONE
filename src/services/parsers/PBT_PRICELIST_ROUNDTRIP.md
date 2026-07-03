# Property-Based Test: Pricelist Round-Trip Preservation

## Overview

This document describes the implementation and results of the pricelist round-trip preservation property-based test.

**Task:** 4.6 Write property test for pricelist round-trip preservation  
**Requirement:** 3.7 - FOR ALL valid pricelist data structures, parsing then printing then parsing SHALL produce an equivalent data structure (round-trip property)  
**Status:** ✅ PASSED

## Property Tested

**Property 1: Pricelist Round-Trip Preservation**

For any valid PricelistData structure:
1. Print to CSV format using CSVPrinter
2. Parse CSV back to PricelistData using CSVParser  
3. Result must be equivalent to original

This ensures data fidelity through the parse → print → parse cycle.

## Implementation

### Test Framework
- **Library:** fast-check (TypeScript property-based testing)
- **Iterations:** 100 per property (as per design specification)
- **Shrinking:** Enabled to find minimal failing examples

### Custom Generators (Arbitraries)

1. **supplierCodeArbitrary**: Generates alphanumeric codes (3-10 chars) with optional hyphens
2. **descriptionArbitrary**: Generates product descriptions with special characters
3. **priceArbitrary**: Generates non-negative prices (0-99999.99) with 2 decimal places
4. **uomArbitrary**: Generates optional UOM values (EA, BOX, CASE, etc.)
5. **pricelistItemArbitrary**: Combines above to create valid PricelistItem structures
6. **pricelistDataArbitrary**: Creates full PricelistData with 1-50 items

### Test Properties

The test suite includes 7 property tests:

1. **Main Round-Trip Test**: Full data structure equivalence
2. **Product Codes Preservation**: All codes match exactly
3. **Descriptions Preservation**: All descriptions match exactly (including whitespace)
4. **Prices Preservation**: All prices match within 2 decimal places
5. **UOM Preservation**: Optional UOM fields preserved correctly
6. **Item Count Preservation**: Exact number of items maintained
7. **Special Characters**: CSV escaping handles commas, quotes, etc.

## Bugs Found and Fixed

The property-based tests discovered **real bugs** in the implementation:

### Bug 1: Trailing Whitespace Lost
**Issue:** Descriptions with trailing whitespace like `"Product "` were parsed as `"Product"`  
**Root Cause:** CSV parser's `parseCSVLine()` was calling `.trim()` on all fields  
**Fix:** Only trim unquoted fields; preserve whitespace in quoted fields

### Bug 2: Leading Whitespace Lost  
**Issue:** Descriptions with leading whitespace like `" Product"` were parsed as `"Product"`  
**Root Cause:** Same as Bug 1 - indiscriminate trimming  
**Fix:** Same as Bug 1

### Bug 3: Printer Not Quoting Whitespace Fields
**Issue:** CSVPrinter wasn't quoting fields with leading/trailing whitespace  
**Root Cause:** `escapeCSVField()` only checked for commas, quotes, and newlines  
**Fix:** Added check: `value !== value.trim()` to quote fields with leading/trailing whitespace

## Code Changes

### CSVParser.ts
- Modified `parseCSVLine()` to track whether fields were quoted
- Only trim unquoted fields to preserve intentional whitespace
- Updated `parseDataRow()` to handle the new field handling logic

### CSVPrinter.ts (Created)
- Implemented `printPricelistCSV()` to convert PricelistData to CSV format
- Implemented `escapeCSVField()` with proper quoting logic
- Handles special characters: commas, quotes, newlines, leading/trailing whitespace
- Formats prices to 2 decimal places

## Test Results

```
✅ All 7 property tests PASSED (100 iterations each)
✅ All 35 existing unit tests PASSED
✅ Total test time: ~380ms
```

## Verification

The property tests verify:
- ✅ Product codes preserved exactly
- ✅ Descriptions preserved exactly (including whitespace and special chars)
- ✅ Prices preserved to 2 decimal places
- ✅ UOM values preserved when present
- ✅ Item count preserved
- ✅ CSV escaping works correctly (commas, quotes, newlines, whitespace)
- ✅ Round-trip produces equivalent structure

## Conclusion

The property-based testing approach successfully:
1. **Discovered bugs** that would have been missed by example-based unit tests
2. **Verified correctness** across hundreds of randomly generated test cases
3. **Provided confidence** that the round-trip property holds for all valid inputs
4. **Demonstrated value** of property-based testing for algorithmic correctness

This implementation satisfies **Requirement 3.7** and validates the round-trip preservation property for pricelist data.
