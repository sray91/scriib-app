/**
 * Import Users to Clerk from Supabase Export
 *
 * This script imports users from the Supabase export file into Clerk
 * and populates the clerk_user_mapping table to maintain compatibility
 * with the existing database schema.
 *
 * Prerequisites:
 * 1. Run export-supabase-users.js first
 * 2. Set CLERK_SECRET_KEY in your .env.local
 * 3. Ensure clerk_user_mapping table exists in Supabase
 *
 * Usage:
 * node scripts/import-users-to-clerk.js [--test]
 *
 * Options:
 * --test    Test mode: Only import first 3 users
 * --skip=N  Skip first N users (for resuming failed imports)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.NEXT_SUPABASE_SERVICE_KEY;

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const skipArg = args.find(arg => arg.startsWith('--skip='));
const skipCount = skipArg ? parseInt(skipArg.split('=')[1]) : 0;

if (!CLERK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please ensure these are set in .env.local:');
  console.error('  - CLERK_SECRET_KEY');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Create a user in Clerk via the Backend API
 */
async function createClerkUser(user) {
  const response = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [user.email],
      first_name: user.profile?.full_name?.split(' ')[0] || user.metadata?.full_name?.split(' ')[0] || '',
      last_name: user.profile?.full_name?.split(' ').slice(1).join(' ') || user.metadata?.full_name?.split(' ').slice(1).join(' ') || '',
      // Password cannot be set directly - users will need to reset
      skip_password_checks: true,
      skip_password_requirement: true,
      // Mark email as verified if it was in Supabase
      email_addresses: [{
        email_address: user.email,
        verified: user.email_verified
      }],
      // Store admin status and other metadata
      public_metadata: {
        is_admin: user.metadata?.is_admin || false,
        migrated_from_supabase: true,
        original_supabase_id: user.id,
      },
      private_metadata: {
        supabase_created_at: user.created_at,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Clerk API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Create mapping in clerk_user_mapping table
 */
async function createMapping(clerkUserId, supabaseUserId) {
  const { error } = await supabase
    .from('clerk_user_mapping')
    .insert({
      clerk_user_id: clerkUserId,
      supabase_user_id: supabaseUserId,
    });

  if (error) {
    throw new Error(`Failed to create mapping: ${error.message}`);
  }
}

/**
 * Import a single user
 */
async function importUser(user) {
  try {
    // Create user in Clerk
    const clerkUser = await createClerkUser(user);

    // Create mapping in Supabase
    await createMapping(clerkUser.id, user.id);

    return {
      success: true,
      email: user.email,
      clerkId: clerkUser.id,
      supabaseId: user.id,
    };
  } catch (error) {
    return {
      success: false,
      email: user.email,
      supabaseId: user.id,
      error: error.message,
    };
  }
}

/**
 * Main import function
 */
async function importAllUsers() {
  console.log('🚀 Starting Clerk user import...\n');

  if (isTestMode) {
    console.log('⚠️  Running in TEST MODE - will only import first 3 users\n');
  }

  if (skipCount > 0) {
    console.log(`⏭️  Skipping first ${skipCount} users\n`);
  }

  // Read the export file
  const filename = 'supabase-users-export.json';
  if (!fs.existsSync(filename)) {
    console.error(`❌ Error: ${filename} not found`);
    console.error('Please run export-supabase-users.js first');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(filename, 'utf8'));
  console.log(`📄 Loaded ${users.length} users from ${filename}\n`);

  // Filter users based on mode and skip count
  let usersToImport = users.slice(skipCount);
  if (isTestMode) {
    usersToImport = usersToImport.slice(0, 3);
  }

  console.log(`📥 Importing ${usersToImport.length} users...\n`);

  const results = {
    success: [],
    failed: [],
  };

  for (let i = 0; i < usersToImport.length; i++) {
    const user = usersToImport[i];
    const totalIndex = skipCount + i + 1;

    console.log(`[${totalIndex}/${users.length}] Importing ${user.email}...`);

    const result = await importUser(user);

    if (result.success) {
      results.success.push(result);
      console.log(`  ✅ Success: Clerk ID = ${result.clerkId}`);
    } else {
      results.failed.push(result);
      console.error(`  ❌ Failed: ${result.error}`);
    }

    // Rate limiting: Clerk has API rate limits
    // Wait 200ms between requests to be safe
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFilename = `migration-results-${timestamp}.json`;
  fs.writeFileSync(resultsFilename, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📄 Results saved to: ${resultsFilename}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Users:');
    results.failed.forEach(f => {
      console.log(`   - ${f.email}: ${f.error}`);
    });
  }

  console.log('\n⚠️  Post-Migration Steps:');
  console.log('   1. Send password reset emails to all migrated users');
  console.log('   2. Test authentication with a few user accounts');
  console.log('   3. Verify clerk_user_mapping table is populated');
  console.log('   4. Test that existing user data is accessible');
  console.log('   5. Monitor for any authentication issues\n');

  if (results.failed.length > 0) {
    console.log('💡 To retry failed users:');
    console.log(`   node scripts/import-users-to-clerk.js --skip=${skipCount + results.success.length}\n`);
  }
}

// Run the import
importAllUsers().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
