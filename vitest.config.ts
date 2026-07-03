import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@components': path.resolve(__dirname, './src/components'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@firebase': path.resolve(__dirname, './src/services/firebase/config'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      // Mock Firebase configuration for testing
      PUBLIC_FIREBASE_API_KEY: 'test-api-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
      PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
      PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
      PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
      PUBLIC_FIREBASE_APP_ID: '1:123456789012:web:abcdef123456',
    },
  },
});
