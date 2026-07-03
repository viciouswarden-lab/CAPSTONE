# Receiving Upload Troubleshooting

## Issue: Items and Quantities Not Showing After Upload

### Root Cause Analysis

The items/quantities won't display if the line items don't have valid SKUs when saved to Firestore.

### Common Scenarios:

#### Scenario 1: SKUs Don't Match (Most Common)
**Problem:** CSV has SKUs like `HW-HAM-001` but your products database has different SKUs

**Check:**
1. Open browser console (F12)
2. Look for messages like: `No match found for: HW-HAM-001`
3. This means the CSV SKU doesn't exist in your products

**Solution:**
- **Option A:** Edit CSV to use your actual product SKUs
- **Option B:** After parsing, manually select products from dropdown
- **Option C:** Create products with matching SKUs first

#### Scenario 2: No SKU Column in CSV
**Problem:** CSV only has description and quantity, no supplier_code column

**What Happens:**
- Parser tries fuzzy matching by description
- If no match, SKU dropdown stays empty
- Empty SKU = item won't be saved

**Solution:**
- After parsing, manually select product from SKU dropdown for each item

#### Scenario 3: Products Don't Exist Yet
**Problem:** You're receiving new products not in your catalog

**Solution:**
1. Parse the CSV
2. For unmatched items, click "Add as New Product" (if available)
3. OR manually go to `/admin/seed-products` to add products first

### Debugging Steps:

#### Step 1: Check Browser Console
```
F12 → Console tab
Look for:
- "Parsed document:" - shows what was extracted
- "Processing parsed item:" - shows each item
- "Matched product:" or "No match found" - shows matching results
- "Line items to save:" - shows what will be saved
```

#### Step 2: Check What's Being Parsed
After clicking "Parse Document", check console for:
```javascript
Parsed document: {
  lineItems: [
    {
      supplierCode: "HW-HAM-001",
      description: "Claw Hammer 16oz",
      quantity: 50,
      expectedQuantity: 48
    }
  ]
}
```

#### Step 3: Check Product Matching
Look for console messages:
```
✅ Matched product: HW-HAM-001
❌ No match found for: HW-HAM-001
```

#### Step 4: Check What's Being Saved
Before submission, check console:
```javascript
Line items to save: [
  {
    sku: "HW-HAM-001",  // ← Must have valid SKU
    quantity: 50,
    locationId: "warehouse",
    expectedQuantity: 48
  }
]
```

If array is empty `[]`, nothing will be saved!

### Quick Fixes:

#### Fix 1: Manual SKU Selection
After parsing:
1. For each line item without a selected SKU
2. Click the SKU dropdown
3. Select the correct product
4. Repeat for all items
5. Submit

#### Fix 2: Update CSV with Correct SKUs
1. Go to `/products` page
2. Note your actual product SKUs
3. Update CSV file to use those SKUs in the `supplier_code` column
4. Re-upload and parse

#### Fix 3: Seed Products First
If products don't exist:
1. Go to `/admin/seed-products`
2. Click "Seed Products" to add 30 sample products
3. OR manually add products via `/products`
4. Then upload receiving document

### Testing the Fix:

#### Test 1: Verify Products Exist
```sql
1. Go to /products
2. Check if products like HW-HAM-001 exist
3. If not, seed products first
```

#### Test 2: Upload and Check Console
```javascript
1. Upload CSV
2. Click Parse
3. Check console for "Matched product:" messages
4. Should see: "Matched product: HW-HAM-001" for each item
```

#### Test 3: Verify Before Submit
```javascript
1. Before clicking submit
2. Check each line item has:
   - Selected SKU in dropdown (not empty)
   - Quantity filled in
   - Description shown
```

#### Test 4: Check Firestore After Submit
```javascript
1. Submit form
2. Go to /receiving
3. Should show correct item count and quantity
4. Click view icon
5. Should see all line items
```

### Expected Console Output (Success):

```
Parsed document: { lineItems: Array(5), warnings: [] }
Number of items parsed: 5
Processing parsed item: { supplierCode: "HW-HAM-001", description: "...", quantity: 50 }
Matched product: HW-HAM-001
Processing parsed item: { supplierCode: "HW-SCR-001", description: "...", quantity: 25 }
Matched product: HW-SCR-001
...
Line items to save: Array(5)
  0: {sku: "HW-HAM-001", quantity: 50, locationId: "warehouse"}
  1: {sku: "HW-SCR-001", quantity: 25, locationId: "warehouse"}
  ...
```

### Expected Console Output (Problem):

```
Parsed document: { lineItems: Array(5), warnings: [] }
Number of items parsed: 5
Processing parsed item: { supplierCode: "HW-HAM-001", description: "...", quantity: 50 }
No match found for: HW-HAM-001 Claw Hammer 16oz  ← Problem!
...
Line items to save: Array(0)  ← Empty! Nothing will be saved
  length: 0
```

### Solution Summary:

| Problem | Solution |
|---------|----------|
| SKUs don't match | Update CSV or manually select products |
| Products don't exist | Seed products first or add manually |
| No SKU column | Manually select from dropdown after parse |
| Empty line items saved | Check console, verify SKUs selected |

### Still Not Working?

1. **Check Firestore directly:**
   - Go to Firebase Console
   - Open `receiving_records` collection
   - Find your record
   - Check if `lineItems` array exists and has data

2. **Check network tab:**
   - F12 → Network tab
   - Submit form
   - Look for errors in the response

3. **Share console output:**
   - Copy full console output
   - Share for debugging

---

**Key Point:** Line items MUST have valid SKUs to be saved. If SKU dropdown is empty, that line item will be skipped!
