# Price Change Detection - Quick Start

## ✅ Implementation Complete!

Price change detection has been successfully added to the pricelist upload process.

## How to Test

### Step 1: Upload First Pricelist
```
1. Go to /pricelists/upload
2. Select a supplier
3. Upload a CSV file with prices
4. Wait for processing
```

**Console Output:**
```
No previous pricelist found for comparison - this is the first upload for this supplier
```

### Step 2: Upload Second Pricelist (with price changes)
```
1. Go to /pricelists/upload again
2. Select THE SAME supplier
3. Upload a CSV with SAME products but DIFFERENT prices
4. Wait for processing
```

**Console Output:**
```
Detected 5 price changes (2 significant)
⚠️ WARNING: 2 significant price increases (>10%) detected!
```

### Step 3: View Results
```
1. You'll be redirected to the review page
2. Look for:
   - "Price Changes" stat card showing count
   - Orange badges on items (e.g., "↑15.3%")
   - Orange row highlighting
   - Filter button: "Price Changes"
```

## ⚠️ Required: Firestore Index

The first time you run this, you'll see an error about a missing index.

**Quick Fix:**
1. Check browser console for the error
2. Click the link in the error message
3. Firebase Console will open with index pre-configured
4. Click "Create Index"
5. Wait 1-2 minutes
6. Try uploading again

**Index Details:**
- Collection: `pricelists`
- Fields: `supplierId ASC`, `status ASC`, `uploadDate DESC`

## What Gets Detected

### Significant Changes (>10% increase):
- Shows in "Price Changes" stat card
- Gets orange badge with percentage
- Row highlighted in orange
- Stored with `isSignificant: true`

### All Changes:
- Stored in `price_changes` collection
- Available for reporting and analysis
- Includes increases AND decreases

## Example Test Data

### First Upload (prices-v1.csv):
```csv
Code,Description,Price,UOM
HAMMER-001,Claw Hammer 16oz,100.00,PCS
DRILL-001,Cordless Drill 18V,2500.00,SET
SAW-001,Hand Saw 20in,450.00,PCS
```

### Second Upload (prices-v2.csv):
```csv
Code,Description,Price,UOM
HAMMER-001,Claw Hammer 16oz,120.00,PCS
DRILL-001,Cordless Drill 18V,2600.00,SET
SAW-001,Hand Saw 20in,455.00,PCS
```

**Expected Results:**
- HAMMER-001: 20% increase → **SIGNIFICANT** (₱100 → ₱120)
- DRILL-001: 4% increase → not significant (₱2500 → ₱2600)
- SAW-001: 1.11% increase → not significant (₱450 → ₱455)

**Console will show:**
```
Detected 3 price changes (1 significant)
⚠️ WARNING: 1 significant price increases (>10%) detected!
```

## Troubleshooting

### "No index found" error
→ Create the Firestore composite index (see above)

### "No price changes detected" 
→ Make sure:
- Same supplier for both uploads
- Same supplier codes in CSV
- Different prices between uploads

### Upload succeeds but no detection log
→ Check:
- Browser console for errors
- Firestore permissions
- Previous pricelist exists with status='processed'

## Configuration

**Significance Threshold:** Currently 10%

To change, edit `src/pages/pricelists/upload.astro` around line 720:
```typescript
const isSignificant = percentageChange > 10;  // Change this value
```

## What's Next

After testing:
1. ✅ Verify price changes appear on review page
2. ✅ Check `price_changes` collection in Firestore
3. ✅ Test filtering by price changes
4. 📧 Set up email notifications (future)
5. 📊 Add price change reports to dashboard (future)

---

**Ready to test!** Upload two pricelists from the same supplier with different prices.
