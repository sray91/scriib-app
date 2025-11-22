import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUnipileClient } from '@/lib/unipile-client';

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

/**
 * Fetch analytics data using Unipile API
 */
async function fetchUnipileAnalytics(unipileAccount, startDate, endDate, limit) {
  const unipile = getUnipileClient();
  const unipileAccountId = unipileAccount.unipile_account_id;

  console.log('Fetching posts from Unipile, Account ID:', unipileAccountId);

  let response;
  let errorMessages = [];

  // Strategy 1: Try the direct posts endpoint (most likely to work for own posts)
  try {
    console.log('Trying direct posts endpoint: /posts');
    response = await unipile.getAccountPosts(unipileAccountId, { limit });
    console.log('✓ Direct posts endpoint successful');
  } catch (error) {
    console.log('✗ Direct posts endpoint failed:', error.message);
    errorMessages.push(`/posts: ${error.message}`);

    // Strategy 2: Try getting account details and using identifier
    try {
      console.log('Trying to get account details for user identifier...');
      const accountDetails = await unipile.getAccount(unipileAccountId);
      console.log('Account details:', JSON.stringify(accountDetails, null, 2));

      const userIdentifier = accountDetails.identifier || accountDetails.provider_id || accountDetails.username;

      if (userIdentifier) {
        console.log('Trying user posts endpoint with identifier:', userIdentifier);
        response = await unipile.listUserPosts(unipileAccountId, userIdentifier, { limit });
        console.log('✓ User posts endpoint successful');
      } else {
        throw new Error('No user identifier found in account details');
      }
    } catch (error2) {
      console.log('✗ User posts endpoint failed:', error2.message);
      errorMessages.push(`/users/{id}/posts: ${error2.message}`);

      // Strategy 3: Try the feed endpoint as last resort
      try {
        console.log('Trying feed endpoint: /feed');
        response = await unipile.getFeed(unipileAccountId, { limit });
        console.log('✓ Feed endpoint successful');
      } catch (error3) {
        console.log('✗ Feed endpoint failed:', error3.message);
        errorMessages.push(`/feed: ${error3.message}`);

        // All strategies failed
        throw new Error(`All Unipile endpoints failed:\n${errorMessages.join('\n')}`);
      }
    }
  }

  console.log('Unipile API response received');

  // Extract posts from response
  let postsData = [];
  if (response.items) {
    postsData = response.items;
  } else if (response.data) {
    postsData = response.data;
  } else if (Array.isArray(response)) {
    postsData = response;
  }

  console.log(`Fetched ${postsData.length} posts from Unipile`);

  // Transform posts and filter by date range
  const transformedPosts = postsData
    .map(post => {
      try {
        // Extract timestamp
        let publishedAt = null;
        if (post.created_at) {
          publishedAt = new Date(post.created_at);
        } else if (post.date) {
          publishedAt = new Date(post.date);
        } else {
          return null;
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
    })
    .filter(post => post !== null);

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

  const timeRangeDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  return {
    profile: {
      name: unipileAccount.profile_name || unipileAccount.account_name,
      id: unipileAccountId
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
      days: timeRangeDays
    },
    dataSource: 'unipile',
    apiLimitation: {
      message: "Showing real-time analytics from Unipile LinkedIn API.",
      availableData: `Displaying ${posts.length} posts with engagement metrics from your LinkedIn feed.`,
      upgradeInfo: "Data is fetched directly from LinkedIn via Unipile."
    }
  };
}

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
    const limit = searchParams.get('limit') || '50';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // STRATEGY: Try Unipile first (most reliable), then fall back to LinkedIn OAuth, then database

    // 1. Try Unipile account first
    const { data: unipileAccount } = await supabase
      .from('linkedin_outreach_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (unipileAccount) {
      console.log('=== Using Unipile for LinkedIn Analytics ===');
      try {
        const analyticsData = await fetchUnipileAnalytics(unipileAccount, startDate, endDate, parseInt(limit));
        return NextResponse.json(analyticsData);
      } catch (unipileError) {
        console.error('Unipile analytics failed, falling back:', unipileError);
        // Continue to fallback options
      }
    }

    // 2. Fall back to LinkedIn OAuth (portability or regular)
    let linkedinAccount = null;
    let accountError = null;

    // Try portability account first
    const { data: portabilityAccount } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin_portability')
      .maybeSingle();

    if (portabilityAccount) {
      linkedinAccount = portabilityAccount;
      console.log('Using LinkedIn Portability account');
    } else {
      // Fall back to regular LinkedIn account
      const { data: regularAccount, error: regError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'linkedin')
        .single();

      linkedinAccount = regularAccount;
      accountError = regError;
      console.log('Using regular LinkedIn account');
    }

    if (accountError || !linkedinAccount) {
      return NextResponse.json({
        error: 'LinkedIn account not connected. Please connect your LinkedIn account via Unipile or OAuth.',
        needsAuth: true,
        hint: 'Go to Settings → Outreach to connect via Unipile (recommended)'
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

    // Fetch real-time data from LinkedIn Member Data Portability API
    let profileData = null;
    let linkedInPosts = [];

    try {
      console.log('=== LinkedIn API Analytics Request ===');
      console.log('Account platform:', linkedinAccount.platform);
      console.log('Token exists:', !!accessToken);
      console.log('Token preview:', accessToken?.substring(0, 20) + '...');

      // Get basic profile information
      console.log('Fetching profile from /v2/me...');
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      console.log('Profile API status:', profileResponse.status);

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        console.log('Profile data received:', profile);
        profileData = {
          id: profile.id,
          name: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim()
        };
      } else {
        const errorText = await profileResponse.text();
        console.error('Profile API error:', profileResponse.status, errorText);
      }

      // Fetch posts using Member Data Portability API
      console.log('Fetching LinkedIn posts via Member Data Portability API...');

      // Try Member Snapshot API for posts
      console.log('Trying memberSnapshot API...');
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

      console.log('Member Snapshot API status:', snapshotResponse.status);

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('Member Snapshot API response:', JSON.stringify(snapshotData, null, 2));

        // Extract posts from snapshot data
        if (snapshotData.POSTS?.elements) {
          linkedInPosts = snapshotData.POSTS.elements;
          console.log(`Found ${linkedInPosts.length} posts in POSTS.elements`);
        } else if (snapshotData.elements) {
          linkedInPosts = snapshotData.elements.filter(item =>
            item.type === 'POST' || item.domain === 'POSTS'
          );
          console.log(`Found ${linkedInPosts.length} posts in elements array`);
        }
      } else {
        const errorText = await snapshotResponse.text();
        console.error(`Member Snapshot API error: ${snapshotResponse.status}`, errorText);
        console.log('Trying ugcPosts API as fallback...');

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

        console.log('UGC Posts API status:', ugcResponse.status);

        if (ugcResponse.ok) {
          const ugcData = await ugcResponse.json();
          linkedInPosts = ugcData.elements || [];
          console.log(`UGC Posts API successful: ${linkedInPosts.length} posts`);
        } else {
          const ugcError = await ugcResponse.text();
          console.error('UGC Posts API error:', ugcResponse.status, ugcError);
        }
      }

      console.log(`Total LinkedIn posts fetched: ${linkedInPosts.length}`);
      console.log('=== End LinkedIn API Request ===');

    } catch (apiError) {
      console.error('LinkedIn API error:', apiError);
      console.error('Error stack:', apiError.stack);
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