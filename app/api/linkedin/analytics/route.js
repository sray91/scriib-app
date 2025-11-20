import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Helper function to transform LinkedIn API post to our format
function transformLinkedInPost(post, startDate, endDate) {
  try {
    // Extract timestamp
    let publishedAt = null;
    if (post.created?.time) {
      publishedAt = new Date(post.created.time);
    } else if (post.createdAt) {
      publishedAt = new Date(post.createdAt);
    } else if (post.created) {
      publishedAt = new Date(post.created);
    } else {
      publishedAt = new Date();
    }

    // Filter by date range
    if (publishedAt < startDate || publishedAt > endDate) {
      return null;
    }

    // Extract content
    let content = 'No content available';
    if (post.text?.text) {
      content = post.text.text;
    } else if (post.commentary?.text) {
      content = post.commentary.text;
    } else if (post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text) {
      content = post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
    } else if (post.content?.description) {
      content = post.content.description;
    }

    // Extract metrics
    const socialCounts = post.totalSocialActivityCounts || {};
    const metrics = {
      likes: socialCounts.numLikes || socialCounts.likes || 0,
      comments: socialCounts.numComments || socialCounts.comments || 0,
      shares: socialCounts.numShares || socialCounts.shares || 0,
      views: socialCounts.numViews || 0,
      impressions: socialCounts.numImpressions || socialCounts.numViews || 0,
      reactions: socialCounts.numLikes || 0
    };

    // Build post URL
    let postUrl = null;
    if (post.id) {
      const postId = post.id.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');
      postUrl = `https://www.linkedin.com/feed/update/${postId}/`;
    }

    return {
      id: post.id || `post_${Date.now()}`,
      content,
      published_at: publishedAt.toISOString(),
      post_url: postUrl,
      metrics
    };
  } catch (error) {
    console.error('Error transforming LinkedIn post:', error);
    return null;
  }
}

export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get the user's LinkedIn access token
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single();

    if (accountError || !linkedinAccount) {
      return NextResponse.json({ 
        error: 'LinkedIn account not connected. Please connect your LinkedIn account first.',
        needsAuth: true 
      }, { status: 404 });
    }

    // Check if token is expired
    if (linkedinAccount.expires_at && new Date(linkedinAccount.expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'LinkedIn access token has expired. Please reconnect your account.',
        needsAuth: true 
      }, { status: 401 });
    }

    const accessToken = linkedinAccount.access_token;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30'; // days
    const postId = searchParams.get('postId');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Fetch real-time data from LinkedIn Member Data Portability API
    let profileData = null;
    let linkedInPosts = [];

    try {
      // Get basic profile information
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        profileData = {
          id: profile.id,
          name: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim()
        };
      }

      // Fetch posts using Member Data Portability API
      console.log('Fetching LinkedIn posts via Member Data Portability API...');

      // Try Member Snapshot API for posts
      const snapshotResponse = await fetch(
        'https://api.linkedin.com/v2/memberSnapshot?q=member&domains=POSTS',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json'
          }
        }
      );

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('Member Snapshot API successful');

        // Extract posts from snapshot data
        if (snapshotData.POSTS?.elements) {
          linkedInPosts = snapshotData.POSTS.elements;
        } else if (snapshotData.elements) {
          linkedInPosts = snapshotData.elements.filter(item =>
            item.type === 'POST' || item.domain === 'POSTS'
          );
        }
      } else {
        console.log(`Member Snapshot API returned ${snapshotResponse.status}, trying alternative...`);

        // Try ugcPosts API as fallback
        const ugcResponse = await fetch(
          `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${profileData?.id})&count=100`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0'
            }
          }
        );

        if (ugcResponse.ok) {
          const ugcData = await ugcResponse.json();
          linkedInPosts = ugcData.elements || [];
          console.log('UGC Posts API successful');
        }
      }
    } catch (apiError) {
      console.error('LinkedIn API error:', apiError);
      // Fall back to database if API fails
    }

    // If we got posts from LinkedIn API, use those; otherwise fall back to database
    let pastPosts = [];
    if (linkedInPosts.length > 0) {
      // Transform LinkedIn API posts to our format
      pastPosts = linkedInPosts.map(post => transformLinkedInPost(post, startDate, endDate))
        .filter(post => post !== null); // Filter out posts outside date range

      console.log(`Using ${pastPosts.length} posts from LinkedIn API`);
    } else {
      // Fallback: fetch from database
      console.log('Falling back to database posts');
      const { data: dbPosts, error: postsError } = await supabase
        .from('past_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'linkedin')
        .gte('published_at', startDate.toISOString())
        .lte('published_at', endDate.toISOString())
        .order('published_at', { ascending: false });

      if (!postsError) {
        pastPosts = dbPosts || [];
      }
    }

    // Calculate aggregate metrics from stored posts
    let totalViews = 0;
    let totalImpressions = 0;
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;
    let postsWithEngagement = 0;
    let totalEngagement = 0;

    const transformedPosts = pastPosts.map(post => {
      const metrics = post.metrics || {};
      const views = metrics.views || 0;
      const impressions = metrics.impressions || 0;
      const reactions = metrics.likes || metrics.reactions || 0;
      const comments = metrics.comments || 0;
      const shares = metrics.shares || 0;

      // Calculate engagement rate for this post
      let engagement = 0;
      if (impressions > 0) {
        engagement = ((reactions + comments + shares) / impressions) * 100;
        postsWithEngagement++;
        totalEngagement += engagement;
      }

      totalViews += views;
      totalImpressions += impressions;
      totalReactions += reactions;
      totalComments += comments;
      totalShares += shares;

      return {
        id: post.id,
        content: post.content,
        publishedAt: post.published_at,
        postUrl: post.post_url,
        metrics: {
          views,
          impressions,
          reactions,
          comments,
          shares,
          engagement: engagement
        }
      };
    });

    const averageEngagement = postsWithEngagement > 0
      ? totalEngagement / postsWithEngagement
      : 0;

    const analyticsData = {
      profile: profileData,
      metrics: {
        totalViews,
        totalImpressions,
        totalReactions,
        totalComments,
        totalShares,
        averageEngagement,
        postsCount: pastPosts.length
      },
      posts: transformedPosts,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: parseInt(timeRange)
      },
      dataSource: linkedInPosts.length > 0 ? 'linkedin_api' : 'database',
      apiLimitation: pastPosts.length === 0 ? {
        message: "No LinkedIn posts found for this time range.",
        availableData: "Click 'Sync Posts' to fetch your recent LinkedIn posts and their engagement metrics.",
        upgradeInfo: "Data is fetched from LinkedIn's Member Data Portability API."
      } : linkedInPosts.length > 0 ? {
        message: "Showing real-time analytics from LinkedIn Member Data Portability API.",
        availableData: `Displaying ${pastPosts.length} posts with live engagement metrics.`,
        upgradeInfo: "Data refreshes each time you visit this page."
      } : {
        message: "Showing analytics from your synced LinkedIn posts (database).",
        availableData: `Displaying ${pastPosts.length} posts from your database. Click 'Sync Posts' to refresh with latest data from LinkedIn.`,
        upgradeInfo: "For real-time analytics, ensure your LinkedIn account is properly connected."
      }
    };

    // Update last used timestamp
    await supabase
      .from('social_accounts')
      .update({ last_used_at: new Date() })
      .eq('id', linkedinAccount.id);

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('LinkedIn analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn analytics', details: error.message },
      { status: 500 }
    );
  }
} 