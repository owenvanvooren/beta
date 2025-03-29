# Secure CDN for Beta Distribution

This repository provides a secure CDN service for distributing beta builds to authorized users only. It works with GitHub Packages and Firebase authentication to ensure only valid beta testers can download the software.

## How It Works

1. Beta users register on the beta website and are approved by an admin
2. When a user logs in with their beta code, they get authorized download access
3. Download requests are validated against Firebase in real-time
4. Files are served from GitHub Releases with temporary signed URLs
5. Each download request is validated and tracked

## Setup Instructions

### Prerequisites

- A GitHub account with access to GitHub Packages
- Firebase project with Realtime Database
- Node.js and npm installed

### Installation

1. Clone this repository to your private GitHub repo:

```bash
git clone https://github.com/teenagetech/cdn.git
cd cdn
```

2. Install dependencies:

```bash
npm install
```

3. Create a Firebase Admin SDK service account key:
   - Go to your Firebase project settings
   - Navigate to "Service accounts"
   - Click "Generate new private key"
   - Save the file as `firebase-admin-key.json` in the root directory

4. Deploy to your preferred hosting:
   - Vercel, Netlify, or any Node.js hosting service
   - Set the `GITHUB_TOKEN` environment variable with a token that has access to your private repo

### Creating Releases

1. Add your PDX file to the repository
2. Tag a new version:

```bash
git tag v0.1.2
git push origin v0.1.2
```

3. The GitHub Action will automatically:
   - Create a new release
   - Upload the PDX file as a release asset
   - Publish the npm package

## Firebase Database Structure

The secure download system uses the following Firebase Realtime Database structure:

```
/betaCodes
  /{betaCodeId}
    code: "XXXX1234"
    email: "user@example.com"
    project: "8ball"
    approved: true

/secureDownloads
  /{userEmail}
    timestamp: 1234567890
    expiry: 1234567890
    fileName: "8ball.pdx.zip"
    version: "0.1.2"
    betaCode: "XXXX1234"
```

## Firebase Security Rules

Add these security rules to your Firebase Realtime Database:

```json
{
  "rules": {
    "secureDownloads": {
      "$userEmail": {
        ".read": "auth != null && auth.token.email.replace('.', ',') === $userEmail",
        ".write": "auth != null && auth.token.email.replace('.', ',') === $userEmail"
      }
    },
    "betaCodes": {
      ".read": "auth != null",
      "$codeId": {
        ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
      }
    }
  }
}
```

## Usage

The CDN server provides the following endpoints:

- `GET /download?email=user@example.com&timestamp=1234567890&version=0.1.2` - Securely download a file
- `GET /health` - Health check endpoint

## License

Private - All rights reserved

## Troubleshooting Vercel Deployment

If you're experiencing 404 NOT_FOUND errors with your Vercel deployment, follow these steps:

1. **Verify Vercel Configuration**
   - Make sure your `vercel.json` has the correct settings for Node.js deployment
   - Check that the entry point is correct (`index.js` or `cdn-server.js`)
   - Ensure all routes are properly configured

2. **Check Environment Variables**
   - In the Vercel dashboard, go to your project > Settings > Environment Variables
   - Make sure both `CDN_TOKEN` and `FIREBASE_ADMIN_CONFIG` are set
   - Verify that `CDN_TOKEN` has proper GitHub API permissions
   - Make sure the Firebase Admin config is properly formatted JSON

3. **Test Domain Configuration**
   - In the Vercel dashboard, go to your project > Settings > Domains
   - Verify that `cdn.owen.uno` is properly set up
   - Check DNS settings to ensure they're pointing to Vercel correctly

4. **Check GitHub Repository**
   - Make sure there's at least one release in your GitHub repository
   - Verify that the `8ball.pdx.zip` file is included as a release asset
   - Check that your GitHub token has access to the repository

5. **Check Server Logs**
   - In the Vercel dashboard, go to your project > Deployments > Latest
   - Click on the "Functions" tab to see your serverless function logs
   - Look for any errors or issues in the logs

6. **Use Debug Endpoints**
   - Access `/health` to check if the server is running: `https://cdn.owen.uno/health`
   - Access `/debug` to see environment configuration: `https://cdn.owen.uno/debug`
   - Access `/` to confirm the root endpoint works: `https://cdn.owen.uno/`

If you're still having issues, try redeploying your Vercel application:

```bash
npm install -g vercel
vercel login
vercel deploy --prod
``` 