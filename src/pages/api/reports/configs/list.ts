/**
 * API Endpoint: List Report Configurations
 * 
 * GET /api/reports/configs/list
 * 
 * Retrieves all saved report configurations for the current user.
 * 
 * Requirements: 15.6
 */

import type { APIRoute } from 'astro';
import { ReportingService } from '../../../../services/reporting';

export const GET: APIRoute = async ({ cookies }) => {
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

    // Get user configurations
    const reportingService = new ReportingService();
    const configs = await reportingService.getUserReportConfigs(userId);

    return new Response(
      JSON.stringify({ configs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error listing report configurations:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to list configurations' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
