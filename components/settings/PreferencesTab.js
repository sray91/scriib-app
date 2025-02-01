'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function PreferencesTab() {
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    darkMode: false,
    autoSave: true
  })
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGNF') throw error
      if (data) {
        setPreferences(data.settings)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast({
        title: 'Error',
        description: 'Failed to load preferences',
        variant: 'destructive'
      })
    }
  }

  const updatePreference = async (key, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newPreferences = { ...preferences, [key]: value }
      setPreferences(newPreferences)

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          settings: newPreferences
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Preferences updated successfully'
      })
    } catch (error) {
      console.error('Error updating preference:', error)
      toast({
        title: 'Error',
        description: 'Failed to update preference',
        variant: 'destructive'
      })
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
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
        </div>
      </CardContent>
    </Card>
  )
}
