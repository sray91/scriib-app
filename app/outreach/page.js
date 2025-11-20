'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Plus, Play, Pause, Square, Eye, Pencil, Trash2, Send } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [deleteCampaignId, setDeleteCampaignId] = useState(null)
  const [controllingCampaign, setControllingCampaign] = useState(null)
  const { toast } = useToast()

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      const response = await fetch(`/api/outreach/campaigns?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaigns')
      }

      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, toast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Delete campaign
  const handleDeleteCampaign = async () => {
    if (!deleteCampaignId) return

    try {
      const response = await fetch(`/api/outreach/campaigns?id=${deleteCampaignId}`, {
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

      fetchCampaigns()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete campaign',
        variant: 'destructive'
      })
    } finally {
      setDeleteCampaignId(null)
    }
  }

  // Control campaign (start, pause, stop)
  const handleControlCampaign = async (campaignId, action) => {
    setControllingCampaign(campaignId)

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

      fetchCampaigns()
    } catch (error) {
      console.error(`Error ${action}ing campaign:`, error)
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} campaign`,
        variant: 'destructive'
      })
    } finally {
      setControllingCampaign(null)
    }
  }

  // Get status badge color
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

  // Calculate progress percentage
  const calculateProgress = (campaign) => {
    if (campaign.total_contacts === 0) return 0
    return Math.round((campaign.connections_sent / campaign.total_contacts) * 100)
  }

  return (
    <div className="container py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outreach Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage your LinkedIn outreach campaigns
          </p>
        </div>
        <Link href="/outreach/new">
          <Button className="bg-[#fb2e01] hover:bg-[#e02a01]">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Campaigns</CardTitle>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-1">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first outreach campaign to start connecting
              </p>
              <Link href="/outreach/new">
                <Button className="bg-[#fb2e01] hover:bg-[#e02a01]">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>LinkedIn Account</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Connections</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Replies</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        {campaign.name}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {campaign.linkedin_outreach_accounts?.account_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#fb2e01] h-2 rounded-full transition-all"
                              style={{ width: `${calculateProgress(campaign)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {calculateProgress(campaign)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {campaign.connections_sent}/{campaign.total_contacts}
                      </TableCell>
                      <TableCell>{campaign.connections_accepted || 0}</TableCell>
                      <TableCell>{campaign.replies_received || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {campaign.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleControlCampaign(campaign.id, 'start')}
                              disabled={controllingCampaign === campaign.id}
                            >
                              {controllingCampaign === campaign.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {campaign.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleControlCampaign(campaign.id, 'pause')}
                              disabled={controllingCampaign === campaign.id}
                            >
                              {controllingCampaign === campaign.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pause className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {campaign.status === 'paused' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleControlCampaign(campaign.id, 'start')}
                                disabled={controllingCampaign === campaign.id}
                              >
                                {controllingCampaign === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleControlCampaign(campaign.id, 'stop')}
                                disabled={controllingCampaign === campaign.id}
                              >
                                {controllingCampaign === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          <Link href={`/outreach/${campaign.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {campaign.status !== 'completed' && (
                            <Link href={`/outreach/${campaign.id}/edit`}>
                              <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {(campaign.status === 'draft' || campaign.status === 'stopped') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteCampaignId(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={(open) => !open && setDeleteCampaignId(null)}>
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
    </div>
  )
}
