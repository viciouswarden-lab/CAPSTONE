/**
 * API Endpoint: Update Supplier
 * 
 * PUT /api/suppliers/[id]
 * Updates supplier information
 * 
 * Requirements: 2.2
 */

import type { APIRoute } from 'astro';
import { supplierService } from '../../../services/suppliers/SupplierService';
import { FirebaseAuthService } from '../../../services/auth/AuthService';
import { auth, db } from '../../../services/firebase';

export const PUT: APIRoute = async ({ params, request }) => {
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

    // Parse request body
    const updates = await request.json();

    // Validate required fields
    if (!updates.name || !updates.contactPerson || !updates.email || !updates.phone || !updates.address) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update supplier
    const updatedSupplier = await supplierService.updateSupplier(id, {
      name: updates.name,
      contactPerson: updates.contactPerson,
      email: updates.email,
      phone: updates.phone,
      address: updates.address,
    });

    return new Response(JSON.stringify({ success: true, supplier: updatedSupplier }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to update supplier' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
