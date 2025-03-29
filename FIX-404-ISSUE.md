# Fixing the 404 NOT_FOUND Issue with cdn.owen.uno

Hi Owen! We've made several improvements to help fix the 404 NOT_FOUND error you're experiencing with your CDN deployment. Here's a comprehensive guide to get things working properly.

## What We've Fixed

1. **Updated Environment Variable Names**: Changed GitHub token environment variable from `GITHUB_TOKEN` to `CDN_TOKEN` in both the server code and Vercel configuration.

2. **Enhanced Firebase Admin Initialization**: Added robust error handling for Firebase Admin SDK configuration parsing, supporting JSON, cleaned strings, and base64 encoding.

3. **Added Debug Endpoints**: Created `/health`, `/debug`, and root (`/`) endpoints to help diagnose server issues.

4. **Improved Server Structure**: Created an `index.js` entry point file to better support Vercel deployment.

5. **Added Detailed Logging**: Enhanced logging throughout the download endpoint for better troubleshooting.

6. **Created Deployment Scripts**: Added scripts to help with local testing and Vercel deployment.

## Steps to Fix the Issue

### 1. Deploy to Vercel

Run our deployment script:
```bash
./deploy-vercel.sh
```

Or deploy manually:
```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

### 2. Configure Environment Variables

In the Vercel dashboard:
1. Go to your project
2. Click on "Settings" > "Environment Variables"
3. Add or update these environment variables:
   - `CDN_TOKEN`: Your GitHub personal access token (replace the one you shared earlier as it's now compromised)
   - `FIREBASE_ADMIN_CONFIG`: Your Firebase Admin SDK configuration JSON
   - `ENABLE_DEBUG`: Set to `true` temporarily to enable the debug endpoint

### 3. Set Up DNS for cdn.owen.uno

1. Go to Vercel project settings > Domains
2. Add `cdn.owen.uno` if not already added
3. Follow the instructions to configure DNS (usually a CNAME record pointing to cname.vercel-dns.com)

### 4. Verify GitHub Repository Setup

1. Make sure your private GitHub repository (`teenagetech/cdn`) exists
2. Check that you have at least one release with tag in the format `v0.0` (or similar)
3. Ensure `8ball.pdx.zip` is included as a release asset

### 5. Test the Deployment

Access these endpoints to check if the server is running:
- https://cdn.owen.uno/health
- https://cdn.owen.uno/debug (if debug is enabled)
- https://cdn.owen.uno/ (should show a server running message)

### 6. Troubleshoot if Still Having Issues

If you're still encountering problems:
- Check Vercel function logs in the dashboard
- Try using the local development environment with `npm run debug`
- Make sure your GitHub token has the correct permissions
- Verify that the Firebase Admin SDK configuration is valid
- Try creating a new release in your GitHub repository

## Testing the Download Link Locally

To test locally before deploying:
1. Add your real credentials to the `.env` file:
   ```
   CDN_TOKEN=your_new_github_token
   FIREBASE_ADMIN_CONFIG={"your":"firebase_config_here"}
   ```
2. Run `npm run local` or `npm run debug`
3. Test with a curl command:
   ```
   curl "http://localhost:3000/download?email=hi@owen.uno&timestamp=1743204832269&version=b0.0"
   ```

If you've made all these changes and still encounter issues, please check the server logs in the Vercel dashboard for more specific error information. 