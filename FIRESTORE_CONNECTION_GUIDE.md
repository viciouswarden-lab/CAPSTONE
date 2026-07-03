# Firestore Connection Guide

## Overview
This guide will help you connect your PRO SYNAPSE application to Firebase Firestore so you can:
- ✅ Add suppliers
- ✅ Add products
- ✅ Create users
- ✅ Manage inventory
- ✅ Upload pricelists

## Step 1: Configure Firebase Credentials

### 1.1 Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ next to "Project Overview" → "Project Settings"
4. Scroll down to "Your apps" section
5. If you don't have a web app yet:
   - Click the "</>" icon to add a web app
   - Give it a nickname (e.g., "PRO SYNAPSE Web")
   - Click "Register app"
6. Copy the configuration values from the Firebase SDK snippet

### 1.2 Update `.env` File

Open `e:\CAPSTONE\adorable-axis\.env` and replace the placeholder values:

```env
PUBLIC_FIREBASE_API_KEY=your_actual_api_key_here
PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your_project_id
PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 2: Set Up Firestore Database

### 2.1 Enable Firestore

1. In Firebase Console, go to **Firestore Database** in the left menu
2. Click "Create database"
3. Choose **"Start in test mode"** (for development/CAPSTONE demo)
4. Select a location close to you
5. Click "Enable"

### 2.2 Deploy Security Rules (Optional but Recommended)

```bash
firebase deploy --only firestore:rules
```

Or manually copy the rules from `firestore.rules` in the Firebase Console.

## Step 3: Set Up Authentication

### 3.1 Enable Email/Password Authentication

1. In Firebase Console, go to **Authentication** in the left menu
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable **"Email/Password"** provider
5. Click "Save"

### 3.2 Create Test Users

1. Go to Authentication → Users tab
2. Click "Add user"
3. Create at least one administrator user:
   - Email: `admin@tpro.com`
   - Password: `admin123456` (or your choice)

## Step 4: Restart the Development Server

After updating `.env`:

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

The application will now connect to Firestore!

## Step 5: Verify Connection

### 5.1 Check Browser Console

1. Open your application in a browser
2. Open Developer Tools (F12)
3. Check the Console tab
4. You should NOT see: "Firebase not initialized - running in demo mode"
5. You should see successful Firebase initialization

### 5.2 Test Adding a Supplier

1. Navigate to `/suppliers`
2. Click "Add Supplier"
3. Fill in the form:
   - Name: Test Supplier Co.
   - Contact Person: John Doe
   - Email: john@testsupplier.com
   - Phone: +63 917 123 4567
   - Address: 123 Test St., Test City
4. Click "Save"
5. You should see the supplier in the list
6. Check Firestore Console → `suppliers` collection to verify

### 5.3 Test Adding a Product

1. Navigate to `/products`
2. Click "Add Product"
3. Fill in the form:
   - SKU: TEST-001
   - Description: Test Product
   - Category: Test Category
   - Unit: pc
   - Reorder Level: 10
4. Click "Save"
5. Verify in Firestore Console → `products` collection

## What Gets Connected

### ✅ Already Connected (Firestore Services Available)

1. **Suppliers** (`/suppliers`)
   - List, create, update, deactivate suppliers
   - Service: `src/services/suppliers/SupplierService.ts`

2. **Products** (`/products`)
   - List, create, update, search products
   - Service: `src/services/products/ProductService.ts`

3. **Users** (`/admin/users`)
   - List, create, manage user accounts
   - Service: `src/services/users/UserManagementService.ts`

4. **Inventory** (`/inventory`)
   - Track stock levels, adjustments
   - Service: `src/services/inventory/InventoryService.ts`

5. **Pricelists** (`/pricelists`)
   - Upload and parse CSV pricelists
   - Service: `src/services/parsers/`

### 📝 What Needs Page Updates

Currently, the UI pages use mock data. We need to update:

1. **`src/pages/suppliers/index.astro`** - Connect to SupplierService
2. **`src/pages/suppliers/new.astro`** - Connect form to SupplierService
3. **`src/pages/products/index.astro`** - Connect to ProductService
4. **`src/pages/products/new.astro`** - Connect form to ProductService
5. **`src/pages/admin/users/index.astro`** - Connect to UserManagementService

## Firestore Collections Structure

Your Firestore will automatically create these collections:

```
firestore (root)
├── suppliers/
│   └── {supplierId}/
│       ├── supplierId: string
│       ├── name: string
│       ├── contactPerson: string
│       ├── email: string
│       ├── phone: string
│       ├── address: string
│       ├── isActive: boolean
│       ├── createdAt: timestamp
│       ├── updatedAt: timestamp
│       └── createdBy: string
│
├── products/
│   └── {sku}/
│       ├── sku: string (document ID)
│       ├── description: string
│       ├── category: string
│       ├── unit: string
│       ├── reorderLevel: number
│       ├── isActive: boolean
│       ├── supplierMappings: array
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── users/
│   └── {userId}/
│       ├── userId: string
│       ├── email: string
│       ├── displayName: string
│       ├── role: string (Administrator, Manager, etc.)
│       ├── isActive: boolean
│       ├── createdAt: timestamp
│       └── lastLoginAt: timestamp
│
├── inventory/
├── pricelists/
├── priceChanges/
└── transactions/
```

## Troubleshooting

### "Firebase App already exists" Error

**Cause**: Firebase was trying to initialize multiple times in development

**Solution**: ✅ **Already Fixed!** 
- The code now checks if Firebase is already initialized before creating a new instance
- Uses `getApps()` to check for existing apps
- Reuses existing app with `getApp()` if already initialized
- Just restart your dev server and the error should be gone

### "Firebase not initialized" Error

**Cause**: `.env` file not properly configured

**Solution**:
1. Verify all `PUBLIC_FIREBASE_*` variables are set in `.env`
2. Restart dev server after changing `.env`
3. Check for typos in environment variable names

### "Permission Denied" Errors

**Cause**: Firestore security rules are too restrictive

**Solution**: In Firebase Console → Firestore → Rules, ensure test mode rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // Test mode - open access
    }
  }
}
```

### Can't Create Users

**Cause**: Authentication not enabled or user already exists

**Solution**:
1. Enable Email/Password in Authentication settings
2. Check if email already exists in Authentication → Users
3. Verify `.env` has correct auth domain

## Next Steps

After successfully connecting:

1. ✅ Update page components to use Firestore services instead of mock data
2. ✅ Test CRUD operations for suppliers and products
3. ✅ Upload test pricelist to verify parsing
4. ✅ Create inventory records
5. ✅ Test user authentication flow

---

**Ready to connect!** Follow the steps above and your application will be live with Firestore! 🚀
