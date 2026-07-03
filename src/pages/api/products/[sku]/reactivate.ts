/**
 * API Endpoint: Reactivate Product
 * 
 * POST /api/products/[sku]/reactivate
 * Marks a product as active again
 * 
 * Requirements: 7.3
 */

import type { APIRoute } from 'astro';
import { productService } from '../../../../services/products/ProductService';
import { FirebaseAuthService } from '../../../../services/auth/AuthService';
import { auth, db } from '../../../../services/firebase';

export const POST: APIRoute = async ({ params }) => {
  try {
    const { sku } = params;

    if (!sku) {
      return new Response(JSON.stringify({ error: 'Product SKU is required' }), {
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

    // Reactivate product - Requirement 7.3
    // Update the product to set isActive back to true
    await productService.updateProduct(sku, { isActive: true }, user.userId);

    return new Response(JSON.stringify({ success: true, message: 'Product reactivated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reactivating product:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to reactivate product' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
