# Receiving to Inventory Flow

## Overview

When products are received through the `/receiving/new` page, the system automatically updates inventory quantities and creates a complete audit trail.

## Step-by-Step Process

### 1. User Creates Receiving Record
**Location:** `/receiving/new`

User fills in:
- Supplier
- Receiving Date
- Document Type (Invoice or Delivery Receipt)
- Location (where products are being received)
- Line Items (SKU, Received Quantity, Expected Quantity)

### 2. Variance Detection
**Automatic:** During form entry

- System compares received vs expected quantities
- Flags items with >5% variance
- Shows visual warnings on individual line items
- Sets `hasVariance` flag on the receiving record

### 3. Receiving Record Creation
**Collection:** `receiving_records`

Record includes:
```javascript
{
  receivingId: "RCV-2026-123456",
  supplierId: "supplier_id",
  receivingDate: Timestamp,
  documentType: "invoice" | "delivery_receipt",
  status: "completed",
  hasVariance: true/false,
  lineItems: [
    {
      sku: "HW-HAM-001",
      quantity: 50,
      expectedQuantity: 48, // optional
      locationId: "warehouse"
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4. Inventory Updates
**Service:** `InventoryService.processReceiving()`

For each line item:

#### 4.1 Atomic Inventory Adjustment
**Collection:** `inventory`

- Uses Firestore transaction for atomicity
- Creates or updates inventory record with composite ID: `{sku}_{locationId}`
- Formula: `new_quantity = current_quantity + received_quantity`
- Updates `lastUpdated` timestamp

**Example:**
```javascript
// Before receiving
{ inventoryId: "HW-HAM-001_warehouse", quantityOnHand: 10 }

// After receiving 50 units
{ inventoryId: "HW-HAM-001_warehouse", quantityOnHand: 60 }
```

#### 4.2 Transaction History Record
**Collection:** `inventory_transactions`

Creates audit trail:
```javascript
{
  transactionId: "1735934400000_HW-HAM-001_warehouse",
  sku: "HW-HAM-001",
  locationId: "warehouse",
  transactionType: "receiving",
  quantityChange: +50,
  quantityBefore: 10,
  quantityAfter: 60,
  timestamp: Timestamp,
  userId: "RCV-2026-123456", // receiving ID as reference
  notes: "Receiving RCV-2026-123456 - invoice"
}
```

#### 4.3 Low Stock Alert Check
**Collection:** `low_stock_alerts`

After updating inventory:
- Compares new quantity vs product's reorder point
- If `quantity < reorderPoint`: Creates/updates active alert
- If `quantity >= reorderPoint`: Resolves existing alert

**Alert Structure:**
```javascript
{
  alertId: "HW-HAM-001_warehouse",
  sku: "HW-HAM-001",
  locationId: "warehouse",
  currentQuantity: 60,
  reorderPoint: 20,
  status: "resolved", // was "active", now resolved
  createdAt: Timestamp,
  updatedAt: Timestamp,
  resolvedAt: Timestamp
}
```

### 5. Progress Feedback
**UI:** Progress modal

User sees real-time progress:
- 10%: Preparing receiving record...
- 30%: Validating line items...
- 60%: Creating receiving record...
- 80%: Updating inventory...
- 100%: Complete!

### 6. Redirect to Receiving List
After success, user is redirected to `/receiving` to see the new record in the list.

## Data Consistency

### Atomic Operations
- Inventory updates use Firestore transactions
- Ensures inventory quantity and transaction history are always in sync
- Prevents race conditions from concurrent updates

### Validation
- SKU must exist in products collection
- Quantity must be positive
- Location must be specified
- Transaction fails if validation fails (no partial updates)

### Audit Trail
Every inventory change is recorded:
- What changed (SKU, quantity)
- Where it changed (location)
- When it changed (timestamp)
- Why it changed (transaction type: receiving)
- Who initiated it (user/receiving ID)

## Collections Affected

1. **receiving_records** - New record created
2. **inventory** - Quantities updated (one per SKU-location combination)
3. **inventory_transactions** - Transaction records created (audit trail)
4. **low_stock_alerts** - Alerts created/updated/resolved

## Error Handling

If any step fails:
- Transaction is rolled back (atomicity)
- User sees error message
- No partial updates occur
- User can correct and retry

## Benefits

✅ **Automatic** - No manual inventory updates needed
✅ **Accurate** - Atomic transactions prevent inconsistencies
✅ **Auditable** - Complete transaction history
✅ **Proactive** - Automatic low stock detection
✅ **Transparent** - Progress feedback during operation
✅ **Reliable** - Error handling prevents partial states

## Future Enhancements

Potential improvements:
- Purchase order matching (compare received vs PO quantities)
- Barcode scanning for faster receiving
- Photo upload for received products
- Quality inspection workflow
- Multiple location receiving in single record
- Batch receiving from CSV upload
- Real-time inventory notifications
