/**
 * API Endpoint: Update User
 * 
 * PUT /api/users/[id]
 * Updates user information including role and activation status
 * 
 * Requirements: 16.2, 16.3, 16.5
 * Task: 34.2
 */

import type { APIRoute } from 'astro';
import { userManagementService } from '../../../services/users/UserManagementService';
import { FirebaseAuthService } from '../../../services/auth/AuthService';
import { auth, db } from '../../../services/firebase';
import type { UserRole } from '../../../types/models';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authService = new FirebaseAuthService(auth, db);
    const currentUser = await authService.getCurrentUser();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check role permissions - only Administrator can update users
    if (currentUser.role !== 'Administrator') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Administrator role required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const updates = await request.json();
    const { displayName, role, isActive } = updates;

    // Validate at least one field is being updated
    if (displayName === undefined && role === undefined && isActive === undefined) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate role if provided (Requirement 16.4)
    if (role !== undefined) {
      const validRoles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ 
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Build update data
    const updateData: any = {};
    if (displayName !== undefined) {
      updateData.displayName = displayName.trim();
    }
    if (role !== undefined) {
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update user (Requirement 16.2, 16.5)
    // Permission changes apply immediately to active sessions (Requirement 16.5)
    await userManagementService.updateUser(id, updateData, currentUser.userId);

    // If deactivating user, log it (Requirement 16.3)
    if (isActive === false) {
      await userManagementService.logUserAction(
        id,
        'user_deactivated_via_update',
        { deactivatedBy: currentUser.userId },
        currentUser.userId
      );
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'User updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to update user' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

