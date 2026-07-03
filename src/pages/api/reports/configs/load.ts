/**
 * API Endpoint: Load Report Configuration
 * 
 * GET /api/reports/configs/load?configId=...
 * 
 * Loads a saved report configuration by ID.
 * 
 * Requirements: 15.6
 */

import type { APIRoute } from 'astro';
import { ReportingService } from '../../../../services/reporting';

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    // Get session from cookie
    const sessionCookie = cookies.get('session');
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get configId from query params
    const configId = url.searchParams.get('configId');
    if (!configId) {
      return new Response(
        JSON.stringify({ error: 'Configuration ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load configuration
    const reportingService = new ReportingService();
    const config = await reportingService.loadReportConfig(configId);

    return new Response(
      JSON.stringify({ config }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error loading report configuration:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to load configuration' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
