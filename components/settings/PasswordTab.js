'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useUser } from '@clerk/nextjs'
import { Loader2, AlertCircle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSearchParams, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'

export default function PasswordTab() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const [hasPasswordAuth, setHasPasswordAuth] = useState(true)

  const { toast } = useToast()
  const searchParams = useSearchParams()
  const fromInvite = searchParams.get('fromInvite') === 'true'
  const successType = searchParams.get('success')
  const ghostwriter = searchParams.get('ghostwriter')

  // Show welcome message for direct invites
  useEffect(() => {
    if (successType === 'invite_accepted') {
      setShowWelcomeMessage(true)
      setIsNewUser(true)
      setNeedsPassword(true)
      
      // Show toast notification
      toast({
        title: 'Success!',
        description: 'You have been added as an approver. Please set a password for future logins.',
      })
    }
  }, [successType, toast])

  // Clerk handles password management
  useEffect(() => {
    const checkPasswordStatus = async () => {
      try {
        if (!user) return
        // Password management is now handled by Clerk
        setNeedsPassword(false)

        // Check if user has password authentication enabled
        // Users who signed up via OAuth (Google, etc.) may not have a password
        const passwordIdentifier = user.primaryEmailAddress?.verification?.strategy === 'from_oauth_google'
          || user.externalAccounts?.length > 0

        // If they only have OAuth, they don't have a password set
        const hasPassword = user.passwordEnabled !== false
        setHasPasswordAuth(hasPassword)

        // Check if the user is recently created (within the last hour)
        const createdAt = new Date(user.createdAt)
        const now = new Date()
        const userAgeMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)

        // If user was created less than 60 minutes ago, treat as new user
        if (userAgeMinutes < 60) {
          setIsNewUser(true)
        }
      } catch (error) {
        console.error('Error checking user auth status:', error)
      }
    }

    checkPasswordStatus()
  }, [user])

  // Handle forgot password - sends reset email via Clerk
  const handleForgotPassword = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: 'Error',
        description: 'No email address found for your account',
        variant: 'destructive'
      })
      return
    }

    setResetLoading(true)
    setError(null)

    try {
      // Create a password reset flow using Clerk
      await user.primaryEmailAddress.prepareVerification({
        strategy: 'reset_password_email_code'
      })

      toast({
        title: 'Password Reset Email Sent',
        description: `Check your email (${user.primaryEmailAddress.emailAddress}) for a password reset link.`,
      })

      // Sign out and redirect to login page with message
      await signOut()
      router.push('/login?message=Password reset email sent. Please check your inbox and click the link to reset your password.')
    } catch (error) {
      console.error('Error sending password reset:', error)

      // Fallback: redirect to login page where they can use "Forgot password?"
      toast({
        title: 'Use Login Page',
        description: 'Please use the "Forgot password?" link on the login page to reset your password.',
      })

      await signOut()
      router.push('/login?message=Click "Forgot password?" below to reset your password')
    } finally {
      setResetLoading(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      // Use Clerk's password update method
      await user.updatePassword({
        currentPassword: needsPassword ? undefined : currentPassword,
        newPassword: newPassword,
      })

      // Clear the form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setNeedsPassword(false)
      setSuccess(true)

      toast({
        title: 'Success',
        description: isNewUser ? 'Password set successfully' : 'Password updated successfully'
      })
    } catch (error) {
      console.error('Error updating password:', error)
      // Clerk errors have a more specific structure
      const errorMessage = error.errors?.[0]?.message || error.message || 'Failed to update password'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: isNewUser ? 'Failed to set password' : 'Failed to update password',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isNewUser ? 'Set Your Password' : (needsPassword ? 'Set Password' : 'Update Password')}</CardTitle>
        <CardDescription>
          {isNewUser 
            ? 'Create a password to secure your account and enable future logins' 
            : (needsPassword 
                ? 'Create a password for your account for additional security' 
                : 'Change your password to keep your account secure')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-4">
            <AlertDescription className="text-green-600">
              Password successfully {needsPassword ? 'set' : 'updated'}!
            </AlertDescription>
          </Alert>
        )}

        {showWelcomeMessage && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <p className="font-bold mb-1">You have successfully been added as an approver!</p>
              <p>Please set a password now to secure your account for future logins.</p>
            </AlertDescription>
          </Alert>
        )}

        {isNewUser && !showWelcomeMessage && (
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              You&apos;re a new user. Setting a password will secure your account for future logins.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          {!needsPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Password must be at least 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={loading} className={isNewUser ? "bg-blue-600 hover:bg-blue-700" : ""}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNewUser ? 'Create Password' : (needsPassword ? 'Set Password' : 'Update Password')}
            </Button>
          </div>
        </form>

        {/* Forgot Password Section */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Forgot your password?</p>
              <p className="text-xs text-gray-500 mt-1">
                We&apos;ll send you an email to reset it
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 