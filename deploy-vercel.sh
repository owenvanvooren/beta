#!/bin/bash

# Script to deploy to Vercel with proper environment variables

echo "Starting Vercel deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Ensure user is logged in
echo "Checking Vercel login status..."
vercel whoami || vercel login

# Deploy to production
echo "Deploying to Vercel..."
vercel deploy --prod

echo ""
echo "===================================================="
echo "Deployment Complete!"
echo ""
echo "IMPORTANT: Make sure to set these environment variables in the Vercel dashboard:"
echo "1. CDN_TOKEN - Your GitHub personal access token"
echo "2. FIREBASE_ADMIN_CONFIG - Your Firebase Admin SDK configuration JSON"
echo ""
echo "Visit your Vercel project dashboard to configure them:"
echo "https://vercel.com/dashboard/projects"
echo ""
echo "Then, test your deployment with these endpoints:"
echo "- https://cdn.owen.uno/health"
echo "- https://cdn.owen.uno/debug"
echo "====================================================" 