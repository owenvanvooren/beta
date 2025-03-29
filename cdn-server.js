const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const path = require('path');
const fs = require('fs-extra');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Initialize Express app
const app = express();
app.use(cors({ origin: ['https://beta.owen.uno', 'https://www.beta.owen.uno'] }));
app.use(express.json());

// Initialize Firebase Admin SDK
try {
  console.log("Initializing Firebase Admin SDK...");
  let adminConfig;
  
  if (process.env.FIREBASE_ADMIN_CONFIG) {
    console.log("Using FIREBASE_ADMIN_CONFIG environment variable");
    try {
      // Try to parse the JSON from the environment variable
      adminConfig = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
      console.log("Successfully parsed FIREBASE_ADMIN_CONFIG as JSON");
    } catch (parseError) {
      console.error("Error parsing FIREBASE_ADMIN_CONFIG:", parseError.message);
      
      // Try cleaning up the string before parsing
      try {
        // Sometimes environment variables get extra escaping or newlines that need to be cleaned
        const cleanedConfig = process.env.FIREBASE_ADMIN_CONFIG
          .replace(/\\n/g, "\\n")
          .replace(/\\"/g, '\\"')
          .replace(/\n/g, "")
          .trim();
        adminConfig = JSON.parse(cleanedConfig);
        console.log("Successfully parsed cleaned FIREBASE_ADMIN_CONFIG as JSON");
      } catch (cleanedParseError) {
        console.error("Error parsing cleaned FIREBASE_ADMIN_CONFIG:", cleanedParseError.message);
        console.log("FIREBASE_ADMIN_CONFIG environment variable format is invalid.");
        
        // Attempt to handle it as a base64 encoded string
        try {
          const base64Decoded = Buffer.from(process.env.FIREBASE_ADMIN_CONFIG, 'base64').toString();
          adminConfig = JSON.parse(base64Decoded);
          console.log("Successfully parsed base64-decoded FIREBASE_ADMIN_CONFIG as JSON");
        } catch (base64Error) {
          console.error("Error parsing base64-decoded FIREBASE_ADMIN_CONFIG:", base64Error.message);
          throw new Error("Could not parse FIREBASE_ADMIN_CONFIG in any format");
        }
      }
    }
  } else {
    console.log("FIREBASE_ADMIN_CONFIG not found, attempting to load from firebase-admin-key.json");
    // Try to load from a local file
    try {
      const fs = require('fs');
      adminConfig = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));
      console.log("Successfully loaded config from firebase-admin-key.json");
    } catch (fileError) {
      console.error("Error loading firebase-admin-key.json:", fileError.message);
      throw new Error("No Firebase Admin SDK configuration available. Please set FIREBASE_ADMIN_CONFIG or provide firebase-admin-key.json");
    }
  }
  
  // Initialize the Firebase Admin SDK with the configuration
  admin.initializeApp({
    credential: admin.credential.cert(adminConfig),
    databaseURL: "https://owen-uno-beta-default-rtdb.firebaseio.com/"
  });
  
  console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
  console.warn("Server will continue running but Firebase features will be disabled");
}

// Initialize GitHub API with the token
console.log("Initializing GitHub API client...");
const octokit = new Octokit({
  auth: process.env.CDN_TOKEN
});
console.log("GitHub API client initialized");

// Temporary file storage
const TEMP_DIR = path.join(__dirname, 'temp');
fs.ensureDirSync(TEMP_DIR);

// Root endpoint
app.get('/', (req, res) => {
  res.send('CDN Server is running. Use /download endpoint for secure downloads.');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint - only available in development environment for security
app.get('/debug', (req, res) => {
  // Only show in development or with debug flag enabled
  const isDebugAllowed = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG === 'true';
  
  if (!isDebugAllowed) {
    return res.status(403).send('Debug endpoint disabled in production');
  }
  
  // Return useful debug information
  res.json({
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development',
    firebase_initialized: Boolean(admin.apps.length),
    github_token_set: Boolean(process.env.CDN_TOKEN),
    server_time: new Date().toISOString(),
    host_info: {
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime()
    },
    // Do not include actual sensitive data, just indicate if they're set
    environment_variables: {
      CDN_TOKEN: Boolean(process.env.CDN_TOKEN),
      FIREBASE_ADMIN_CONFIG: Boolean(process.env.FIREBASE_ADMIN_CONFIG),
      NODE_ENV: process.env.NODE_ENV || 'development',
      ENABLE_DEBUG: process.env.ENABLE_DEBUG || 'false'
    }
  });
});

// Secure download endpoint
app.get('/download', async (req, res) => {
  try {
    console.log("Download request received:", req.query);
    const { email, timestamp, version } = req.query;
    
    if (!email || !timestamp) {
      console.error("Missing required parameters:", { email, timestamp });
      return res.status(400).send('Invalid request parameters');
    }
    
    // Validate timestamp is recent (within 5 minutes)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (isNaN(requestTime) || now - requestTime > 5 * 60 * 1000) {
      console.error("Timestamp expired or invalid:", { timestamp, requestTime, now, diff: now - requestTime });
      return res.status(400).send('Download link expired');
    }
    
    // Validate the request against Firebase
    try {
      // Create a sanitized email key for lookup
      const sanitizedEmail = email.replace(/\./g, ',').replace(/[\#\$\[\]]/g, '_');
      console.log("Checking database for download record with email:", sanitizedEmail);
      
      const db = admin.database();
      const secureDownloadRef = db.ref(`secureDownloads/${sanitizedEmail}`);
      
      const snapshot = await secureDownloadRef.once('value');
      const downloadData = snapshot.val();
      
      if (!downloadData) {
        console.error("No download record found for email:", email);
        return res.status(401).send('Invalid or expired download link - no record found');
      }
      
      if (downloadData.timestamp != timestamp) {
        console.error("Timestamp mismatch:", { requested: timestamp, stored: downloadData.timestamp });
        return res.status(401).send('Invalid download link - timestamp mismatch');
      }
      
      if (now > downloadData.expiry) {
        console.error("Download link expired:", { now, expiry: downloadData.expiry, diff: now - downloadData.expiry });
        return res.status(401).send('Download link expired - beyond expiration time');
      }
      
      // Verify that the original email in the record matches the requested email
      if (downloadData.originalEmail !== email) {
        console.error(`Email mismatch: requested ${email}, stored ${downloadData.originalEmail}`);
        return res.status(401).send('Email verification failed');
      }
      
      // Get the file from GitHub Packages
      console.log("Firebase validation successful, fetching file from GitHub:", downloadData.fileName);
      const owner = 'teenagetech';
      const repo = 'cdn';
      const fileName = downloadData.fileName;
      
      // Get the latest release or specific version
      let release;
      if (version) {
        console.log("Fetching specific version:", version);
        // Get a specific version
        try {
          // Handle b0.0 format for version tags (convert to v0.0)
          let tagVersion = version;
          if (version.startsWith('b')) {
            tagVersion = version.replace('b', '');
            console.log("Converted version format:", version, "->", tagVersion);
          }
          
          console.log("Looking for release with tag:", `v${tagVersion}`);
          release = await octokit.repos.getReleaseByTag({
            owner,
            repo,
            tag: `v${tagVersion}`
          });
          console.log("Found release:", release.data.name);
        } catch (err) {
          console.error('Specific version not found, falling back to latest:', err);
          release = await octokit.repos.getLatestRelease({
            owner,
            repo
          });
          console.log("Using latest release instead:", release.data.name);
        }
      } else {
        // Get the latest release
        console.log("No version specified, using latest release");
        release = await octokit.repos.getLatestRelease({
          owner,
          repo
        });
        console.log("Using latest release:", release.data.name);
      }
      
      // Find the asset we want
      console.log("Looking for asset:", fileName, "in release assets");
      console.log("Available assets:", release.data.assets.map(a => a.name).join(', '));
      
      // Check if the specified file exists in the assets
      if (!release.data.assets || release.data.assets.length === 0) {
        console.error("No assets found in release");
        return res.status(404).send(`No assets found in release`);
      }
      
      const asset = release.data.assets.find(asset => asset.name === fileName);
      if (!asset) {
        console.error("Asset not found in release:", fileName);
        return res.status(404).send(`File '${fileName}' not found in release`);
      }
      
      console.log("Asset found, downloading from GitHub:", asset.id);
      // Download the file
      const assetDetails = await octokit.request('GET /repos/{owner}/{repo}/releases/assets/{asset_id}', {
        owner,
        repo,
        asset_id: asset.id,
        headers: {
          'Accept': 'application/octet-stream'
        }
      });
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      
      // Send the file data
      console.log("Sending file to client:", fileName);
      res.send(Buffer.from(assetDetails.data));
      
      // Clean up the download record to prevent reuse
      console.log("Cleaning up download record");
      await secureDownloadRef.remove();
      
      // Log the successful download
      console.log(`Successful download of ${fileName} by ${email} (version: ${version || 'latest'})`);
      
    } catch (dbError) {
      console.error("Error with Firebase database operations:", dbError);
      throw dbError;
    }
    
  } catch (error) {
    console.error('Error processing download:', error);
    res.status(500).send(`Server error processing download: ${error.message}`);
  }
});

// Version info endpoint
app.get('/version', async (req, res) => {
  try {
    const owner = 'teenagetech';
    const repo = 'cdn';
    
    const release = await octokit.repos.getLatestRelease({
      owner,
      repo
    });
    
    res.json({
      version: release.data.tag_name,
      name: release.data.name,
      published_at: release.data.published_at,
      assets: release.data.assets.map(asset => ({
        name: asset.name,
        size: asset.size,
        download_count: asset.download_count
      }))
    });
  } catch (error) {
    console.error('Error fetching version info:', error);
    res.status(500).send('Error fetching version information');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CDN Server started on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Debug info available at: http://localhost:${PORT}/debug (development only)`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 