# Price Change Detection Implementation

## Summary
Successfully implemented automatic price change detection during pricelist upload. The system now compares new pricelists against previous ones from the same supplier and tracks price changes in Firestore.

## What Was Added

### Changes to `src/pages/pricelists/upload.astro`

#### 1. New Imports
Added `orderBy` and `limit` to Firestore imports:
```typescript
import { collection, addDoc, serverTimestamp, writeBatch, doc, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
```

#### 2. Price Change Detection Logic
Added after product matching and before final status update (around line 700):

**Flow:**
1. Query for previous pricelist from same supplier
2. Fetch items from both pricelists
3. Compare prices by supplier code
4. Calculate percentage and absolute changes
5. Store significant changes (>10%) in Firestore
6. Log results to console

**Key Calculations:**
```typescript
absoluteChange = Math.round((newPrice - oldPrice) * 100) / 100
percentageChange = ((newPrice - oldPrice) / oldPrice) * 100 (rounded to 2 decimals)
isSignificant = percentageChange > 10
```

## How It Works

### Upload Flow:
```
┌─────────────────┐
│ Upload CSV      │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse & Store   │
│ Pricelist Items │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Match Products  │
│ (Exact/Fuzzy)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Find Previous   │◄─── Same Supplier
│ Pricelist       │     Processed Status
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Compare Prices  │
│ by Supplier Code│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate:      │
│ • Percentage Δ  │
│ • Absolute Δ    │
│ • Is Significant│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store in        │
│ price_changes   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redirect to     │
│ Review Page     │
└─────────────────┘
```

### Data Stored in `price_changes` Collection

Each price change document contains:
```typescript
{
  sku: string,                    // Matched SKU or supplier code
  supplierId: string,             // Supplier ID
  supplierCode: string,           // Supplier's product code
  description: string,            // Product description
  oldPrice: number,               // Previous price
  newPrice: number,               // Current price
  absoluteChange: number,         // Difference (₱)
  percentageChange: number,       // Percentage increase/decrease
  changeDate: Timestamp,          // When detected
  isSignificant: boolean,         // true if > 10% increase
  oldPricelistId: string,         // Previous pricelist reference
  newPricelistId: string,         // Current pricelist reference
}
```

## Query Used to Find Previous Pricelist

```typescript
query(
  collection(db, 'pricelists'),
  where('supplierId', '==', supplierId),
  where('status', '==', 'processed'),
  orderBy('uploadDate', 'desc'),
  limit(2)  // Current + previous
)
```

**This query requires a Firestore composite index!**

## Required Firestore Index ⚠️

### Index Configuration

**Collection:** `pricelists`
**Fields (in order):**
1. `supplierId` - Ascending
2. `status` - Ascending
3. `uploadDate` - Descending

### Why This Index Is Needed

The query filters by TWO fields (`supplierId` and `status`) AND orders by a THIRD field (`uploadDate`). Firestore requires a composite index for this type of query.

### How to Create the Index

#### Method 1: Automatic Creation on First Run

1. Upload a pricelist
2. When price change detection runs, you'll see a console error with a link
3. Click the link to go to Firebase Console
4. Click "Create Index"
5. Wait 1-2 minutes for it to build

#### Method 2: Manual Creation in Firebase Console

1. Go to https://console.firebase.google.com
2. Select project: `tpro-synapse`
3. Navigate to **Firestore Database** → **Indexes**
4. Click **"Create Index"**
5. Configure:
   - **Collection ID:** `pricelists`
   - **Fields to index:**
     - `supplierId` - Ascending
     - `status` - Ascending
     - `uploadDate` - Descending
   - **Query scope:** Collection
6. Click **"Create"**
7. Wait for status to show "Enabled"

#### Method 3: Using firestore.indexes.json

Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "pricelists",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "supplierId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "uploadDate",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

Deploy with:
```bash
firebase deploy --only firestore:indexes
```

## Console Output

### Successful Detection Example:
```
=== PRICE CHANGE DETECTION START ===
Found 2 pricelists for supplier SUP-001
Comparing against previous pricelist: PL-2026-123456
Previous pricelist has 150 items
Current pricelist has 152 items
Price change: HAMMER-001 - 100 → 120 (20%) [SIGNIFICANT]
Price change: DRILL-003 - 250 → 265 (6%)
Price change: SAW-007 - 450 → 500 (11.11%) [SIGNIFICANT]
Detected 3 price changes (2 significant)
⚠️ WARNING: 2 significant price increases (>10%) detected!
=== PRICE CHANGE DETECTION END ===
```

### First Upload (No Previous Pricelist):
```
=== PRICE CHANGE DETECTION START ===
Found 1 pricelists for supplier SUP-001
No previous pricelist found for comparison - this is the first upload for this supplier
=== PRICE CHANGE DETECTION END ===
```

### Error Handling:
```
Price change detection error: Missing or insufficient permissions
Continuing despite price change detection error
```
(Upload continues even if detection fails)

## Viewing Price Changes

### Review Page
After uploading, the review page automatically displays:
- **Stat card** showing count of significant price changes
- **Orange badges** showing percentage increase (e.g., "↑15.3%")
- **Orange row highlighting** for items with price changes
- **Filter button** to show only items with price changes

### Example Display:
```
┌─────────────────────────────────────────────┐
│ Statistics                                  │
├─────────────────────────────────────────────┤
│ Total Items: 152                            │
│ Matched: 140                                │
│ New Products: 12                            │
│ Suggested: 0                                │
│ Price Changes: 2  ← Shows significant only │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ HAMMER-001 | Claw Hammer 16oz | ₱120.00    │
│ Flags: [NEW] [↑20%]                        │ ← Orange badge
│ (Orange background)                         │
└─────────────────────────────────────────────┘
```

## Benefits

### For Business Users:
1. **Automatic Detection** - No manual price comparison needed
2. **Visual Alerts** - Orange badges highlight significant changes
3. **Historical Tracking** - All changes stored in Firestore
4. **Filter Capability** - Quickly focus on items with price increases

### For Management:
1. **Cost Tracking** - Monitor supplier price trends
2. **Budget Planning** - Identify cost pressure areas
3. **Supplier Analysis** - Compare pricing behavior across suppliers
4. **Reporting** - Data available for price change reports

## Configuration

### Significance Threshold
Currently hardcoded to **10%**

To change:
```typescript
const isSignificant = percentageChange > 10;  // Change this value
```

Could be made configurable:
- Per supplier (different thresholds for different suppliers)
- Per category (higher threshold for volatile categories)
- System-wide setting (stored in Firestore config)

## Error Handling

The implementation includes robust error handling:

1. **Try-Catch Wrapper** - Entire detection wrapped in try-catch
2. **Non-Blocking** - Upload succeeds even if detection fails
3. **Console Logging** - Errors logged for debugging
4. **User Notification** - Upload still redirects to review page

## Performance Considerations

### Query Optimization:
- Uses `limit(2)` to fetch only 2 pricelists (current + previous)
- Filters by `status == 'processed'` to exclude incomplete uploads
- Orders by `uploadDate desc` to get most recent first

### Scalability:
- Processes items in memory (no additional Firestore reads per comparison)
- Writes price changes individually (could be batched for large pricelists)
- Suitable for pricelists up to ~5,000 items

### For Very Large Pricelists (>5,000 items):
Consider:
- Batch writes in chunks of 500
- Cloud Function trigger instead of client-side detection
- Background processing with job queue

## Testing

### Test Scenario 1: First Upload
1. Upload pricelist for new supplier
2. Verify no price changes detected
3. Check console: "No previous pricelist found"

### Test Scenario 2: Price Increase
1. Upload pricelist with item at ₱100
2. Upload new pricelist with same item at ₱115
3. Verify price change detected: 15% increase, significant
4. Check review page shows orange badge

### Test Scenario 3: Small Change
1. Upload pricelist with item at ₱100
2. Upload new pricelist with same item at ₱105
3. Verify price change detected: 5% increase, NOT significant
4. Check review page - no orange badge

### Test Scenario 4: Multiple Changes
1. Upload pricelist with 10 items
2. Change 3 items (1 significant, 2 minor)
3. Upload new pricelist
4. Verify 3 changes detected, 1 significant
5. Check review page shows correct count

## Future Enhancements

### Planned Features:
1. **Email Notifications** - Alert buyers of significant price increases
2. **Price History Charts** - Visualize trends over time
3. **Price Alerts** - Set thresholds per product/category
4. **Competitor Comparison** - Compare prices across suppliers
5. **Automatic Pricing Updates** - Suggest retail price adjustments

### Dashboard Integration:
- Monthly price change reports
- Supplier cost trends
- Category inflation analysis
- Budget impact projections

## Troubleshooting

### Issue: No price changes detected
**Check:**
- Is this the first upload for this supplier?
- Do items have matching supplier codes between uploads?
- Are prices actually different?
- Check console logs for detection process

### Issue: Index error
**Solution:**
- Create the required composite index (see above)
- Wait for index to build (1-2 minutes)
- Try upload again

### Issue: Detection fails silently
**Check:**
- Console for error messages
- Firestore permissions
- Previous pricelist query results
- Item comparison logic

### Issue: Too many/few significant changes
**Adjust:**
- Change threshold from 10% to desired value
- Consider category-specific thresholds
- Review calculation logic

## Files Modified

- `src/pages/pricelists/upload.astro` - Added price change detection logic
- `firestore.indexes.json` - Add required index (recommended)

## Related Documentation

- `PRICE_CHANGE_LOGIC.md` - Detailed explanation of price change algorithms
- `NEW_PRODUCTS_TERMINOLOGY_UPDATE.md` - Review page terminology changes
- `FIRESTORE_INDEX_SETUP_GUIDE.md` - General index setup instructions

## Status

✅ **Implementation Complete**
✅ **Console Logging Active**
⚠️ **Index Required** - Create before production use
⚠️ **Notifications Pending** - Email/SMS alerts not yet implemented

---

**Ready for Testing!** Upload two pricelists from the same supplier with different prices to see price change detection in action.
