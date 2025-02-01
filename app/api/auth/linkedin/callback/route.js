import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const baseURL = new URL(request.url).origin;

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    if (!code) {
      console.error('No code received from LinkedIn');
      return NextResponse.redirect(`${baseURL}/settings?error=no_code`);
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      // Log more details about the error
      console.error('Status:', tokenResponse.status);
      console.error('Response:', tokenData);
      return NextResponse.redirect(`${baseURL}/settings?error=token_exchange_failed&details=${encodeURIComponent(tokenData.error_description || 'Unknown error')}`);
    }

    // Use LinkedIn's OpenID Connect userinfo endpoint with updated version
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'LinkedIn-Version': '202304',  // Updated version
        'X-Restli-Protocol-Version': '2.0.0',
        'Accept': 'application/json',
      }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Profile fetch failed:', errorText);
      console.error('Status:', profileResponse.status);
      return NextResponse.redirect(`${baseURL}/settings?error=profile_fetch_failed&status=${profileResponse.status}`);
    }

    const profileData = await profileResponse.json();
    
    // Store the account info with the profile data
    const { data: accountData, error: accountError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform: 'linkedin',
        platform_user_id: profileData.sub,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        screen_name: profileData.name || 'LinkedIn User',
        expires_in: tokenData.expires_in || null,
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
          : null,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        profile_data: profileData
      });

    if (accountError) {
      console.error('Database error:', accountError);
      return NextResponse.redirect(`${baseURL}/settings?error=database_error`);
    }

    return NextResponse.redirect(`${baseURL}/settings?success=true`);
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=callback_failed`);
  }
} 