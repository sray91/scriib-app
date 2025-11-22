import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getLinkedInConfig, LINKEDIN_MODES } from '@/lib/linkedin-config';

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get request parameters
    const { count = 30 } = await request.json().catch(() => ({}));
    const postsToFetch = Math.min(count, 50); // Limit to 50 posts max

    // Get the user's LinkedIn access token for portability mode
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin_portability')
      .single();

    if (accountError || !linkedinAccount) {
      return NextResponse.json({
        error: 'LinkedIn Portability account not connected. Please connect your LinkedIn account with Member Data Portability access first.',
        needsAuth: true,
        authUrl: `/api/auth/linkedin?mode=portability`
      }, { status: 404 });
    }

    // Check if token is expired
    if (linkedinAccount.expires_at && new Date(linkedinAccount.expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'LinkedIn access token has expired. Please reconnect your account.',
        needsAuth: true,
        authUrl: `/api/auth/linkedin?mode=${LINKEDIN_MODES.PORTABILITY}`
      }, { status: 401 });
    }

    const accessToken = linkedinAccount.access_token;

    console.log('=== LinkedIn Posts Sync Request ===');
    console.log('Account platform:', linkedinAccount.platform);
    console.log('Token exists:', !!accessToken);
    console.log('Token preview:', accessToken?.substring(0, 20) + '...');
    console.log('Fetching LinkedIn posts using Member Data Portability API...');

    // Fetch posts using LinkedIn Member Data Portability API
    // Note: The actual API endpoints may vary based on LinkedIn's current implementation
    let posts = [];
    let allPosts = [];

    try {
      console.log('Using Member Data Portability API...');
      console.log('Requesting', postsToFetch, 'posts');
      
      // Use Member Snapshot API to get member data including posts
      // This is the correct DMA API endpoint for accessing member data
      const snapshotResponse = await fetch(
        'https://api.linkedin.com/v2/memberSnapshot?q=member&domains=POSTS,ACCOUNT_HISTORY',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!snapshotResponse.ok) {
        const snapshotError = await snapshotResponse.text();
        console.error(`Member Snapshot API failed: ${snapshotResponse.status}`, snapshotError);
        console.log('Trying Member Changelog API as alternative...');

        // Try Member Changelog API as alternative
        const changelogResponse = await fetch(
          `https://api.linkedin.com/v2/memberChangelog?q=member&count=${postsToFetch}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Member Changelog API status:', changelogResponse.status);

        if (!changelogResponse.ok) {
          const changelogError = await changelogResponse.text();
          console.error('Member Changelog API error:', changelogResponse.status, changelogError);
          throw new Error(`Both DMA APIs failed. Snapshot: ${snapshotResponse.status}, Changelog: ${changelogResponse.status}`);
        }

        const changelogData = await changelogResponse.json();
        console.log('Using Member Changelog API data:', JSON.stringify(changelogData, null, 2));
        posts = changelogData.elements || [];
        console.log(`Changelog API returned ${posts.length} posts`);
      } else {
        const snapshotData = await snapshotResponse.json();
        console.log('Member Snapshot API successful!');
        console.log('Snapshot data:', JSON.stringify(snapshotData, null, 2));

        // Extract posts from snapshot data
        if (snapshotData.POSTS && snapshotData.POSTS.elements) {
          posts = snapshotData.POSTS.elements;
          console.log(`Found ${posts.length} posts in POSTS.elements`);
        } else if (snapshotData.elements) {
          posts = snapshotData.elements.filter(item => item.type === 'POST' || item.domain === 'POSTS');
          console.log(`Found ${posts.length} posts in elements array after filtering`);
        } else {
          posts = snapshotData.elements || [];
          console.log(`Using raw elements array: ${posts.length} posts`);
        }
      }

      console.log(`Total posts to process: ${posts.length}`);

      // Transform LinkedIn posts to our format
      for (const post of posts) {
        try {
          const transformedPost = {
            platform_post_id: post.id,
            content: extractPostContent(post),
            published_at: new Date(post.created?.time || Date.now()).toISOString(),
            post_url: `https://www.linkedin.com/feed/update/${post.id}/`,
            media_urls: extractMediaUrls(post),
            metrics: extractMetrics(post),
            post_type: determinePostType(post),
            visibility: post.visibility?.code || 'PUBLIC',
            raw_data: post
          };

          allPosts.push(transformedPost);
        } catch (transformError) {
          console.error('Error transforming post:', transformError);
          continue;
        }
      }

    } catch (apiError) {
      console.error('LinkedIn API error:', apiError);
      console.error('API error details:', apiError.message);
      console.error('API error stack:', apiError.stack);

      return NextResponse.json({
        error: 'Failed to fetch posts from LinkedIn API',
        details: apiError.message,
        hint: 'Check that your LinkedIn Portability API access is properly configured and your token has the required scopes.'
      }, { status: 500 });
    }

    // Store posts in database
    const storedPosts = [];
    const errors = [];

    for (const post of allPosts) {
      try {
        const { data, error } = await supabase
          .from('past_posts')
          .upsert({
            user_id: user.id,
            platform: 'linkedin',
            ...post
          }, {
            onConflict: 'platform_post_id,platform,user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error('Database error for post:', error);
          errors.push({ post_id: post.platform_post_id, error: error.message });
        } else {
          storedPosts.push(data);
        }
      } catch (dbError) {
        console.error('Database operation error:', dbError);
        errors.push({ post_id: post.platform_post_id, error: dbError.message });
      }
    }

    // Update last sync time
    await supabase
      .from('social_accounts')
      .update({ last_used_at: new Date() })
      .eq('id', linkedinAccount.id);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${storedPosts.length} LinkedIn posts`,
      data: {
        synced_count: storedPosts.length,
        total_fetched: allPosts.length,
        errors_count: errors.length,
        posts: storedPosts.map(p => ({
          id: p.id,
          content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
          published_at: p.published_at,
          post_type: p.post_type
        }))
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('LinkedIn posts sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync LinkedIn posts', details: error.message },
      { status: 500 }
    );
  }
}

// Helper functions
function extractPostContent(post) {
  if (post.text?.text) {
    return post.text.text;
  }
  
  if (post.commentary?.text) {
    return post.commentary.text;
  }
  
  if (post.content?.description) {
    return post.content.description;
  }
  
  return 'No content available';
}

function extractMediaUrls(post) {
  const mediaUrls = [];
  
  if (post.content?.media) {
    const media = Array.isArray(post.content.media) ? post.content.media : [post.content.media];
    media.forEach(item => {
      if (item.originalUrl) {
        mediaUrls.push(item.originalUrl);
      }
    });
  }
  
  return mediaUrls.length > 0 ? mediaUrls : null;
}

function extractMetrics(post) {
  // LinkedIn API may not always provide metrics in the response
  // This would typically come from a separate analytics API call
  return {
    likes: post.totalSocialActivityCounts?.numLikes || 0,
    comments: post.totalSocialActivityCounts?.numComments || 0,
    shares: post.totalSocialActivityCounts?.numShares || 0,
    // Note: Views and impressions may not be available in basic API response
    views: null,
    impressions: null
  };
}

function determinePostType(post) {
  if (post.content?.article) return 'article';
  if (post.content?.media) {
    const media = Array.isArray(post.content.media) ? post.content.media[0] : post.content.media;
    if (media.type === 'VIDEO') return 'video';
    if (media.type === 'IMAGE') return 'image';
  }
  return 'text';
} 