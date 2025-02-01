import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    // Update the scopes for OpenID Connect
    const scopes = [
      'openid',
      'profile',
      'email',
      'w_member_social'
    ].join(' ');

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=select_account&` +
      `state=${state}`;

    // Redirect to LinkedIn's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('LinkedIn auth initialization error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=auth_init_failed`);
  }
}