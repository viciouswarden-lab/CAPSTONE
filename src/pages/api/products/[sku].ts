/**
 * API Endpoint: Update Product
 * 
 * PUT /api/products/[sku]
 * Updates product information
 * 
 * Requirements: 7.2
 */

import type { APIRoute } from 'astro';
import { productService } from '../../../services/products/ProductService';
import { FirebaseAuthService } from '../../../services/auth/AuthService';
import { auth, db } from '../../../services/firebase';

export const PUT: APIRoute = async ({ params, request }) => {
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

    // Parse request body
    const updates = await request.json();

    // Validate required fields - Requirement 7.2
    if (!updates.description || !updates.category || !updates.unitOfMeasure) {
      return new Response(JSON.stringify({ error: 'Missing required fields (description, category, unitOfMeasure)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate reorder point
    if (updates.reorderPoint !== undefined) {
      const reorderPoint = Number(updates.reorderPoint);
      if (isNaN(reorderPoint) || reorderPoint < 0) {
        return new Response(JSON.stringify({ error: 'Reorder point must be a non-negative number' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.reorderPoint = reorderPoint;
    }

    // Update product - Requirement 7.2 (maintains version history)
    const updatedProduct = await productService.updateProduct(sku, updates, user.userId);

    return new Response(JSON.stringify({ success: true, product: updatedProduct }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Check for SKU uniqueness violation (Requirement 7.4)
    if (error instanceof Error && error.message.includes('already exists')) {
      return new Response(
        JSON.stringify({ error: 'SKU already exists' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to update product' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
