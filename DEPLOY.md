# Deployment Guide

This guide will walk you through deploying the Secure CDN Server to Vercel.

## Prerequisites

1. GitHub account with owner access to the private `teenagetech/cdn` repository
2. Vercel account (sign up at [vercel.com](https://vercel.com))
3. Firebase project with Realtime Database

## Step 1: Prepare Your Repository

1. Make sure all your changes are committed and pushed to your private repository:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

2. Ensure you have added your beta file (e.g., `8ball.pdx.zip`) to the repository.

## Step 2: Create a GitHub Personal Access Token

1. Go to [GitHub Developer Settings](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "Beta CDN Access"
4. Select these scopes:
   - `repo` (full control of private repositories)
   - `read:packages` (to read from GitHub Packages)
   - `write:packages` (to write to GitHub Packages)
5. Click "Generate token"
6. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

## Step 3: Configure Firebase Admin SDK

1. Go to your [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Click "Generate new private key"
5. Save the JSON file (you'll need it for deployment)

## Step 4: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository (`teenagetech/cdn`)
4. Configure the project:
   - Set the Framework Preset to "Other"
   - Leave the Build and Output Directory settings as default
   
5. Add Environment Variables:
   - Click "Environment Variables" to expand that section
   - Add `GITHUB_TOKEN` with the value of your GitHub Personal Access Token

6. Deploy the project by clicking "Deploy"

## Step 5: Upload Firebase Admin SDK Key

After deployment:

1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add a new environment variable called `FIREBASE_ADMIN_CONFIG`
4. Copy the entire contents of your Firebase Admin SDK JSON file as the value
5. Click "Save"
6. Redeploy your application (or trigger a new deployment)

## Step 6: Set Up Your Domain

1. In the Vercel dashboard, go to your project settings
2. Click on "Domains"
3. Add your custom domain, e.g., `cdn.owen.uno`
4. Follow Vercel's DNS configuration instructions

## Step 7: Update Your Beta Website

1. Update your beta website to point to the new CDN URL:
   - Change `secureDownloadUrl` in `script.js` to use your new domain:
   ```javascript
   const secureDownloadUrl = `https://cdn.owen.uno/download?email=${encodeURIComponent(currentUser.email)}&timestamp=${timestamp}&version=${version}`;
   ```

2. Deploy your updated beta website

## Step 8: Test the Secure Download

1. Log in to your beta website with a valid beta code
2. Click the download button
3. Verify that the secure download process works correctly

## Troubleshooting

- **403 Forbidden errors**: Check your GitHub token permissions
- **Firebase errors**: Ensure your Firebase Admin SDK key is properly formatted
- **Download failures**: Check the Vercel function logs for detailed error messages

## Maintenance

To update your beta files:

1. Add the new version to your repository
2. Create a new tag and push it:
```bash
git tag v0.1.3
git push origin v0.1.3
```
3. The GitHub Action will automatically create a new release with the file 