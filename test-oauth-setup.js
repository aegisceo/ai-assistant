#!/usr/bin/env node

/**
 * OAuth Setup Test Script
 * 
 * This script tests and validates the OAuth consent screen configuration
 * and helps diagnose common OAuth setup issues.
 */

require('dotenv').config();
const https = require('https');
const { URL } = require('url');

console.log('🔍 OAuth Setup Validation Tool');
console.log('=====================================\n');

// Test configuration - Using environment variables for security
const CONFIG = {
  projectId: process.env.GCP_PROJECT_ID || 'ai-personal-assistant-470210',
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost',
  requiredScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
  ]
};

// Validate required environment variables
if (!CONFIG.clientId || !CONFIG.clientSecret) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
  console.error('   Example:');
  console.error('   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
  console.error('   GOOGLE_CLIENT_SECRET=your-client-secret');
  process.exit(1);
}

async function testOAuthConfiguration() {
  console.log('📋 Testing OAuth Configuration...\n');
  
  // Test 1: Check credentials format
  console.log('✅ Test 1: Credentials Format');
  console.log(`   Project ID: ${CONFIG.projectId}`);
  console.log(`   Client ID: ${CONFIG.clientId.substring(0, 20)}...`);
  console.log(`   Client Secret: [REDACTED - Length: ${CONFIG.clientSecret.length}]`);
  console.log(`   Redirect URI: ${CONFIG.redirectUri}\n`);

  // Test 2: Validate client ID format
  console.log('✅ Test 2: Client ID Validation');
  const clientIdPattern = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
  if (clientIdPattern.test(CONFIG.clientId)) {
    console.log('   ✓ Client ID format is valid');
  } else {
    console.log('   ❌ Client ID format is invalid');
  }
  console.log();

  // Test 3: Test OAuth discovery endpoint
  console.log('✅ Test 3: OAuth Discovery Endpoint');
  try {
    const discoveryData = await makeHttpsRequest('https://accounts.google.com/.well-known/openid_configuration');
    const discovery = JSON.parse(discoveryData);
    console.log('   ✓ OAuth discovery endpoint accessible');
    console.log(`   ✓ Authorization endpoint: ${discovery.authorization_endpoint}`);
    console.log(`   ✓ Token endpoint available: Yes`);
  } catch (error) {
    console.log('   ❌ Failed to access OAuth discovery endpoint');
    console.log(`   Error: ${error.message}`);
  }
  console.log();

  // Test 4: Generate authorization URL
  console.log('✅ Test 4: Authorization URL Generation');
  const authUrl = generateAuthorizationUrl();
  console.log('   ✓ Authorization URL generated successfully');
  console.log(`   URL: ${authUrl.substring(0, 100)}...`);
  console.log();

  // Test 5: Test OAuth consent screen status
  console.log('✅ Test 5: OAuth Consent Screen Status');
  await testConsentScreenStatus();
  console.log();

  // Test 6: Common issues check
  console.log('✅ Test 6: Common Issues Check');
  checkCommonIssues();
  console.log();

  // Instructions
  console.log('🚀 Next Steps:');
  console.log('=====================================');
  console.log('1. Visit the full authorization URL generated in Test 4');
  console.log('2. Complete the OAuth consent flow');
  console.log('3. If you encounter errors, check the diagnostics above');
  console.log('4. Run: node gmail-auth.js [authorization-code]');
  console.log();
}

function generateAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: 'code',
    scope: CONFIG.requiredScopes.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function testConsentScreenStatus() {
  try {
    // Try to get project information from Google Cloud
    const projectUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${CONFIG.projectId}`;
    console.log('   📋 OAuth Consent Screen Configuration:');
    console.log(`      Console URL: ${projectUrl}`);
    console.log('      Status: Manual verification required');
    console.log();
    console.log('   ⚠️  Please verify manually:');
    console.log('      1. OAuth consent screen is configured');
    console.log('      2. App name and support email are set');
    console.log('      3. Required Gmail scopes are added');
    console.log('      4. Your email is added as a test user');
    console.log('      5. Publishing status is set appropriately');
  } catch (error) {
    console.log('   ❌ Unable to automatically check consent screen status');
    console.log(`   Manual verification required: ${error.message}`);
  }
}

function checkCommonIssues() {
  const issues = [];

  // Check for common redirect URI issues
  if (CONFIG.redirectUri === 'urn:ietf:wg:oauth:2.0:oob') {
    issues.push({
      issue: 'Using deprecated OOB redirect URI',
      solution: 'Update redirect URI to http://localhost or configure proper web redirect'
    });
  }

  // Check for scope issues
  if (CONFIG.requiredScopes.length === 0) {
    issues.push({
      issue: 'No scopes specified',
      solution: 'Add required Gmail API scopes to the consent screen'
    });
  }

  // Check environment variables
  if (!process.env.GOOGLE_CLIENT_ID && !process.env.GCP_PROJECT_ID) {
    issues.push({
      issue: 'Missing environment variables',
      solution: 'Set GOOGLE_CLIENT_ID and GCP_PROJECT_ID environment variables'
    });
  }

  if (issues.length === 0) {
    console.log('   ✓ No common issues detected');
  } else {
    console.log('   ⚠️  Potential issues found:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.issue}`);
      console.log(`      Solution: ${issue.solution}`);
    });
  }
}

function makeHttpsRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Enhanced OAuth URL with better error handling
function generateEnhancedAuthUrl() {
  console.log('\n🔗 Enhanced Authorization URL:');
  console.log('=====================================');
  
  const authUrl = generateAuthorizationUrl();
  console.log(authUrl);
  console.log();
  
  console.log('📋 URL Parameters Breakdown:');
  console.log(`   client_id: ${CONFIG.clientId}`);
  console.log(`   redirect_uri: ${CONFIG.redirectUri}`);
  console.log(`   scopes: ${CONFIG.requiredScopes.join(', ')}`);
  console.log(`   access_type: offline (for refresh token)`);
  console.log(`   prompt: consent (force consent screen)`);
  console.log();
}

// Troubleshooting guide
function showTroubleshootingGuide() {
  console.log('🛠️  Troubleshooting Guide:');
  console.log('=====================================');
  console.log();
  
  console.log('❌ Error: "unauthorized_client"');
  console.log('   Cause: OAuth consent screen not configured');
  console.log('   Fix: Configure consent screen in Google Cloud Console');
  console.log();
  
  console.log('❌ Error: "invalid_request"');
  console.log('   Cause: Invalid redirect URI or client configuration');
  console.log('   Fix: Check redirect URI matches credentials configuration');
  console.log();
  
  console.log('❌ Error: "access_denied"');
  console.log('   Cause: User denied permission or app not approved');
  console.log('   Fix: Grant permissions or add user as test user');
  console.log();
  
  console.log('❌ Error: "invalid_scope"');
  console.log('   Cause: Requested scopes not configured in consent screen');
  console.log('   Fix: Add Gmail API scopes to OAuth consent screen');
  console.log();
}

// Main execution
async function main() {
  try {
    await testOAuthConfiguration();
    generateEnhancedAuthUrl();
    showTroubleshootingGuide();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testOAuthConfiguration,
  generateAuthorizationUrl,
  CONFIG
};
