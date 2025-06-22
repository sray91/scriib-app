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
    
    // First, check if we have any imported posts from Apify scraper
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
      
      // Using the Member Data Portability API to get user's posts
      // First, verify the user's profile
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
      
      // Now fetch the user's posts using the Member Data Portability API
      const postsResponse = await fetch(
        `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:${linkedInAccount.platform_user_id}`, {
        headers: {
          'Authorization': `Bearer ${linkedInAccount.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      
      if (!postsResponse.ok) {
        console.error('LinkedIn Posts API error:', postsResponse.status, postsResponse.statusText);
        const errorText = await postsResponse.text();
        console.error('LinkedIn Posts API error details:', errorText);
        
        // Try an alternative endpoint for the Member Data Portability API
        const alternativeResponse = await fetch(
          `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${linkedInAccount.platform_user_id})`, {
          headers: {
            'Authorization': `Bearer ${linkedInAccount.access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          }
        });
        
        if (!alternativeResponse.ok) {
          console.error('LinkedIn Alternative API error:', alternativeResponse.status, alternativeResponse.statusText);
          const altErrorText = await alternativeResponse.text();
          console.error('LinkedIn Alternative API error details:', altErrorText);
          
          return NextResponse.json({ 
            posts: [],
            error: 'LinkedIn API access issue: Unable to fetch your posts. You may need to reconnect your account with additional permissions.',
            profileData: {
              name: profileData.localizedFirstName + ' ' + profileData.localizedLastName,
              id: profileData.id
            }
          });
        }
        
        // Process the alternative response
        const altData = await alternativeResponse.json();
        console.log('LinkedIn posts data (alternative):', JSON.stringify(altData).substring(0, 200) + '...');
        
        // Transform the alternative response into a more usable format
        const altPosts = (altData.elements || []).map(post => {
          try {
            const content = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
            const likes = post.socialDetail?.totalSocialActivityCounts?.numLikes || 0;
            const comments = post.socialDetail?.totalSocialActivityCounts?.numComments || 0;
            const shares = post.socialDetail?.totalSocialActivityCounts?.numShares || 0;
            
            return {
              id: post.id,
              content,
              engagement: { likes, comments, shares },
              timestamp: post.created?.time
            };
          } catch (e) {
            console.error('Error parsing LinkedIn post:', e);
            return null;
          }
        }).filter(Boolean);
        
        return NextResponse.json({ 
          posts: altPosts,
          profileData: {
            name: profileData.localizedFirstName + ' ' + profileData.localizedLastName,
            id: profileData.id
          }
        });
      }
      
      // Process the primary response
      const data = await postsResponse.json();
      console.log('LinkedIn posts data:', JSON.stringify(data).substring(0, 200) + '...');
      
      // Transform the response into a more usable format
      const posts = (data.elements || []).map(post => {
        try {
          // Extract content based on the structure of the response
          let content = '';
          if (post.text) {
            content = post.text;
          } else if (post.content && post.content.description) {
            content = post.content.description;
          }
          
          // Extract engagement metrics if available
          const likes = post.totalSocialActivityCounts?.numLikes || 0;
          const comments = post.totalSocialActivityCounts?.numComments || 0;
          const shares = post.totalSocialActivityCounts?.numShares || 0;
          
          return {
            id: post.id,
            content,
            engagement: { likes, comments, shares },
            timestamp: post.created?.time || post.createdTime
          };
        } catch (e) {
          console.error('Error parsing LinkedIn post:', e);
          return null;
        }
      }).filter(Boolean);
      
      return NextResponse.json({ 
        posts,
        profileData: {
          name: profileData.localizedFirstName + ' ' + profileData.localizedLastName,
          id: profileData.id
        }
      });
      
    } catch (error) {
      console.error('Error fetching LinkedIn data:', error);
      
      // Check if it's a token expiration issue
      const errorMessage = error.message || '';
      const isTokenExpired = 
        errorMessage.includes('token') && 
        (errorMessage.includes('expired') || errorMessage.includes('invalid'));
      
      if (isTokenExpired) {
        // Mark the token as expired in the database
        await supabase
          .from('social_accounts')
          .update({ token_expired: true })
          .eq('user_id', user.id)
          .eq('platform', 'linkedin');
          
        return NextResponse.json({
          posts: [],
          error: 'Your LinkedIn connection has expired. Please reconnect your account.',
          needsReconnect: true
        });
      }
      
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