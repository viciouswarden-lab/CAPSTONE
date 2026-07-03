# MainLayout Component Implementation

## Task 21.1: Create main layout component

**Status**: ✅ Complete

## Overview

The MainLayout.astro component provides the primary application layout with:
- Authentication checking
- Role-based access control (RBAC)
- Navigation menu with role-based visibility
- Global styles and meta tags
- Responsive design

## Implementation Details

### 1. Authentication Checking (Requirement 1.3)

```typescript
if (requireAuth) {
  currentUser = await authService.getCurrentUser();
  
  if (!currentUser) {
    return Astro.redirect('/login');
  }
}
```

The layout accepts a `requireAuth` prop. When true:
- Calls `AuthService.getCurrentUser()` to check authentication status
- Redirects unauthenticated users to `/login`
- Validates session validity server-side

### 2. Role-Based Access Control (Requirement 1.4)

```typescript
if (requiredRole && currentUser.role !== requiredRole) {
  const roleHierarchy: Record<UserRole, number> = {
    'Administrator': 5,
    'Manager': 4,
    'Analyst': 3,
    'Clerk': 2,
    'Sales_Associate': 1,
  };

  const userRoleLevel = roleHierarchy[currentUser.role];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    return Astro.redirect('/unauthorized');
  }
}
```

The layout implements a role hierarchy system:
- **Administrator** (Level 5): Full system access
- **Manager** (Level 4): Business operations and reports
- **Analyst** (Level 3): Data analysis and matching
- **Clerk** (Level 2): Inventory and receiving
- **Sales_Associate** (Level 1): POS operations only

Users with higher-level roles can access lower-level pages.

### 3. Navigation Menu (Requirement 20.1)

The navigation menu dynamically filters items based on user role:

| Menu Item | Roles with Access |
|-----------|------------------|
| Dashboard | All roles |
| Suppliers | Administrator, Manager, Analyst |
| Pricelists | Administrator, Manager, Analyst, Clerk |
| Products | Administrator, Manager, Analyst, Clerk |
| Matching | Administrator, Manager, Analyst |
| Inventory | Administrator, Manager, Clerk |
| Receiving | Administrator, Manager, Clerk |
| POS | Administrator, Manager, Sales_Associate |
| Reports | Administrator, Manager, Analyst |
| Users | Administrator only |

### 4. Global Styles (Requirement 20.1)

The layout includes comprehensive global styles:
- **CSS Variables**: Consistent color palette, spacing, typography
- **Component Styles**: Buttons, forms, tables, cards
- **Utility Classes**: Spacing, text alignment, colors
- **Responsive Design**: Mobile-first approach with breakpoints

### 5. Security Headers

The layout includes security-focused meta tags:
```html
<meta http-equiv="X-Content-Type-Options" content="nosniff" />
<meta http-equiv="X-Frame-Options" content="DENY" />
<meta http-equiv="X-XSS-Protection" content="1; mode=block" />
```

## Usage Examples

### Basic Page (No Authentication Required)

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout title="Welcome">
  <h1>Welcome to PRO SYNAPSE</h1>
  <p>Public content accessible to everyone.</p>
</MainLayout>
```

### Protected Page (Authentication Required)

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout title="Dashboard" requireAuth={true}>
  <h1>Dashboard</h1>
  <p>This content requires authentication.</p>
</MainLayout>
```

### Role-Restricted Page

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout 
  title="User Management" 
  requireAuth={true} 
  requiredRole="Administrator"
>
  <h1>User Management</h1>
  <p>Only administrators can access this page.</p>
</MainLayout>
```

## Testing

### Unit Tests

Created `MainLayout.test.ts` to verify:
- ✅ Role hierarchy logic (all roles tested)
- ✅ Navigation item visibility per role
- ✅ Access control rules

**Test Results**: 10/10 tests passed

### Test Coverage

```
✅ Administrator can access all pages
✅ Manager cannot access Administrator pages
✅ Analyst has appropriate access
✅ Clerk has appropriate access
✅ Sales_Associate has limited access
✅ Navigation items filter correctly per role
```

## Component Props Interface

```typescript
interface Props {
  title: string;           // Page title (required)
  requireAuth?: boolean;   // Require authentication (default: false)
  requiredRole?: UserRole; // Minimum required role (optional)
}
```

## Features Implemented

- ✅ Server-side authentication checking
- ✅ Role-based access control with hierarchy
- ✅ Dynamic navigation menu filtering
- ✅ Responsive layout (desktop, tablet, mobile)
- ✅ Global CSS variables and utility classes
- ✅ Security meta tags
- ✅ User information display
- ✅ Active page highlighting
- ✅ Logout functionality
- ✅ Accessibility considerations

## Dependencies

- `FirebaseAuthService`: For authentication checks
- `auth`, `db`: Firebase configuration from `src/services/firebase`
- Type imports from `src/types/models`

## Validation

All requirements validated:
- ✅ Requirement 1.3: Authentication checking and redirect
- ✅ Requirement 1.4: Role-based access control
- ✅ Requirement 20.1: Consistent navigation and global styles

## Notes

1. **Server-Side Rendering**: Authentication checks occur during SSR, preventing unauthorized access before the page renders.

2. **Role Hierarchy**: The hierarchy system allows flexibility - higher roles inherit access to lower-role pages.

3. **Unauthorized Redirect**: Users without sufficient role access are redirected to `/unauthorized` (page to be created in future task).

4. **Responsive Design**: The navigation adapts to different screen sizes:
   - Desktop: Full labels with icons
   - Tablet: Icons only
   - Mobile: Horizontal scrolling menu

5. **Performance**: Minimal JavaScript sent to client; authentication happens server-side.

## Future Enhancements

Potential improvements for future iterations:
- Add breadcrumb navigation
- Implement dark mode toggle
- Add notification system
- Cache user permissions for better performance
- Add keyboard shortcuts display
- Implement search functionality in navigation
