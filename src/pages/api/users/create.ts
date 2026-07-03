/**
 * API Endpoint: Create User
 * 
 * POST /api/users/create
 * Creates a new user account with role assignment and initial password
 * 
 * Requirements: 16.1, 16.2
 * Task: 34.2
 */

import type { APIRoute } from 'astro';
import { userManagementService } from '../../../services/users/UserManagementService';
import { FirebaseAuthService } from '../../../services/auth/AuthService';
import { auth, db } from '../../../services/firebase';
import type { UserRole } from '../../../types/models';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Authenticate user
    const authService = new FirebaseAuthService(auth, db);
    const currentUser = await authService.getCurrentUser();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check role permissions - only Administrator can create users (Requirement 16.1)
    if (currentUser.role !== 'Administrator') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Administrator role required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json();
    const { email, displayName, role, password } = body;

    // Validate required fields (Requirement 16.1)
    if (!email || !displayName || !role || !password) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields. Email, display name, role, and password are required.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate role (Requirement 16.4)
    const validRoles: UserRole[] = ['Administrator', 'Manager', 'Analyst', 'Clerk', 'Sales_Associate'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create user (Requirement 16.1, 16.2)
    const userId = await userManagementService.createUser({
      email: email.trim(),
      displayName: displayName.trim(),
      role,
      password,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      message: 'User created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle specific Firebase auth errors
    let errorMessage = 'Failed to create user';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('email already exists')) {
        errorMessage = 'A user with this email already exists';
        statusCode = 409;
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

