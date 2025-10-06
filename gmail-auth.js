#!/usr/bin/env node

/**
 * Gmail OAuth2 Authentication Helper
 * 
 * This script helps you complete the Gmail OAuth2 flow to get a refresh token
 * that can be used by the MCP server to access your Gmail account.
 */

import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';

dotenv.config();

async function getGmailRefreshToken() {
  let credentials;
  
  try {
    // Try to read from credentials.json first
    const credentialsFile = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    credentials = {
      client_id: credentialsFile.installed.client_id,
      client_secret: credentialsFile.installed.client_secret,
      redirect_uri: credentialsFile.installed.redirect_uris[0] || 'urn:ietf:wg:oauth:2.0:oob'
    };
    console.log('✅ Using credentials from credentials.json');
  } catch (error) {
    // Fall back to environment variables
    credentials = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
    };
    
    if (!credentials.client_id || !credentials.client_secret) {
      console.error('❌ Missing Gmail API credentials');
      console.error('Please either create credentials.json or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
      process.exit(1);
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );

  // Generate the URL for user consent
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    prompt: 'consent' // Force consent screen to get refresh token
  });

  console.log('\n🔐 Gmail OAuth2 Setup');
  console.log('='.repeat(50));
  console.log('\n1. Visit this URL in your browser:');
  console.log('\n' + authUrl);
  console.log('\n2. Sign in to your Gmail account');
  console.log('3. Grant the requested permissions');
  console.log('4. Copy the authorization code from the browser');
  console.log('\nThen run: node gmail-auth.js <authorization_code>');
  console.log('\nExample: node gmail-auth.js 4/0AeanS0ZnZE7sGrv...');
}

async function exchangeCodeForTokens(authCode) {
  const credentials = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
  };

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );

  try {
    const { tokens } = await oauth2Client.getToken(authCode);
    
    console.log('\n✅ Authentication successful!');
    console.log('\nAdd this to your .env file:');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);

    console.log('\n⚠️  Security Note: Keep this token secure!');
    console.log('   • Do not share or commit to version control');
    console.log('   • This token grants access to your Gmail account');

    if (tokens.access_token) {
      console.log('\n🔑 Access token received (expires in 1 hour)');
    }
    
    console.log('\n📧 You can now use Gmail tools in the MCP server!');
    
  } catch (error) {
    console.error('\n❌ Error exchanging code for tokens:');
    console.error('Error:', error.message);
    
    if (error.message.includes('unauthorized_client')) {
      console.error('\n🔧 This error usually means:');
      console.error('1. OAuth consent screen is not configured');
      console.error('2. Your app is not approved for the requested scopes');
      console.error('3. The redirect URI doesn\'t match');
      console.error('\n📋 To fix this:');
      console.error('- Go to Google Cloud Console');
      console.error('- Configure the OAuth consent screen');
      console.error('- Add gmail scopes: readonly, send, modify');
      console.error('- Add yourself as a test user');
      console.error('- Make sure redirect URI is: http://localhost');
    }
    
    process.exit(1);
  }
}

// Main logic
const authCode = process.argv[2];

if (authCode) {
  exchangeCodeForTokens(authCode);
} else {
  getGmailRefreshToken();
}
