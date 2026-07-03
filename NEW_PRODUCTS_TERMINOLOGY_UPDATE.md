# New Products Terminology Update

## Summary
Updated both the Pricelist Review and Product Matching pages to treat unmatched items as "New Products" instead of displaying them as "Unmatched" or "Unmatched Products".

## Changes Made

### 1. Pricelist Review Page (`src/pages/pricelists/review.astro`)

**Terminology Changes:**
- Changed "Unmatched" stat card to "New Products" with blue styling
- Changed badge from red "Unmatched" to blue "New Product" 
- Updated filter dropdown option from "Unmatched" to "New Products"
- Removed duplicate stat card (was showing both "Unmatched" and "New Products")

**Logic Changes:**
- Added `isNewProduct()` helper function: `item.matchStatus === 'unmatched' || item.isNewProduct`
- All references to `item.isNewProduct` now use `isNewProduct(item)` function
- This treats all unmatched items as new products
- NEW badge now shows for unmatched items

**Visual Changes:**
- Unmatched items get blue badge instead of red
- Blue row highlighting for new/unmatched products
- Blue "new_releases" icon for the stat card

### 2. Product Matching Page (`src/pages/matching/index.astro`)

**Terminology Changes:**
- Changed "Unmatched" tab to "New Products" with "new_releases" icon
- Changed "Unmatched" stat card to "New Products" with blue styling  
- Changed status badge from red "Unmatched" to blue "New Product"

**Visual Changes:**
- Icon changed from "link_off" to "new_releases"
- Color changed from red (#ef4444) to blue (#3b82f6)
- Badge class changed from `badge-danger` to `badge-info`

## User Benefits

1. **Clearer Intent**: "New Products" is more descriptive than "Unmatched" - it tells users these are products they don't have yet
2. **Positive Framing**: "New" is more positive than "Unmatched" (which sounds like an error)
3. **Consistent Terminology**: Both pages now use the same language
4. **Better Workflow**: Users understand these items need to be added as new products to the catalog

## Affected Stat Cards

### Review Page:
- Total Items (gray)
- Matched (green) 
- **New Products (blue)** ← Changed from "Unmatched" (red)
- Suggested (orange)
- Price Changes (orange)

### Matching Page:
- Total Items (gray)
- **New Products (blue)** ← Changed from "Unmatched" (red)
- Suggested (orange)
- Matched (green)

## Affected Filters

**Review Page:**
- Match Status dropdown: "All Match Status", "Matched", **"New Products"** ← (was "Unmatched"), "Suggested"
- "New Only" button now filters for `isNewProduct(item)` which includes unmatched items

**Matching Page:**
- Tabs: "All Items", **"New Products"** ← (was "Unmatched"), "Suggested", "Matched"

## Technical Implementation

### Review Page Helper Function:
```typescript
const isNewProduct = (item: any) => item.matchStatus === 'unmatched' || item.isNewProduct;
```

This function returns `true` if:
- The item has `matchStatus === 'unmatched'` (couldn't find a match), OR
- The item has `isNewProduct === true` (explicitly marked as new)

### Badge Styling:
```typescript
// Before
unmatched: '<span class="badge badge-danger">Unmatched</span>'

// After  
unmatched: '<span class="badge badge-info">New Product</span>'
```

## Files Modified
1. `src/pages/pricelists/review.astro` - Pricelist review page
2. `src/pages/matching/index.astro` - Product matching page

## Testing Checklist
- [ ] Upload a new pricelist with unmatched items
- [ ] Verify stat cards show "New Products" instead of "Unmatched"
- [ ] Verify badges are blue and say "New Product"
- [ ] Filter by "New Products" in dropdown and verify it works
- [ ] Click "New Only" button and verify unmatched items appear
- [ ] Check matching page shows "New Products" tab with blue styling
- [ ] Verify unmatched items show blue "New Product" badge in table
- [ ] Confirm row highlighting is blue for new products
