# Report Export Usage Examples

This document provides practical examples of using the report export functionality in the PRO SYNAPSE system.

## Basic Usage

### Export a Sales Report

```typescript
import { reportingService } from './services/reporting/ReportingService';

async function exportMonthlySalesReport() {
  // Step 1: Generate the report
  const report = await reportingService.generateSalesReport({
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    },
    groupBy: 'product',
    includeMargin: true,
    filters: {}
  });

  // Step 2: Export to PDF
  const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
  
  // Step 3: Download the PDF
  downloadBlob(pdfBlob, 'sales-report-jan-2024.pdf');
  
  // Or export to Excel
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');
  downloadBlob(excelBlob, 'sales-report-jan-2024.xlsx');
}

// Helper function to download blob in browser
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### Export an Inventory Report

```typescript
async function exportLowStockReport() {
  // Generate inventory report with filters
  const report = await reportingService.generateInventoryReport({
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    },
    includeValue: true,
    includeTurnover: true,
    filters: {
      lowStockOnly: true, // Only show items below reorder point
      locationId: 'MAIN'
    }
  });

  // Export to PDF for printing
  const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
  downloadBlob(pdfBlob, 'low-stock-report.pdf');
}
```

### Export a Supplier Performance Report

```typescript
async function exportQuarterlySupplierReport() {
  // Generate supplier report with all metrics
  const report = await reportingService.generateSupplierReport({
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-03-31')
    },
    metrics: ['price_stability', 'delivery_reliability', 'product_range'],
    filters: {}
  });

  // Export to Excel for further analysis
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');
  downloadBlob(excelBlob, 'supplier-performance-q1-2024.xlsx');
}
```

## Astro Integration Example

### Create an API Route for Report Export

```typescript
// src/pages/api/reports/export.ts
import type { APIRoute } from 'astro';
import { reportingService } from '../../../services/reporting/ReportingService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { reportType, format, config } = await request.json();

    // Generate the report based on type
    let report;
    switch (reportType) {
      case 'sales':
        report = await reportingService.generateSalesReport(config);
        break;
      case 'inventory':
        report = await reportingService.generateInventoryReport(config);
        break;
      case 'supplier':
        report = await reportingService.generateSupplierReport(config);
        break;
      default:
        return new Response('Invalid report type', { status: 400 });
    }

    // Export the report
    const blob = await reportingService.exportReportFromData(report, format);
    
    // Determine content type
    const contentType = format === 'pdf' 
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    // Return the file
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="report.${format === 'pdf' ? 'pdf' : 'xlsx'}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response('Export failed', { status: 500 });
  }
};
```

### Frontend Component Example (React)

```typescript
// src/components/ReportExportButton.tsx
import React, { useState } from 'react';

interface ReportExportButtonProps {
  reportType: 'sales' | 'inventory' | 'supplier';
  config: any;
}

export function ReportExportButton({ reportType, config }: ReportExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(true);
    
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          format,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-buttons">
      <button
        onClick={() => handleExport('pdf')}
        disabled={exporting}
        className="btn btn-primary"
      >
        {exporting ? 'Exporting...' : 'Export PDF'}
      </button>
      <button
        onClick={() => handleExport('excel')}
        disabled={exporting}
        className="btn btn-secondary"
      >
        {exporting ? 'Exporting...' : 'Export Excel'}
      </button>
    </div>
  );
}
```

## Server-Side Export (Node.js)

```typescript
import { reportingService } from './services/reporting/ReportingService';
import { writeFile } from 'fs/promises';

async function generateAndSaveReport() {
  // Generate report
  const report = await reportingService.generateSalesReport({
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    },
    groupBy: 'category',
    includeMargin: true,
    filters: {}
  });

  // Export to PDF
  const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  await writeFile('./reports/sales-jan-2024.pdf', pdfBuffer);

  // Export to Excel
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');
  const excelBuffer = Buffer.from(await excelBlob.arrayBuffer());
  await writeFile('./reports/sales-jan-2024.xlsx', excelBuffer);

  console.log('Reports saved successfully');
}
```

## Email Integration Example

```typescript
import nodemailer from 'nodemailer';
import { reportingService } from './services/reporting/ReportingService';

async function emailMonthlyReport(recipientEmail: string) {
  // Generate report
  const report = await reportingService.generateSalesReport({
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    },
    groupBy: 'product',
    includeMargin: true,
    filters: {}
  });

  // Export to PDF
  const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

  // Export to Excel
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');
  const excelBuffer = Buffer.from(await excelBlob.arrayBuffer());

  // Setup email transporter
  const transporter = nodemailer.createTransport({
    // Your email config
  });

  // Send email with attachments
  await transporter.sendMail({
    from: 'reports@prosynapse.com',
    to: recipientEmail,
    subject: 'Monthly Sales Report - January 2024',
    text: 'Please find attached the monthly sales report.',
    attachments: [
      {
        filename: 'sales-report-jan-2024.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      {
        filename: 'sales-report-jan-2024.xlsx',
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ]
  });

  console.log('Report emailed successfully');
}
```

## Scheduled Report Export (Cloud Function)

```typescript
import { reportingService } from './services/reporting/ReportingService';
import { Storage } from '@google-cloud/storage';

// Firebase Cloud Function that runs daily
export async function generateDailyReports() {
  const storage = new Storage();
  const bucket = storage.bucket('prosynapse-reports');

  // Generate yesterday's sales report
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const report = await reportingService.generateSalesReport({
    dateRange: {
      start: yesterday,
      end: today
    },
    groupBy: 'product',
    includeMargin: true,
    filters: {}
  });

  // Export to both formats
  const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');

  // Upload to Cloud Storage
  const dateStr = yesterday.toISOString().split('T')[0];
  
  await bucket.file(`daily-reports/${dateStr}/sales-report.pdf`).save(
    Buffer.from(await pdfBlob.arrayBuffer())
  );
  
  await bucket.file(`daily-reports/${dateStr}/sales-report.xlsx`).save(
    Buffer.from(await excelBlob.arrayBuffer())
  );

  console.log(`Daily report generated for ${dateStr}`);
}
```

## Error Handling Best Practices

```typescript
async function exportWithErrorHandling() {
  try {
    // Generate report
    const report = await reportingService.generateSalesReport({
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      groupBy: 'product',
      includeMargin: true,
      filters: {}
    });

    // Export to PDF with error handling
    const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
    
    // Verify blob size
    if (pdfBlob.size === 0) {
      throw new Error('Generated PDF is empty');
    }

    downloadBlob(pdfBlob, 'sales-report.pdf');
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Export failed:', error.message);
      
      // Show user-friendly error message
      if (error.message.includes('Failed to generate')) {
        alert('Unable to generate report. Please try again later.');
      } else if (error.message.includes('Unsupported export format')) {
        alert('Export format not supported.');
      } else {
        alert('An error occurred while exporting the report.');
      }
    }
  }
}
```

## Performance Considerations

### Large Reports

For reports with many rows, consider pagination or streaming:

```typescript
async function exportLargeReport() {
  // For very large datasets, you might want to:
  // 1. Generate report in chunks
  // 2. Stream data to the export function
  // 3. Use background processing for Excel generation
  
  const report = await reportingService.generateSalesReport({
    dateRange: {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31')
    },
    groupBy: 'product',
    includeMargin: true,
    filters: {}
  });

  // Check report size
  if (report.summary.totalRecords > 1000) {
    console.warn('Large report detected. Export may take longer.');
  }

  // Export with progress indication
  const excelBlob = await reportingService.exportReportFromData(report, 'excel');
  downloadBlob(excelBlob, 'annual-sales-2023.xlsx');
}
```

## Testing Export Functionality

```typescript
import { describe, it, expect } from 'vitest';

describe('Report Export Integration', () => {
  it('should export sales report successfully', async () => {
    const report = await reportingService.generateSalesReport({
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      groupBy: 'product',
      includeMargin: true,
      filters: {}
    });

    const pdfBlob = await reportingService.exportReportFromData(report, 'pdf');
    
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe('application/pdf');
    expect(pdfBlob.size).toBeGreaterThan(0);
  });
});
```

This comprehensive guide covers most common use cases for the report export functionality.
