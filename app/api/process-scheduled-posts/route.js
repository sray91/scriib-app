import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    console.log('Checking for scheduled posts...');
    
    // First get due posts
    const { data: duePosts, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', new Date().toISOString())

    if (fetchError) throw fetchError;

    console.log(`Found ${duePosts?.length || 0} posts to process`);

    for (const post of duePosts) {
      try {
        // Get the selected account IDs from the platforms field
        const selectedAccountIds = Object.entries(post.platforms || {})
          .filter(([_, isSelected]) => isSelected)
          .map(([accountId]) => accountId);

        // Get the social accounts for this post
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('*')
          .in('id', selectedAccountIds);

        console.log(`Processing post ${post.id} for accounts:`, accounts);

        // Post to each selected platform
        for (const account of accounts) {
          if (account.platform === 'twitter') {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/post/twitter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: post.content,
                accessToken: account.access_token,
                mediaFiles: post.media_files
              })
            });

            if (!response.ok) {
              throw new Error(`Failed to post to Twitter: ${response.statusText}`);
            }
          }
        }

        // Update post status to published
        await supabase
          .from('posts')
          .update({ 
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', post.id);

      } catch (error) {
        console.error('Error processing post:', post.id, error);
        await supabase
          .from('posts')
          .update({ 
            status: 'failed',
            error_message: error.message 
          })
          .eq('id', post.id);
      }
    }

    return Response.json({ 
      success: true, 
      processed: duePosts?.length || 0 
    });

  } catch (error) {
    console.error('Error in scheduled posts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
} 