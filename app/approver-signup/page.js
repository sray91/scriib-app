'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function ApproverSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [processingMagicLink, setProcessingMagicLink] = useState(true)
  const [ghostwriter, setGhostwriter] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getSupabase()
  
  useEffect(() => {
    // Get params from URL
    const emailParam = searchParams.get('email')
    const ghostwriterParam = searchParams.get('ghostwriter')
    
    if (emailParam) {
      setEmail(emailParam)
    }
    
    if (ghostwriterParam) {
      setGhostwriter(ghostwriterParam)
    }
    
    // Check if this is a magic link redirect with auth code
    const code = searchParams.get('code')
    
    if (code) {
      // Process the OTP code to verify the email
      handleMagicLinkVerification(code)
    } else {
      setProcessingMagicLink(false)
    }
  }, [searchParams])
  
  const handleMagicLinkVerification = async (code) => {
    try {
      setProcessingMagicLink(true)
      
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        throw error
      }
      
      // Get user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Unable to get session')
      }
      
      // Create the approver link if ghostwriter ID is provided
      if (ghostwriter) {
        try {
          // First ensure user has a profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email.toLowerCase(),
              created_at: new Date().toISOString()
            })
            .onConflict('id')
            .merge()
            
          if (profileError) {
            console.error('Error creating profile:', profileError)
          }
          
          // Create the link with the ghostwriter
          const { error: linkError } = await supabase
            .from('ghostwriter_approver_link')
            .insert({
              ghostwriter_id: ghostwriter,
              approver_id: session.user.id,
              active: true
            })
            .onConflict(['ghostwriter_id', 'approver_id'])
            .merge({ active: true, revoked_at: null })
            
          if (linkError) {
            console.error('Error creating approver link:', linkError)
          }
        } catch (error) {
          console.error('Error creating relationship:', error)
        }
      }
      
      // Now transition to password setup
      setProcessingMagicLink(false)
    } catch (error) {
      console.error('Error verifying magic link:', error)
      setError('There was a problem verifying your email. Please try again.')
      setProcessingMagicLink(false)
    }
  }
  
  const handleSetPassword = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Set the password for the authenticated user
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      
      if (error) throw error
      
      // Password set successfully
      setSuccess(true)
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Loading state
  if (processingMagicLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Verifying your email</CardTitle>
            <CardDescription>Please wait while we verify your email</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-center text-gray-600">
              We&apos;re verifying your email and setting up your account...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Success!</CardTitle>
            <CardDescription>Your account has been set up successfully</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-center text-gray-600 mb-4">
              Your password has been set and you&apos;re now logged in.
            </p>
            <p className="text-center text-gray-500 text-sm">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Main form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Complete your signup</CardTitle>
          <CardDescription>Set a password to secure your approver account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled={true}
                className="bg-gray-50"
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
                placeholder="Choose a secure password"
                autoComplete="new-password"
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
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
            </div>
            
            <Button type="submit" className="w-full bg-[#fb2e01] hover:bg-[#fb2e01]/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting password...
                </>
              ) : 'Complete Account Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 