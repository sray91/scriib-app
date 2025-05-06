import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const env = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.NEXT_SUPABASE_SERVICE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
           process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 8) + '...' : 'not set'
    };

    return NextResponse.json({ status: 'ok', env });
  } catch (error) {
    console.error('Environment check error:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking environment variables' },
      { status: 500 }
    );
  }
} 