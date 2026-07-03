/**
 * Firebase Configuration Module
 * 
 * Initializes Firebase app, authentication, Firestore, storage, and functions clients.
 * Validates: Requirements 1.1, 1.3, 19.1, 19.2
 */

import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

// Note: Firebase Storage removed due to Spark plan limitations
// Using local file storage instead (see /src/utils/fileStorage.ts)

// Firebase configuration - should be loaded from environment variables in production
// For development, these can be obtained from Firebase Console
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || '',
};

// Validate Firebase configuration
function validateConfig(config: FirebaseOptions): void {
  // Skip validation if all fields are empty (demo/development mode)
  const allEmpty = Object.values(config).every(v => !v);
  if (allEmpty) {
    console.warn('Firebase configuration is empty - running in demo mode without backend');
    return;
  }

  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingFields = requiredFields.filter(
    (field) => !config[field as keyof FirebaseOptions]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Firebase configuration is incomplete. Missing fields: ${missingFields.join(', ')}. ` +
      'Please set the required environment variables.'
    );
  }
}

// Validate configuration on module load
validateConfig(firebaseConfig);

// Initialize Firebase app only if config is provided
// Use singleton pattern to prevent duplicate initialization
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;

const allEmpty = Object.values(firebaseConfig).every(v => !v);

if (!allEmpty) {
  // Check if app already exists to prevent duplicate initialization
  if (getApps().length === 0) {
    // No app exists, initialize new one
    app = initializeApp(firebaseConfig);
  } else {
    // App already exists, reuse it
    app = getApp();
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
} else {
  console.warn('Firebase not initialized - running in demo mode');
}

// Note: Storage not initialized (requires Blaze plan)
// Using local file storage instead

// Export initialized services (null-safe for demo mode)
export { app, auth, db, functions };

// Export types for convenience
export type { FirebaseApp, Auth, Firestore, Functions };
