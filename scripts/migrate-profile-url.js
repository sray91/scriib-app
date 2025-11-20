import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('Running migration to make profile_url nullable...')

  try {
    // Execute the ALTER TABLE command
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('id')
      .limit(0)

    // We need to use the raw SQL query approach
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE public.crm_contacts ALTER COLUMN profile_url DROP NOT NULL;'
    })

    if (sqlError) {
      console.error('Migration failed:', sqlError)
      process.exit(1)
    }

    console.log('✅ Migration completed successfully!')
    console.log('profile_url is now nullable in crm_contacts table')
    process.exit(0)
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration()
