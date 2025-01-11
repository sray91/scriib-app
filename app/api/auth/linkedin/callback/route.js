import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Get the base URL from the request
    const baseURL = new URL(request.url).origin;
    
    // Get the code and state from the callback URL
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    
    if (!code) {
      console.error('No code received from LinkedIn');
      return NextResponse.redirect(`${baseURL}/settings?error=no_code`);
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for token');
      return NextResponse.redirect(`${baseURL}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user's LinkedIn profile data
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Failed to fetch LinkedIn profile');
      return NextResponse.redirect(`${baseURL}/settings?error=profile_fetch_failed`);
    }

    const profileData = await profileResponse.json();

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('No authenticated user found');
      return NextResponse.redirect(`${baseURL}/login`);
    }

    // Calculate token expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Check if this LinkedIn account is already connected
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .eq('platform_user_id', profileData.id)
      .single();

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from('social_accounts')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          profile_data: profileData,
          screen_name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
          expires_at: expiresAt.toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating LinkedIn account:', updateError);
        return NextResponse.redirect(`${baseURL}/settings?error=update_failed`);
      }
    } else {
      // Insert new account
      const { error: insertError } = await supabase
        .from('social_accounts')
        .insert({
          user_id: user.id,
          platform: 'linkedin',
          platform_user_id: profileData.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          profile_data: profileData,
          screen_name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
          expires_at: expiresAt.toISOString(),
          last_used_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error saving LinkedIn account:', insertError);
        return NextResponse.redirect(`${baseURL}/settings?error=save_failed`);
      }
    }

    return NextResponse.redirect(`${baseURL}/settings?success=linkedin_connected`);
  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.redirect(`${baseURL}/settings?error=oauth_failed`);
  }
} 