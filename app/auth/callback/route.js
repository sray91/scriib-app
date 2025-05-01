import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const ghostwriter = requestUrl.searchParams.get('ghostwriter')
  
  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code)
    
    // Redirect to the appropriate page
    if (ghostwriter) {
      // If this is an approver invitation, redirect to the accept page
      return NextResponse.redirect(new URL(`/accept?ghostwriter=${ghostwriter}`, requestUrl.origin))
    } else {
      // Otherwise, redirect to the dashboard or home page
      return NextResponse.redirect(new URL('/', requestUrl.origin))
    }
  }
  
  // Fallback to the home page if no code is present
  return NextResponse.redirect(new URL('/', requestUrl.origin))
} 