# Vercel Deployment Guide for Adorable Axis

Complete step-by-step guide to deploy your Astro + Firebase application to Vercel.

## Prerequisites

- ✅ GitHub account
- ✅ Vercel account (free tier is fine)
- ✅ Firebase project set up
- ✅ Your code ready to deploy

---

## Step 1: Install Vercel Adapter

First, we need to add the Vercel adapter to your Astro project.

### 1.1 Install the adapter:
```bash
npm install @astrojs/vercel
```

### 1.2 Update `astro.config.mjs`:

Replace the current content with:

```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    }
  })
});
```

**What this does:**
- Adds Vercel adapter for serverless deployment
- Enables server-side rendering
- Enables Vercel Web Analytics (optional)

---

## Step 2: Prepare Your Repository

### 2.1 Create `.gitignore` (if not exists):

Make sure these are in your `.gitignore`:

```
# Dependencies
node_modules/

# Build output
dist/
.astro/

# Environment variables
.env
.env.local
.env.production

# Vercel
.vercel

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log

# Logs
npm-debug.log*
*.log
```

### 2.2 Create `vercel.json` configuration:

Create a file named `vercel.json` in your project root:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "astro",
  "regions": ["sin1"],
  "env": {
    "PUBLIC_FIREBASE_API_KEY": "@public_firebase_api_key",
    "PUBLIC_FIREBASE_AUTH_DOMAIN": "@public_firebase_auth_domain",
    "PUBLIC_FIREBASE_PROJECT_ID": "@public_firebase_project_id",
    "PUBLIC_FIREBASE_STORAGE_BUCKET": "@public_firebase_storage_bucket",
    "PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "@public_firebase_messaging_sender_id",
    "PUBLIC_FIREBASE_APP_ID": "@public_firebase_app_id"
  }
}
```

**Note:** `sin1` is Singapore region. Choose based on your location:
- `sin1` - Singapore (closest to Philippines)
- `hnd1` - Tokyo, Japan
- `sfo1` - San Francisco, USA
- `iad1` - Washington D.C., USA

---

## Step 3: Push to GitHub

### 3.1 Initialize Git (if not already):
```bash
git init
```

### 3.2 Add all files:
```bash
git add .
```

### 3.3 Commit:
```bash
git commit -m "Prepare for Vercel deployment"
```

### 3.4 Create GitHub repository:
1. Go to https://github.com/new
2. Name it (e.g., `adorable-axis`)
3. Keep it **Private** (recommended for capstone)
4. Don't initialize with README (you already have code)
5. Click "Create repository"

### 3.5 Push to GitHub:
```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/adorable-axis.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Vercel

### 4.1 Go to Vercel:
- Visit https://vercel.com
- Click "Sign Up" or "Login"
- Choose "Continue with GitHub"

### 4.2 Import Project:
1. Click "Add New..." → "Project"
2. Find your `adorable-axis` repository
3. Click "Import"

### 4.3 Configure Project:
- **Framework Preset:** Astro (auto-detected)
- **Root Directory:** `./` (leave as is)
- **Build Command:** `npm run build` (auto-filled)
- **Output Directory:** `dist` (auto-filled)
- **Install Command:** `npm install` (auto-filled)

### 4.4 Add Environment Variables:

Click "Environment Variables" and add these:

| Name | Value |
|------|-------|
| `PUBLIC_FIREBASE_API_KEY` | Your Firebase API key |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `PUBLIC_FIREBASE_PROJECT_ID` | Your project ID |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `PUBLIC_FIREBASE_APP_ID` | Your app ID |

**Where to find these values:**
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Click ⚙️ (Settings) → Project settings
4. Scroll to "Your apps" section
5. Copy each value

**Important:** Make sure to add them to ALL environments:
- ✅ Production
- ✅ Preview
- ✅ Development

### 4.5 Deploy:
Click **"Deploy"** button!

Vercel will:
1. Clone your repository
2. Install dependencies
3. Build your Astro site
4. Deploy to their CDN

This takes 1-3 minutes.

---

## Step 5: Post-Deployment Configuration

### 5.1 Update Firebase Authorized Domains:

Your Vercel URL will be something like: `adorable-axis.vercel.app`

1. Go to Firebase Console
2. Navigate to **Authentication** → **Settings** → **Authorized domains**
3. Click "Add domain"
4. Add your Vercel domain: `adorable-axis.vercel.app`
5. Click "Add"

### 5.2 Test Your Deployment:

Visit your Vercel URL and test:
- ✅ Login/Authentication works
- ✅ Pages load correctly
- ✅ Firestore data loads
- ✅ Forms submit properly
- ✅ POS transactions work
- ✅ File uploads work

---

## Step 6: Custom Domain (Optional)

### 6.1 Add Custom Domain in Vercel:
1. Go to your project in Vercel
2. Click "Settings" → "Domains"
3. Enter your domain (e.g., `yourstore.com`)
4. Follow Vercel's instructions to update DNS

### 6.2 Update Firebase:
Add your custom domain to Firebase Authorized Domains (same as Step 5.1)

---

## Troubleshooting

### Issue: Build fails with "Module not found"
**Solution:**
```bash
# Locally, delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Commit and push
git add .
git commit -m "Fix dependencies"
git push
```

### Issue: Environment variables not working
**Check:**
1. Variable names start with `PUBLIC_` (required for client-side access)
2. Added to ALL environments (Production, Preview, Development)
3. No extra spaces in values
4. Redeploy after adding variables

### Issue: Firebase authentication fails
**Solution:**
- Verify Vercel domain is in Firebase Authorized Domains
- Check browser console for specific errors
- Verify environment variables are correct

### Issue: 404 errors on routes
**Solution:**
Add to `vercel.json`:
```json
{
  "routes": [
    {
      "src": "/.*",
      "dest": "/index.html"
    }
  ]
}
```

### Issue: Functions timeout
**Solution:**
Vercel free tier has 10s timeout for serverless functions. Upgrade to Pro if needed.

---

## Continuous Deployment

Once set up, every push to `main` branch automatically deploys!

```bash
# Make changes
git add .
git commit -m "Your changes"
git push

# Vercel automatically deploys
```

**Preview Deployments:**
- Every pull request gets its own preview URL
- Test changes before merging

---

## Vercel CLI (Optional but Recommended)

### Install Vercel CLI:
```bash
npm install -g vercel
```

### Login:
```bash
vercel login
```

### Deploy from CLI:
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### View logs:
```bash
vercel logs
```

---

## Performance Tips

### 1. Enable Caching:
Add to your API routes:
```javascript
export const prerender = false; // Disable for dynamic routes

// Add cache headers
response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate');
```

### 2. Image Optimization:
Vercel automatically optimizes images. Use:
```astro
<img src="/path/to/image.jpg" loading="lazy" />
```

### 3. Enable Compression:
Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Encoding",
          "value": "gzip"
        }
      ]
    }
  ]
}
```

---

## Security Checklist

Before going live:

- ✅ All sensitive data in environment variables (not in code)
- ✅ Firestore Security Rules are properly configured
- ✅ Firebase Authentication enabled
- ✅ HTTPS enabled (automatic with Vercel)
- ✅ CORS configured correctly
- ✅ Rate limiting configured (if needed)
- ✅ No API keys committed to Git

---

## Monitoring

### Vercel Analytics:
- Go to your project → "Analytics"
- View traffic, performance, errors

### Firebase Monitoring:
- Firebase Console → Performance
- Monitor API calls, query performance

### Error Tracking:
Consider adding:
- Sentry
- LogRocket
- Rollbar

---

## Costs

### Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Preview deployments
- ✅ Web analytics

### You'll Need Pro If:
- >100GB bandwidth
- >100 builds/day
- Need priority support
- Need longer function execution (>10s)

**For a capstone project, free tier is more than enough!**

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Build locally
npm run build

# Test production build locally
npm run preview

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# Pull environment variables from Vercel
vercel env pull
```

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Astro Deployment:** https://docs.astro.build/en/guides/deploy/vercel/
- **Vercel Support:** https://vercel.com/support

---

## Summary

1. ✅ Install Vercel adapter
2. ✅ Update `astro.config.mjs`
3. ✅ Create `vercel.json`
4. ✅ Push to GitHub
5. ✅ Import to Vercel
6. ✅ Add environment variables
7. ✅ Deploy!
8. ✅ Update Firebase authorized domains
9. ✅ Test everything

**Estimated Time:** 15-30 minutes

Your app will be live at: `https://adorable-axis.vercel.app` 🎉

Good luck with your capstone presentation! 🚀
