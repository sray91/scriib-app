import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    // Construct LinkedIn OAuth URL
    const linkedInAuthUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    const params = {
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      state: state,
      scope: 'r_liteprofile w_member_social',
    };

    // Add all parameters to the URL
    Object.entries(params).forEach(([key, value]) => {
      linkedInAuthUrl.searchParams.append(key, value);
    });

    // Redirect to LinkedIn's authorization page
    return NextResponse.redirect(linkedInAuthUrl.toString());
  } catch (error) {
    console.error('LinkedIn auth initialization error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=auth_init_failed`);
  }
} 