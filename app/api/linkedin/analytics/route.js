import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    let analyticsData = {};

    try {
      // Note: LinkedIn's official API has limited analytics access
      // For personal profiles, we can only get basic profile info
      // Company page analytics require special permissions
      
      // Get basic profile information
      const profileResponse = await fetch('https://api.linkedin.com/v2/people/~:(id,firstName,lastName)', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'cache-control': 'no-cache',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      if (!profileResponse.ok) {
        throw new Error(`LinkedIn API error: ${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();
      
      // Since personal profile analytics aren't available through LinkedIn API,
      // we'll return mock data with a note about limitations
      analyticsData = {
        profile: {
          id: profileData.id,
          name: `${profileData.firstName?.localized?.en_US || ''} ${profileData.lastName?.localized?.en_US || ''}`.trim(),
        },
        metrics: {
          // Note: These would be real metrics if we had access to LinkedIn's analytics API
          // For now, we return structured mock data that matches the expected format
          totalViews: 64100,
          totalImpressions: 68300,
          totalReactions: 1024,
          totalComments: 145,
          totalShares: 89,
          averageEngagement: 2.1,
          profileViews: 1250,
          searchAppearances: 89
        },
        posts: [
          {
            id: 'post_1',
            content: 'Real LinkedIn post content would be here',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            metrics: {
              views: 12400,
              impressions: 13200,
              reactions: 156,
              comments: 23,
              shares: 12,
              engagement: 1.4
            }
          },
          {
            id: 'post_2', 
            content: 'Another real LinkedIn post would be here',
            publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            metrics: {
              views: 8900,
              impressions: 9500,
              reactions: 89,
              comments: 15,
              shares: 8,
              engagement: 1.2
            }
          }
        ],
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: parseInt(timeRange)
        },
        apiLimitation: {
          message: "LinkedIn's API has limited analytics access for personal profiles. Company page analytics require special permissions and approval from LinkedIn.",
          availableData: "Basic profile information and mock analytics data for demonstration purposes.",
          upgradeInfo: "To get real analytics data, you would need LinkedIn Marketing API access or Company Page Admin permissions."
        }
      };

      // Update last used timestamp
      await supabase
        .from('social_accounts')
        .update({ last_used_at: new Date() })
        .eq('id', linkedinAccount.id);

    } catch (apiError) {
      console.error('LinkedIn API error:', apiError);
      
      // Return mock data with error information
      analyticsData = {
        error: 'LinkedIn API access limited',
        message: apiError.message,
        mockData: true,
        metrics: {
          totalViews: 64100,
          totalImpressions: 68300,
          totalReactions: 1024,
          totalComments: 145,
          totalShares: 89,
          averageEngagement: 2.1,
          profileViews: 1250,
          searchAppearances: 89
        },
        posts: [
          {
            id: 'mock_post_1',
            content: 'This is mock data - LinkedIn API access is limited for personal profiles',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            metrics: {
              views: 12400,
              impressions: 13200,
              reactions: 156,
              comments: 23,
              shares: 12,
              engagement: 1.4
            }
          }
        ],
        apiLimitation: "LinkedIn's personal profile analytics are not publicly available through their API. Real analytics would require LinkedIn Marketing API access or Company Page permissions."
      };
    }

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('LinkedIn analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn analytics', details: error.message },
      { status: 500 }
    );
  }
} 