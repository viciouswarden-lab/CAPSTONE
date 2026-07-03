# Firebase Configuration Module

This module provides centralized Firebase initialization and configuration for the PRO SYNAPSE application.

## Overview

The Firebase configuration module initializes and exports the following services:
- **Authentication (auth)**: User authentication and session management
- **Firestore (db)**: NoSQL document database
- **Storage (storage)**: Cloud file storage for documents (pricelists, invoices, receipts)
- **Functions (functions)**: Cloud Functions for server-side logic

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Choose a project name (e.g., "pro-synapse")
4. Enable Google Analytics (optional)

### 2. Register Your App

1. In Firebase Console, go to Project Settings
2. Under "Your apps", click the web icon (</>)
3. Register your app with a nickname (e.g., "PRO SYNAPSE Web")
4. Copy the Firebase configuration object

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env` in the project root
2. Fill in the Firebase configuration values from step 2:
   ```
   PUBLIC_FIREBASE_API_KEY=your_api_key
   PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

### 4. Enable Firebase Services

#### Authentication
1. In Firebase Console, go to Authentication > Sign-in method
2. Enable "Email/Password" provider
3. Save changes

#### Firestore Database
1. In Firebase Console, go to Firestore Database
2. Click "Create database"
3. Choose "Start in production mode" (we have custom security rules)
4. Select a location (choose closest to your users)

#### Cloud Storage
1. In Firebase Console, go to Storage
2. Click "Get started"
3. Choose "Start in production mode"
4. Select a location (same as Firestore)

#### Cloud Functions
1. Upgrade to Blaze plan (pay-as-you-go) if needed
2. In Firebase Console, go to Functions
3. Functions will be available for deployment

### 5. Deploy Security Rules

Deploy Firestore security rules:
```bash
firebase deploy --only firestore:rules
```

Deploy Storage security rules:
```bash
firebase deploy --only storage:rules
```

Deploy Firestore indexes:
```bash
firebase deploy --only firestore:indexes
```

### 6. Initialize Firebase CLI (if not already done)

```bash
npm install -g firebase-tools
firebase login
firebase init
```

Select:
- Firestore (configure security rules and indexes)
- Storage (configure security rules)
- Functions (if using Cloud Functions)

## Usage

Import Firebase services in your code:

```typescript
import { auth, db, storage, functions } from '@firebase';

// Use authentication
import { signInWithEmailAndPassword } from 'firebase/auth';
await signInWithEmailAndPassword(auth, email, password);

// Use Firestore
import { collection, getDocs } from 'firebase/firestore';
const snapshot = await getDocs(collection(db, 'products'));

// Use Storage
import { ref, uploadBytes } from 'firebase/storage';
const storageRef = ref(storage, 'pricelists/supplier1/pricelist.csv');
await uploadBytes(storageRef, file);

// Use Functions
import { httpsCallable } from 'firebase/functions';
const processInvoice = httpsCallable(functions, 'processInvoice');
await processInvoice({ invoiceId: '123' });
```

## Security

### Requirements Validation

This module validates the following requirements:

- **Requirement 1.1**: User authentication with valid credentials creates authenticated session
- **Requirement 1.3**: Protected resources redirect unauthenticated users to login
- **Requirement 19.1**: All data in transit encrypted using TLS 1.3 or higher (Firebase default)
- **Requirement 19.2**: Sensitive data at rest encrypted using Firebase encryption (Firebase default)

### Security Rules

The security rules enforce:
- Authenticated access for all collections (Requirement 1.3)
- Role-based read/write permissions (Requirement 1.4)
- Immutable audit trails (price changes, transactions)
- User can only void their own transactions (or admin override)

### Data Encryption

Firebase provides:
- **Transit Encryption**: All communication uses TLS 1.3 or higher (Requirement 19.1)
- **At-Rest Encryption**: All data stored in Firestore and Storage is encrypted using AES-256 (Requirement 19.2)

## Configuration Validation

The module validates all required configuration fields on initialization. If any required field is missing, it throws an error with specific details about which fields are missing.

Required fields:
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## Troubleshooting

### "Firebase configuration is incomplete" Error

**Cause**: Missing or empty environment variables.

**Solution**: 
1. Ensure `.env` file exists in project root
2. Verify all `PUBLIC_FIREBASE_*` variables are set
3. Restart the development server after changing `.env`

### "Permission denied" Errors

**Cause**: Security rules are rejecting the operation.

**Solution**:
1. Ensure user is authenticated
2. Verify user has the required role for the operation
3. Check that the user account is active (`isActive: true`)
4. Review `firestore.rules` and `storage.rules` for the specific collection/path

### "Failed to get document" Errors

**Cause**: Trying to access a document that doesn't exist or user doesn't have permission.

**Solution**:
1. Check that the document ID is correct
2. Verify the user has read permission for that collection
3. Use `.exists()` to check if a document exists before reading

## Project Structure

```
src/services/firebase/
├── config.ts       # Firebase initialization and exports
└── README.md       # This file
```

## Related Files

- `firestore.rules` - Firestore security rules
- `storage.rules` - Cloud Storage security rules
- `firestore.indexes.json` - Composite index definitions
- `.env.example` - Environment variable template
- `tsconfig.json` - TypeScript path aliases configuration

## Next Steps

1. Set up Firebase project and obtain credentials
2. Configure environment variables
3. Deploy security rules and indexes
4. Create initial admin user in Firebase Console
5. Implement authentication service (see `src/services/auth/`)
