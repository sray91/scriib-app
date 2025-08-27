import { NextResponse } from 'next/server';
import { ApifyService } from '@/lib/services/apifyService';
import { getSupabase } from '@/lib/supabase';

export async function POST(request) {
  const supabase = getSupabase();
  
  try {
    // Check if APIFY_API_TOKEN is configured
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'APIFY_API_TOKEN environment variable is not configured' },
        { status: 500 }
      );
    }

    const apifyService = new ApifyService(process.env.APIFY_API_TOKEN);
    
    // Get input from request body or use defaults
    const body = await request.json().catch(() => ({}));
    const input = body.input || apifyService.getDefaultInput();
    
    console.log('Starting LinkedIn scraping with input:', input);

    // Fetch posts from Apify
    const posts = await apifyService.fetchLinkedInPosts(input);
    
    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts found',
        processed: 0
      });
    }

    console.log(`Processing ${posts.length} posts from Apify...`);

    // Debug: Log the structure of the first few posts
    if (posts.length > 0) {
      console.log('Sample post structure:', JSON.stringify(posts[0], null, 2));
      console.log('Available keys in first post:', Object.keys(posts[0]));
    }

    // Transform and prepare posts for database
    const transformedPosts = posts
      .filter(post => {
        const hasId = post && (post.id || post.postId || post.linkedinPostId || post.activity_id);
        const hasContent = post && (post.text || post.description);
        const isValid = hasId && hasContent;
        
        if (!isValid && post) {
          console.log('Filtered out post - hasId:', !!hasId, 'hasContent:', !!hasContent, 'keys:', Object.keys(post));
        }
        return isValid;
      })
      .map((post) => {
        // Handle different possible field names for content - ensure it's a string
        const content = post.text || post.description || '';
        const hashtags = typeof content === 'string' ? (content.match(/#[a-zA-Z0-9_]+/g) || []) : [];
        const mentions = typeof content === 'string' ? (content.match(/@[a-zA-Z0-9_]+/g) || []) : [];
        
        // Handle different possible field names for ID
        const postId = post.activity_id || post.id || post.postId || post.linkedinPostId || `apify_${Date.now()}_${Math.random()}`;
        
        // Handle different possible author structures
        const author = post.author || post.profile || post.user || {};
        
        // Handle different possible reaction structures  
        const stats = post.stats || post.reactions || post.engagement || {};
        
        // Extract likes from reactions array or direct count
        let likesCount = 0;
        if (stats.reactions && Array.isArray(stats.reactions)) {
          const likeReaction = stats.reactions.find(r => r.type === 'LIKE');
          likesCount = likeReaction ? likeReaction.count : 0;
        } else {
          likesCount = stats.likes || stats.likeCount || 0;
        }
        
        return {
          external_id: postId,
          content: content,
          author_name: author.name || author.fullName || author.title || 'Unknown',
          author_title: author.headline || author.title || author.position || null,
          author_profile_url: author.profile_url || author.profileUrl || author.url || author.link || null,
          author_image_url: author.image_url || author.imageUrl || author.profilePicture || author.avatar || null,
          post_url: post.post_url || post.postUrl || post.url || post.link || null,
          published_at: post.posted_at?.date || post.publishedAt || post.createdAt || post.date ? 
            new Date(post.posted_at?.date || post.publishedAt || post.createdAt || post.date).toISOString() : null,
          likes_count: parseInt(likesCount),
          comments_count: parseInt(stats.comments || stats.commentCount || 0),
          shares_count: parseInt(stats.shares || stats.shareCount || stats.reposts || 0),
          reactions_count: parseInt(stats.total_reactions || stats.total || stats.totalEngagement || 
            likesCount + (stats.comments || 0) + (stats.shares || 0)),
          post_type: post.content?.type || post.postType || post.type || 'text',
          media_urls: post.mediaUrls || post.media || post.images || [],
          hashtags: post.hashtags || hashtags,
          mentions: mentions,
          keywords: input.keyword ? input.keyword.split(',').map(k => k.trim()) : []
        };
      });

    console.log(`Transformed ${transformedPosts.length} valid posts`);

    // Insert posts into database using upsert to handle duplicates
    const { data, error } = await supabase
      .from('viral_posts')
      .upsert(transformedPosts, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select('id');

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Successfully upserted ${data?.length || 0} posts`);

    // Update viral scores for newly inserted posts
    try {
      const { error: functionError } = await supabase.rpc('update_all_viral_scores');
      if (functionError) {
        console.warn('Warning: Could not update viral scores:', functionError);
      }
    } catch (scoreError) {
      console.warn('Warning: Viral score calculation failed:', scoreError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully scraped and stored ${transformedPosts.length} posts`,
      processed: transformedPosts.length,
      upserted: data?.length || 0
    });

  } catch (error) {
    console.error('Error in scrape API:', error);
    
    // Provide specific error message for Apify issues
    let errorMessage = error.message || 'Unknown error occurred';
    let helpMessage = '';
    
    if (error.type === 'invalid-input' && error.statusCode === 400) {
      errorMessage = 'LinkedIn scraper input validation error';
      helpMessage = 'Please check the input parameters. The apimaestro/linkedin-posts-search-scraper-no-cookies actor may have specific requirements for keywords, date filters, or post counts.';
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        help: helpMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        apify_error: error.type || undefined,
        statusCode: error.statusCode || undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check scraping status or trigger with query params
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const trigger = searchParams.get('trigger');
  
  if (trigger === 'true') {
    // This is likely a cron job trigger, use default input
    return POST(new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({
        input: {
          keyword: "AI, machine learning, data science, generative AI, startup, product management, leadership, technology",
          sort_type: "date_posted",
          date_filter: "past-6h",
          total_posts: 300
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    }));
  }
  
  // Return status information
  const supabase = getSupabase();
  
  try {
    const { data: recentPosts, error } = await supabase
      .from('viral_posts')
      .select('id, scraped_at, viral_score')
      .order('scraped_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    const { count } = await supabase
      .from('viral_posts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      totalPosts: count,
      recentScrapingActivity: recentPosts,
      lastScraped: recentPosts?.[0]?.scraped_at || null
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
