import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get table structure info for posts
    const { data: postsColumns, error: postsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'posts')
      .eq('table_schema', 'public')

    // Get FK relationships for posts
    const { data: foreignKeys, error: fkError } = await supabase
      .from('information_schema.key_column_usage')
      .select(`
        constraint_name,
        column_name,
        table_name
      `)
      .eq('table_name', 'posts')
      .eq('table_schema', 'public')

    // Get a sample post with a basic query
    const { data: samplePost, error: sampleError } = await supabase
      .from('posts')
      .select('*')
      .limit(1)
      .single()

    // Test a basic query to auth.users
    const { data: sampleUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
      .single()

    // Test the specific query that's failing
    const testQuery = samplePost?.user_id ? 
      await supabase
        .from('posts')
        .select('*, user:user_id(*)')
        .eq('id', samplePost.id)
        .single() : 
      { error: "No sample post found to test" };

    // Return the combined info
    return NextResponse.json({
      message: "Database debug information",
      postsColumns: postsColumns || [],
      postsColumnsError: postsError ? postsError.message : null,
      foreignKeys: foreignKeys || [],
      foreignKeysError: fkError ? fkError.message : null,
      samplePost: samplePost || null,
      samplePostError: sampleError ? sampleError.message : null,
      sampleUser: sampleUser || null,
      sampleUserError: userError ? userError.message : null,
      testQueryResult: testQuery.data || null,
      testQueryError: testQuery.error ? testQuery.error.message : null
    })
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
} 