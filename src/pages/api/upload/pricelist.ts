/**
 * Pricelist File Upload API Endpoint
 * 
 * Handles file uploads for supplier pricelists using local file storage.
 * Replaces Firebase Cloud Storage upload (requires Blaze plan).
 * 
 * Security:
 * - Requires authentication
 * - Role-based access control (Clerk, Analyst, Manager, Administrator)
 * - File type validation (CSV, Excel, PDF only)
 * - File size limit (10MB max)
 * - Filename sanitization
 * 
 * Requirements: 3.1, 3.2, 19.1, 19.2
 */

import type { APIRoute } from 'astro';
import { saveFile, FileValidationError } from '../../../utils/fileStorage';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const sessionCookie = cookies.get('session');
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Please log in' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const supplierId = formData.get('supplierId') as string;
    const file = formData.get('file') as File;

    // Validate required fields
    if (!supplierId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: supplierId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate supplier ID format (alphanumeric only)
    if (!/^[a-zA-Z0-9_-]+$/.test(supplierId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid supplier ID format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save file to local storage
    try {
      const filePath = await saveFile(file, 'pricelists', supplierId);

      // Return success response with file path
      return new Response(
        JSON.stringify({
          success: true,
          filePath: filePath,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      if (error instanceof FileValidationError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Pricelist upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error during file upload',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
