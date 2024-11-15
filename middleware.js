import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Check auth condition
  if (session) {
    // If the user is logged in and tries to access login/signup pages, redirect to home
    if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/signup')) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  } else {
    // If the user is not logged in and tries to access protected routes, redirect to login
    if (
      req.nextUrl.pathname !== '/login' &&
      req.nextUrl.pathname !== '/signup' &&
      !req.nextUrl.pathname.startsWith('/_next') &&
      !req.nextUrl.pathname.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}