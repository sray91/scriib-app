import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUnipileClient } from '@/lib/unipile-client';

export const dynamic = 'force-dynamic';

/**
 * LinkedIn Analytics via Unipile API
 * This route fetches LinkedIn post analytics using Unipile instead of direct LinkedIn API
 * Works with accounts connected via Unipile (stored in linkedin_outreach_accounts table)
 */
export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30'; // days
    const limit = searchParams.get('limit') || '50'; // number of posts to fetch

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Get user's Unipile LinkedIn account
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('linkedin_outreach_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (accountError || !linkedinAccount) {
      return NextResponse.json({
        error: 'LinkedIn account not connected via Unipile. Please connect your LinkedIn account first.',
        needsAuth: true,
        hint: 'Use the Outreach settings to connect your LinkedIn account.'
      }, { status: 404 });
    }

    const unipileAccountId = linkedinAccount.unipile_account_id;
    console.log('=== Unipile LinkedIn Analytics Request ===');
    console.log('Unipile Account ID:', unipileAccountId);
    console.log('Fetching posts from last', timeRange, 'days');

    // Initialize Unipile client
    const unipile = getUnipileClient();

    // Fetch posts using Unipile
    let postsData = [];
    try {
      const response = await unipile.listUserPosts(unipileAccountId, 'me', {
        limit: parseInt(limit)
      });

      console.log('Unipile API response:', JSON.stringify(response, null, 2));

      // Extract posts from response (Unipile wraps results in different ways)
      if (response.items) {
        postsData = response.items;
      } else if (response.data) {
        postsData = response.data;
      } else if (Array.isArray(response)) {
        postsData = response;
      }

      console.log(`Fetched ${postsData.length} posts from Unipile`);
    } catch (unipileError) {
      console.error('Unipile API error:', unipileError);
      return NextResponse.json({
        error: 'Failed to fetch posts from Unipile',
        details: unipileError.message,
        hint: 'Check that your Unipile account is properly connected and active.'
      }, { status: 500 });
    }

    // Transform Unipile posts to our format
    const transformedPosts = postsData
      .map(post => transformUnipilePost(post, startDate, endDate))
      .filter(post => post !== null); // Filter out posts outside date range

    // Calculate aggregate metrics
    let totalViews = 0;
    let totalImpressions = 0;
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;
    let postsWithEngagement = 0;
    let totalEngagement = 0;

    const posts = transformedPosts.map(post => {
      const metrics = post.metrics || {};
      const views = metrics.views || 0;
      const impressions = metrics.impressions || 0;
      const reactions = metrics.reactions || 0;
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
      profile: {
        name: linkedinAccount.profile_name || linkedinAccount.account_name,
        id: linkedinAccount.unipile_account_id
      },
      metrics: {
        totalViews,
        totalImpressions,
        totalReactions,
        totalComments,
        totalShares,
        averageEngagement,
        postsCount: posts.length
      },
      posts: posts,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: parseInt(timeRange)
      },
      dataSource: 'unipile',
      apiLimitation: {
        message: "Showing real-time analytics from Unipile LinkedIn API.",
        availableData: `Displaying ${posts.length} posts with engagement metrics.`,
        upgradeInfo: "Data is fetched directly from LinkedIn via Unipile."
      }
    };

    console.log('=== End Unipile Analytics Request ===');

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('LinkedIn analytics (Unipile) error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn analytics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Transform Unipile post to our standardized format
 */
function transformUnipilePost(post, startDate, endDate) {
  try {
    // Extract timestamp
    let publishedAt = null;
    if (post.created_at) {
      publishedAt = new Date(post.created_at);
    } else if (post.date) {
      publishedAt = new Date(post.date);
    } else {
      publishedAt = new Date();
    }

    // Filter by date range
    if (publishedAt < startDate || publishedAt > endDate) {
      return null;
    }

    // Extract content
    const content = post.text || post.body || post.content || 'No content available';

    // Extract metrics from Unipile response
    const metrics = {
      impressions: post.impressions_counter || post.views || 0,
      views: post.impressions_counter || post.views || 0,
      reactions: post.reaction_counter || post.likes || 0,
      comments: post.comment_counter || post.comments || 0,
      shares: post.repost_counter || post.shares || 0
    };

    // Build post URL
    let postUrl = post.url || post.link;
    if (!postUrl && post.social_id) {
      // Try to construct URL from social_id
      const postId = post.social_id.replace('urn:li:activity:', '').replace('urn:li:share:', '');
      postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${postId}/`;
    }

    return {
      id: post.social_id || post.id || `post_${Date.now()}`,
      content,
      published_at: publishedAt.toISOString(),
      post_url: postUrl,
      metrics
    };
  } catch (error) {
    console.error('Error transforming Unipile post:', error);
    return null;
  }
}
