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
    setError(null)
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      // Use the environment variable for the site URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      
      console.log("Signing up with email redirect:", `${siteUrl.replace(/\/+$/, '')}/auth/callback?next=${encodeURIComponent(nextUrl)}`)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl.replace(/\/+$/, '')}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
          data: {
            // Add any additional user metadata here
            sign_up_method: 'email_password'
          }
        },
      })
      
      if (error) throw error

      // For approver invites, give special instructions
      if (nextUrl.includes('/accept')) {
        router.push(`/login?message=Check your email to confirm your account. After confirming, you'll be able to accept the approver invitation&next=${encodeURIComponent(nextUrl)}`)
      } else {
        router.push(`/login?message=Check your email to confirm your account&next=${encodeURIComponent(nextUrl)}`)
      }
    } catch (error) {
      // If the error is about an existing account, suggest logging in
      if (error.message?.includes('already registered')) {
        setError(`This email is already registered. Please try logging in with your password instead.`)
      } else {
        setError(error.message)
      }
    } finally {
      setLoading(false)
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
              {loading ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>
          
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