# Deployment Checklist ✅

Quick checklist to deploy to Vercel.

## Before Deployment

- [ ] All features working locally
- [ ] Firebase project set up
- [ ] Environment variables documented
- [ ] No sensitive data in code
- [ ] Git repository clean
- [ ] All tests passing (if any)

## Step 1: Prepare Code

- [x] ✅ Vercel adapter installed (`@astrojs/vercel`)
- [x] ✅ `astro.config.mjs` updated
- [x] ✅ `vercel.json` created
- [ ] Build works locally: `npm run build`
- [ ] Preview works locally: `npm run preview`

## Step 2: Git & GitHub

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Prepare for Vercel deployment"

# Push to GitHub
git push origin main
```

- [ ] Code pushed to GitHub
- [ ] Repository is accessible

## Step 3: Vercel Setup

### 3.1 Import Project
1. [ ] Go to https://vercel.com
2. [ ] Sign in with GitHub
3. [ ] Click "Add New..." → "Project"
4. [ ] Select your repository
5. [ ] Click "Import"

### 3.2 Configure Environment Variables

Add these in Vercel dashboard:

- [ ] `PUBLIC_FIREBASE_API_KEY`
- [ ] `PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `PUBLIC_FIREBASE_APP_ID`

**Get values from:**
Firebase Console → Project Settings → Your apps

**Important:** Add to ALL environments:
- [ ] Production
- [ ] Preview  
- [ ] Development

### 3.3 Deploy
- [ ] Click "Deploy" button
- [ ] Wait for build to complete (1-3 minutes)
- [ ] Note your deployment URL (e.g., `yourapp.vercel.app`)

## Step 4: Firebase Configuration

### 4.1 Update Authorized Domains
1. [ ] Go to Firebase Console
2. [ ] Authentication → Settings → Authorized domains
3. [ ] Add your Vercel domain: `yourapp.vercel.app`
4. [ ] Click "Add"

### 4.2 Verify Firestore Rules
- [ ] Security rules allow authenticated users
- [ ] Rules file deployed: `firebase deploy --only firestore:rules`

### 4.3 Check Firestore Indexes
- [ ] All required indexes created
- [ ] No pending index builds

## Step 5: Testing

Visit your Vercel URL and test:

### Authentication
- [ ] Login page loads
- [ ] Can log in successfully
- [ ] Session persists on refresh
- [ ] Logout works

### Core Features
- [ ] Dashboard displays correctly
- [ ] All navigation links work
- [ ] Data loads from Firestore
- [ ] Forms submit successfully

### Suppliers
- [ ] Can view suppliers list
- [ ] Can add new supplier
- [ ] Can edit supplier
- [ ] Can view supplier details

### Products
- [ ] Can view products list
- [ ] Can add new product
- [ ] Can edit product
- [ ] Search/filter works

### Pricelists
- [ ] Can upload CSV file
- [ ] Can view pricelists list
- [ ] Can review pricelist details
- [ ] Price changes display correctly
- [ ] New products highlighted

### Inventory
- [ ] Can view inventory levels
- [ ] Can edit inventory
- [ ] Can adjust stock
- [ ] Alerts show correctly

### POS
- [ ] Can search products
- [ ] Can add to cart
- [ ] Can complete transaction
- [ ] Receipt displays

### Reports
- [ ] Can generate reports
- [ ] Can view report details
- [ ] Can export PDF
- [ ] Can export Excel

## Step 6: Performance Check

- [ ] Pages load in < 3 seconds
- [ ] Images load quickly
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari/Edge

## Step 7: Security Verification

- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Authentication required for protected pages
- [ ] Firestore rules tested
- [ ] No API keys in client code
- [ ] Environment variables secure

## Common Issues & Solutions

### Build Fails
```bash
# Locally test build
npm run build

# If successful, push again
git add .
git commit -m "Fix build"
git push
```

### Environment Variables Not Working
- Check they start with `PUBLIC_`
- Verify no extra spaces
- Redeploy after adding variables

### Firebase Auth Fails
- Check Vercel domain in Firebase Authorized Domains
- Verify environment variables are correct
- Check browser console for errors

### 404 Errors
- Check routes are correct
- Verify file names match imports
- Check case sensitivity

## Rollback Plan

If deployment fails:

1. **Revert in Vercel:**
   - Go to Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Revert in Git:**
   ```bash
   git revert HEAD
   git push
   ```

## Post-Deployment

- [ ] Share URL with stakeholders
- [ ] Update documentation with live URL
- [ ] Monitor Vercel analytics
- [ ] Monitor Firebase usage
- [ ] Set up error tracking (optional)

## URLs to Save

- **Production URL:** `https://_____________.vercel.app`
- **GitHub Repo:** `https://github.com/____________/adorable-axis`
- **Vercel Dashboard:** `https://vercel.com/____________/adorable-axis`
- **Firebase Console:** `https://console.firebase.google.com/project/_____________`

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Astro Docs:** https://docs.astro.build/en/guides/deploy/vercel/
- **Firebase Docs:** https://firebase.google.com/docs

---

**Estimated Total Time:** 20-30 minutes

**Status:** Ready to deploy! 🚀
