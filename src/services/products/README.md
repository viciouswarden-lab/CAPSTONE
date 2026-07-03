# Product Service

Manages product records including CRUD operations, unique SKU constraints, search functionality, version history tracking, and supplier mappings.

## Requirements Validated

- **7.1**: WHEN a user creates a new product, THE System SHALL require SKU, description, category, and unit of measure
- **7.2**: WHEN a user updates product information, THE System SHALL save changes and maintain version history
- **7.3**: WHEN a user deactivates a product, THE System SHALL mark it as inactive while preserving historical transaction data
- **7.4**: THE System SHALL enforce unique SKU constraints across all active products
- **7.5**: WHEN a user searches for products, THE System SHALL support filtering by category, supplier, and status
- **7.6**: THE System SHALL return product search results within 2 seconds

## Features

### Product CRUD Operations

- **Create Product**: Create new products with SKU uniqueness validation
- **Get Product**: Retrieve product by SKU
- **Update Product**: Update product information with version history tracking
- **Deactivate Product**: Mark products as inactive without deletion

### Search and Filtering

- Filter by category
- Filter by supplier (checks supplierMappings)
- Filter by status (active/inactive/all)
- Text search across SKU, description, and category
- Results returned within 2 seconds (Requirement 7.6)

### Supplier Mappings

- Add supplier mapping: Links supplier product codes to internal SKUs
- Update supplier cost: Updates last cost information for specific suppliers
- Stores last cost date for historical tracking

### Version History

- Maintains complete version history for all product changes
- Records user who made changes and timestamp
- Stored in separate `product_versions` collection
- Queryable by SKU with chronological ordering

## Usage

```typescript
import { productService, CreateProductRequest } from './services/products';

// Create a new product
const newProduct: CreateProductRequest = {
  sku: 'PROD-001',
  description: 'Sample Product',
  category: 'Electronics',
  unitOfMeasure: 'each',
  reorderPoint: 10,
  isActive: true,
  supplierMappings: [
    {
      supplierId: 'SUP-001',
      supplierCode: 'ABC123',
      lastCost: 50.00,
      lastCostDate: new Date(),
    }
  ],
};

const product = await productService.createProduct(newProduct);

// Get a product
const product = await productService.getProduct('PROD-001');

// Update a product
await productService.updateProduct('PROD-001', {
  description: 'Updated Description',
  reorderPoint: 15,
}, 'user-123');

// Search products
const results = await productService.searchProducts({
  category: 'Electronics',
  status: 'active',
  searchText: 'sample',
});

// Add supplier mapping
await productService.addSupplierMapping('PROD-001', {
  supplierId: 'SUP-002',
  supplierCode: 'XYZ789',
  lastCost: 45.00,
  lastCostDate: new Date(),
});

// Update supplier cost
await productService.updateSupplierCost('PROD-001', 'SUP-001', 52.50);

// Deactivate product
await productService.deactivateProduct('PROD-001', 'user-123');

// Get version history
const history = await productService.getProductVersionHistory('PROD-001');
```

## Data Model

### ProductDoc (Firestore)

```typescript
interface ProductDoc {
  sku: string; // document ID
  description: string;
  category: string;
  unitOfMeasure: string;
  reorderPoint: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  supplierMappings: SupplierMapping[];
}

interface SupplierMapping {
  supplierId: string;
  supplierCode: string;
  lastCost: number;
  lastCostDate: Timestamp;
}
```

### Product (Domain Model)

```typescript
interface Product {
  sku: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  reorderPoint: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  supplierMappings: SupplierMapping[];
}
```

## Implementation Details

### Unique SKU Constraint

The service enforces unique SKU constraints using Firestore transactions. When creating a product, it checks if an active product with the same SKU already exists and throws an error if found.

### Version History

All product updates are tracked in a separate `product_versions` collection with the following structure:

```typescript
interface ProductVersionHistory {
  sku: string;
  version: number; // timestamp-based
  changes: Partial<ProductDoc>;
  changedBy: string; // userId
  changedAt: Timestamp;
}
```

### Search Performance

Search operations use Firestore indexes for optimal performance:
- Category filtering uses indexed queries
- Status filtering uses indexed queries
- Supplier filtering is done in-memory (requires array membership check)
- Text search is done in-memory (Firestore doesn't support full-text search natively)

For production use, consider implementing a dedicated search service (Algolia, Elasticsearch) for advanced text search capabilities.

## Error Handling

The service throws descriptive errors for:
- Missing required fields
- Duplicate SKU attempts
- Product not found
- Supplier mapping not found
- Firestore operation failures

All errors include context about the operation and the underlying cause.

## Testing

Tests should cover:
- Creating products with valid and invalid data
- Unique SKU constraint enforcement
- Product updates with version history verification
- Deactivation preserving historical data
- Search with various filter combinations
- Supplier mapping operations
- Edge cases (empty results, non-existent products)
