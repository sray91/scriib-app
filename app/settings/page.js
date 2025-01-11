'use client'

import { useState, useEffect } from 'react'
import { Twitter, Linkedin, Trash2, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSession } from '@supabase/auth-helpers-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('social')
  const [sharedCollections, setSharedCollections] = useState([])
  const [socialAccounts, setSocialAccounts] = useState([])
  const supabase = createClientComponentClient()
  const session = useSession()
  const { toast } = useToast()

  // Fetch social accounts
  const fetchSocialAccounts = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSocialAccounts(data || []);
    } catch (error) {
      console.error('Error fetching social accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load social accounts',
        variant: 'destructive'
      });
    }
  };

  // Fetch shared collections
  const fetchSharedCollections = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('shared_collections')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSharedCollections(data);
    } catch (error) {
      console.error('Error fetching shared collections:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shared collections',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (session) {
      fetchSharedCollections();
      fetchSocialAccounts();
    }
  }, [session]);

  // Handle social account connection
  const handleConnect = async (platform) => {
    // Check for existing accounts of this platform
    const currentAccounts = socialAccounts.filter(acc => acc.platform === platform);
    
    // Add a limit check (adjust the number as needed)
    if (currentAccounts.length >= 10) {
      toast({
        title: 'Error',
        description: `You can only connect up to 10 ${platform} accounts.`,
        variant: 'destructive'
      });
      return;
    }

    // Store the current accounts in session storage before redirecting
    sessionStorage.setItem('existingAccounts', JSON.stringify(currentAccounts));

    // Add state parameter to track the auth flow
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('oauthState', state);

    if (platform === 'linkedin') {
      window.location.href = `/api/auth/linkedin?state=${state}`;
    } else if (platform === 'twitter') {
      window.location.href = `/api/auth/twitter?state=${state}`;
    }
  };

  // Handle social account disconnection
  const handleDisconnect = async (accountId) => {
    try {
      const { error } = await supabase
        .from('social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      setSocialAccounts(prev => prev.filter(account => account.id !== accountId));
      toast({
        title: 'Success',
        description: 'Account disconnected successfully'
      });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect account',
        variant: 'destructive'
      });
    }
  };

  // Handle copy share URL
  const handleCopyShareUrl = async (shareId) => {
    const shareUrl = `${window.location.origin}/shared/${shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Success',
        description: 'Share URL copied to clipboard!'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL',
        variant: 'destructive'
      });
    }
  };

  // Handle delete shared collection
  const handleDeleteShare = async (shareId) => {
    try {
      const { error } = await supabase
        .from('shared_collections')
        .delete()
        .eq('share_id', shareId);

      if (error) throw error;

      setSharedCollections(prev => 
        prev.filter(collection => collection.share_id !== shareId)
      );

      toast({
        title: 'Success',
        description: 'Shared collection deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting shared collection:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete shared collection',
        variant: 'destructive'
      });
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
        <TabsTrigger value="social">Social Accounts</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="shares">Shared Pages</TabsTrigger>
      </TabsList>
      
      <TabsContent value="social" className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Connected Social Accounts</h2>
              <div className="space-x-2">
                <Button 
                  variant="outline"
                  onClick={() => handleConnect('linkedin')}
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  Add LinkedIn
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleConnect('twitter')}
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Add Twitter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {/* LinkedIn Accounts */}
              {socialAccounts
                .filter(account => account.platform === 'linkedin')
                .map(account => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Linkedin className="h-5 w-5" />
                      <div>
                        <div className="font-medium">{account.screen_name || 'LinkedIn Account'}</div>
                        <div className="text-sm text-muted-foreground">
                          Last used: {account.last_used_at ? new Date(account.last_used_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDisconnect(account.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}

              {/* Twitter/X Accounts */}
              {socialAccounts
                .filter(account => account.platform === 'twitter')
                .map(account => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Twitter className="h-5 w-5" />
                      <div>
                        <div className="font-medium">{account.screen_name || 'Twitter Account'}</div>
                        <div className="text-sm text-muted-foreground">
                          Last used: {account.last_used_at ? new Date(account.last_used_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDisconnect(account.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}

              {socialAccounts.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No social accounts connected. Add your first account above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="profile">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Profile Settings</h2>
            <p className="text-muted-foreground">Manage your profile information</p>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="preferences">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Preferences</h2>
            <p className="text-muted-foreground">Customize your app experience</p>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="shares">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Shared Collections</h2>
            <div className="space-y-4">
              {sharedCollections.length === 0 ? (
                <p className="text-muted-foreground">No shared collections yet.</p>
              ) : (
                sharedCollections.map((collection) => (
                  <div 
                    key={collection.share_id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">
                        {collection.tag} Collection
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(collection.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyShareUrl(collection.share_id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/shared/${collection.share_id}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteShare(collection.share_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}