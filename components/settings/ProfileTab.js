'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { getSupabase } from '@/lib/supabase'
import { useUser } from '@clerk/nextjs'
import { Loader2, Upload, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import Image from 'next/image'

export default function ProfileTab() {
  const supabase = getSupabase()
  const { user, isLoaded } = useUser()
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    bio: '',
    website: '',
    linkedin_url: '',
    avatar_url: '',
    phone_number: '',
    sms_opt_in: false
  })
  const [userEmail, setUserEmail] = useState('')
  const fileInputRef = useRef(null)

  const { toast } = useToast()

  // Get UUID for current Clerk user
  useEffect(() => {
    if (isLoaded && user) {
      setUserEmail(user.primaryEmailAddress?.emailAddress || user.email || '')
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
      loadProfile()
    }
  }, [userId])

  const loadProfile = async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGNF') throw error
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          username: data.username || '',
          bio: data.bio || '',
          website: data.website || '',
          linkedin_url: data.linkedin_url || '',
          avatar_url: data.avatar_url || '',
          phone_number: data.phone_number || '',
          sms_opt_in: !!data.sms_opt_in
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
      if (!userId) throw new Error('No user found')

      // Get current profile to check unchanged fields
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // Only update fields that have changed to avoid conflicts
      const updates = {
        id: userId,
        updated_at: new Date().toISOString()
      };
      
      // Only include fields that have changed or aren't null
      if (profile.full_name !== undefined) updates.full_name = profile.full_name;
      if (profile.bio !== undefined) updates.bio = profile.bio;
      if (profile.website !== undefined) updates.website = profile.website;
      if (profile.linkedin_url !== undefined) updates.linkedin_url = profile.linkedin_url || null;
      if (profile.avatar_url !== undefined) updates.avatar_url = profile.avatar_url;
      if (profile.phone_number !== undefined) updates.phone_number = profile.phone_number || null;
      if (profile.sms_opt_in !== undefined) updates.sms_opt_in = !!profile.sms_opt_in;
      
      // Handle username separately to check for uniqueness
      if (profile.username !== currentProfile?.username) {
        // Check if username exists (if a username is provided)
        if (profile.username) {
          const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', profile.username)
            .neq('id', userId) // Exclude the current user
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
        .eq('id', userId);

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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'Error',
        description: 'Image must be smaller than 5MB',
        variant: 'destructive'
      });
      return;
    }

    setUploadingAvatar(true);

    if (!userId) throw new Error('No user found');

    try {
      // Generate unique filename
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const storagePath = `avatars/${userId}/${fileName}`;

      // Delete old avatar if it exists
      if (profile.avatar_url) {
        try {
          const oldPath = profile.avatar_url.split('/').slice(-3).join('/');
          await supabase.storage.from('avatars').remove([oldPath]);
        } catch (error) {
          console.log('Could not delete old avatar:', error);
        }
      }

      // Upload new avatar
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: 'Success',
        description: 'Profile picture updated successfully'
      });

    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile picture',
        variant: 'destructive'
      });
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile.avatar_url) return;

    if (!userId) throw new Error('No user found');

    setUploadingAvatar(true);

    try {

      // Delete from storage
      try {
        const oldPath = profile.avatar_url.split('/').slice(-3).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      } catch (error) {
        console.log('Could not delete avatar from storage:', error);
      }

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: '' }));

      toast({
        title: 'Success',
        description: 'Profile picture removed successfully'
      });

    } catch (error) {
      console.error('Avatar removal error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove profile picture',
        variant: 'destructive'
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={updateProfile} className="space-y-4 sm:space-y-6">
          {/* Profile Picture Section */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-sm font-medium">Profile Picture</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="Profile picture"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-xl font-semibold">
                      {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                {profile.avatar_url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Recommended: Square image, at least 200x200px. Max 5MB. Supports JPEG, PNG, GIF, WebP.
            </p>
          </div>
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
            <Label htmlFor="phone_number" className="text-sm font-medium">Mobile Number</Label>
            <Input
              id="phone_number"
              value={profile.phone_number}
              onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
              placeholder="e.g. +14155550123"
              className="h-10 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1)</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="sms_opt_in"
              type="checkbox"
              checked={!!profile.sms_opt_in}
              onChange={(e) => setProfile({ ...profile, sms_opt_in: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="sms_opt_in" className="text-sm">I agree to receive SMS notifications about pending approvals</Label>
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

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="linkedin_url" className="text-sm font-medium">LinkedIn Profile URL</Label>
            <Input
              id="linkedin_url"
              type="url"
              value={profile.linkedin_url}
              onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
              placeholder="https://www.linkedin.com/in/your-name"
              className="h-10 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for CRM features. Example: https://www.linkedin.com/in/your-name
            </p>
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