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
import { AlertCircle } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/'
  const inviteEmail = searchParams.get('email') || ''
  const message = searchParams.get('message')
  
  useEffect(() => {
    // If there's an email from the invite, use it
    if (inviteEmail) {
      setEmail(inviteEmail)
    }
    
    // If there's a message, display it
    if (message) {
      setError(message)
    }
  }, [inviteEmail, message])
  
  const supabase = createClientComponentClient()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      // Use the environment variable for the site URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        },
      })
      
      if (error) throw error

      router.push(`/login?message=Check your email to confirm your account&next=${encodeURIComponent(nextUrl)}`)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleMagicLinkSignup = async (e) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    setSendingMagicLink(true)
    setError(null)
    
    try {
      // Use the environment variable for the site URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign up</CardTitle>
          <CardDescription>Create an account to start managing your content creation</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant={message ? "default" : "destructive"} className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {magicLinkSent ? (
            <div className="text-center py-6 px-2">
              <h3 className="text-lg font-medium mb-2">Check Your Email</h3>
              <p className="text-gray-600 mb-4">
                We&apos;ve sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-500">
                Click the link in the email to sign in. If you don&apos;t see it, check your spam folder.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!!inviteEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign up with Password'}
                </Button>
              </form>
              
              <div className="mt-4 relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-gray-500">Or continue with</span>
                </div>
              </div>
              
              <form onSubmit={handleMagicLinkSignup} className="mt-4">
                <Button 
                  type="submit" 
                  variant="outline" 
                  className="w-full" 
                  disabled={sendingMagicLink || !email}
                >
                  {sendingMagicLink ? 'Sending...' : 'Email Magic Link'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Don&apos;t want to set a password? We&apos;ll email you a secure login link.
                </p>
              </form>
            </>
          )}
          
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href={`/login?next=${encodeURIComponent(nextUrl)}&email=${encodeURIComponent(email)}`} className="text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}