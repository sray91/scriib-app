import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    console.log('Checking for scheduled posts...');
    
    // Get due posts with their associated social accounts
    const { data: duePosts, error: fetchError } = await supabase
      .from('posts')
      .select('*, social_accounts(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_time', new Date().toISOString())

    if (fetchError) throw fetchError;

    console.log(`Found ${duePosts?.length || 0} posts to process`);

    for (const post of duePosts) {
      try {
        // Use the existing Twitter posting endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/post/twitter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: post.content,
            accessToken: post.social_accounts.access_token,
            mediaFiles: post.media_files
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to post: ${response.statusText}`);
        }

        // Update post status to published
        await supabase
          .from('posts')
          .update({ status: 'published' })
          .eq('id', post.id);

      } catch (error) {
        console.error('Error processing post:', post.id, error);
        // Mark post as failed
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