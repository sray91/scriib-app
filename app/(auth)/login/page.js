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

  const [isApproverInvite, setIsApproverInvite] = useState(false)
  const [showApproverHelp, setShowApproverHelp] = useState(false)
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
      
      // Show help message if they land on the login page from an approver invite
      if (nextUrl.includes('/accept') && searchParams.get('ghostwriter')) {
        setShowApproverHelp(true)
      }
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
  }, [errorMessage, message, inviteEmail, fromApproverInvite, nextUrl, searchParams])

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
          
          {showApproverHelp && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                You&apos;ve clicked an approver invitation link. Please sign in with your password or create a new account using the Sign Up link.
              </AlertDescription>
            </Alert>
          )}
          
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