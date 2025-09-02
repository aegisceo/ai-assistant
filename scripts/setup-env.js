#!/usr/bin/env node

/**
 * Interactive setup script to help configure environment variables
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env.local');

console.log('🚀 AI Email Assistant - Environment Setup');
console.log('='.repeat(50));
console.log('This will help you configure the required API keys and credentials.\n');

const questions = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    prompt: 'Enter your Supabase Project URL (https://your-project.supabase.co): ',
    required: true
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    prompt: 'Enter your Supabase Anon Key: ',
    required: true
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    prompt: 'Enter your Supabase Service Role Key: ',
    required: true
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    prompt: 'Enter your Google OAuth Client ID: ',
    required: true
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    prompt: 'Enter your Google OAuth Client Secret: ',
    required: true
  },
  {
    key: 'ANTHROPIC_API_KEY',
    prompt: 'Enter your Anthropic Claude API Key: ',
    required: true
  },
  {
    key: 'NEXTAUTH_SECRET',
    prompt: 'Enter a random string for NextAuth secret (press Enter to generate): ',
    required: false,
    default: () => require('crypto').randomBytes(32).toString('hex')
  }
];

const answers = {};

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question.prompt, (answer) => {
      if (!answer && question.required) {
        console.log('❌ This field is required. Please try again.\n');
        askQuestion(question).then(resolve);
      } else if (!answer && question.default) {
        resolve(question.default());
      } else {
        resolve(answer);
      }
    });
  });
}

async function setup() {
  console.log('📋 Please provide the following information:\n');
  
  for (const question of questions) {
    answers[question.key] = await askQuestion(question);
    console.log('✅ Saved\n');
  }
  
  // Set NEXTAUTH_URL
  answers.NEXTAUTH_URL = 'http://localhost:3000';
  
  // Generate .env.local content
  let envContent = '# AI Email Assistant Environment Configuration\n';
  envContent += '# Generated on ' + new Date().toISOString() + '\n\n';
  
  envContent += '# Supabase Configuration\n';
  envContent += `NEXT_PUBLIC_SUPABASE_URL=${answers.NEXT_PUBLIC_SUPABASE_URL}\n`;
  envContent += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${answers.NEXT_PUBLIC_SUPABASE_ANON_KEY}\n`;
  envContent += `SUPABASE_SERVICE_ROLE_KEY=${answers.SUPABASE_SERVICE_ROLE_KEY}\n\n`;
  
  envContent += '# Google OAuth Configuration (Gmail + Calendar)\n';
  envContent += `GOOGLE_CLIENT_ID=${answers.GOOGLE_CLIENT_ID}\n`;
  envContent += `GOOGLE_CLIENT_SECRET=${answers.GOOGLE_CLIENT_SECRET}\n\n`;
  
  envContent += '# Anthropic Claude API Configuration\n';
  envContent += `ANTHROPIC_API_KEY=${answers.ANTHROPIC_API_KEY}\n\n`;
  
  envContent += '# Next.js Configuration\n';
  envContent += `NEXTAUTH_URL=${answers.NEXTAUTH_URL}\n`;
  envContent += `NEXTAUTH_SECRET=${answers.NEXTAUTH_SECRET}\n`;
  
  // Write to file
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Environment configuration saved to .env.local');
  console.log('\n🎉 Setup complete! Next steps:');
  console.log('1. Restart your development server: npm run dev');
  console.log('2. Open http://localhost:3000');
  console.log('3. Click "Connect Gmail" to authenticate');
  console.log('4. Start testing with your real email data!');
  
  rl.close();
}

// Check if .env.local already exists
if (fs.existsSync(envPath)) {
  rl.question('⚠️ .env.local already exists. Overwrite? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      setup();
    } else {
      console.log('Setup cancelled. You can manually edit .env.local');
      rl.close();
    }
  });
} else {
  setup();
}