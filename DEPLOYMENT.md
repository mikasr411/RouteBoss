# Route Boss - Deployment Guide

Complete step-by-step guide to deploy Route Boss to Vercel via GitHub.

---

## Prerequisites

### 1. Install Node.js (if not already installed)

**Check if Node.js is installed:**
```bash
node --version
npm --version
```

**If not installed, download and install:**
- Visit [https://nodejs.org/](https://nodejs.org/)
- Download the LTS (Long Term Support) version
- Run the installer and follow the setup wizard
- Restart your terminal/command prompt after installation
- Verify installation: `node --version` and `npm --version`

**Recommended version:** Node.js 18.x or higher

---

## Local Development Setup

### 1. Install Dependencies

Navigate to your project folder and install all required packages:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Google Maps API library
- And all other required packages

**Expected output:** You should see "added X packages" message when complete.

---

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Windows PowerShell
New-Item -Path .env.local -ItemType File

# Or create manually in your editor
```

Add your Google Maps API key:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important:** 
- Replace `your_api_key_here` with your actual Google Maps API key
- This file is already in `.gitignore` and won't be committed to GitHub
- You'll need to add this same environment variable in Vercel later

---

### 3. Run Development Server

Start the local development server:

```bash
npm run dev
```

**What this does:**
- Starts Next.js development server
- Watches for file changes and hot-reloads
- Runs on `http://localhost:3000` by default

**To stop the server:** Press `Ctrl+C` in the terminal

**Verify it works:**
- Open [http://localhost:3000](http://localhost:3000) in your browser
- You should see the Route Boss homepage
- Navigate through the app to ensure everything loads

---

## Build & Production Scripts

Your `package.json` includes these scripts:

- **`npm run dev`** - Start development server (hot reload enabled)
- **`npm run build`** - Build the production-ready application
- **`npm run start`** - Start production server (run after build)
- **`npm run lint`** - Run ESLint to check code quality

**Test the build locally:**
```bash
npm run build
npm run start
```

This will build and run a production version locally to verify everything works before deploying.

---

## Git & GitHub Setup

### 1. Initialize Git Repository

If you haven't already initialized git:

```bash
git init
```

### 2. Create GitHub Repository

1. Go to [https://github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `RouteBoss` (or your preferred name)
4. Description: "Route optimizer for service based business"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

### 3. Connect Local Repository to GitHub

After creating the GitHub repository, you'll see setup instructions. Use these commands:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/RouteBoss.git
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username.

**If you already have a remote:**
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/RouteBoss.git
git push -u origin main
```

---

## Vercel Deployment

### 1. Create Vercel Account

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended for easy integration)
4. Authorize Vercel to access your GitHub account

### 2. Import Project from GitHub

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. You'll see a list of your GitHub repositories
3. Find **"RouteBoss"** (or your repo name) and click **"Import"**

### 3. Configure Project Settings

**Framework Preset:**
- Vercel should auto-detect **Next.js** - verify this is selected

**Root Directory:**
- Leave as **`./`** (root of the repository)

**Build Command:**
- Should auto-fill: `npm run build`
- If not, enter: `npm run build`

**Output Directory:**
- Should auto-fill: `.next`
- If not, enter: `.next`

**Install Command:**
- Should auto-fill: `npm install`
- If not, enter: `npm install`

### 4. Add Environment Variables

**Before deploying, add your Google Maps API key:**

1. In the project import screen, expand **"Environment Variables"**
2. Click **"Add"** or **"Add Environment Variable"**
3. Add the following:

   **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   
   **Value:** Your actual Google Maps API key
   
   **Environment:** Select all (Production, Preview, Development)

4. Click **"Add"** to save

**Why this is needed:**
- Your `.env.local` file is not committed to GitHub (it's in `.gitignore`)
- Vercel needs the API key to build and run your app
- The `NEXT_PUBLIC_` prefix makes it available in the browser

### 5. Deploy

1. Click **"Deploy"** button
2. Wait for the build to complete (usually 1-3 minutes)
3. You'll see build logs in real-time
4. Once complete, you'll get a deployment URL like: `route-boss-xyz.vercel.app`

**First deployment typically takes longer** as it installs dependencies and builds the project.

---

## Post-Deployment

### 1. Verify Deployment

1. Click the deployment URL to open your live site
2. Test all features:
   - Import page
   - Customers page
   - Routes page
   - Map page (verify Google Maps loads)
   - Gear Garage pages

### 2. Set Up Custom Domain (Optional)

1. In Vercel project dashboard, go to **"Settings"** → **"Domains"**
2. Enter your domain name (e.g., `routeboss.com`)
3. Follow Vercel's DNS configuration instructions
4. Vercel will provide DNS records to add to your domain registrar
5. Wait for DNS propagation (can take up to 48 hours, usually much faster)

---

## Vercel Configuration

### Do We Need `vercel.json`?

**No, `vercel.json` is NOT needed for this project.**

**Why:**
- Next.js 14 is a first-class framework on Vercel
- Vercel auto-detects Next.js and configures everything automatically
- The default Next.js configuration works perfectly out of the box
- Adding unnecessary config can cause issues

**What Vercel auto-configures:**
- Build command: `npm run build`
- Output directory: `.next`
- Framework: Next.js
- Node.js version: Latest LTS
- All routing and API routes

**Only add `vercel.json` if you need:**
- Custom headers
- Redirects/rewrites (though Next.js has its own config for this)
- Custom build settings
- Edge function configurations

For Route Boss, the default Vercel configuration is perfect.

---

## Troubleshooting

### Build Fails

**Common issues:**

1. **Missing environment variable:**
   - Error: "Google Maps API key not configured"
   - Solution: Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel environment variables

2. **TypeScript errors:**
   - Run `npm run lint` locally first
   - Fix any TypeScript errors before pushing

3. **Missing dependencies:**
   - Ensure `package.json` has all required packages
   - Run `npm install` locally to verify

4. **npm audit warnings (vulnerabilities):**
   - You may see "3 high severity vulnerabilities" after `npm install`
   - **This is safe to ignore for deployment** - these are in dev dependencies (ESLint tooling)
   - The vulnerabilities are in `glob` package used by `eslint-config-next`
   - They don't affect production code or Vercel deployment
   - To fix (optional): Upgrade to Next.js 16+ (breaking change, test thoroughly first)
   - **Your deployment will work fine with these warnings**

### Deployment Works But Features Don't

1. **Check environment variables:**
   - Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel
   - Make sure it's enabled for all environments (Production, Preview, Development)

2. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed API calls

3. **Verify API key permissions:**
   - Ensure Google Maps API key has these APIs enabled:
     - Maps JavaScript API
     - Geocoding API
     - Directions API

### Local Development Issues

1. **Port 3000 already in use:**
   ```bash
   # Use a different port
   npm run dev -- -p 3001
   ```

2. **Dependencies not installing:**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

---

## Updating Your Deployment

After making changes to your code:

1. **Commit changes locally:**
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **Vercel auto-deploys:**
   - Vercel automatically detects the push
   - Creates a new deployment
   - Builds and deploys automatically
   - You'll get a notification when complete

**Preview deployments:**
- Each push creates a preview deployment
- You can test changes before merging to main
- Production only updates when you push to `main` branch

---

## Environment Variables Reference

### Required for Production

| Variable Name | Description | Where to Get It |
|--------------|-------------|-----------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | [Google Cloud Console](https://console.cloud.google.com/) |

### How to Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key
6. (Optional but recommended) Restrict the API key to your domain

---

## Project Structure

```
route-boss/
├── app/                    # Next.js App Router pages
│   ├── customers/          # Customers management page
│   ├── gear/               # Gear Garage pages
│   ├── import/             # CSV import page
│   ├── map/                # Google Maps view
│   └── routes/              # Routes page with message builder
├── components/             # React components
├── lib/                    # Utility functions
├── store/                  # Zustand state management
├── types/                  # TypeScript type definitions
├── .env.local             # Environment variables (not in git)
├── .gitignore             # Git ignore rules
├── DEPLOYMENT.md          # This file
├── next.config.js         # Next.js configuration
├── package.json           # Dependencies and scripts
└── README.md              # Project documentation
```

---

## Quick Reference: Scripts

| Command | Purpose |
|---------|---------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start development server (localhost:3000) |
| `npm run build` | Build for production |
| `npm run start` | Start production server (after build) |
| `npm run lint` | Check code quality |

---

## Support

If you encounter issues:

1. Check Vercel deployment logs in the dashboard
2. Review browser console for client-side errors
3. Verify all environment variables are set correctly
4. Ensure all required Google Maps APIs are enabled
5. Check that your Google Maps API key has proper restrictions (or none for testing)

---

**Last Updated:** January 2025
**Next.js Version:** 14.2.0
**Vercel Compatibility:** ✅ Fully compatible, no extra config needed

