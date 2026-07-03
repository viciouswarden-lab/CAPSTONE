/**
 * API Endpoint: Deactivate Supplier
 * 
 * POST /api/suppliers/[id]/deactivate
 * Marks a supplier as inactive without deleting historical data
 * 
 * Requirements: 2.3
 */

import type { APIRoute } from 'astro';
import { supplierService } from '../../../../services/suppliers/SupplierService';
import { FirebaseAuthService } from '../../../../services/auth/AuthService';
import { auth, db } from '../../../../services/firebase';

export const POST: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Supplier ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authService = new FirebaseAuthService(auth, db);
    const user = await authService.getCurrentUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check role permissions (Administrator, Manager, or Analyst)
    if (!['Administrator', 'Manager', 'Analyst'].includes(user.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Deactivate supplier
    await supplierService.deactivateSupplier(id);

    return new Response(JSON.stringify({ success: true, message: 'Supplier deactivated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deactivating supplier:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to deactivate supplier' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
