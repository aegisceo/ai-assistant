#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Creating OAuth states table...');
    
    // Create the table directly using Supabase client
    const { error: tableError } = await supabase
      .schema('public')
      .from('oauth_states')
      .select('*')
      .limit(1);
    
    // If table exists, tableError will be null
    // If table doesn't exist, we'll get a relation error
    if (tableError && tableError.message.includes('relation')) {
      console.log('Table does not exist, creating it...');
      
      // Since we can't execute raw SQL easily, let's try to create via API
      // This approach may not work with complex DDL, so we'll provide manual instructions
      console.log('❌ Cannot apply DDL migrations programmatically with this setup.');
      console.log('');
      console.log('Please apply the migration manually:');
      console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/projects');
      console.log('2. Navigate to your project: cmbnexhzuoydobsevplb');
      console.log('3. Go to SQL Editor');
      console.log('4. Copy and paste the following SQL:');
      console.log('');
      
      // Read and display the migration
      const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250901000003_create_oauth_states.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('--- SQL TO RUN ---');
      console.log(migrationSQL);
      console.log('--- END SQL ---');
      console.log('');
      console.log('5. Click "Run" to execute the migration');
      console.log('6. Then try reconnecting Gmail in the app');
      
    } else if (!tableError) {
      console.log('✅ OAuth states table already exists!');
      console.log('You can now reconnect Gmail.');
    } else {
      console.error('Unexpected error:', tableError);
    }
    
  } catch (err) {
    console.error('Error checking migration:', err.message);
    process.exit(1);
  }
}

applyMigration();