'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Info } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [isApproverInvite, setIsApproverInvite] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/'
  const errorMessage = searchParams.get('error')
  const message = searchParams.get('message')
  const inviteEmail = searchParams.get('email') || ''
  const fromApproverInvite = nextUrl.includes('/accept') || searchParams.get('fromInvite') === 'true'
  
  useEffect(() => {
    // If there's an email from the invite, use it
    if (inviteEmail) {
      setEmail(inviteEmail)
    }
    
    // Check if user is coming from an approver invite flow
    if (fromApproverInvite) {
      setIsApproverInvite(true)
    }
    
    // If there's an error message in the URL, display it
    if (errorMessage) {
      if (errorMessage === 'no_session') {
        setError('You need to log in to continue. Please sign in or create an account.')
      } else {
        setError(`Authentication error: ${errorMessage}`)
      }
    } else if (message) {
      setError(message)
    }
  }, [errorMessage, message, inviteEmail, fromApproverInvite])

  const supabase = createClientComponentClient()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      // Redirect to the next URL or home page
      router.push(nextUrl)
      router.refresh()
    } catch (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async (e) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    setSendingMagicLink(true)
    setError(null)
    
    try {
      // Get site URL from env or fallback to window location
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      
      // If this is an approver invite, add the setPassword flag to help with passwordless flow
      let redirectTo
      
      if (nextUrl.includes('/accept')) {
        // For accept URLs, we need to preserve the ghostwriter parameter and add setPassword
        const acceptUrl = new URL(nextUrl, siteUrl)
        acceptUrl.searchParams.set('setPassword', 'true')
        redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(acceptUrl.pathname + acceptUrl.search)}`
      } else {
        // For regular URLs, just encode the nextUrl
        redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`
      }
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      })
      
      if (error) throw error
      
      setMagicLinkSent(true)
    } catch (error) {
      setError(error.message)
    } finally {
      setSendingMagicLink(false)
    }
  }

  return (
    <div className="container max-w-sm mx-auto py-8 px-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl">Sign in</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isApproverInvite && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                As an invited approver, you can use the Magic Link option below to sign in without a password.
              </AlertDescription>
            </Alert>
          )}
          
          {magicLinkSent ? (
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Check your email</h3>
              <p className="text-gray-600 mb-4">
                We&apos;ve sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-500">
                Click the link in the email to sign in. If you don&apos;t see it, check your spam folder.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-gray-500">or</span>
                </div>
              </div>
              
              <form onSubmit={handleMagicLinkLogin} className="mt-4">
                <Button 
                  type="submit" 
                  variant="outline" 
                  className={`w-full ${isApproverInvite ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : ''}`}
                  disabled={sendingMagicLink || !email}
                >
                  {sendingMagicLink ? 'Sending...' : 'Email Magic Link'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {isApproverInvite 
                    ? "Recommended for approvers: We'll email you a secure login link"
                    : "Don't have a password? We'll email you a secure login link."}
                </p>
              </form>
            </>
          )}
          
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href={`/signup?next=${encodeURIComponent(nextUrl)}&email=${encodeURIComponent(email)}`} className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}