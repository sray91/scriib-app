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

    // Transform and prepare posts for database
    const transformedPosts = posts
      .filter(post => post && post.id && post.text) // Filter out invalid posts
      .map((post) => {
        // Extract hashtags and mentions from content
        const content = post.text || '';
        const hashtags = content.match(/#[a-zA-Z0-9_]+/g) || [];
        const mentions = content.match(/@[a-zA-Z0-9_]+/g) || [];
        
        return {
          external_id: post.id,
          content: content,
          author_name: post.author?.name || 'Unknown',
          author_title: post.author?.title || null,
          author_profile_url: post.author?.profileUrl || null,
          author_image_url: post.author?.imageUrl || null,
          post_url: post.postUrl || null,
          published_at: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
          likes_count: parseInt(post.reactions?.likes || 0),
          comments_count: parseInt(post.reactions?.comments || 0),
          shares_count: parseInt(post.reactions?.shares || 0),
          reactions_count: parseInt(post.reactions?.total || 0),
          post_type: post.postType || 'text',
          media_urls: post.mediaUrls || [],
          hashtags: hashtags,
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
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
          date_filter: "past-6h", // Every 6 hours, get last 6 hours of posts
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
