import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url)
    console.log("=============== AUTH CALLBACK ===============")
    console.log("Callback URL:", requestUrl.toString())
    console.log("Environment variables:", {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NODE_ENV: process.env.NODE_ENV,
    })
    console.log("Search params:", Object.fromEntries(requestUrl.searchParams.entries()))
    
    // Check if we have a duplicate path like /auth/callback/auth/callback
    if (requestUrl.pathname.includes('/auth/callback/auth/callback')) {
      // Fix the path by removing the duplicate
      const fixedUrl = new URL(requestUrl)
      fixedUrl.pathname = '/auth/callback'
      return NextResponse.redirect(fixedUrl)
    }
    
    const code = requestUrl.searchParams.get('code')
    const ghostwriter = requestUrl.searchParams.get('ghostwriter')
    const next = requestUrl.searchParams.get('next')
    const email = requestUrl.searchParams.get('email')
    const isApproverInvite = !!ghostwriter // If ghostwriter param exists, this is an approver invite
    
    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      // Exchange the code for a session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error("Error exchanging code for session:", exchangeError)
        return NextResponse.redirect(
          new URL(`/?error=auth_error&message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
        )
      }
      
      // Verify we have a session now
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error("Failed to get session after code exchange:", sessionError)
        let redirectPath
        
        if (ghostwriter) {
          // For approver invites, direct them to login with better context
          redirectPath = `/login?error=no_session&next=${encodeURIComponent(`/accept?ghostwriter=${ghostwriter}`)}&fromInvite=true`
        } else if (next) {
          redirectPath = `/login?error=no_session&next=${encodeURIComponent(next)}`
        } else {
          redirectPath = '/login?error=no_session'
        }
        
        // Add email parameter if available
        if (email) {
          redirectPath += `&email=${encodeURIComponent(email)}`
        }
        
        return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
      }
      
      // Determine where to redirect
      let redirectUrl
      
      // Get the site URL from environment or the request
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin
      
      // Remove trailing slash if it exists
      const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
      
      console.log("Site URL for redirect:", normalizedSiteUrl)
      
      if (ghostwriter) {
        // If this is an approver invitation, redirect to the accept page
        const acceptUrl = new URL(`/accept?ghostwriter=${ghostwriter}`, normalizedSiteUrl)
        if (email) {
          acceptUrl.searchParams.set('email', email)
        }
        
        // Always add setPassword=true for ghostwriter invites to ensure they set a password
        acceptUrl.searchParams.set('setPassword', 'true')
        
        // Log for debugging
        console.log("Redirecting approver invite to:", acceptUrl.toString())
        
        redirectUrl = acceptUrl
      } else if (next) {
        // If there's a next parameter, redirect there
        let nextUrlObj;
        try {
          // Check if next is a valid URL
          new URL(next);
          // If it is, it's an absolute URL - check if it's on our domain
          const nextDomain = new URL(next).origin;
          if (nextDomain === normalizedSiteUrl) {
            // It's on our domain, use it as is
            redirectUrl = new URL(next);
          } else {
            // It's an external URL, redirect to home for safety
            console.warn("Attempted external redirect:", next);
            redirectUrl = new URL('/', normalizedSiteUrl);
          }
        } catch (e) {
          // It's not a valid URL, assume it's a path
          redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, normalizedSiteUrl);
        }
        
        // If the next URL is the accept page and we have an email, add it to the query params
        if ((next.includes('/accept') || redirectUrl.pathname.includes('/accept')) && email) {
          redirectUrl.searchParams.set('email', email)
          // Add a flag to indicate this is a new user via magic link who will need to set a password
          redirectUrl.searchParams.set('setPassword', 'true')
        }
      } else {
        // Otherwise, redirect to the dashboard or home page
        redirectUrl = new URL('/', normalizedSiteUrl)
      }
      
      console.log("Redirecting to:", redirectUrl.toString())
      console.log("=============== END AUTH CALLBACK ===============")
      return NextResponse.redirect(redirectUrl)
    }
    
    // Fallback to the home page if no code is present
    return NextResponse.redirect(new URL('/?error=no_code', requestUrl.origin))
  } catch (error) {
    console.error("Error in auth callback:", error)
    return NextResponse.redirect(
      new URL(`/?error=auth_callback_error&message=${encodeURIComponent(error.message || 'Unknown error')}`, 
      new URL(request.url).origin)
    )
  }
} 