# Inventory Service

Real-time inventory tracking and management service for the PRO SYNAPSE system.

## Features

- **Quantity Tracking**: Monitor stock levels by product and location
- **Atomic Adjustments**: Safe inventory updates using Firestore transactions
- **Low Stock Alerts**: Automatic detection of items below reorder points
- **Audit Trail**: Complete transaction history for all inventory changes
- **Multi-location Support**: Track inventory across multiple warehouses/stores

## Usage

```typescript
import { inventoryService } from './services/inventory';

// Get current stock level
const quantity = await inventoryService.getQuantityOnHand('SKU001', 'WAREHOUSE');

// Adjust inventory (receiving, sale, or manual adjustment)
await inventoryService.adjustInventory({
  sku: 'SKU001',
  locationId: 'WAREHOUSE',
  quantityChange: 50,
  reason: 'receiving',
  userId: 'USER123',
  timestamp: new Date(),
  notes: 'Supplier shipment received'
});

// Check for low stock items
const alerts = await inventoryService.getLowStockItems();
alerts.forEach(alert => {
  console.log(`${alert.sku} is low: ${alert.currentQuantity}/${alert.reorderPoint}`);
});

// Get transaction history
const history = await inventoryService.getInventoryHistory('SKU001', {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});
```

## Low Stock Alert System

The `getLowStockItems()` method is the core of Task 11.2, implementing Requirement 8.4:

> IF inventory quantity falls below the defined reorder point, THEN THE System SHALL generate a low stock alert

### How it works:

1. Queries all inventory records (or filters by location if specified)
2. For each inventory item, retrieves the product's reorder point
3. Compares current quantity against reorder point
4. Generates alert if `currentQuantity < reorderPoint`

### Example Alert Output:

```typescript
{
  sku: 'WIDGET-001',
  currentQuantity: 15,
  reorderPoint: 20,
  locationId: 'WAREHOUSE_MAIN'
}
```

This alert indicates that WIDGET-001 currently has 15 units in stock at the main warehouse, but the reorder threshold is 20 units. An order should be placed to replenish stock.

## API Reference

### `getQuantityOnHand(sku: string, locationId?: string): Promise<number>`

Returns current quantity for a product. If `locationId` is omitted, returns total across all locations.

### `adjustInventory(adjustment: InventoryAdjustment): Promise<void>`

Adjusts inventory using the formula: `new_quantity = current_quantity + quantity_change`

Creates an audit trail transaction record automatically.

### `getLowStockItems(locationId?: string): Promise<LowStockAlert[]>`

Returns all products with `quantity < reorder_point`. Optionally filter by location.

### `processReceiving(receiving: ReceivingRecord): Promise<void>`

Processes a receiving transaction, updating inventory for all line items.

### `processSale(transaction: POSTransaction): Promise<void>`

Processes a POS sale, decreasing inventory for all sold items.

### `getInventoryHistory(sku: string, dateRange: DateRange): Promise<InventoryTransaction[]>`

Retrieves transaction history for auditing purposes.

## Testing

All functionality is covered by comprehensive unit tests:

```bash
npm test -- InventoryService.test.ts --run
```

Test coverage includes:
- Quantity retrieval (single location and totals)
- Inventory adjustments (positive and negative)
- Low stock alert generation
- Transaction history retrieval
- Edge cases (non-existent products, empty inventory)

## Requirements Satisfied

- ✅ **8.1**: Maintain current quantity on hand
- ✅ **8.2**: Update inventory on receiving and sales
- ✅ **8.3**: Atomic transaction processing
- ✅ **8.4**: Generate low stock alerts
- ✅ **8.5**: Fast inventory status retrieval (< 2 seconds)
- ✅ **8.6**: Maintain transaction history
- ✅ **8.7**: Log adjustments with user identity

## Related Documentation

- [Implementation Details](./IMPLEMENTATION.md) - Technical implementation notes
- [Type Definitions](../../types/services.ts) - Service interfaces
- [Firestore Schema](../../types/firestore.ts) - Database document types
