'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2, AlertCircle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSearchParams } from 'next/navigation'

export default function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  
  const supabase = createClientComponentClient()
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

  // Check if user has a password
  useEffect(() => {
    const checkPasswordStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // Check for users that might need to set their first password
        const { data, error } = await supabase.auth.getSession()
        
        if (!error && data?.session) {
          // Check if this is a new user who hasn't set a password yet
          if (data.session.user?.app_metadata?.provider === 'email') {
            setNeedsPassword(true)
            
            // Check if the user is recently created (within the last hour)
            const createdAt = new Date(user.created_at)
            const now = new Date()
            const userAgeMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
            
            // If user was created less than 60 minutes ago, treat as new user
            if (userAgeMinutes < 60) {
              setIsNewUser(true)
            }
          }
        }
      } catch (error) {
        console.error('Error checking user auth status:', error)
      }
    }
    
    checkPasswordStatus()
  }, [supabase])

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
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }
    
    try {
      // For users with existing passwords
      if (!needsPassword && currentPassword) {
        // First verify the current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: (await supabase.auth.getUser()).data.user.email,
          password: currentPassword,
        })
        
        if (signInError) {
          setError('Current password is incorrect')
          setLoading(false)
          return
        }
      }
      
      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      
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
      setError(error.message)
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
              Password must be at least 6 characters
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

          <Button type="submit" disabled={loading} className={isNewUser ? "bg-blue-600 hover:bg-blue-700" : ""}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNewUser ? 'Create Password' : (needsPassword ? 'Set Password' : 'Update Password')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 