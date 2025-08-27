import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getLinkedInConfig, LINKEDIN_MODES } from '@/lib/linkedin-config';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const stateParam = searchParams.get('state');
    const baseURL = new URL(request.url).origin;

    // Decode mode from state parameter
    let mode = LINKEDIN_MODES.STANDARD; // Default
    try {
      if (stateParam) {
        const stateData = JSON.parse(decodeURIComponent(stateParam));
        mode = stateData.mode || LINKEDIN_MODES.STANDARD;
      }
    } catch (e) {
      console.log('Could not parse state parameter, using default mode');
    }

    console.log(`LinkedIn callback with mode: ${mode}`);

    // Check for errors returned from LinkedIn
    if (error) {
      console.error('LinkedIn auth error:', error, errorDescription);
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_auth_error&details=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_auth_error&details=No authorization code received`);
    }

    // Get configuration for the mode
    const config = getLinkedInConfig(mode);
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_token_error&details=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
    }

    // Get user profile
    const profileResponse = await fetch(config.apiEndpoint, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error('Profile fetch failed:', profileData);
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_profile_error&details=${encodeURIComponent('Failed to fetch profile')}`);
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.redirect(`${baseURL}/settings?error=auth_error&details=User not authenticated`);
    }

    // Determine platform name based on mode
    const platformName = mode === LINKEDIN_MODES.PORTABILITY ? 'linkedin_portability' : 'linkedin';

    // Save to database
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        platform: platformName,
        platform_user_id: profileData.sub || profileData.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        profile_data: profileData,
        screen_name: profileData.name || profileData.given_name,
        expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        last_used_at: new Date(),
        expires_in: tokenData.expires_in || null,
      }, {
        onConflict: 'platform_user_id,platform'
      });

    if (dbError) {
      console.error('Database save failed:', dbError);
      return NextResponse.redirect(`${baseURL}/settings?error=db_error&details=${encodeURIComponent('Failed to save account')}`);
    }

    // Success redirect
    return NextResponse.redirect(`${baseURL}/settings?success=linkedin_connected&tab=social`);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=linkedin_callback_error&details=${encodeURIComponent(error.message)}`);
  }
} 