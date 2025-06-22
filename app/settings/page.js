'use client'

import { useState, useEffect } from 'react'
import { Twitter, Linkedin, Trash2, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSession } from '@supabase/auth-helpers-react'
import * as Switch from '@radix-ui/react-switch'
import TeamsTab from "@/components/settings/TeamsTab";
import PreferencesTab from "@/components/settings/PreferencesTab";
import ProfileTab from "@/components/settings/ProfileTab"
import ApproversTab from "@/components/settings/ApproversTab"
import GhostwritersTab from "@/components/settings/GhostwritersTab"
import PasswordTab from "@/components/settings/PasswordTab"
import LinkedInTab from "@/components/settings/LinkedInTab"
import { useLinkedInAuthStatus } from '@/components/settings/SocialAccountsTab'
import { useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('social')
  const [sharedCollections, setSharedCollections] = useState([])
  const [socialAccounts, setSocialAccounts] = useState([])
  const supabase = createClientComponentClient()
  const session = useSession()
  const { toast } = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState([])
  const searchParams = useSearchParams()

  useEffect(() => {
    // Set active tab based on URL parameter
    const tabParam = searchParams.get('tab')
    if (tabParam && ['social', 'profile', 'password', 'preferences', 'approvers', 'ghostwriters', 'shares', 'teams', 'linkedin'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useLinkedInAuthStatus();

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
  }, [session, searchParams]);

  // Handle social account connections
  const handleConnect = (platform) => {
    if (platform === 'twitter') {
      toast({
        title: 'Not implemented',
        description: 'Twitter connection is not implemented yet.',
      });
    } else if (platform === 'linkedin') {
      // Use the unified LinkedIn auth (defaults to standard mode)
      window.location.href = `/api/auth/linkedin`;
    }
  };

  const handleDisconnect = async (accountId) => {
    try {
      const { error } = await supabase
        .from('social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      // Update the UI
      setSocialAccounts(prev => prev.filter(acc => acc.id !== accountId));

      toast({
        title: 'Account disconnected',
        description: 'Social account has been disconnected successfully.'
      });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect the account',
        variant: 'destructive'
      });
    }
  };

  // Handle share operations
  const handleCopyShareUrl = (shareId) => {
    const url = `${window.location.origin}/shared/${shareId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'Share URL copied to clipboard'
    });
  };

  const handleDeleteShare = async (shareId) => {
    try {
      const { error } = await supabase
        .from('shared_collections')
        .delete()
        .eq('share_id', shareId);

      if (error) throw error;

      // Update UI
      setSharedCollections(prev => prev.filter(share => share.share_id !== shareId));

      toast({
        title: 'Deleted',
        description: 'Shared collection has been deleted'
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

  // Handle admin change
  const handleAdminChange = async (userId, isAdmin) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: isAdmin })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(user =>
        user.user_id === userId ? { ...user, is_admin: isAdmin } : user
      ));

      toast({
        title: 'Success',
        description: `Admin status updated successfully`
      });
    } catch (error) {
      console.error('Error updating admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive'
      });
    }
  };

  // Check admin status on component mount
  useEffect(() => {
    checkAdminStatus()
  }, [])

  async function checkAdminStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Current user:', user)
      
      if (!user) return

      const isUserAdmin = user.user_metadata?.is_admin || false
      console.log('Is admin:', isUserAdmin)
      
      setIsAdmin(isUserAdmin)
      
      if (isUserAdmin) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  async function fetchUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_users');
      
      if (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "Error",
          description: "Failed to load users. " + error.message,
          variant: "destructive",
        });
        return;
      }
      
      setUsers(data || []);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again later.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container py-8 max-w-5xl">
      <h2 className="text-2xl font-bold tracking-tight mb-8 text-center sm:text-left">Account Settings</h2>
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Mobile tab navigation - visible only on small screens */}
        <div className="relative mb-6 md:hidden">
          <div className="bg-gray-100 rounded-lg p-1">
            <TabsList className="grid grid-cols-4 gap-1">
              <TabsTrigger 
                value="profile" 
                className="px-3 py-2 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="social" 
                className="px-3 py-2 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Social
              </TabsTrigger>
              <TabsTrigger 
                value="password" 
                className="px-3 py-2 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Password
              </TabsTrigger>
              <TabsTrigger 
                value="more" 
                className="px-3 py-2 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                onClick={() => {
                  if (activeTab !== 'preferences' && 
                      activeTab !== 'approvers' && 
                      activeTab !== 'ghostwriters' && 
                      activeTab !== 'shares' && 
                      activeTab !== 'teams' &&
                      activeTab !== 'linkedin') {
                    setActiveTab('preferences');
                  }
                }}
              >
                More
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Secondary tab row - only visible when "More" is selected */}
          {(activeTab === 'preferences' || 
            activeTab === 'approvers' || 
            activeTab === 'ghostwriters' || 
            activeTab === 'shares' || 
            activeTab === 'teams' ||
            activeTab === 'linkedin') && (
            <div className="mt-2 bg-gray-100 rounded-lg p-1">
              <TabsList className="grid grid-cols-6 gap-1">
                <TabsTrigger 
                  value="preferences" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  Prefs
                </TabsTrigger>
                <TabsTrigger 
                  value="approvers" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  Approvers
                </TabsTrigger>
                <TabsTrigger 
                  value="ghostwriters" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm truncate"
                >
                  Ghosts
                </TabsTrigger>
                <TabsTrigger 
                  value="shares" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  Shares
                </TabsTrigger>
                <TabsTrigger 
                  value="teams" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  Teams
                </TabsTrigger>
                <TabsTrigger 
                  value="linkedin" 
                  className="px-2 py-2 text-xs font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  LinkedIn
                </TabsTrigger>
              </TabsList>
            </div>
          )}
        </div>

        {/* Desktop tab navigation - visible on medium screens and up */}
        <div className="relative mb-8 hidden md:block">
          <div className="overflow-x-auto pb-2">
            <TabsList className="flex w-full bg-gray-100 p-1 rounded-lg">
              <TabsTrigger 
                value="profile" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="social" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Social
              </TabsTrigger>
              <TabsTrigger 
                value="password" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Password
              </TabsTrigger>
              <TabsTrigger 
                value="preferences" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Preferences
              </TabsTrigger>
              <TabsTrigger 
                value="approvers" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Approvers
              </TabsTrigger>
              <TabsTrigger 
                value="ghostwriters" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Ghostwriters
              </TabsTrigger>
              <TabsTrigger 
                value="shares" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Shares
              </TabsTrigger>
              <TabsTrigger 
                value="teams" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Teams
              </TabsTrigger>
              <TabsTrigger 
                value="linkedin" 
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                LinkedIn
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-0">
          <TabsContent value="profile" className="space-y-0 mt-0">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="social">
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-xl font-bold tracking-tight">Connected Social Accounts</h2>
                  <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      onClick={() => handleConnect('linkedin')}
                      className="h-10 px-4 flex-1 sm:flex-none"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      Add LinkedIn
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleConnect('twitter')}
                      className="h-10 px-4 flex-1 sm:flex-none"
                    >
                      <Twitter className="h-4 w-4 mr-2" />
                      Add Twitter
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {socialAccounts
                    .filter(account => account.platform === 'linkedin' || account.platform === 'linkedin_portability')
                    .map(account => (
                      <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3 sm:mb-0">
                          <div className="bg-blue-50 p-2 rounded-full">
                            <Linkedin className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {account.screen_name || 'LinkedIn Account'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Connected • Last used: {account.last_used_at ? new Date(account.last_used_at).toLocaleDateString() : 'Never'}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 self-end sm:self-auto"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    ))}

                  {socialAccounts
                    .filter(account => account.platform === 'twitter')
                    .map(account => (
                      <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3 sm:mb-0">
                          <div className="bg-blue-50 p-2 rounded-full">
                            <Twitter className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium">{account.screen_name || 'Twitter Account'}</div>
                            <div className="text-sm text-muted-foreground">
                              Last used: {account.last_used_at ? new Date(account.last_used_at).toLocaleDateString() : 'Never'}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 self-end sm:self-auto"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    ))}

                  {socialAccounts.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <p className="text-muted-foreground text-lg mb-1">
                        No social accounts connected
                      </p>
                      <p className="text-sm text-gray-500">
                        Add your first account using the buttons above
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="password">
            <PasswordTab />
          </TabsContent>
          <TabsContent value="preferences">
            <PreferencesTab />
          </TabsContent>
          <TabsContent value="approvers">
            <ApproversTab />
          </TabsContent>
          <TabsContent value="ghostwriters">
            <GhostwritersTab />
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

          {isAdmin && (
            <TabsContent value="admin">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold mb-4">User Management</h2>
                      <div className="space-y-4">
                        {users.length === 0 ? (
                          <p className="text-muted-foreground">No users found or still loading...</p>
                        ) : (
                          users.map((user) => (
                            <div 
                              key={user.user_id} 
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{user.user_email}</p>
                                <p className="text-sm text-muted-foreground">
                                  Joined: {new Date(user.user_created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm mr-2">Admin</span>
                                <Switch.Root
                                  className="w-[42px] h-[25px] bg-gray-200 rounded-full relative focus:outline-none focus:ring focus:ring-blue-200 data-[state=checked]:bg-blue-600"
                                  id={`admin-${user.user_id}`}
                                  checked={user.is_admin || false}
                                  onCheckedChange={(checked) => handleAdminChange(user.user_id, checked)}
                                >
                                  <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[17px]" />
                                </Switch.Root>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
          <TabsContent value="teams">
            <TeamsTab />
          </TabsContent>
          <TabsContent value="linkedin">
            <LinkedInTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}