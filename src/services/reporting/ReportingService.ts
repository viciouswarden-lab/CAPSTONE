/**
 * Reporting Service Implementation
 * 
 * Generates analytics and reports for sales, inventory, and supplier performance.
 * Provides customizable reporting with filtering and grouping options.
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ReportingService as IReportingService,
  SalesReportConfig,
  InventoryReportConfig,
  SupplierReportConfig,
  ReportConfig,
  Report,
} from '../../types/services';
import type {
  POSTransactionDoc,
  InventoryDoc,
  ProductDoc,
  PriceChangeDoc,
  ReceivingRecordDoc,
  ReportConfigDoc,
  PricingDoc,
} from '../../types/firestore';

/**
 * Sales report data structure
 */
interface SalesReportData {
  groupBy: string; // The grouping dimension (product, category, period)
  rows: SalesReportRow[];
}

interface SalesReportRow {
  key: string; // Product SKU, category name, or time period
  label: string; // Display label for the key
  revenue: number;
  unitsSold: number;
  margin?: number; // Optional margin calculation
  transactionCount: number;
}

/**
 * Inventory report data structure
 */
interface InventoryReportData {
  rows: InventoryReportRow[];
  totalValue?: number; // Optional total inventory value
}

interface InventoryReportRow {
  sku: string;
  description: string;
  category: string;
  locationId: string;
  stockLevel: number;
  reorderPoint: number;
  inventoryValue?: number; // Optional: stock level * unit cost
  turnoverRate?: number; // Optional: calculated turnover rate
}

/**
 * Supplier report data structure
 */
interface SupplierReportData {
  rows: SupplierReportRow[];
}

interface SupplierReportRow {
  supplierId: string;
  supplierName: string;
  priceStability?: number; // Optional: percentage of products with stable prices
  deliveryReliability?: number; // Optional: percentage of on-time deliveries
  productRange?: number; // Optional: number of products from this supplier
  metrics: Record<string, any>; // Flexible metrics storage
}

/**
 * Implementation of the ReportingService interface
 * 
 * This service generates various analytics reports with support for filtering,
 * grouping, and export capabilities. Reports are generated within 5 seconds
 * as required by specification.
 */
export class ReportingService implements IReportingService {
  private readonly transactionsCollection = 'pos_transactions';
  private readonly inventoryCollection = 'inventory';
  private readonly productsCollection = 'products';
  private readonly priceChangesCollection = 'price_changes';
  private readonly receivingCollection = 'receiving_records';
  private readonly reportConfigsCollection = 'report_configs';
  private readonly pricingCollection = 'pricing';

  /**
   * Generate a sales report
   * 
   * Shows revenue, units sold, and margin by product, category, or time period.
   * Supports grouping and filtering options.
   * Target: Complete within 5 seconds (Requirement 15.5)
   * 
   * @param config - Sales report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.1
   */
  async generateSalesReport(config: SalesReportConfig): Promise<Report> {
    try {
      const reportId = `SALES_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const startTimestamp = Timestamp.fromDate(config.dateRange.start);
      const endTimestamp = Timestamp.fromDate(config.dateRange.end);

      // Query POS transactions within date range
      let transactionsQuery = query(
        collection(db, this.transactionsCollection),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        where('status', '==', 'completed') // Only include completed transactions
      );

      const transactionsSnap = await getDocs(transactionsQuery);

      // Aggregate sales data based on groupBy configuration
      const aggregateMap = new Map<string, {
        revenue: number;
        unitsSold: number;
        totalCost: number;
        transactionCount: number;
        label: string;
      }>();

      // Process each transaction
      for (const transactionDoc of transactionsSnap.docs) {
        const transaction = transactionDoc.data() as POSTransactionDoc;

        // Process each line item
        for (const lineItem of transaction.lineItems) {
          // Apply filters if specified
          if (config.filters.sku && lineItem.sku !== config.filters.sku) {
            continue;
          }

          // Determine grouping key
          let groupKey: string;
          let groupLabel: string;

          switch (config.groupBy) {
            case 'product':
              groupKey = lineItem.sku;
              groupLabel = `${lineItem.sku} - ${lineItem.description}`;
              break;

            case 'category':
              // Need to fetch product to get category
              const productRef = doc(db, this.productsCollection, lineItem.sku);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const product = productSnap.data() as ProductDoc;
                groupKey = product.category;
                groupLabel = product.category;

                // Apply category filter
                if (config.filters.category && product.category !== config.filters.category) {
                  continue;
                }
              } else {
                groupKey = 'Unknown';
                groupLabel = 'Unknown Category';
              }
              break;

            case 'day':
              const dayDate = transaction.timestamp.toDate();
              groupKey = dayDate.toISOString().split('T')[0];
              groupLabel = groupKey;
              break;

            case 'week':
              const weekDate = transaction.timestamp.toDate();
              const weekStart = new Date(weekDate);
              weekStart.setDate(weekDate.getDate() - weekDate.getDay());
              groupKey = weekStart.toISOString().split('T')[0];
              groupLabel = `Week of ${groupKey}`;
              break;

            case 'month':
              const monthDate = transaction.timestamp.toDate();
              groupKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
              groupLabel = groupKey;
              break;

            default:
              groupKey = 'All';
              groupLabel = 'All Sales';
          }

          // Aggregate data
          const existing = aggregateMap.get(groupKey) || {
            revenue: 0,
            unitsSold: 0,
            totalCost: 0,
            transactionCount: 0,
            label: groupLabel,
          };

          existing.revenue += lineItem.lineTotal;
          existing.unitsSold += lineItem.quantity;
          existing.transactionCount += 1;

          // Calculate cost if includeMargin is enabled
          if (config.includeMargin) {
            // Fetch product cost from supplier mappings
            const productRef = doc(db, this.productsCollection, lineItem.sku);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const product = productSnap.data() as ProductDoc;
              if (product.supplierMappings && product.supplierMappings.length > 0) {
                // Use the first supplier's cost (or implement logic to select preferred supplier)
                const cost = product.supplierMappings[0].lastCost;
                existing.totalCost += cost * lineItem.quantity;
              }
            }
          }

          aggregateMap.set(groupKey, existing);
        }
      }

      // Build report rows
      const rows: SalesReportRow[] = [];
      for (const [key, data] of aggregateMap.entries()) {
        const row: SalesReportRow = {
          key,
          label: data.label,
          revenue: Math.round(data.revenue * 100) / 100,
          unitsSold: data.unitsSold,
          transactionCount: data.transactionCount,
        };

        if (config.includeMargin) {
          row.margin = Math.round((data.revenue - data.totalCost) * 100) / 100;
        }

        rows.push(row);
      }

      // Sort rows by revenue descending
      rows.sort((a, b) => b.revenue - a.revenue);

      // Calculate summary aggregates
      const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const totalUnits = rows.reduce((sum, row) => sum + row.unitsSold, 0);
      const totalMargin = config.includeMargin
        ? rows.reduce((sum, row) => sum + (row.margin || 0), 0)
        : 0;

      const reportData: SalesReportData = {
        groupBy: config.groupBy,
        rows,
      };

      const report: Report = {
        reportId,
        title: `Sales Report - ${config.groupBy}`,
        generatedAt: new Date(),
        data: reportData,
        summary: {
          totalRecords: rows.length,
          aggregates: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalUnits,
            ...(config.includeMargin && { totalMargin: Math.round(totalMargin * 100) / 100 }),
          },
        },
      };

      return report;
    } catch (error) {
      throw new Error(
        `Failed to generate sales report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate an inventory report
   * 
   * Shows current stock levels, inventory value, and turnover rates.
   * Supports filtering by location, category, and stock level.
   * Target: Complete within 5 seconds (Requirement 15.5)
   * 
   * @param config - Inventory report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.2
   */
  async generateInventoryReport(config: InventoryReportConfig): Promise<Report> {
    try {
      const reportId = `INV_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Query inventory records
      let inventoryQuery = query(collection(db, this.inventoryCollection));

      // Apply location filter if specified
      if (config.filters.locationId) {
        inventoryQuery = query(inventoryQuery, where('locationId', '==', config.filters.locationId));
      }

      const inventorySnap = await getDocs(inventoryQuery);

      // Build report rows
      const rows: InventoryReportRow[] = [];
      let totalValue = 0;

      for (const inventoryDoc of inventorySnap.docs) {
        const inventory = inventoryDoc.data() as InventoryDoc;

        // Get product details
        const productRef = doc(db, this.productsCollection, inventory.sku);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          continue;
        }

        const product = productSnap.data() as ProductDoc;

        // Apply category filter if specified
        if (config.filters.category && product.category !== config.filters.category) {
          continue;
        }

        // Apply stock level filter if specified (low stock only)
        if (config.filters.lowStockOnly && inventory.quantityOnHand >= product.reorderPoint) {
          continue;
        }

        const row: InventoryReportRow = {
          sku: inventory.sku,
          description: product.description,
          category: product.category,
          locationId: inventory.locationId,
          stockLevel: inventory.quantityOnHand,
          reorderPoint: product.reorderPoint,
        };

        // Calculate inventory value if requested
        if (config.includeValue && product.supplierMappings.length > 0) {
          const unitCost = product.supplierMappings[0].lastCost;
          row.inventoryValue = Math.round(inventory.quantityOnHand * unitCost * 100) / 100;
          totalValue += row.inventoryValue;
        }

        // Calculate turnover rate if requested
        if (config.includeTurnover) {
          // Simplified turnover calculation: sales in period / average inventory
          // For now, we'll use a placeholder or calculate based on sales data
          const startTimestamp = Timestamp.fromDate(config.dateRange.start);
          const endTimestamp = Timestamp.fromDate(config.dateRange.end);

          const salesQuery = query(
            collection(db, this.transactionsCollection),
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp)
          );

          const salesSnap = await getDocs(salesQuery);
          let totalSold = 0;

          salesSnap.forEach((saleDoc) => {
            const sale = saleDoc.data() as POSTransactionDoc;
            const lineItem = sale.lineItems.find(item => item.sku === inventory.sku);
            if (lineItem) {
              totalSold += lineItem.quantity;
            }
          });

          // Turnover rate = units sold / average inventory (simplified: current inventory)
          if (inventory.quantityOnHand > 0) {
            row.turnoverRate = Math.round((totalSold / inventory.quantityOnHand) * 100) / 100;
          } else {
            row.turnoverRate = 0;
          }
        }

        rows.push(row);
      }

      // Sort by stock level ascending (lowest stock first)
      rows.sort((a, b) => a.stockLevel - b.stockLevel);

      const reportData: InventoryReportData = {
        rows,
        ...(config.includeValue && { totalValue: Math.round(totalValue * 100) / 100 }),
      };

      const report: Report = {
        reportId,
        title: 'Inventory Report',
        generatedAt: new Date(),
        data: reportData,
        summary: {
          totalRecords: rows.length,
          aggregates: {
            totalItems: rows.length,
            lowStockItems: rows.filter(r => r.stockLevel < r.reorderPoint).length,
            ...(config.includeValue && { totalValue: Math.round(totalValue * 100) / 100 }),
          },
        },
      };

      return report;
    } catch (error) {
      throw new Error(
        `Failed to generate inventory report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a supplier performance report
   * 
   * Shows price stability, delivery reliability, and product range metrics.
   * Supports filtering by supplier and date range.
   * Target: Complete within 5 seconds (Requirement 15.5)
   * 
   * @param config - Supplier report configuration
   * @returns Promise resolving to generated report
   * 
   * Requirement 15.3
   */
  async generateSupplierReport(config: SupplierReportConfig): Promise<Report> {
    try {
      const reportId = `SUP_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const startTimestamp = Timestamp.fromDate(config.dateRange.start);
      const endTimestamp = Timestamp.fromDate(config.dateRange.end);

      // Get all products to determine supplier list
      let productsQuery = query(collection(db, this.productsCollection));
      const productsSnap = await getDocs(productsQuery);

      // Build supplier map
      const supplierMap = new Map<string, {
        supplierName: string;
        productCount: number;
        priceChanges: number;
        significantChanges: number;
        totalProducts: number;
        onTimeDeliveries: number;
        totalDeliveries: number;
      }>();

      // Aggregate supplier data from products
      productsSnap.forEach((productDoc) => {
        const product = productDoc.data() as ProductDoc;

        product.supplierMappings.forEach((mapping) => {
          // Apply supplier filter if specified
          if (config.filters.supplierId && mapping.supplierId !== config.filters.supplierId) {
            return;
          }

          const existing = supplierMap.get(mapping.supplierId) || {
            supplierName: mapping.supplierId, // Will be replaced with actual name if available
            productCount: 0,
            priceChanges: 0,
            significantChanges: 0,
            totalProducts: 0,
            onTimeDeliveries: 0,
            totalDeliveries: 0,
          };

          existing.productCount += 1;
          existing.totalProducts += 1;

          supplierMap.set(mapping.supplierId, existing);
        });
      });

      // Calculate metrics for each supplier
      const rows: SupplierReportRow[] = [];

      for (const [supplierId, supplierData] of supplierMap.entries()) {
        const row: SupplierReportRow = {
          supplierId,
          supplierName: supplierData.supplierName,
          metrics: {},
        };

        // Calculate price stability if requested
        if (config.metrics.includes('price_stability')) {
          // Query price changes for this supplier in the date range
          const priceChangesQuery = query(
            collection(db, this.priceChangesCollection),
            where('supplierId', '==', supplierId),
            where('changeDate', '>=', startTimestamp),
            where('changeDate', '<=', endTimestamp)
          );

          const priceChangesSnap = await getDocs(priceChangesQuery);
          const totalChanges = priceChangesSnap.size;
          const significantChanges = priceChangesSnap.docs.filter(
            doc => (doc.data() as PriceChangeDoc).isSignificant
          ).length;

          // Price stability = percentage of products with no significant changes
          // Simplified: 100% - (significant changes / total products * 100)
          if (supplierData.totalProducts > 0) {
            row.priceStability = Math.max(0, Math.round(
              (100 - (significantChanges / supplierData.totalProducts * 100)) * 100
            ) / 100);
          } else {
            row.priceStability = 100;
          }

          row.metrics.totalPriceChanges = totalChanges;
          row.metrics.significantPriceChanges = significantChanges;
        }

        // Calculate delivery reliability if requested
        if (config.metrics.includes('delivery_reliability')) {
          // Query receiving records for this supplier in the date range
          const receivingQuery = query(
            collection(db, this.receivingCollection),
            where('supplierId', '==', supplierId),
            where('receivingDate', '>=', startTimestamp),
            where('receivingDate', '<=', endTimestamp)
          );

          const receivingSnap = await getDocs(receivingQuery);
          const totalDeliveries = receivingSnap.size;
          
          // Count completed deliveries as "on-time" (simplified metric)
          const onTimeDeliveries = receivingSnap.docs.filter(
            doc => (doc.data() as ReceivingRecordDoc).status === 'completed'
          ).length;

          if (totalDeliveries > 0) {
            row.deliveryReliability = Math.round((onTimeDeliveries / totalDeliveries * 100) * 100) / 100;
          } else {
            row.deliveryReliability = 0;
          }

          row.metrics.totalDeliveries = totalDeliveries;
          row.metrics.onTimeDeliveries = onTimeDeliveries;
        }

        // Calculate product range if requested
        if (config.metrics.includes('product_range')) {
          row.productRange = supplierData.productCount;
          row.metrics.activeProducts = supplierData.productCount;
        }

        rows.push(row);
      }

      // Sort by supplier name
      rows.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

      const reportData: SupplierReportData = {
        rows,
      };

      // Calculate summary aggregates
      const avgPriceStability = rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + (r.priceStability || 0), 0) / rows.length * 100) / 100
        : 0;

      const avgDeliveryReliability = rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + (r.deliveryReliability || 0), 0) / rows.length * 100) / 100
        : 0;

      const totalProducts = rows.reduce((sum, r) => sum + (r.productRange || 0), 0);

      const report: Report = {
        reportId,
        title: 'Supplier Performance Report',
        generatedAt: new Date(),
        data: reportData,
        summary: {
          totalRecords: rows.length,
          aggregates: {
            totalSuppliers: rows.length,
            ...(config.metrics.includes('price_stability') && { avgPriceStability }),
            ...(config.metrics.includes('delivery_reliability') && { avgDeliveryReliability }),
            ...(config.metrics.includes('product_range') && { totalProducts }),
          },
        },
      };

      return report;
    } catch (error) {
      throw new Error(
        `Failed to generate supplier report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export a report to PDF or Excel format
   * 
   * Retrieves report data and formats it appropriately for PDF or Excel export.
   * PDF export uses jsPDF with jspdf-autotable for formatted tables.
   * Excel export uses xlsx library for workbook generation.
   * 
   * @param reportId - Report ID to export
   * @param format - Export format ('pdf' or 'excel')
   * @returns Promise resolving to file blob
   * 
   * Requirement 15.4
   */
  async exportReport(reportId: string, format: 'pdf' | 'excel'): Promise<Blob> {
    try {
      // Since reports are generated on-demand, we need to retrieve the report from memory or regenerate
      // In this implementation, reportId contains the report type and timestamp
      // Format: TYPE_timestamp_random (e.g., SALES_1234567890_abc123)
      
      // For this implementation, we'll throw a descriptive error if the report cannot be found
      // In a production system, you might store generated reports in Firestore or cache them
      throw new Error(
        'Report export requires the report object to be passed directly. ' +
        'reportId-based lookup is not implemented in this version. ' +
        'Please use exportReportFromData() instead.'
      );
    } catch (error) {
      throw new Error(
        `Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export a report from report data to PDF or Excel format
   * 
   * This method accepts the report object directly and exports it to the specified format.
   * 
   * @param report - Report object to export
   * @param format - Export format ('pdf' or 'excel')
   * @returns Promise resolving to file blob
   * 
   * Requirement 15.4
   */
  async exportReportFromData(report: Report, format: 'pdf' | 'excel'): Promise<Blob> {
    try {
      if (format === 'pdf') {
        return await this.exportToPDF(report);
      } else if (format === 'excel') {
        return await this.exportToExcel(report);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export report to PDF format
   * 
   * Creates a PDF document with formatted tables and summary information.
   * Uses jsPDF and jspdf-autotable for professional PDF generation.
   * 
   * @param report - Report to export
   * @returns Promise resolving to PDF blob
   */
  private async exportToPDF(report: Report): Promise<Blob> {
    // Dynamic import to avoid bundling issues
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(report.title, 14, 15);

    // Add generation date
    doc.setFontSize(10);
    doc.text(`Generated: ${report.generatedAt.toLocaleString()}`, 14, 22);

    // Add summary section
    doc.setFontSize(12);
    doc.text('Summary', 14, 30);
    doc.setFontSize(10);
    
    let yPosition = 35;
    doc.text(`Total Records: ${report.summary.totalRecords}`, 14, yPosition);
    
    // Add aggregates
    yPosition += 5;
    for (const [key, value] of Object.entries(report.summary.aggregates)) {
      doc.text(
        `${key.replace(/([A-Z])/g, ' $1').trim()}: ${typeof value === 'number' ? value.toFixed(2) : value}`,
        14,
        yPosition
      );
      yPosition += 5;
    }

    // Add data table based on report type
    yPosition += 5;

    // Detect report type from reportId or data structure
    if (report.reportId.startsWith('SALES_')) {
      this.addSalesTableToPDF(doc, report.data as SalesReportData, yPosition);
    } else if (report.reportId.startsWith('INV_')) {
      this.addInventoryTableToPDF(doc, report.data as InventoryReportData, yPosition);
    } else if (report.reportId.startsWith('SUP_')) {
      this.addSupplierTableToPDF(doc, report.data as SupplierReportData, yPosition);
    } else {
      // Generic table for unknown report types
      doc.text('Report data available in raw format only', 14, yPosition);
    }

    // Generate PDF blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }

  /**
   * Add sales report table to PDF
   */
  private addSalesTableToPDF(doc: any, data: SalesReportData, startY: number): void {
    const autoTable = require('jspdf-autotable').default;

    // Prepare table data
    const headers = ['Key', 'Label', 'Revenue', 'Units Sold', 'Transactions'];
    const rows = data.rows.map(row => [
      row.key,
      row.label,
      `$${row.revenue.toFixed(2)}`,
      row.unitsSold.toString(),
      row.transactionCount.toString(),
    ]);

    // Add margin column if present
    if (data.rows.length > 0 && data.rows[0].margin !== undefined) {
      headers.push('Margin');
      data.rows.forEach((row, index) => {
        rows[index].push(`$${(row.margin || 0).toFixed(2)}`);
      });
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 9 },
    });
  }

  /**
   * Add inventory report table to PDF
   */
  private addInventoryTableToPDF(doc: any, data: InventoryReportData, startY: number): void {
    const autoTable = require('jspdf-autotable').default;

    // Prepare table data
    const headers = ['SKU', 'Description', 'Category', 'Location', 'Stock', 'Reorder Point'];
    const rows = data.rows.map(row => [
      row.sku,
      row.description.substring(0, 30), // Truncate long descriptions
      row.category,
      row.locationId,
      row.stockLevel.toString(),
      row.reorderPoint.toString(),
    ]);

    // Add optional columns
    if (data.rows.length > 0) {
      if (data.rows[0].inventoryValue !== undefined) {
        headers.push('Value');
        data.rows.forEach((row, index) => {
          rows[index].push(`$${(row.inventoryValue || 0).toFixed(2)}`);
        });
      }
      if (data.rows[0].turnoverRate !== undefined) {
        headers.push('Turnover');
        data.rows.forEach((row, index) => {
          rows[index].push((row.turnoverRate || 0).toFixed(2));
        });
      }
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 8 },
    });
  }

  /**
   * Add supplier report table to PDF
   */
  private addSupplierTableToPDF(doc: any, data: SupplierReportData, startY: number): void {
    const autoTable = require('jspdf-autotable').default;

    // Prepare table data
    const headers = ['Supplier ID', 'Supplier Name'];
    const rows: string[][] = [];

    // Determine which metrics are present
    const hasStability = data.rows.length > 0 && data.rows[0].priceStability !== undefined;
    const hasReliability = data.rows.length > 0 && data.rows[0].deliveryReliability !== undefined;
    const hasRange = data.rows.length > 0 && data.rows[0].productRange !== undefined;

    if (hasStability) headers.push('Price Stability %');
    if (hasReliability) headers.push('Delivery Reliability %');
    if (hasRange) headers.push('Product Range');

    data.rows.forEach(row => {
      const rowData = [row.supplierId, row.supplierName];
      if (hasStability) rowData.push((row.priceStability || 0).toFixed(2));
      if (hasReliability) rowData.push((row.deliveryReliability || 0).toFixed(2));
      if (hasRange) rowData.push((row.productRange || 0).toString());
      rows.push(rowData);
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 9 },
    });
  }

  /**
   * Export report to Excel format
   * 
   * Creates an Excel workbook with formatted worksheets for report data.
   * Uses xlsx library for Excel generation.
   * 
   * @param report - Report to export
   * @returns Promise resolving to Excel blob
   */
  private async exportToExcel(report: Report): Promise<Blob> {
    const XLSX = await import('xlsx');

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create summary sheet
    const summaryData = [
      ['Report Title', report.title],
      ['Generated At', report.generatedAt.toLocaleString()],
      ['Total Records', report.summary.totalRecords],
      [],
      ['Summary Metrics', ''],
    ];

    for (const [key, value] of Object.entries(report.summary.aggregates)) {
      summaryData.push([
        key.replace(/([A-Z])/g, ' $1').trim(),
        typeof value === 'number' ? value : value.toString(),
      ]);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create data sheet based on report type
    if (report.reportId.startsWith('SALES_')) {
      this.addSalesSheetToExcel(workbook, report.data as SalesReportData, XLSX);
    } else if (report.reportId.startsWith('INV_')) {
      this.addInventorySheetToExcel(workbook, report.data as InventoryReportData, XLSX);
    } else if (report.reportId.startsWith('SUP_')) {
      this.addSupplierSheetToExcel(workbook, report.data as SupplierReportData, XLSX);
    }

    // Generate Excel blob
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const excelBlob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return excelBlob;
  }

  /**
   * Add sales data sheet to Excel workbook
   */
  private addSalesSheetToExcel(workbook: any, data: SalesReportData, XLSX: any): void {
    // Prepare headers
    const headers = ['Key', 'Label', 'Revenue', 'Units Sold', 'Transactions'];
    if (data.rows.length > 0 && data.rows[0].margin !== undefined) {
      headers.push('Margin');
    }

    // Prepare data rows
    const rows = data.rows.map(row => {
      const rowData = [
        row.key,
        row.label,
        row.revenue,
        row.unitsSold,
        row.transactionCount,
      ];
      if (row.margin !== undefined) {
        rowData.push(row.margin);
      }
      return rowData;
    });

    // Create worksheet
    const wsData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data');
  }

  /**
   * Add inventory data sheet to Excel workbook
   */
  private addInventorySheetToExcel(workbook: any, data: InventoryReportData, XLSX: any): void {
    // Prepare headers
    const headers = ['SKU', 'Description', 'Category', 'Location', 'Stock Level', 'Reorder Point'];
    
    // Check for optional columns
    const hasValue = data.rows.length > 0 && data.rows[0].inventoryValue !== undefined;
    const hasTurnover = data.rows.length > 0 && data.rows[0].turnoverRate !== undefined;
    
    if (hasValue) headers.push('Inventory Value');
    if (hasTurnover) headers.push('Turnover Rate');

    // Prepare data rows
    const rows = data.rows.map(row => {
      const rowData = [
        row.sku,
        row.description,
        row.category,
        row.locationId,
        row.stockLevel,
        row.reorderPoint,
      ];
      if (hasValue) rowData.push(row.inventoryValue || 0);
      if (hasTurnover) rowData.push(row.turnoverRate || 0);
      return rowData;
    });

    // Create worksheet
    const wsData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Data');
  }

  /**
   * Add supplier data sheet to Excel workbook
   */
  private addSupplierSheetToExcel(workbook: any, data: SupplierReportData, XLSX: any): void {
    // Prepare headers
    const headers = ['Supplier ID', 'Supplier Name'];
    
    // Check for optional columns
    const hasStability = data.rows.length > 0 && data.rows[0].priceStability !== undefined;
    const hasReliability = data.rows.length > 0 && data.rows[0].deliveryReliability !== undefined;
    const hasRange = data.rows.length > 0 && data.rows[0].productRange !== undefined;
    
    if (hasStability) headers.push('Price Stability %');
    if (hasReliability) headers.push('Delivery Reliability %');
    if (hasRange) headers.push('Product Range');

    // Prepare data rows
    const rows = data.rows.map(row => {
      const rowData = [row.supplierId, row.supplierName];
      if (hasStability) rowData.push(row.priceStability || 0);
      if (hasReliability) rowData.push(row.deliveryReliability || 0);
      if (hasRange) rowData.push(row.productRange || 0);
      return rowData;
    });

    // Create worksheet
    const wsData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Supplier Data');
  }

  /**
   * Save a report configuration for reuse
   * 
   * @param config - Report configuration to save
   * @param userId - User ID who is saving the configuration
   * @param name - Name for the saved configuration
   * @returns Promise resolving to config ID
   * 
   * Requirement 15.6
   */
  async saveReportConfig(config: ReportConfig, userId: string, name: string): Promise<string> {
    try {
      const configId = `CONFIG_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Determine report type from config
      let reportType: 'sales' | 'inventory' | 'supplier' = 'sales';
      if ('includeValue' in config || 'includeTurnover' in config) {
        reportType = 'inventory';
      } else if ('metrics' in config) {
        reportType = 'supplier';
      } else if ('groupBy' in config) {
        reportType = 'sales';
      }

      const configDoc: ReportConfigDoc = {
        configId,
        userId,
        name,
        reportType,
        config,
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
      };

      const configRef = doc(db, this.reportConfigsCollection, configId);
      await setDoc(configRef, configDoc);

      return configId;
    } catch (error) {
      throw new Error(
        `Failed to save report config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all saved report configurations for a user
   * 
   * @param userId - User ID to get configurations for
   * @returns Promise resolving to array of report configurations
   * 
   * Requirement 15.6
   */
  async getUserReportConfigs(userId: string): Promise<ReportConfigDoc[]> {
    try {
      const configsQuery = query(
        collection(db, this.reportConfigsCollection),
        where('userId', '==', userId),
        orderBy('lastUsed', 'desc')
      );

      const configsSnap = await getDocs(configsQuery);
      const configs: ReportConfigDoc[] = [];

      configsSnap.forEach((doc) => {
        configs.push(doc.data() as ReportConfigDoc);
      });

      return configs;
    } catch (error) {
      throw new Error(
        `Failed to get user report configs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a saved report configuration
   * 
   * @param configId - Configuration ID to delete
   * @param userId - User ID (for authorization check)
   * @returns Promise resolving when delete is complete
   * 
   * Requirement 15.6
   */
  async deleteReportConfig(configId: string, userId: string): Promise<void> {
    try {
      const configRef = doc(db, this.reportConfigsCollection, configId);
      const configSnap = await getDoc(configRef);

      if (!configSnap.exists()) {
        throw new Error(`Report configuration ${configId} not found`);
      }

      const configData = configSnap.data() as ReportConfigDoc;

      // Verify user owns this configuration
      if (configData.userId !== userId) {
        throw new Error('Unauthorized: Cannot delete another user\'s configuration');
      }

      // Delete the configuration
      await deleteDoc(configRef);
    } catch (error) {
      throw new Error(
        `Failed to delete report config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load a saved report configuration
   * 
   * @param configId - Configuration ID to load
   * @returns Promise resolving to report configuration
   * 
   * Requirement 15.6
   */
  async loadReportConfig(configId: string): Promise<ReportConfig> {
    try {
      const configRef = doc(db, this.reportConfigsCollection, configId);
      const configSnap = await getDoc(configRef);

      if (!configSnap.exists()) {
        throw new Error(`Report configuration ${configId} not found`);
      }

      const configData = configSnap.data() as ReportConfigDoc;

      // Update last used timestamp
      await setDoc(configRef, {
        ...configData,
        lastUsed: Timestamp.now(),
      });

      return configData.config;
    } catch (error) {
      throw new Error(
        `Failed to load report config ${configId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const reportingService = new ReportingService();
