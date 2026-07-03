# Price Change Detection Logic

## Overview
The system detects and tracks price changes between pricelists from the same supplier. It compares new uploads against previous pricelists to identify price increases, calculates percentage changes, and flags significant changes (>10% increase).

## How It Works

### 1. Detection Trigger
Price changes are detected when:
- A new pricelist is uploaded for a supplier
- The system finds a previous pricelist from the same supplier
- The same product (matched by supplier code) exists in both pricelists

### 2. Calculation Process

#### A. Price Comparison (`PriceChangeDetector`)
**Location:** `src/services/pricing/PriceChangeDetector.ts`

For each product that exists in both the old and new pricelists:

1. **Percentage Change:**
   ```
   percentage_change = ((new_price - old_price) / old_price) × 100
   ```
   - Rounded to 2 decimal places
   - Handles division by zero (returns 0 if old price is 0)

2. **Absolute Difference:**
   ```
   absolute_change = new_price - old_price
   ```
   - Rounded to 2 decimal places

3. **Significance Check:**
   ```
   isSignificant = percentage_change > 10
   ```
   - Only increases greater than 10% are flagged as significant
   - Decreases are NOT flagged as significant

#### B. Example Calculations

**Example 1: Significant Increase**
- Old Price: ₱100.00
- New Price: ₱115.00
- Percentage Change: ((115 - 100) / 100) × 100 = **15%**
- Absolute Change: ₱15.00
- Is Significant: **YES** (> 10%)

**Example 2: Non-Significant Increase**
- Old Price: ₱100.00
- New Price: ₱108.00
- Percentage Change: ((108 - 100) / 100) × 100 = **8%**
- Absolute Change: ₱8.00
- Is Significant: **NO** (≤ 10%)

**Example 3: Price Decrease**
- Old Price: ₱100.00
- New Price: ₱85.00
- Percentage Change: ((85 - 100) / 100) × 100 = **-15%**
- Absolute Change: -₱15.00
- Is Significant: **NO** (not an increase)

### 3. Storage in Firestore

#### Collection: `price_changes`
Each price change is stored as a document with:

```typescript
{
  sku: string,                    // Product SKU (or supplier code)
  supplierId: string,             // Supplier ID
  oldPrice: number,               // Previous price
  newPrice: number,               // Current price
  absoluteChange: number,         // Difference in currency
  percentageChange: number,       // Percentage difference
  changeDate: Timestamp,          // When the change occurred
  isSignificant: boolean,         // true if > 10% increase
  oldPricelistId: string,         // Reference to old pricelist
  newPricelistId: string,         // Reference to new pricelist
}
```

### 4. Query and Display

#### Review Page (`src/pages/pricelists/review.astro`)
Displays price changes for a specific pricelist:

```typescript
// Query for significant price changes
const priceChangesQuery = query(
  priceChangesRef,
  where('newPricelistId', '==', pricelistId),
  where('isSignificant', '==', true)
);
```

**Display Features:**
- Stat card showing count of significant price changes
- Orange badges showing percentage increase (e.g., "↑15.3%")
- Orange row highlighting for items with price changes
- Filter button to show only items with price changes

#### Dashboard (`src/services/pricing/PriceMonitorService.ts`)
Dashboard metrics are aggregated by month:

```typescript
// Query significant changes in date range
const q = query(
  priceChangesRef,
  where('isSignificant', '==', true),
  where('changeDate', '>=', startDate),
  where('changeDate', '<=', endDate),
  orderBy('changeDate', 'desc')
);
```

### 5. Notifications (Future Feature)

When significant price changes are detected, the system:
1. Logs notifications to console (placeholder)
2. Updates dashboard metrics for monthly aggregation
3. Stores change data for future notification service integration

**Planned notification methods:**
- Email alerts
- Push notifications
- Slack webhooks
- SMS alerts

## Current Limitations

### ⚠️ Price Change Detection Not Yet Implemented in Upload Flow
The price change detection logic exists but is **NOT currently called** during pricelist upload. 

**What's Missing:**
- The upload page doesn't call `PriceMonitorService.detectPriceChanges()`
- Price changes are NOT automatically detected when uploading pricelists
- The `price_changes` collection may be empty unless manually populated

**To Implement:**
In `src/pages/pricelists/upload.astro`, after creating pricelist items:
```typescript
// After saving pricelist and items to Firestore:

// 1. Query for previous pricelist from same supplier
const previousPricelists = await getDocs(query(
  collection(db, 'pricelists'),
  where('supplierId', '==', supplierId),
  where('uploadDate', '<', currentPricelist.uploadDate),
  orderBy('uploadDate', 'desc'),
  limit(1)
));

// 2. If previous pricelist exists, detect price changes
if (!previousPricelists.empty) {
  const priceMonitorService = new PriceMonitorService(db);
  await priceMonitorService.detectPriceChanges(
    currentPricelistData,
    previousPricelistData,
    newPricelistId,
    oldPricelistId
  );
}
```

## Firestore Indexes Required

To efficiently query price changes, these composite indexes are needed:

1. **For review page:**
   - Collection: `price_changes`
   - Fields: `newPricelistId` ASC, `isSignificant` ASC

2. **For dashboard:**
   - Collection: `price_changes`
   - Fields: `changeDate` DESC, `isSignificant` ASC

3. **For price history:**
   - Collection: `price_changes`
   - Fields: `sku` ASC, `changeDate` ASC, `supplierId` ASC

## Data Flow Diagram

```
┌─────────────────┐
│  Upload New     │
│  Pricelist      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Find Previous  │
│  Pricelist      │◄─── Same Supplier
│  (Same Supplier)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Compare Prices  │
│ (Detector)      │
│                 │
│ • Calculate %   │
│ • Calculate Δ   │
│ • Check >10%    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store Changes   │
│ in Firestore    │
│ (price_changes) │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────┐   ┌──────────────┐
│ Update      │   │ Trigger      │
│ Dashboard   │   │ Notifications│
│ Metrics     │   │ (Future)     │
└─────────────┘   └──────────────┘
```

## User Workflow

### For Business Users:
1. **Upload new pricelist** → System automatically detects changes
2. **Review pricelist** → See orange badges for price increases
3. **Filter by price changes** → Focus on items that increased significantly
4. **Update pricing strategy** → Decide whether to pass increases to customers

### For Management:
1. **View dashboard** → See monthly trends in supplier price changes
2. **Review significant changes** → Identify cost pressure areas
3. **Plan accordingly** → Adjust budgets, pricing, or suppliers

## Configuration

### Change Significance Threshold
Default: **10%**

To modify:
- Update `PriceChangeDetector.isSignificantIncrease()` method
- Current logic: `percentageChange > 10`
- Could be made configurable per supplier or category

### Date Range Queries
Default: Last 30 days for dashboard

To modify:
- Update dashboard queries in reporting service
- Adjust `DateRange` parameters in `getSignificantChanges()`

## Testing

The price change logic includes comprehensive tests:
- `src/services/pricing/PriceChangeDetector.test.ts`
- `src/services/pricing/PriceMonitorService.test.ts`
- `src/tests/integration/pricelistProcessing.integration.test.ts`

All tests verify:
- Correct percentage calculations
- Proper significance flagging
- Firestore storage
- Query performance
