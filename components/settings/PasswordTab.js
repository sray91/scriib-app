'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Check if user has a password
  useEffect(() => {
    const checkPasswordStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // Approximate check for users that were likely created with magic links
        // This is based on the provider field in Supabase auth
        const { data, error } = await supabase.auth.getSession()
        if (!error && data?.session?.user?.app_metadata?.provider === 'email') {
          setNeedsPassword(true)
        }
      } catch (error) {
        console.error('Error checking user auth status:', error)
      }
    }
    
    checkPasswordStatus()
  }, [])

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
        description: 'Password updated successfully'
      })
    } catch (error) {
      console.error('Error updating password:', error)
      setError(error.message)
      toast({
        title: 'Error',
        description: 'Failed to update password',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{needsPassword ? 'Set Password' : 'Update Password'}</CardTitle>
        <CardDescription>
          {needsPassword 
            ? 'Create a password for your account for additional security' 
            : 'Change your password to keep your account secure'}
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

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsPassword ? 'Set Password' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 