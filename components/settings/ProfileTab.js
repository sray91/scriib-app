'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 } from 'lucide-react'

export default function ProfileTab() {
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    bio: '',
    website: '',
    avatar_url: ''
  })
  const [userEmail, setUserEmail] = useState('')
  
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Save the email address from auth
      setUserEmail(user.email || '')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGNF') throw error
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          username: data.username || '',
          bio: data.bio || '',
          website: data.website || '',
          avatar_url: data.avatar_url || ''
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive'
      })
    }
  }

  const updateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get current profile to check unchanged fields
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      // Only update fields that have changed to avoid conflicts
      const updates = {
        id: user.id,
        updated_at: new Date().toISOString()
      };
      
      // Only include fields that have changed or aren't null
      if (profile.full_name !== undefined) updates.full_name = profile.full_name;
      if (profile.bio !== undefined) updates.bio = profile.bio;
      if (profile.website !== undefined) updates.website = profile.website;
      if (profile.avatar_url !== undefined) updates.avatar_url = profile.avatar_url;
      
      // Handle username separately to check for uniqueness
      if (profile.username !== currentProfile?.username) {
        // Check if username exists (if a username is provided)
        if (profile.username) {
          const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', profile.username)
            .neq('id', user.id) // Exclude the current user
            .maybeSingle();
  
          if (existingUser) {
            toast({
              title: 'Error',
              description: 'Username is already taken. Please choose another one.',
              variant: 'destructive'
            });
            setLoading(false);
            return;
          }
          
          // Username is unique, include it in updates
          updates.username = profile.username;
        } else {
          // Allow clearing username
          updates.username = null;
        }
      }

      console.log('Updating profile with:', updates);
      
      const { error } = await supabase
        .from('profiles')
        .update(updates) // Use update instead of upsert to avoid conflicts
        .eq('id', user.id);

      if (error) {
        console.error('Detailed error:', error);
        // Check specifically for uniqueness constraint errors
        if (error.code === '23505') {
          if (error.message.includes('profiles_username_key')) {
            throw new Error('Username is already taken. Please choose another one.');
          } else {
            throw new Error('A conflict occurred. Please try again with different values.');
          }
        }
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully'
      });
      
      // Reload the profile after successful update
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={updateProfile} className="space-y-4 sm:space-y-6">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              value={userEmail}
              disabled
              readOnly
              className="bg-gray-50 text-gray-600 h-10 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email address cannot be changed
            </p>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="full_name" className="text-sm font-medium">Full Name</Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Enter your full name"
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="Enter your username"
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell us about yourself"
              rows={4}
              className="min-h-[80px] text-sm resize-y"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="website" className="text-sm font-medium">Website</Label>
            <Input
              id="website"
              type="url"
              value={profile.website}
              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
              placeholder="Enter your website URL"
              className="h-10 text-sm"
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 