# Firestore Setup - Quick Start

## 🚀 5-Minute Setup

### Step 1: Get Firebase Credentials (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select/Create your project
3. Project Settings → Your apps → Web app
4. Copy the config values

### Step 2: Update `.env` File (1 minute)

Open `e:\CAPSTONE\adorable-axis\.env` and paste your values:

```env
PUBLIC_FIREBASE_API_KEY=AIzaSy...
PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your-project
PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 3: Enable Firestore (1 minute)

1. Firebase Console → Firestore Database
2. Create database → **Test mode** → Enable

### Step 4: Enable Authentication (1 minute)

1. Firebase Console → Authentication
2. Get started → Email/Password → Enable
3. Add user: `admin@tpro.com` / `admin123456`

### Step 5: Restart Dev Server

```bash
npm run dev
```

## ✅ What's Connected Now

The Suppliers page is already connected to Firestore!

**Try it:**
1. Navigate to `/suppliers`
2. Click "Add Supplier"
3. Fill in the form and save
4. See it appear in both:
   - Your app's supplier list
   - Firebase Console → Firestore → `suppliers` collection

## 📁 Files Updated

- ✅ `src/pages/suppliers/index.astro` - Connected to Firestore
- ⏳ `src/pages/products/index.astro` - Still uses mock data (can update next)
- ⏳ `src/pages/admin/users/index.astro` - Still uses mock data (can update next)

## 🎯 Next Steps

Want to connect more pages? I can update:
1. Products page - to add/list real products
2. Users page - to manage real user accounts
3. Other operational pages

Just let me know which page you want to connect next!

## 🆘 Troubleshooting

**"Firebase not initialized" error?**
- Check all `PUBLIC_FIREBASE_*` variables are set in `.env`
- Restart dev server after updating `.env`

**"Permission denied" errors?**
- Ensure Firestore is in **test mode** (allows all reads/writes)
- Check Firebase Console → Firestore → Rules

**Can't see data?**
- Open Firebase Console → Firestore → Data tab
- Collections will appear after first document is created

---

**Need detailed setup?** See `FIRESTORE_CONNECTION_GUIDE.md` for full documentation.
