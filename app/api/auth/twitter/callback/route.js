import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const requestUrl = new URL(request.url);
    
    // Get the code verifier from cookies
    const cookieStore = cookies();
    const codeVerifier = cookieStore.get('code_verifier')?.value;
    if (!codeVerifier) {
      console.error('No code verifier found in cookies');
      return NextResponse.redirect(`${baseURL}/settings?error=no_code_verifier`);
    }
    const code = requestUrl.searchParams.get('code');
    if (!code) {
      console.error('No code received from Twitter');
      return NextResponse.redirect(`${baseURL}/settings?error=no_code`);
    }
    console.log('Using code verifier:', codeVerifier);
    console.log('Received code:', code);
    // Initialize Twitter client
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    });
    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env.TWITTER_REDIRECT_URI,
    });
    console.log('Token exchange successful');
    console.log('Access Token received:', !!accessToken);
    console.log('Refresh Token received:', !!refreshToken);
    // Get authenticated client
    const twitterClient = new TwitterApi(accessToken);
    console.log('Fetching user profile...');
    const { data: profileData } = await twitterClient.v2.me({
      'user.fields': ['id', 'name', 'username', 'profile_image_url', 'description', 'verified'],
    });
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('No authenticated user found');
      return NextResponse.redirect(`${baseURL}/login`);
    }
    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (expiresIn || 7200)); // Default to 2 hours if not provided
    // Check for existing account
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'twitter')
      .eq('platform_user_id', profileData.id)
      .single();
    const accountData = {
      access_token: accessToken,
      refresh_token: refreshToken || null, // Handle null refresh token
      profile_data: profileData,
      screen_name: profileData.username,
      expires_at: expiresAt.toISOString(),
      last_used_at: new Date().toISOString(),
    };
    try {
      if (existingAccount) {
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update(accountData)
          .eq('id', existingAccount.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('social_accounts')
          .insert({
            ...accountData,
            user_id: user.id,
            platform: 'twitter',
            platform_user_id: profileData.id,
          });
        if (insertError) throw insertError;
      }
    } catch (dbError) {
      console.error('Error saving Twitter account:', dbError);
      return NextResponse.redirect(`${baseURL}/settings?error=save_failed&details=${encodeURIComponent(dbError.message)}`);
    }
    // Clean up the code verifier cookie
    const response = NextResponse.redirect(`${baseURL}/settings?success=twitter_connected`);
    response.cookies.delete('code_verifier');
    
    return response;
  } catch (error) {
    console.error('Twitter OAuth error:', error);
    const baseURL = new URL(request.url).origin;
    
    const response = NextResponse.redirect(
      `${baseURL}/settings?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    );
    response.cookies.delete('code_verifier');
    return response;
  }
}