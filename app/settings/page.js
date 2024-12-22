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
  const supabase = createClientComponentClient()
  const session = useSession()
  const { toast } = useToast()

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
    }
  }, [session]);

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
            <h2 className="text-lg font-semibold mb-4">Connected Social Accounts</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Twitter className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Twitter</div>
                    <div className="text-sm text-muted-foreground">Connected</div>
                  </div>
                </div>
                <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  Disconnect
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Linkedin className="h-5 w-5" />
                  <div>
                    <div className="font-medium">LinkedIn</div>
                    <div className="text-sm text-muted-foreground">Connected</div>
                  </div>
                </div>
                <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  Disconnect
                </Button>
              </div>
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