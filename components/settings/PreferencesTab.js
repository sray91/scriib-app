'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@supabase/supabase-js'
import { useUser } from '@clerk/nextjs'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PreferencesTab() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { user, isLoaded } = useUser()
  const [userId, setUserId] = useState(null)
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    darkMode: false,
    autoSave: true
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorDetails, setErrorDetails] = useState('')
  const { toast } = useToast()

  // Get UUID for current Clerk user
  useEffect(() => {
    if (isLoaded && user) {
      fetch(`/api/user/get-uuid`)
        .then(res => res.json())
        .then(data => {
          if (data.uuid) {
            setUserId(data.uuid)
          }
        })
        .catch(err => console.error('Error fetching UUID:', err))
    }
  }, [isLoaded, user])

  // Fetch data when userId is available
  useEffect(() => {
    if (userId) {
      loadPreferences()
    }
  }, [userId])

  const loadPreferences = async () => {
    if (!userId) return

    setLoading(true)
    setError(false)
    setErrorDetails('')

    try {
      console.log('User authenticated, ID:', userId)

      // Try a simple query to check database connectivity
      const { error: pingError } = await supabase
        .from('user_preferences')
        .select('count')
        .limit(1)

      if (pingError) {
        console.error('Database connectivity issue:', pingError)
        setErrorDetails(`DB connectivity: ${pingError.message} (${pingError.code})`)
        throw pingError
      }

      console.log('Database connection successful')

      // Now try to get the user's specific preferences
      const { data, error: prefsError } = await supabase
        .from('user_preferences')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle()

      if (prefsError && prefsError.code !== 'PGNF') {
        console.error('Error fetching preferences:', prefsError)
        setErrorDetails(`Fetch error: ${prefsError.message} (${prefsError.code})`)
        throw prefsError
      }

      if (data) {
        console.log('User preferences loaded successfully')
        setPreferences(data.settings)
      } else {
        console.log('No preferences found for user, will create on first update')
        // We'll use the default preferences
      }

      setLoading(false)
    } catch (error) {
      console.error('Error in preferences tab:', error)
      setError(true)
      setLoading(false)
      
      // If no detailed error is set yet, set a generic one
      if (!errorDetails) {
        setErrorDetails(error.message || 'Unknown error occurred')
      }
      
      toast({
        title: 'Error Loading Preferences',
        description: 'Using default settings instead. Details: ' + (errorDetails || error.message),
        variant: 'destructive'
      })
    }
  }

  const updatePreference = async (key, value) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'You must be logged in to update preferences',
        variant: 'destructive'
      })
      return
    }

    try {
      setError(false)

      // Optimistically update the UI
      const newPreferences = { ...preferences, [key]: value }
      setPreferences(newPreferences)

      console.log('Updating preference:', key, value, 'for user:', userId)
      
      // Get existing preferences with id
      const { data: existingPrefs, error: selectError } = await supabase
        .from('user_preferences')
        .select('id, settings')
        .eq('user_id', userId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error fetching existing preferences:', selectError)
        throw selectError
      }

      let result
      if (existingPrefs) {
        // Update existing record
        result = await supabase
          .from('user_preferences')
          .update({
            settings: newPreferences,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPrefs.id)
      } else {
        // Insert new record
        result = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            settings: newPreferences,
            updated_at: new Date().toISOString()
          })
      }

      if (result.error) {
        console.error('Database operation error:', result.error)
        throw result.error
      }

      console.log('Preference updated successfully')
      
      toast({
        title: 'Success',
        description: 'Preference updated successfully'
      })
    } catch (error) {
      console.error('Error updating preference:', error)
      setError(true)
      setErrorDetails(error.message || 'Failed to update preference')
      
      toast({
        title: 'Error',
        description: 'Failed to update preference: ' + error.message,
        variant: 'destructive'
      })
    }
  }

  const handleRetry = () => {
    loadPreferences()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center min-h-[200px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading preferences...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 font-medium mb-2">Failed to load preferences</p>
            <p className="text-sm text-muted-foreground mb-4">
              {errorDetails || 'Using default settings instead.'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mb-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
          <div className="space-y-4">
            {renderPreferenceItems()}
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderPreferenceItems() {
    return (
      <>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <div className="text-sm text-muted-foreground">
              Receive email notifications about important updates
            </div>
          </div>
          <Switch
            id="email-notifications"
            checked={preferences.emailNotifications}
            onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dark-mode">Dark Mode</Label>
            <div className="text-sm text-muted-foreground">
              Enable dark mode for the application
            </div>
          </div>
          <Switch
            id="dark-mode"
            checked={preferences.darkMode}
            onCheckedChange={(checked) => updatePreference('darkMode', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-save">Auto Save</Label>
            <div className="text-sm text-muted-foreground">
              Automatically save changes as you work
            </div>
          </div>
          <Switch
            id="auto-save"
            checked={preferences.autoSave}
            onCheckedChange={(checked) => updatePreference('autoSave', checked)}
          />
        </div>
      </>
    )
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          {renderPreferenceItems()}
        </div>
      </CardContent>
    </Card>
  )
}
