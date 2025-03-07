import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // First, check if we have any imported posts from the Chrome extension
    const { data: importedPosts, error: importError } = await supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('likes', { ascending: false })
      .limit(10);
    
    if (!importError && importedPosts && importedPosts.length > 0) {
      // We have imported posts, return them
      return NextResponse.json({
        posts: importedPosts.map(post => ({
          id: post.id,
          content: post.content,
          engagement: {
            likes: post.likes || 0,
            comments: post.comments || 0,
            shares: post.shares || 0
          },
          timestamp: post.timestamp,
          source: post.source || 'imported'
        }))
      });
    }
    
    // Fetch user's LinkedIn account
    const { data: linkedInAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single();
    
    if (accountError && accountError.code !== 'PGRST116') {
      console.error('Error fetching LinkedIn account:', accountError);
      return NextResponse.json(
        { error: 'Failed to fetch LinkedIn account', posts: [] },
        { status: 500 }
      );
    }
    
    // If no LinkedIn account is connected
    if (!linkedInAccount || !linkedInAccount.access_token) {
      console.log('No LinkedIn account connected');
      return NextResponse.json({ 
        posts: [],
        error: 'No LinkedIn account connected'
      });
    }
    
    try {
      console.log('Attempting to fetch LinkedIn posts with token:', linkedInAccount.access_token.substring(0, 10) + '...');
      console.log('User ID:', linkedInAccount.platform_user_id);
      
      // Try to get the user's profile first to confirm the token works
      const profileResponse = await fetch(
        `https://api.linkedin.com/v2/me`, {
        headers: {
          'Authorization': `Bearer ${linkedInAccount.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      
      if (!profileResponse.ok) {
        console.error('LinkedIn Profile API error:', profileResponse.status, profileResponse.statusText);
        const errorText = await profileResponse.text();
        console.error('LinkedIn Profile API error details:', errorText);
        
        return NextResponse.json({ 
          posts: [],
          error: 'LinkedIn API access issue: Unable to verify your LinkedIn profile. Your token may have expired.'
        });
      }
      
      const profileData = await profileResponse.json();
      console.log('LinkedIn profile verified:', profileData.id);
      
      // Unfortunately, LinkedIn has restricted access to user posts for most third-party apps
      // We'll be transparent about this limitation
      
      return NextResponse.json({ 
        posts: [],
        error: 'LinkedIn API restrictions: LinkedIn no longer allows most third-party apps to access user posts. This is a LinkedIn platform limitation, not an issue with our app.',
        profileData: {
          name: profileData.localizedFirstName + ' ' + profileData.localizedLastName,
          id: profileData.id
        }
      });
      
    } catch (error) {
      console.error('Error fetching LinkedIn data:', error);
      
      return NextResponse.json({
        posts: [],
        error: 'Failed to fetch LinkedIn data: ' + error.message
      });
    }
    
  } catch (error) {
    console.error('Error in user-posts API:', error);
    return NextResponse.json(
      { error: 'Internal server error', posts: [] },
      { status: 500 }
    );
  }
} 