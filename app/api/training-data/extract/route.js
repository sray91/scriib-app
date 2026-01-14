import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { requireAuth } from '@/lib/api-auth';

// Initialize the Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Get request parameters
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'LinkedIn post URL is required' }, { status: 400 });
    }

    // Validate LinkedIn URL
    const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
    if (!linkedinPattern.test(url)) {
      return NextResponse.json({ 
        error: 'Invalid LinkedIn post URL. Please provide a valid LinkedIn post URL.' 
      }, { status: 400 });
    }

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Apify API token not configured. Please add APIFY_API_TOKEN to your environment variables.' 
      }, { status: 500 });
    }

    // Check if this URL already exists in trending_posts
    const { data: existingPost } = await supabase
      .from('trending_posts')
      .select('id')
      .eq('post_url', url)
      .single();

    if (existingPost) {
      return NextResponse.json({ 
        error: 'This LinkedIn post URL has already been added to your training data.' 
      }, { status: 409 });
    }

    console.log(`🚀 Starting Apify LinkedIn scraper for single post: ${url}`);

    // Prepare Actor input for specific post URL
    const input = {
      urls: [url],
      proxy: {
        useApifyProxy: true,
        apifyProxyCountry: 'US'
      },
      maxPosts: 1
    };

    // Run the Actor and wait for it to finish
    const run = await apifyClient.actor("curious_coder/linkedin-post-search-scraper").call(input);

    // Fetch results from the run's dataset
    const { items: scrapedPosts } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!scrapedPosts || scrapedPosts.length === 0) {
      return NextResponse.json({
        error: 'No post data could be extracted from this URL. The post may be private or the URL may be invalid.'
      }, { status: 404 });
    }

    console.log(`📊 Received ${scrapedPosts.length} posts from Apify`);

    // Get the first (and should be only) post
    const apifyPost = scrapedPosts[0];
    console.log('🔍 Post data structure:', JSON.stringify(apifyPost, null, 2));

    // Transform the Apify post to our trending_posts format
    const trendingPost = transformToTrendingPost(apifyPost, url);

    // Store in trending_posts table
    const { data: storedPost, error: dbError } = await supabase
      .from('trending_posts')
      .insert(trendingPost)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        error: 'Failed to save post to database',
        details: dbError.message 
      }, { status: 500 });
    }

    console.log(`✅ Successfully stored trending post: ${storedPost.id}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully extracted and added LinkedIn post to training data',
      data: {
        id: storedPost.id,
        content: storedPost.content.substring(0, 150) + (storedPost.content.length > 150 ? '...' : ''),
        author_name: storedPost.author_name,
        likes: storedPost.likes,
        comments: storedPost.comments,
        shares: storedPost.shares,
        engagement_rate: storedPost.engagement_rate,
        post_url: storedPost.post_url,
        apify_run_id: run.id,
        dataset_url: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`
      }
    });

  } catch (error) {
    console.error('Training data extraction error:', error);
    
    // Handle specific Apify errors
    if (error.type === 'actor-is-not-rented') {
      return NextResponse.json(
        { 
          error: 'LinkedIn Scraper Access Required', 
          details: 'You need to rent the LinkedIn scraper actor on Apify. Visit https://apify.com/curious_coder/linkedin-post-search-scraper to get access.',
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
          solution: 'Get a new API token from https://console.apify.com/account#/integrations'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to extract LinkedIn post data', 
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Transform Apify post data to trending_posts table format
 */
function transformToTrendingPost(apifyPost, originalUrl) {
  if (!apifyPost) {
    throw new Error('Invalid post data from Apify');
  }

  // Extract content with multiple possible field names
  let content = apifyPost.text || apifyPost.content || apifyPost.commentary || apifyPost.description || '';
  if (!content || content.trim().length < 10) {
    throw new Error('Post content too short or missing');
  }

  // Clean up content
  content = content.trim();
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '...';
  }

  // Extract metrics with multiple possible field names
  const likes = parseInt(apifyPost.likes || apifyPost.likesCount || apifyPost.numLikes) || 0;
  const comments = parseInt(apifyPost.comments || apifyPost.commentsCount || apifyPost.numComments) || 0;
  const shares = parseInt(apifyPost.shares || apifyPost.sharesCount || apifyPost.reposts || apifyPost.numShares) || 0;
  const views = parseInt(apifyPost.views || apifyPost.viewsCount || apifyPost.numViews) || 0;

  // Calculate engagement rate if we have views, otherwise estimate
  let engagementRate = 0;
  if (views > 0) {
    engagementRate = ((likes + comments + shares) / views * 100).toFixed(2);
  } else if (likes > 0 || comments > 0 || shares > 0) {
    // Estimate based on typical LinkedIn engagement rates (2-3%)
    const estimatedViews = (likes + comments + shares) / 0.025; // Assume 2.5% engagement
    engagementRate = ((likes + comments + shares) / estimatedViews * 100).toFixed(2);
  }

  // Determine post type
  let postType = 'text';
  if (apifyPost.images && Array.isArray(apifyPost.images) && apifyPost.images.length > 0) {
    postType = 'image';
  } else if (apifyPost.type === 'video' || (apifyPost.media && apifyPost.media.some(m => m.type === 'video'))) {
    postType = 'video';
  } else if (apifyPost.type === 'article' || content.length > 2000) {
    postType = 'article';
  }

  // Extract author information
  const authorName = apifyPost.authorName || apifyPost.author?.name || apifyPost.authorFullName || 'Unknown Author';
  const authorTitle = apifyPost.authorHeadline || apifyPost.author?.headline || apifyPost.authorTitle || null;

  // Determine industry tags based on content
  const industryTags = extractIndustryTags(content);

  // Use the original URL provided by user, fallback to Apify URL
  const postUrl = originalUrl || apifyPost.url || apifyPost.postUrl || apifyPost.link;

  return {
    content: content,
    likes: likes,
    comments: comments,
    shares: shares,
    views: views,
    platform: 'linkedin',
    author_name: authorName,
    author_title: authorTitle,
    post_url: postUrl,
    post_type: postType,
    industry_tags: industryTags,
    engagement_rate: parseFloat(engagementRate),
    source: 'apify_extraction',
    raw_data: {
      ...apifyPost,
      extracted_at: new Date().toISOString(),
      original_url: originalUrl
    },
    is_active: true
  };
}

/**
 * Extract industry tags from post content
 */
function extractIndustryTags(content) {
  const tags = [];
  const lowerContent = content.toLowerCase();

  // Define industry keywords
  const industryKeywords = {
    'technology': ['tech', 'software', 'ai', 'artificial intelligence', 'machine learning', 'coding', 'programming', 'startup', 'saas'],
    'marketing': ['marketing', 'brand', 'advertising', 'social media', 'content marketing', 'seo', 'digital marketing'],
    'leadership': ['leadership', 'management', 'ceo', 'executive', 'team', 'mentor', 'culture'],
    'sales': ['sales', 'revenue', 'client', 'customer', 'prospect', 'deal', 'business development'],
    'career': ['career', 'job', 'hiring', 'interview', 'resume', 'professional development', 'networking'],
    'finance': ['finance', 'investment', 'funding', 'financial', 'money', 'budget', 'economy'],
    'entrepreneurship': ['entrepreneur', 'business', 'startup', 'founder', 'innovation', 'venture'],
    'productivity': ['productivity', 'efficiency', 'time management', 'workflow', 'organization'],
    'hr': ['hr', 'human resources', 'talent', 'recruitment', 'employee', 'workplace'],
    'consulting': ['consulting', 'advisory', 'strategy', 'transformation', 'solutions']
  };

  // Check for keywords in content
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      tags.push(industry);
    }
  }

  // Limit to 5 tags maximum
  return tags.slice(0, 5);
} 