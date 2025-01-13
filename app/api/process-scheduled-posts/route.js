import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req) {
  // Add basic authentication
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  // Skip auth check if running locally
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    console.log('Checking for scheduled posts at:', new Date().toISOString());
    
    const { data: duePosts, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching posts:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${duePosts?.length || 0} posts to process`);

    for (const post of duePosts) {
      console.log('Processing post:', post.id);
      try {
        // Get selected platforms
        const selectedAccounts = Object.entries(post.platforms)
          .filter(([_, isSelected]) => isSelected)
          .map(([accountId]) => accountId)

        // Get account details
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .in('id', selectedAccounts)

        // Post to each platform
        for (const account of accounts) {
          if (account.platform === 'twitter') {
            const response = await fetch(`${req.headers.get('origin')}/api/post/twitter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: post.content,
                accessToken: account.access_token,
                mediaFiles: post.media_files
              })
            })

            if (!response.ok) {
              throw new Error(`Failed to post to Twitter: ${response.statusText}`)
            }
          }
        }

        // Update post status to published
        await supabase
          .from('posts')
          .update({ status: 'published' })
          .eq('id', post.id)

        console.log('Post processed successfully:', post.id);

      } catch (error) {
        console.error('Error processing post:', post.id, error);
        // Mark post as failed
        await supabase
          .from('posts')
          .update({ 
            status: 'failed',
            error_message: error.message 
          })
          .eq('id', post.id)
      }
    }

    return Response.json({ 
      success: true, 
      processed: duePosts?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing posts:', error);
    return Response.json({ error: error.message }, { status: 500 })
  }
} 