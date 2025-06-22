import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

// Initialize the Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get request parameters
    const requestBody = await request.json().catch(() => ({}));
    const { 
      urls = [], 
      keywords = '', 
      datePosted = 'past-month',
      count = 50,
      proxyCountry = 'US'
    } = requestBody;

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Apify API token not configured. Please add APIFY_API_TOKEN to your environment variables.' 
      }, { status: 500 });
    }

    // Prepare Actor input for LinkedIn post scraper
    const input = {
      urls: urls.length > 0 ? urls : [
        // Default search URL if no specific URLs provided
        `https://www.linkedin.com/search/results/content/?datePosted=%22${datePosted}%22&keywords=${encodeURIComponent(keywords)}&origin=FACETED_SEARCH`
      ],
      proxy: {
        useApifyProxy: true,
        apifyProxyCountry: proxyCountry
      },
      maxPosts: Math.min(count, 200) // Limit to prevent abuse
    };

    console.log(`🚀 Starting Apify LinkedIn scraper for user ${user.id}`);
    console.log(`📋 Scraping ${input.urls.length} URL(s) with max ${input.maxPosts} posts`);

    // Run the Actor and wait for it to finish
    // Alternative free LinkedIn scrapers you can try:
    // "apify/linkedin-posts-scraper" (if available)
    // "pocesar/linkedin-posts-scraper" (if available)
    const run = await apifyClient.actor("curious_coder/linkedin-post-search-scraper").call(input);

    // Fetch results from the run's dataset
    const { items: scrapedPosts } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!scrapedPosts || scrapedPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts found for the given search criteria',
        data: {
          synced_count: 0,
          total_fetched: 0,
          errors_count: 0,
          posts: []
        }
      });
    }

    console.log(`📊 Received ${scrapedPosts.length} posts from Apify`);
    
    // Debug: Log the structure of the first post to understand the data format
    if (scrapedPosts.length > 0) {
      console.log('🔍 Sample post structure:', JSON.stringify(scrapedPosts[0], null, 2));
      console.log('🔑 Available keys:', Object.keys(scrapedPosts[0]));
    }

    // Filter out comments and non-original posts BEFORE processing
    const originalPostsOnly = scrapedPosts.filter(post => {
      // Skip if this looks like a comment
      if (post.type === 'comment' || post.postType === 'comment') {
        return false;
      }
      
      // Skip if it has a parent post (indicating it's a comment/reply)
      if (post.parentPost || post.parentPostId || post.isComment) {
        return false;
      }
      
      // Skip if the URL contains comment indicators
      if (post.url && (post.url.includes('comment-') || post.url.includes('/comments/'))) {
        return false;
      }
      
      // Skip very short content (likely comments)
      const content = post.text || post.content || post.commentary || '';
      if (content && content.length < 50) {
        return false;
      }
      
      return true;
    });

    console.log(`🔍 Filtered to ${originalPostsOnly.length} original posts (removed ${scrapedPosts.length - originalPostsOnly.length} comments/replies)`);

    // Limit to the requested count
    const limitedPosts = originalPostsOnly.slice(0, count);
    console.log(`📏 Limited to ${limitedPosts.length} posts as requested (count: ${count})`);

    if (limitedPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No original posts found after filtering out comments',
        data: {
          synced_count: 0,
          total_fetched: scrapedPosts.length,
          total_filtered: originalPostsOnly.length,
          total_limited: limitedPosts.length,
          errors_count: 0,
          posts: []
        }
      });
    }

    // Transform and validate posts for our database
    const transformedPosts = [];
    const errors = [];

    for (const post of limitedPosts) {
      try {
        const transformedPost = transformApifyPost(post);
        if (transformedPost) {
          transformedPosts.push(transformedPost);
        }
      } catch (error) {
        console.error('Error transforming post:', error);
        console.error('Post data:', JSON.stringify(post, null, 2));
        errors.push({ post_id: post.id || post.postId || post.activityId || 'unknown', error: error.message });
      }
    }

    // Store posts in database
    const storedPosts = [];
    const dbErrors = [];

    for (const post of transformedPosts) {
      try {
        const { data, error } = await supabase
          .from('past_posts')
          .upsert({
            user_id: user.id,
            platform: 'linkedin',
            ...post,
            raw_data: {
              ...post.raw_data,
              source: 'apify_scraper',
              run_id: run.id,
              processed_at: new Date().toISOString()
            }
          }, {
            onConflict: 'platform_post_id,platform,user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error('Database error for post:', error);
          dbErrors.push({ 
            post_id: post.platform_post_id, 
            error: error.message 
          });
        } else {
          storedPosts.push(data);
        }
      } catch (dbError) {
        console.error('Database operation error:', dbError);
        dbErrors.push({ 
          post_id: post.platform_post_id, 
          error: dbError.message 
        });
      }
    }

    console.log(`✅ Successfully stored ${storedPosts.length}/${transformedPosts.length} posts`);

    return NextResponse.json({
      success: true,
      message: `Successfully scraped and stored ${storedPosts.length} LinkedIn posts`,
      data: {
        synced_count: storedPosts.length,
        total_fetched: scrapedPosts.length,
        total_filtered: originalPostsOnly.length,
        total_limited: limitedPosts.length,
        total_transformed: transformedPosts.length,
        errors_count: errors.length + dbErrors.length,
        apify_run_id: run.id,
        dataset_url: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
        filtering_stats: {
          original_from_apify: scrapedPosts.length,
          after_filtering_comments: originalPostsOnly.length,
          after_count_limit: limitedPosts.length,
          successfully_transformed: transformedPosts.length,
          successfully_stored: storedPosts.length
        },
        posts: storedPosts.map(p => ({
          id: p.id,
          platform_post_id: p.platform_post_id,
          content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
          published_at: p.published_at,
          post_type: p.post_type,
          metrics: p.metrics,
          author: p.raw_data?.author?.name || 'Unknown'
        }))
      },
      errors: [...errors, ...dbErrors].length > 0 ? [...errors, ...dbErrors] : undefined
    });

  } catch (error) {
    console.error('Apify LinkedIn scraper error:', error);
    
    // Handle specific Apify errors
    if (error.type === 'actor-is-not-rented') {
      return NextResponse.json(
        { 
          error: 'LinkedIn Scraper Access Required', 
          details: 'You need to rent the LinkedIn scraper actor on Apify. Visit https://apify.com/curious_coder/linkedin-post-search-scraper to get access.',
          apify_error: error.type,
          statusCode: error.statusCode,
          solution: 'Go to Apify console, find this actor, and click "Try for free" or purchase it.'
        },
        { status: 403 }
      );
    }
    
    if (error.statusCode === 401) {
      return NextResponse.json(
        { 
          error: 'Invalid Apify API Token', 
          details: 'Your APIFY_API_TOKEN is invalid or expired. Please check your environment variables.',
          apify_error: error.type,
          solution: 'Get a new API token from https://console.apify.com/account#/integrations'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to scrape LinkedIn posts', 
        details: error.message,
        apify_error: error.type || 'unknown',
        statusCode: error.statusCode
      },
      { status: 500 }
    );
  }
}

/**
 * Transform Apify scraper result to our database format
 */
function transformApifyPost(apifyPost) {
  if (!apifyPost) {
    throw new Error('Invalid post data from Apify');
  }

  // Additional check to skip comments that might have slipped through
  if (apifyPost.type === 'comment' || apifyPost.postType === 'comment' || apifyPost.isComment) {
    throw new Error('Skipping comment post');
  }

  // Extract post ID with multiple possible field names
  const postId = apifyPost.postId || apifyPost.id || apifyPost.activityId || apifyPost.urn;
  if (!postId) {
    throw new Error('No post ID found in Apify data');
  }

  // Extract content with multiple possible field names
  let content = apifyPost.text || apifyPost.content || apifyPost.commentary || apifyPost.description || '';
  if (!content || content.trim().length < 10) {
    throw new Error('Post content too short or missing');
  }

  // Additional check for comment-like content patterns
  const lowerContent = content.toLowerCase().trim();
  if (lowerContent.startsWith('great post!') || 
      lowerContent.startsWith('thanks for sharing') || 
      lowerContent.startsWith('interesting point') ||
      lowerContent.length < 50) {
    throw new Error('Content appears to be a comment rather than original post');
  }

  // Clean up content
  content = content.trim();
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '...';
  }

  // Extract published date with multiple possible field names
  let publishedAt;
  try {
    const dateField = apifyPost.publishedAt || apifyPost.date || apifyPost.createdAt || apifyPost.timestamp || apifyPost.publishedDate;
    if (dateField) {
      publishedAt = new Date(dateField).toISOString();
    } else {
      publishedAt = new Date().toISOString(); // Fallback to now
    }
  } catch (e) {
    publishedAt = new Date().toISOString();
  }

  // Extract metrics with multiple possible field names
  const metrics = {
    likes: parseInt(apifyPost.likes || apifyPost.likesCount || apifyPost.numLikes) || 0,
    comments: parseInt(apifyPost.comments || apifyPost.commentsCount || apifyPost.numComments) || 0,
    shares: parseInt(apifyPost.shares || apifyPost.sharesCount || apifyPost.reposts || apifyPost.numShares) || 0,
    views: parseInt(apifyPost.views || apifyPost.viewsCount || apifyPost.numViews) || 0
  };

  // Extract media URLs
  let mediaUrls = null;
  if (apifyPost.images && Array.isArray(apifyPost.images) && apifyPost.images.length > 0) {
    mediaUrls = apifyPost.images.filter(url => url && typeof url === 'string');
  } else if (apifyPost.media && Array.isArray(apifyPost.media)) {
    mediaUrls = apifyPost.media.map(m => m.url || m).filter(Boolean);
  }

  // Determine post type
  let postType = 'text';
  if (mediaUrls && mediaUrls.length > 0) {
    if (apifyPost.type === 'video' || mediaUrls.some(url => url.includes('video'))) {
      postType = 'video';
    } else {
      postType = 'image';
    }
  } else if (apifyPost.type === 'article' || content.length > 2000) {
    postType = 'article';
  }

  // Build post URL
  let postUrl = apifyPost.url || apifyPost.postUrl || apifyPost.link;
  if (!postUrl && postId) {
    postUrl = `https://www.linkedin.com/posts/activity-${postId}`;
  }

  return {
    platform_post_id: postId,
    content: content,
    published_at: publishedAt,
    post_url: postUrl,
    media_urls: mediaUrls,
    metrics: metrics,
    post_type: postType,
    visibility: 'PUBLIC', // Default visibility
    raw_data: {
      ...apifyPost,
      scraped_at: new Date().toISOString(),
      author: {
        name: apifyPost.authorName || apifyPost.author?.name || apifyPost.authorFullName || 'Unknown',
        profile_url: apifyPost.authorUrl || apifyPost.author?.url || apifyPost.authorProfileUrl,
        company: apifyPost.authorCompany || apifyPost.author?.company
      }
    }
  };
} 