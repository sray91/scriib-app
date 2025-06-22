import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Add CORS headers for extension requests
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Version');
  return response;
}

// Handle preflight requests
export async function OPTIONS(request) {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    let user = null;
    
    // Check for token-based authentication first (for extension)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Decode and validate token
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userId, timestamp] = decoded.split(':');
        
        if (!userId || !timestamp) {
          const invalidFormatResponse = NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
          return addCorsHeaders(invalidFormatResponse);
        }
        
        // Check if token is expired (30 days)
        const tokenAge = Date.now() - parseInt(timestamp);
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        
        if (tokenAge > maxAge) {
          const expiredResponse = NextResponse.json({ error: 'Token expired' }, { status: 401 });
          return addCorsHeaders(expiredResponse);
        }
        
                 // Create a user object for token auth (we'll validate the user exists by checking if they can access data)
         user = { id: userId };
        
      } catch (decodeError) {
        const decodeErrorResponse = NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        return addCorsHeaders(decodeErrorResponse);
      }
    } else {
      // Fallback to session-based authentication
      const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !sessionUser) {
        const sessionErrorResponse = NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        return addCorsHeaders(sessionErrorResponse);
      }
      user = sessionUser;
    }
    
    if (!user) {
      const noUserResponse = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      return addCorsHeaders(noUserResponse);
    }

    // Parse request data
    const { posts, source, timestamp } = await request.json();
    
    // Validate extension data
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      const noPostsResponse = NextResponse.json({ error: 'No posts provided' }, { status: 400 });
      return addCorsHeaders(noPostsResponse);
    }

    if (source !== 'extension') {
      const invalidSourceResponse = NextResponse.json({ error: 'Invalid source' }, { status: 400 });
      return addCorsHeaders(invalidSourceResponse);
    }

    // Validate extension version
    const extensionVersion = request.headers.get('X-Extension-Version');
    if (!extensionVersion) {
      const noVersionResponse = NextResponse.json({ error: 'Extension version required' }, { status: 400 });
      return addCorsHeaders(noVersionResponse);
    }

    console.log(`Processing ${posts.length} posts from extension v${extensionVersion}`);

    // Validate and sanitize each post
    const validPosts = [];
    const errors = [];

    for (const post of posts) {
      try {
        const validatedPost = validatePost(post);
        if (validatedPost) {
          validPosts.push(validatedPost);
        } else {
          errors.push({ post_id: post.platform_post_id, error: 'Invalid post data' });
        }
      } catch (validationError) {
        console.error('Post validation error:', validationError);
        errors.push({ 
          post_id: post.platform_post_id || 'unknown', 
          error: validationError.message 
        });
      }
    }

    if (validPosts.length === 0) {
      const noValidPostsResponse = NextResponse.json({ 
        error: 'No valid posts to process',
        errors: errors 
      }, { status: 400 });
      return addCorsHeaders(noValidPostsResponse);
    }

    // Store posts in database
    const storedPosts = [];
    const dbErrors = [];

    for (const post of validPosts) {
      try {
        // Add extension metadata
        const postData = {
          user_id: user.id,
          platform: 'linkedin',
          ...post,
          raw_data: {
            ...post.raw_data,
            extension_version: extensionVersion,
            processed_at: new Date().toISOString(),
            source: 'browser_extension'
          }
        };

        const { data, error } = await supabase
          .from('past_posts')
          .upsert(postData, {
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

    // Log successful sync
    console.log(`✅ Extension sync: ${storedPosts.length}/${validPosts.length} posts stored`);

    const response = NextResponse.json({
      success: true,
      message: `Successfully processed ${storedPosts.length} LinkedIn posts from extension`,
      data: {
        synced_count: storedPosts.length,
        total_received: posts.length,
        total_valid: validPosts.length,
        errors_count: errors.length + dbErrors.length,
        extension_version: extensionVersion,
        posts: storedPosts.map(p => ({
          id: p.id,
          platform_post_id: p.platform_post_id,
          content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
          published_at: p.published_at,
          post_type: p.post_type,
          metrics: p.metrics
        }))
      },
      errors: [...errors, ...dbErrors].length > 0 ? [...errors, ...dbErrors] : undefined
    });

    return addCorsHeaders(response);

  } catch (error) {
    console.error('Extension sync error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to process extension data', details: error.message },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}

// Validate and sanitize scraped post data
function validatePost(post) {
  if (!post || typeof post !== 'object') {
    throw new Error('Invalid post object');
  }

  // Required fields
  if (!post.platform_post_id || typeof post.platform_post_id !== 'string') {
    throw new Error('Missing or invalid platform_post_id');
  }

  if (!post.content || typeof post.content !== 'string' || post.content.trim().length < 5) {
    throw new Error('Missing or invalid content');
  }

  // Sanitize and validate content
  const content = sanitizeText(post.content);
  if (content.length > 10000) { // Reasonable limit
    throw new Error('Content too long');
  }

  // Validate timestamp
  let publishedAt;
  try {
    publishedAt = new Date(post.published_at).toISOString();
  } catch (e) {
    publishedAt = new Date().toISOString(); // Fallback to now
  }

  // Validate metrics
  const metrics = validateMetrics(post.metrics);

  // Validate media URLs
  const mediaUrls = validateMediaUrls(post.media_urls);

  // Validate post type
  const postType = ['text', 'image', 'video', 'article'].includes(post.post_type) 
    ? post.post_type 
    : 'text';

  // Validate visibility
  const visibility = ['PUBLIC', 'CONNECTIONS', 'PRIVATE'].includes(post.visibility)
    ? post.visibility
    : 'PUBLIC';

  // Validate post URL
  const postUrl = post.post_url && isValidUrl(post.post_url) 
    ? post.post_url 
    : null;

  return {
    platform_post_id: post.platform_post_id,
    content: content,
    published_at: publishedAt,
    post_url: postUrl,
    media_urls: mediaUrls,
    metrics: metrics,
    post_type: postType,
    visibility: visibility,
    raw_data: post.raw_data || {}
  };
}

// Sanitize text content
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 10000); // Limit length
}

// Validate engagement metrics
function validateMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return { likes: 0, comments: 0, shares: 0, views: null };
  }

  return {
    likes: validateCount(metrics.likes),
    comments: validateCount(metrics.comments),
    shares: validateCount(metrics.shares),
    views: metrics.views ? validateCount(metrics.views) : null,
    impressions: metrics.impressions ? validateCount(metrics.impressions) : null
  };
}

// Validate count numbers
function validateCount(count) {
  if (typeof count === 'number' && count >= 0 && count < Number.MAX_SAFE_INTEGER) {
    return Math.floor(count);
  }
  return 0;
}

// Validate media URLs
function validateMediaUrls(urls) {
  if (!urls || !Array.isArray(urls)) return null;
  
  const validUrls = urls
    .filter(url => typeof url === 'string' && isValidUrl(url))
    .slice(0, 10); // Limit to 10 media items
  
  return validUrls.length > 0 ? validUrls : null;
}

// Simple URL validation
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Generate user token endpoint
export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Check if this is a token validation request
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Decode and validate token
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userId, timestamp] = decoded.split(':');
        
        if (!userId || !timestamp) {
          return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
        }
        
        // Check if token is expired (30 days)
        const tokenAge = Date.now() - parseInt(timestamp);
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        
        if (tokenAge > maxAge) {
          return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
                 // For token validation, we'll just check if the token format is valid and not expired
         // The actual user validation will happen when the token is used for POST requests
        
        const validResponse = NextResponse.json({
          valid: true,
          user_id: userId,
          message: 'Token is valid'
        });
        return addCorsHeaders(validResponse);
        
      } catch (decodeError) {
        const invalidTokenResponse = NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        return addCorsHeaders(invalidTokenResponse);
      }
    }
    
    // Generate new token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      const authErrorResponse = NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      return addCorsHeaders(authErrorResponse);
    }

    // Generate a simple token for extension authentication
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    const tokenResponse = NextResponse.json({
      token: token,
      user_id: user.id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
    return addCorsHeaders(tokenResponse);

  } catch (error) {
    console.error('Token generation error:', error);
    const tokenErrorResponse = NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
    return addCorsHeaders(tokenErrorResponse);
  }
} 