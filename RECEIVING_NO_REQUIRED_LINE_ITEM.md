# Receiving Form - No Required Initial Line Item

## ✅ Change Summary

The receiving form (`/receiving/new`) now starts **completely empty** with no pre-added line items.

## Before vs After

### ❌ Before
- Form automatically added 1 line item on page load
- User had to fill it or remove it before uploading document
- Annoying when uploading a document with many items

### ✅ After
- Form starts completely empty
- Shows helpful empty state message
- Upload document → Auto-fills all line items
- Manual entry → Click "Add Line Item" as needed

## User Workflow

### Option 1: Upload Document (Recommended)
1. Fill in basic info (Supplier, Date, Type, Location)
2. Upload invoice/receipt (CSV or Excel)
3. Click "Parse Document"
4. ✨ All line items auto-populate
5. Review and submit

### Option 2: Manual Entry
1. Fill in basic info
2. Click "Add Line Item"
3. Fill in product details
4. Repeat as needed
5. Submit

### Option 3: Hybrid Approach
1. Upload document to get most items
2. Click "Add Line Item" to add missing products
3. Remove unwanted items
4. Submit

## Empty State Message

The form now shows a clear empty state:

```
📦 (icon)
No Line Items Added
Upload an invoice/receipt to auto-fill, or click "Add Line Item" to enter manually
```

This guides users to either:
- Upload a document for automatic parsing
- Click "Add Line Item" for manual entry

## Benefits

✅ **Cleaner Start** - No pre-filled rows to clear
✅ **Better UX** - Clear instructions on what to do
✅ **Upload-First Flow** - Encourages using the upload feature
✅ **Flexibility** - Still allows manual entry when needed

## Validation

The form still validates that:
- At least one line item exists before submission
- All line items have required fields filled

If you try to submit with no line items:
```
Alert: "Please add at least one line item"
```

## Implementation

**Changed:** `src/pages/receiving/new.astro`
- Removed automatic `addLineItem()` call on page load
- Updated empty state message to mention upload option
- Added check to show empty state if no items parsed

**Result:**
- Form starts empty by default
- Only populates when user uploads document or manually adds items

---

**Status:** ✅ Complete
**User Experience:** Improved for document upload workflow
