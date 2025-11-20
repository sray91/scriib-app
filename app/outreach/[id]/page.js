'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Play, Pause, Square, Pencil, Trash2, UserPlus, TrendingUp, Users, CheckCircle, Send, MessageSquare, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const [campaign, setCampaign] = useState(null)
  const [contacts, setContacts] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [controllingCampaign, setControllingCampaign] = useState(false)
  const [deleteCampaignDialog, setDeleteCampaignDialog] = useState(false)
  const [removeContactDialog, setRemoveContactDialog] = useState(false)
  const [contactToRemove, setContactToRemove] = useState(null)
  const [removingContact, setRemovingContact] = useState(false)
  const [refreshingStats, setRefreshingStats] = useState(false)

  // Fetch campaign data
  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/outreach/campaigns`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaign')
      }

      const foundCampaign = data.campaigns.find(c => c.id === campaignId)
      if (!foundCampaign) {
        throw new Error('Campaign not found')
      }

      setCampaign(foundCampaign)
    } catch (error) {
      console.error('Error fetching campaign:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load campaign',
        variant: 'destructive'
      })
      router.push('/outreach')
    }
  }, [campaignId, router, toast])

  // Fetch campaign contacts
  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/contacts`)
      const data = await response.json()

      if (response.ok) {
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }, [campaignId])

  // Fetch campaign activities
  const fetchActivities = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('campaign_activities')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error) {
        setActivities(data || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    }
  }, [campaignId, supabase])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([
        fetchCampaign(),
        fetchContacts(),
        fetchActivities()
      ])
      setLoading(false)
    }

    if (campaignId) {
      fetchData()
    }
  }, [campaignId, fetchCampaign, fetchContacts, fetchActivities])

  // Control campaign
  const handleControlCampaign = async (action) => {
    setControllingCampaign(true)

    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} campaign`)
      }

      toast({
        title: 'Success',
        description: data.message || `Campaign ${action}ed successfully`,
      })

      fetchCampaign()
    } catch (error) {
      console.error(`Error ${action}ing campaign:`, error)
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} campaign`,
        variant: 'destructive'
      })
    } finally {
      setControllingCampaign(false)
    }
  }

  // Delete campaign
  const handleDeleteCampaign = async () => {
    try {
      const response = await fetch(`/api/outreach/campaigns?id=${campaignId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete campaign')
      }

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully',
      })

      router.push('/outreach')
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete campaign',
        variant: 'destructive'
      })
    } finally {
      setDeleteCampaignDialog(false)
    }
  }

  // Refresh campaign stats
  const handleRefreshStats = async () => {
    setRefreshingStats(true)
    try {
      const response = await fetch('/api/outreach/campaigns/refresh-totals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh stats')
      }

      toast({
        title: 'Success',
        description: 'Campaign statistics refreshed',
      })

      // Refresh campaign data
      fetchCampaign()
    } catch (error) {
      console.error('Error refreshing stats:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh stats',
        variant: 'destructive'
      })
    } finally {
      setRefreshingStats(false)
    }
  }

  // Remove contact from campaign
  const handleRemoveContact = async () => {
    if (!contactToRemove) return

    setRemovingContact(true)
    try {
      const response = await fetch(
        `/api/outreach/campaigns/${campaignId}/contacts?contact_id=${contactToRemove.contact_id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove contact')
      }

      toast({
        title: 'Success',
        description: 'Contact removed from campaign',
      })

      // Refresh data
      fetchContacts()
      fetchCampaign()
    } catch (error) {
      console.error('Error removing contact:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove contact',
        variant: 'destructive'
      })
    } finally {
      setRemovingContact(false)
      setRemoveContactDialog(false)
      setContactToRemove(null)
    }
  }

  // Get status badge
  const getStatusBadge = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700',
      stopped: 'bg-red-100 text-red-700',
    }
    return colors[status] || colors.draft
  }

  // Get contact status badge
  const getContactStatusBadge = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-700',
      connection_sent: 'bg-blue-100 text-blue-700',
      connected: 'bg-green-100 text-green-700',
      follow_up_sent: 'bg-purple-100 text-purple-700',
      replied: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
      skipped: 'bg-orange-100 text-orange-700',
    }
    return colors[status] || colors.pending
  }

  // Calculate metrics
  const metrics = campaign ? {
    acceptanceRate: campaign.connections_sent > 0
      ? Math.round((campaign.connections_accepted / campaign.connections_sent) * 100)
      : 0,
    replyRate: campaign.messages_sent > 0
      ? Math.round((campaign.replies_received / campaign.messages_sent) * 100)
      : 0,
    progress: campaign.total_contacts > 0
      ? Math.round((campaign.connections_sent / campaign.total_contacts) * 100)
      : 0,
  } : { acceptanceRate: 0, replyRate: 0, progress: 0 }

  if (loading) {
    return (
      <div className="container py-8 max-w-7xl">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!campaign) {
    return null
  }

  return (
    <div className="container py-8 max-w-7xl">
      <div className="mb-6">
        <Link href="/outreach">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge className={getStatusBadge(campaign.status)}>
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            LinkedIn Account: {campaign.linkedin_outreach_accounts?.account_name || 'N/A'}
          </p>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <Link href={`/outreach/${campaignId}/edit`}>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button
                onClick={() => handleControlCampaign('start')}
                disabled={controllingCampaign}
                className="bg-[#fb2e01] hover:bg-[#e02a01]"
              >
                {controllingCampaign ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Start Campaign
              </Button>
            </>
          )}

          {campaign.status === 'active' && (
            <Button
              onClick={() => handleControlCampaign('pause')}
              disabled={controllingCampaign}
              variant="outline"
            >
              {controllingCampaign ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pause className="mr-2 h-4 w-4" />
              )}
              Pause
            </Button>
          )}

          {campaign.status === 'paused' && (
            <>
              <Button
                onClick={() => handleControlCampaign('start')}
                disabled={controllingCampaign}
                className="bg-[#fb2e01] hover:bg-[#e02a01]"
              >
                {controllingCampaign ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Resume
              </Button>
              <Button
                onClick={() => handleControlCampaign('stop')}
                disabled={controllingCampaign}
                variant="outline"
              >
                {controllingCampaign ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Stop
              </Button>
            </>
          )}

          {(campaign.status === 'draft' || campaign.status === 'stopped') && (
            <Button
              variant="ghost"
              onClick={() => setDeleteCampaignDialog(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Campaign Metrics</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshStats}
          disabled={refreshingStats}
        >
          {refreshingStats ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Stats
            </>
          )}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.total_contacts}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.connections_sent} contacted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.connections_accepted}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.acceptanceRate}% acceptance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.messages_sent}</div>
            <p className="text-xs text-muted-foreground">
              Follow-up messages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.replies_received}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.replyRate}% reply rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Campaign Contacts</CardTitle>
                <Link href={`/crm?campaign=${campaignId}`}>
                  <Button variant="outline" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Contacts
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">No contacts yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add contacts from your CRM to start the campaign
                  </p>
                  <Link href={`/crm`}>
                    <Button className="bg-[#fb2e01] hover:bg-[#e02a01]">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Go to CRM
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Connection Sent</TableHead>
                        <TableHead>Accepted</TableHead>
                        <TableHead>Follow-up Sent</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.crm_contacts?.name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contact.crm_contacts?.company || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getContactStatusBadge(contact.status)}>
                              {contact.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.connection_sent_at
                              ? new Date(contact.connection_sent_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.connection_accepted_at
                              ? new Date(contact.connection_accepted_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.follow_up_sent_at
                              ? new Date(contact.follow_up_sent_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setContactToRemove(contact)
                                setRemoveContactDialog(true)
                              }}
                              disabled={removingContact}
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent campaign activity</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">No activity yet</p>
                  <p className="text-sm text-muted-foreground">
                    Activity will appear here once the campaign starts
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 border-b pb-4 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">{activity.message}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="h-fit">
                        {activity.activity_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>View campaign configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Daily Connection Limit</Label>
                <p className="text-sm text-muted-foreground">{campaign.daily_connection_limit} per day</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Follow-up Delay</Label>
                <p className="text-sm text-muted-foreground">{campaign.follow_up_delay_days} days after acceptance</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Connection Message</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                  {campaign.connection_message || 'No message set'}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Follow-up Message</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                  {campaign.follow_up_message || 'No follow-up message set'}
                </p>
              </div>

              {campaign.pipelines && (
                <div>
                  <Label className="text-sm font-medium">Pipeline</Label>
                  <p className="text-sm text-muted-foreground">{campaign.pipelines.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Campaign Confirmation Dialog */}
      <AlertDialog open={deleteCampaignDialog} onOpenChange={setDeleteCampaignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Contact Confirmation Dialog */}
      <AlertDialog open={removeContactDialog} onOpenChange={setRemoveContactDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Contact from Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {contactToRemove?.crm_contacts?.name || 'this contact'} from the campaign?
              {contactToRemove?.status !== 'pending' && (
                <span className="block mt-2 text-yellow-600">
                  Warning: This contact has already been contacted. Consider stopping the campaign first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingContact}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveContact}
              disabled={removingContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingContact ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
