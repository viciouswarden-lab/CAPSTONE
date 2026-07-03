/**
 * Firebase Module Exports
 * 
 * Central export point for all Firebase services.
 * Note: Storage removed due to Spark plan limitations - using local file storage instead
 */

export { app, auth, db, functions } from './config';
export type { FirebaseApp, Auth, Firestore, Functions } from './config';
