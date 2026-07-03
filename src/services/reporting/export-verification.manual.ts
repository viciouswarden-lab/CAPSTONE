/**
 * Manual Export Verification Script
 * 
 * This script can be run to manually verify export functionality
 * works correctly in a Node environment.
 * 
 * Task: 33.2
 */

import { reportingService } from './ReportingService';
import type { Report } from '../../types/services';
import { writeFileSync } from 'fs';

async function verifyExportFunctionality() {
  console.log('🧪 Manual Export Verification - Task 33.2\n');

  // Create a sample sales report
  const sampleReport: Report = {
    reportId: 'SALES_TEST_' + Date.now(),
    title: 'Manual Verification Sales Report',
    generatedAt: new Date(),
    data: {
      groupBy: 'product',
      rows: [
        {
          key: 'VERIFY001',
          label: 'VERIFY001 - Test Product A',
          revenue: 1299.99,
          unitsSold: 10,
          transactionCount: 5,
          margin: 389.99,
        },
        {
          key: 'VERIFY002',
          label: 'VERIFY002 - Test Product B',
          revenue: 2499.99,
          unitsSold: 15,
          transactionCount: 8,
          margin: 749.99,
        },
      ],
    },
    summary: {
      totalRecords: 2,
      aggregates: {
        totalRevenue: 3799.98,
        totalUnits: 25,
        totalMargin: 1139.98,
      },
    },
  };

  try {
    // Test PDF Export
    console.log('📄 Testing PDF Export...');
    const pdfBlob = await reportingService.exportReportFromData(sampleReport, 'pdf');
    console.log(`✅ PDF generated successfully`);
    console.log(`   - Size: ${pdfBlob.size} bytes`);
    console.log(`   - Type: ${pdfBlob.type}`);

    // Optionally write to file for manual inspection
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    writeFileSync('test-export.pdf', pdfBuffer);
    console.log(`   - Saved to: test-export.pdf\n`);

    // Test Excel Export
    console.log('📊 Testing Excel Export...');
    const excelBlob = await reportingService.exportReportFromData(sampleReport, 'excel');
    console.log(`✅ Excel generated successfully`);
    console.log(`   - Size: ${excelBlob.size} bytes`);
    console.log(`   - Type: ${excelBlob.type}`);

    // Optionally write to file for manual inspection
    const excelBuffer = Buffer.from(await excelBlob.arrayBuffer());
    writeFileSync('test-export.xlsx', excelBuffer);
    console.log(`   - Saved to: test-export.xlsx\n`);

    console.log('✅ All export tests passed!');
    console.log('\n📋 Summary:');
    console.log('   - PDF Export: Working ✓');
    console.log('   - Excel Export: Working ✓');
    console.log('   - Files generated for manual inspection');
    console.log('\nTask 33.2 Export Functionality: VERIFIED ✅');

  } catch (error) {
    console.error('❌ Export verification failed:', error);
    process.exit(1);
  }
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyExportFunctionality();
}

export { verifyExportFunctionality };
