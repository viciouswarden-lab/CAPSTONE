# Supplier Service

## Overview

The `SupplierService` manages supplier records in the PRO SYNAPSE system. It provides complete CRUD operations, search functionality, and audit trail maintenance using Firebase Firestore.

## Requirements Validated

- **2.1**: Create new supplier records with name, contact information, and business details
- **2.2**: Update supplier information while maintaining an audit trail
- **2.3**: Deactivate suppliers (mark as inactive without deleting historical data)
- **2.4**: Provide searchable list of all suppliers with current status
- **2.5**: Return search results within 2 seconds

## Features

### CRUD Operations

- **Create**: Generate new supplier records with auto-generated IDs
- **Read**: Retrieve individual suppliers or lists of suppliers
- **Update**: Modify supplier information with automatic timestamp updates
- **Deactivate/Reactivate**: Soft delete functionality preserving historical data

### Search Functionality

- Text-based search across multiple fields (name, contact person, email)
- Case-insensitive partial matching
- Filter by active/inactive status
- Results sorted alphabetically by name

### Audit Trail

All operations automatically maintain:
- `createdAt`: Timestamp when supplier was created
- `updatedAt`: Timestamp of last modification
- `createdBy`: User ID who created the record

## API Reference

### createSupplier

```typescript
async createSupplier(
  supplier: Omit<Supplier, 'supplierId' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  userId: string
): Promise<Supplier>
```

Creates a new supplier record with auto-generated ID.

**Parameters:**
- `supplier`: Supplier data (without ID and audit fields)
- `userId`: ID of user creating the supplier

**Returns:** Created supplier with generated ID

**Throws:** Error if creation fails

**Example:**
```typescript
const newSupplier = await supplierService.createSupplier({
  name: 'ABC Supplies Inc',
  contactPerson: 'John Doe',
  email: 'john@abcsupplies.com',
  phone: '+1-555-0100',
  address: '123 Main St, Anytown, USA',
  isActive: true
}, 'user123');
```

### getSupplier

```typescript
async getSupplier(supplierId: string): Promise<Supplier | null>
```

Retrieves a supplier by ID.

**Parameters:**
- `supplierId`: Supplier ID to retrieve

**Returns:** Supplier object or null if not found

**Throws:** Error if retrieval fails

### updateSupplier

```typescript
async updateSupplier(
  supplierId: string,
  updates: Partial<Omit<Supplier, 'supplierId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<Supplier>
```

Updates an existing supplier record. Automatically updates `updatedAt` timestamp.

**Parameters:**
- `supplierId`: Supplier ID to update
- `updates`: Partial supplier data to update

**Returns:** Updated supplier

**Throws:** Error if supplier not found or update fails

**Example:**
```typescript
const updated = await supplierService.updateSupplier('supplier123', {
  email: 'newemail@abcsupplies.com',
  phone: '+1-555-0200'
});
```

### deactivateSupplier

```typescript
async deactivateSupplier(supplierId: string): Promise<void>
```

Marks a supplier as inactive without deleting the record. Preserves all historical data.

**Parameters:**
- `supplierId`: Supplier ID to deactivate

**Throws:** Error if supplier not found or deactivation fails

### reactivateSupplier

```typescript
async reactivateSupplier(supplierId: string): Promise<void>
```

Marks a previously deactivated supplier as active.

**Parameters:**
- `supplierId`: Supplier ID to reactivate

**Throws:** Error if supplier not found or reactivation fails

### searchSuppliers

```typescript
async searchSuppliers(
  searchText: string,
  includeInactive?: boolean
): Promise<Supplier[]>
```

Searches for suppliers by text matching across name, contact person, and email fields.

**Parameters:**
- `searchText`: Text to search for (case-insensitive)
- `includeInactive`: Whether to include inactive suppliers (default: false)

**Returns:** Array of matching suppliers sorted by name

**Throws:** Error if search fails

**Example:**
```typescript
// Search for suppliers with "ABC" in name, contact, or email
const results = await supplierService.searchSuppliers('ABC');

// Include inactive suppliers in search
const allResults = await supplierService.searchSuppliers('ABC', true);
```

### getAllSuppliers

```typescript
async getAllSuppliers(
  includeInactive?: boolean,
  limitCount?: number
): Promise<Supplier[]>
```

Retrieves all suppliers with optional filtering and limiting.

**Parameters:**
- `includeInactive`: Whether to include inactive suppliers (default: false)
- `limitCount`: Maximum number of results to return (optional)

**Returns:** Array of suppliers sorted by name

**Throws:** Error if retrieval fails

**Example:**
```typescript
// Get all active suppliers
const activeSuppliers = await supplierService.getAllSuppliers();

// Get all suppliers including inactive
const allSuppliers = await supplierService.getAllSuppliers(true);

// Get first 10 active suppliers
const limitedSuppliers = await supplierService.getAllSuppliers(false, 10);
```

### getActiveSuppliers

```typescript
async getActiveSuppliers(): Promise<Supplier[]>
```

Convenience method to retrieve only active suppliers.

**Returns:** Array of active suppliers sorted by name

**Throws:** Error if retrieval fails

## Data Model

### Supplier Interface

```typescript
interface Supplier {
  supplierId: string;          // Unique identifier
  name: string;                // Company name
  contactPerson: string;       // Contact person name
  email: string;               // Contact email
  phone: string;               // Contact phone number
  address: string;             // Physical address
  isActive: boolean;           // Active status
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
  createdBy: string;           // User ID who created
}
```

## Usage

### Import

```typescript
import { supplierService } from '@/services/suppliers';
```

### Complete Example

```typescript
import { supplierService } from '@/services/suppliers';

// Create a new supplier
const supplier = await supplierService.createSupplier({
  name: 'Tech Distributors LLC',
  contactPerson: 'Jane Smith',
  email: 'jane@techdist.com',
  phone: '+1-555-0300',
  address: '456 Tech Blvd, Silicon Valley, CA 94000',
  isActive: true
}, currentUserId);

console.log(`Created supplier: ${supplier.supplierId}`);

// Search for suppliers
const searchResults = await supplierService.searchSuppliers('Tech');
console.log(`Found ${searchResults.length} suppliers`);

// Update supplier
await supplierService.updateSupplier(supplier.supplierId, {
  phone: '+1-555-0400'
});

// Deactivate supplier
await supplierService.deactivateSupplier(supplier.supplierId);
```

## Performance Considerations

### Search Performance

- Search queries filter by `isActive` status first for better performance
- Results are sorted by name for consistent ordering
- For large datasets, consider using the `limitCount` parameter

### Firestore Queries

The service uses the following Firestore queries:

1. **Single document reads**: Direct document reference (fast)
2. **Active suppliers query**: Filtered by `isActive == true` with name ordering
3. **All suppliers query**: Name ordering only
4. **Search queries**: Full collection scan with client-side filtering

### Required Indexes

For optimal performance, ensure the following Firestore composite index exists:

```
Collection: suppliers
Fields:
  - isActive (Ascending)
  - name (Ascending)
```

## Error Handling

All methods throw descriptive errors:

- **Creation errors**: "Failed to create supplier: [reason]"
- **Retrieval errors**: "Failed to get supplier [id]: [reason]"
- **Update errors**: "Failed to update supplier [id]: [reason]" or "Supplier [id] not found"
- **Deactivation errors**: "Failed to deactivate supplier [id]: [reason]" or "Supplier [id] not found"
- **Search errors**: "Failed to search suppliers: [reason]"

Always wrap service calls in try-catch blocks:

```typescript
try {
  const supplier = await supplierService.getSupplier(id);
  // Process supplier
} catch (error) {
  console.error('Failed to retrieve supplier:', error);
  // Handle error appropriately
}
```

## Testing

The service includes comprehensive unit tests covering:

- CRUD operations
- Search functionality
- Error handling
- Audit trail maintenance
- Edge cases (non-existent records, etc.)

Run tests:

```bash
npm test -- SupplierService.test.ts
```

## Implementation Notes

### Soft Deletes

The service implements soft deletes using the `isActive` flag rather than actually deleting documents. This ensures:

- Historical data is preserved for audit trails
- References from other documents remain valid
- Reactivation is possible if needed

### Audit Trail

All create and update operations automatically maintain audit fields:

- `createdAt` and `createdBy` are set once during creation
- `updatedAt` is updated on every modification
- Timestamps use Firestore's `Timestamp.now()` for server-side consistency

### Search Strategy

The current implementation uses client-side filtering after fetching documents. For large datasets (>1000 suppliers), consider:

1. Implementing full-text search using Algolia or similar
2. Using Firestore's array-contains for tag-based filtering
3. Implementing pagination for result sets

## Future Enhancements

Potential improvements:

- **Pagination**: Add cursor-based pagination for large result sets
- **Caching**: Implement local caching for frequently accessed suppliers
- **Validation**: Add email and phone number format validation
- **Duplicate detection**: Check for duplicate supplier names before creation
- **Bulk operations**: Add methods for bulk import/export
- **Advanced search**: Support filters by creation date, user, etc.
