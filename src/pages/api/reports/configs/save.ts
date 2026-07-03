/**
 * API Endpoint: Save Report Configuration
 * 
 * POST /api/reports/configs/save
 * 
 * Saves a report configuration for future reuse.
 * 
 * Requirements: 15.6
 */

import type { APIRoute } from 'astro';
import { ReportingService } from '../../../../services/reporting';
import type { ReportConfig } from '../../../../types/models';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get session from cookie
    const sessionCookie = cookies.get('session');
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;

    // Parse request body
    const body = await request.json();
    const { config, name } = body;

    if (!config || !name) {
      return new Response(
        JSON.stringify({ error: 'Configuration and name are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save configuration
    const reportingService = new ReportingService();
    const configId = await reportingService.saveReportConfig(
      config as ReportConfig,
      userId,
      name
    );

    return new Response(
      JSON.stringify({ configId, message: 'Configuration saved successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error saving report configuration:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to save configuration' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
