/**
 * Export Users from Supabase
 *
 * This script exports all users from Supabase auth.users for migration to Clerk.
 * Note: Password hashes cannot be exported from Supabase for security reasons.
 * Users will need to reset their passwords after migration or use OAuth.
 *
 * Usage:
 * 1. Set SUPABASE_SERVICE_ROLE_KEY in your .env.local
 * 2. Run: node scripts/export-supabase-users.js
 * 3. Output will be saved to supabase-users-export.json
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_SUPABASE_SERVICE_KEY are set in .env.local');
  process.exit(1);
}

async function exportUsers() {
  console.log('🚀 Starting Supabase user export...\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Use admin API to list all users
    console.log('📥 Fetching users from Supabase...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      throw new Error(`Failed to fetch users: ${authError.message}`);
    }

    const users = authData.users || [];
    console.log(`✅ Found ${users.length} users in Supabase auth\n`);

    // Get profile data for each user
    console.log('📥 Enriching user data with profiles...');
    const enrichedUsers = [];

    for (const user of users) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        enrichedUsers.push({
          id: user.id,
          email: user.email,
          email_verified: user.email_confirmed_at !== null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          metadata: user.user_metadata || {},
          app_metadata: user.app_metadata || {},
          profile: profile || null,
        });

        console.log(`  ✓ Exported: ${user.email}`);
      } catch (error) {
        console.warn(`  ⚠️  Warning: Could not fetch profile for ${user.email}`);
        enrichedUsers.push({
          id: user.id,
          email: user.email,
          email_verified: user.email_confirmed_at !== null,
          created_at: user.created_at,
          metadata: user.user_metadata || {},
          profile: null,
        });
      }
    }

    // Save to file
    const filename = 'supabase-users-export.json';
    fs.writeFileSync(filename, JSON.stringify(enrichedUsers, null, 2));

    console.log(`\n✅ Export complete!`);
    console.log(`📄 Exported ${enrichedUsers.length} users to ${filename}\n`);

    // Print summary
    console.log('📊 Export Summary:');
    console.log(`   Total users: ${enrichedUsers.length}`);
    console.log(`   Verified emails: ${enrichedUsers.filter(u => u.email_verified).length}`);
    console.log(`   Unverified emails: ${enrichedUsers.filter(u => !u.email_verified).length}`);
    console.log(`   With profiles: ${enrichedUsers.filter(u => u.profile).length}`);
    console.log(`   Admin users: ${enrichedUsers.filter(u => u.metadata?.is_admin).length}`);

    console.log('\n⚠️  Important Notes:');
    console.log('   - Password hashes CANNOT be exported from Supabase');
    console.log('   - Users will need to reset their passwords after migration');
    console.log('   - Alternatively, users can sign in via Google OAuth');
    console.log('   - Store this export file securely - it contains user data\n');

  } catch (error) {
    console.error('❌ Error during export:', error.message);
    process.exit(1);
  }
}

// Run the export
exportUsers();
