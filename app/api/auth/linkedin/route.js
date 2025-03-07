import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_REDIRECT_URI) {
      console.error('LinkedIn credentials not configured');
      return NextResponse.redirect(`${baseURL}/settings?error=linkedin_not_configured`);
    }

    console.log('LinkedIn auth initialization with state:', state);
    console.log('Using redirect URI:', process.env.LINKEDIN_REDIRECT_URI);

    // Update the scopes for OpenID Connect
    const scopes = [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'r_member_social'
    ].join(' ');

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=select_account&` +
      `state=${state}`;

    console.log('Redirecting to LinkedIn auth URL');
    
    // Redirect to LinkedIn's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('LinkedIn auth initialization error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=auth_init_failed&details=${encodeURIComponent(error.message)}`);
  }
}