/**
 * API Endpoint: Delete Report Configuration
 * 
 * DELETE /api/reports/configs/delete
 * 
 * Deletes a saved report configuration.
 * 
 * Requirements: 15.6
 */

import type { APIRoute } from 'astro';
import { ReportingService } from '../../../../services/reporting';

export const DELETE: APIRoute = async ({ request, cookies }) => {
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
    const { configId } = body;

    if (!configId) {
      return new Response(
        JSON.stringify({ error: 'Configuration ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete configuration
    const reportingService = new ReportingService();
    await reportingService.deleteReportConfig(configId, userId);

    return new Response(
      JSON.stringify({ message: 'Configuration deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting report configuration:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to delete configuration' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
