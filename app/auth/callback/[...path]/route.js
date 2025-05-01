import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  console.log("Catch-all callback route accessed with path:", params.path)
  
  // Extract the code and ghostwriter from the URL
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const ghostwriter = url.searchParams.get('ghostwriter')
  
  // Create a clean URL with the correct path
  const fixedUrl = new URL('/auth/callback', url.origin)
  
  // Add back any query parameters
  if (code) fixedUrl.searchParams.set('code', code)
  if (ghostwriter) fixedUrl.searchParams.set('ghostwriter', ghostwriter)
  
  console.log("Redirecting to fixed URL:", fixedUrl.toString())
  
  // Redirect to the correct route
  return NextResponse.redirect(fixedUrl)
} 