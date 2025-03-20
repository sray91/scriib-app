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
    
    // Fetch user's LinkedIn account
    const { data: linkedInAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single();
    
    if (accountError || !linkedInAccount || !linkedInAccount.access_token) {
      return NextResponse.json(
        { error: 'No LinkedIn account connected or token expired' },
        { status: 400 }
      );
    }
    
    // Test various LinkedIn API endpoints
    const endpoints = [
      {
        name: 'Profile',
        url: 'https://api.linkedin.com/v2/me',
        description: 'Basic profile information'
      },
      {
        name: 'Email',
        url: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
        description: 'User email address'
      },
      {
        name: 'Shares',
        url: `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:${linkedInAccount.platform_user_id}`,
        description: 'User shared posts'
      },
      {
        name: 'UGC Posts',
        url: `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${linkedInAccount.platform_user_id})`,
        description: 'User created posts'
      },
      {
        name: 'Activities',
        url: `https://api.linkedin.com/v2/activities?q=actor&actor=urn:li:person:${linkedInAccount.platform_user_id}`,
        description: 'User activities'
      }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'Authorization': `Bearer ${linkedInAccount.access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          }
        });
        
        const status = response.status;
        let data = null;
        let error = null;
        
        try {
          if (response.ok) {
            data = await response.json();
          } else {
            error = await response.text();
          }
        } catch (e) {
          error = e.message;
        }
        
        results.push({
          ...endpoint,
          status,
          success: response.ok,
          data: data ? JSON.stringify(data).substring(0, 200) + '...' : null,
          error
        });
      } catch (error) {
        results.push({
          ...endpoint,
          status: 0,
          success: false,
          data: null,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      results,
      userId: linkedInAccount.platform_user_id,
      tokenPreview: linkedInAccount.access_token.substring(0, 10) + '...'
    });
    
  } catch (error) {
    console.error('Error in LinkedIn test API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 