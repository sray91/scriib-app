import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const baseURL = new URL(request.url).origin;

    // Check for errors returned from LinkedIn
    if (error) {
      console.error('LinkedIn auth error:', error, errorDescription);
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_auth_error&details=${encodeURIComponent(errorDescription || error)}`);
    }

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('User authentication error:', userError);
      return NextResponse.redirect(`${baseURL}/settings?error=auth_error&details=user_not_authenticated`);
    }

    if (!code) {
      console.error('No code received from LinkedIn');
      return NextResponse.redirect(`${baseURL}/settings?error=no_code`);
    }

    // Log the code (first few characters for debugging)
    console.log('LinkedIn auth code received:', code.substring(0, 10) + '...');

    // Exchange code for token
    console.log('Exchanging code for token...');
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

    console.log('Token received successfully, fetching profile...');
    
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
    console.log('Profile data received:', JSON.stringify(profileData, null, 2).substring(0, 200) + '...');
    
    // Check if this LinkedIn account is already connected to this user
    const { data: existingAccount, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('platform_user_id', profileData.sub)
      .eq('platform', 'linkedin')
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is fine
      console.error('Error checking for existing account:', fetchError);
      return NextResponse.redirect(`${baseURL}/settings?error=database_error&details=${encodeURIComponent(fetchError.message)}`);
    }
    
    let result;
    
    if (existingAccount) {
      // Update the existing account
      console.log('Updating existing LinkedIn account');
      result = await supabase
        .from('social_accounts')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          screen_name: profileData.name || 'LinkedIn User',
          expires_in: tokenData.expires_in || null,
          expires_at: tokenData.expires_in 
            ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
            : null,
          last_used_at: new Date().toISOString(),
          profile_data: profileData
        })
        .eq('id', existingAccount.id);
    } else {
      // Insert a new account
      console.log('Creating new LinkedIn account');
      result = await supabase
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
    }
    
    if (result.error) {
      console.error('Database error:', result.error);
      return NextResponse.redirect(`${baseURL}/settings?error=database_error&details=${encodeURIComponent(result.error.message)}`);
    }

    console.log('LinkedIn account connected successfully');
    return NextResponse.redirect(`${baseURL}/settings?success=true`);
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=callback_failed&details=${encodeURIComponent(error.message)}`);
  }
} 