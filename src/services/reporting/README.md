# Reporting Service

## Overview

The Reporting Service provides comprehensive analytics and reporting capabilities for the PRO SYNAPSE system. It generates customizable reports for sales, inventory, and supplier performance with support for filtering, grouping, and export functionality.

## Features

### Sales Reports (Requirement 15.1)
- Revenue tracking by product, category, or time period
- Units sold calculations
- Margin analysis (optional)
- Transaction count metrics
- Flexible grouping options: product, category, day, week, month

### Inventory Reports (Requirement 15.2)
- Current stock levels across all locations
- Inventory value calculations
- Turnover rate analysis
- Low stock identification
- Filtering by location and category

### Supplier Performance Reports (Requirement 15.3)
- Price stability metrics (% of products with stable prices)
- Delivery reliability tracking (on-time delivery percentage)
- Product range analysis (number of products per supplier)
- Configurable metrics selection

## Implementation

The ReportingService is implemented in `ReportingService.ts` and provides:

1. **Fast Report Generation**: All reports complete within 5 seconds (Requirement 15.5)
2. **Flexible Configuration**: Customizable date ranges, filters, and grouping options
3. **Atomic Data Access**: Uses Firestore queries to efficiently retrieve and aggregate data
4. **Report Persistence**: Save and load report configurations for repeated use (Requirement 15.6)

## Usage

```typescript
import { reportingService } from './services/reporting';

// Generate a sales report grouped by product
const salesReport = await reportingService.generateSalesReport({
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  },
  groupBy: 'product',
  includeMargin: true,
  filters: {
    category: 'Electronics',
  },
});

// Generate an inventory report with value and turnover
const inventoryReport = await reportingService.generateInventoryReport({
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  },
  includeValue: true,
  includeTurnover: true,
  filters: {
    locationId: 'warehouse-1',
    lowStockOnly: true,
  },
});

// Generate a supplier performance report
const supplierReport = await reportingService.generateSupplierReport({
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  },
  metrics: ['price_stability', 'delivery_reliability', 'product_range'],
  filters: {},
});

// Save a report configuration
const configId = await reportingService.saveReportConfig({
  dateRange: { start: new Date(), end: new Date() },
  filters: { category: 'Electronics' },
});

// Load a saved configuration
const config = await reportingService.loadReportConfig(configId);
```

## Report Data Structures

### Sales Report
```typescript
{
  reportId: string;
  title: string;
  generatedAt: Date;
  data: {
    groupBy: string;
    rows: Array<{
      key: string;
      label: string;
      revenue: number;
      unitsSold: number;
      margin?: number;
      transactionCount: number;
    }>;
  };
  summary: {
    totalRecords: number;
    aggregates: {
      totalRevenue: number;
      totalUnits: number;
      totalMargin?: number;
    };
  };
}
```

### Inventory Report
```typescript
{
  reportId: string;
  title: string;
  generatedAt: Date;
  data: {
    rows: Array<{
      sku: string;
      description: string;
      category: string;
      locationId: string;
      stockLevel: number;
      reorderPoint: number;
      inventoryValue?: number;
      turnoverRate?: number;
    }>;
    totalValue?: number;
  };
  summary: {
    totalRecords: number;
    aggregates: {
      totalItems: number;
      lowStockItems: number;
      totalValue?: number;
    };
  };
}
```

### Supplier Report
```typescript
{
  reportId: string;
  title: string;
  generatedAt: Date;
  data: {
    rows: Array<{
      supplierId: string;
      supplierName: string;
      priceStability?: number;
      deliveryReliability?: number;
      productRange?: number;
      metrics: Record<string, any>;
    }>;
  };
  summary: {
    totalRecords: number;
    aggregates: {
      totalSuppliers: number;
      avgPriceStability?: number;
      avgDeliveryReliability?: number;
      totalProducts?: number;
    };
  };
}
```

## Configuration Options

### Sales Report Configuration
- `dateRange`: Start and end dates for the report period
- `groupBy`: 'product' | 'category' | 'day' | 'week' | 'month'
- `includeMargin`: Boolean flag to include margin calculations
- `filters`: Optional filters (sku, category, etc.)

### Inventory Report Configuration
- `dateRange`: Start and end dates for the report period
- `includeValue`: Boolean flag to include inventory value calculations
- `includeTurnover`: Boolean flag to include turnover rate analysis
- `filters`: Optional filters (locationId, category, lowStockOnly)

### Supplier Report Configuration
- `dateRange`: Start and end dates for the report period
- `metrics`: Array of metrics to include ['price_stability', 'delivery_reliability', 'product_range']
- `filters`: Optional filters (supplierId)

## Performance Considerations

- All reports are designed to complete within 5 seconds (Requirement 15.5)
- Uses efficient Firestore queries with proper indexing
- Aggregations are performed in-memory for optimal performance
- Consider implementing caching for frequently-run reports in production

## Future Enhancements

- Export to PDF and Excel formats (Requirement 15.4)
  - Requires integration with PDF generation library (jsPDF, pdfmake)
  - Requires integration with Excel generation library (exceljs, xlsx)
- Scheduled report generation and email delivery
- Dashboard widgets based on report data
- Custom report templates
- Advanced filtering and sorting options

## Related Services

- **POSService**: Provides transaction data for sales reports
- **InventoryService**: Provides inventory data for inventory reports
- **PricingService**: Provides pricing data for margin calculations

## Requirements Coverage

- ✅ Requirement 15.1: Generate sales reports with revenue, units sold, and margin
- ✅ Requirement 15.2: Generate inventory reports with stock levels, value, and turnover
- ✅ Requirement 15.3: Generate supplier performance reports with metrics
- ⏳ Requirement 15.4: Export reports to PDF and Excel (placeholder implemented)
- ✅ Requirement 15.5: Generate reports within 5 seconds
- ✅ Requirement 15.6: Save and load report configurations
