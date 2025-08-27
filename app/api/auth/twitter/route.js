import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generatePKCE() {
  // Generate a random verifier
  const verifier = crypto.randomBytes(32).toString('hex');
  
  // Generate challenge from verifier
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return { verifier, challenge };
}
export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    // Initialize Twitter client
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    });
    // Generate PKCE pair
    const { verifier, challenge } = generatePKCE();
    console.log('Generated verifier:', verifier); // Debug log
    console.log('Generated challenge:', challenge); // Debug log
    // Generate OAuth 2.0 authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', process.env.TWITTER_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', process.env.TWITTER_REDIRECT_URI);
    authUrl.searchParams.append('scope', 'tweet.read tweet.write users.read');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', challenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    // Create response with the redirect
    const response = NextResponse.redirect(authUrl.toString());
    // Set the code verifier in a secure cookie
    response.cookies.set('code_verifier', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });
    console.log('Twitter Auth URL:', authUrl.toString()); // Debug log
    return response;
  } catch (error) {
    console.error('Twitter auth initialization error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=auth_init_failed`);
  }
}