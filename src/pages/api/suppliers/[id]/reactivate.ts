/**
 * API Endpoint: Reactivate Supplier
 * 
 * POST /api/suppliers/[id]/reactivate
 * Marks a supplier as active again
 * 
 * Requirements: 2.2, 2.3
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

    // Reactivate supplier
    await supplierService.reactivateSupplier(id);

    return new Response(JSON.stringify({ success: true, message: 'Supplier reactivated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reactivating supplier:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to reactivate supplier' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
