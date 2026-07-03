/**
 * Report Export API Endpoint
 * 
 * Handles export requests for reports in PDF and Excel formats.
 * Retrieves the current report from session and calls ReportingService.exportReportFromData.
 * 
 * Requirements: 15.4
 * Task: 33.2
 */

import type { APIRoute } from 'astro';
import { reportingService } from '../../../services/reporting/ReportingService';
import type { Report } from '../../../types/models';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const sessionCookie = cookies.get('session');
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json();
    const { format } = body;

    // Validate format
    if (format !== 'pdf' && format !== 'excel') {
      return new Response(JSON.stringify({ error: 'Invalid format. Must be "pdf" or "excel".' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Retrieve report from session
    const reportCookie = cookies.get('currentReport');
    if (!reportCookie) {
      return new Response(JSON.stringify({ error: 'No report available for export. Please generate a report first.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse report data and restore Date objects
    const reportData = JSON.parse(reportCookie.value);
    const report: Report = {
      ...reportData,
      generatedAt: new Date(reportData.generatedAt),
    };

    // Call ReportingService.exportReportFromData
    const blob = await reportingService.exportReportFromData(report, format);

    // Determine content type and file extension
    const contentType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
    const fileName = `${report.title.replace(/\s+/g, '_')}_${Date.now()}.${fileExtension}`;

    // Convert blob to buffer for Astro response
    const buffer = await blob.arrayBuffer();

    // Return file as download
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Report export error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to export report',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
