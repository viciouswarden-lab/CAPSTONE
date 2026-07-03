# Firebase "Duplicate App" Error - FIXED ✅

## What Was the Error?

```
FirebaseError: Firebase: Firebase App named '[DEFAULT]' already exists 
with different options or config (app/duplicate-app).
```

## What Caused It?

In development mode (especially with Astro), modules can be loaded multiple times, causing Firebase to try to initialize more than once. Each initialization attempt creates a new app instance, but Firebase only allows one app per name.

## How It's Fixed Now

The Firebase configuration file (`src/services/firebase/config.ts`) now uses a **singleton pattern**:

```typescript
// Check if app already exists to prevent duplicate initialization
if (getApps().length === 0) {
  // No app exists, initialize new one
  app = initializeApp(firebaseConfig);
} else {
  // App already exists, reuse it
  app = getApp();
}
```

**What this does:**
1. ✅ Checks if Firebase is already initialized using `getApps()`
2. ✅ If no apps exist → creates a new one
3. ✅ If an app already exists → reuses the existing one
4. ✅ Prevents the duplicate app error completely

## What You Need to Do

**Simply restart your development server:**

```bash
# Press Ctrl+C to stop the current server
# Then restart:
npm run dev
```

That's it! The error should be gone now.

## Testing the Fix

After restarting, you should be able to:
1. ✅ Navigate to `/suppliers` without errors
2. ✅ Click "Add Supplier" and see the form
3. ✅ Add a new supplier successfully
4. ✅ See the supplier in your Firebase Console → Firestore

## Still Having Issues?

If you still see the error after restarting:

1. **Clear your browser cache and reload**
   - Press Ctrl+Shift+R (hard reload)
   
2. **Check your `.env` file**
   - Make sure all `PUBLIC_FIREBASE_*` variables are set correctly
   - No typos in the values
   
3. **Verify Firebase Console settings**
   - Firestore: Should be enabled and in "test mode"
   - Authentication: Email/Password should be enabled

4. **Check browser console for other errors**
   - Press F12 to open developer tools
   - Look for any Firebase-related errors

## What's Next?

With this fix in place, you can now:
- ✅ Add suppliers through the UI
- ✅ See them saved in Firestore
- ✅ Continue with Step 3.2 of the setup guide (adding users)
- ✅ Connect more pages to Firestore

---

**Status**: ✅ FIXED - Restart your dev server and you're good to go!
