'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Send, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function AddToCampaignModal({ isOpen, onClose, selectedContactIds, onSuccess }) {
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  // Fetch campaigns when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCampaigns()
    }
  }, [isOpen])

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/outreach/campaigns')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaigns')
      }

      // Only show draft and active campaigns
      const availableCampaigns = (data.campaigns || []).filter(
        c => c.status === 'draft' || c.status === 'active'
      )
      setCampaigns(availableCampaigns)

      // Pre-select first campaign if available
      if (availableCampaigns.length > 0) {
        setSelectedCampaignId(availableCampaigns[0].id)
      }
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
  }

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId) {
      toast({
        title: 'Error',
        description: 'Please select a campaign',
        variant: 'destructive'
      })
      return
    }

    if (!selectedContactIds || selectedContactIds.length === 0) {
      toast({
        title: 'Error',
        description: 'No contacts selected',
        variant: 'destructive'
      })
      return
    }

    setAdding(true)

    try {
      const response = await fetch(`/api/outreach/campaigns/${selectedCampaignId}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_ids: selectedContactIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add contacts to campaign')
      }

      toast({
        title: 'Success',
        description: `Added ${data.added_count} contact${data.added_count !== 1 ? 's' : ''} to campaign`,
      })

      // Reset and close
      setSelectedCampaignId('')
      onClose()

      // Callback to parent
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error adding contacts to campaign:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add contacts to campaign',
        variant: 'destructive'
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Campaign</DialogTitle>
          <DialogDescription>
            Select a campaign to add {selectedContactIds?.length || 0} contact{selectedContactIds?.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No campaigns available. Create a campaign first.
            </p>
            <Link href="/outreach/new">
              <Button className="bg-[#fb2e01] hover:bg-[#e02a01]">
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">Select Campaign</Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger id="campaign">
                  <SelectValue placeholder="Choose a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({campaign.total_contacts} contacts)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only draft and active campaigns can receive new contacts
              </p>
            </div>

            {selectedCampaignId && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-medium mb-1">Selected Campaign</p>
                <p className="text-sm text-muted-foreground">
                  {campaigns.find(c => c.id === selectedCampaignId)?.description || 'No description'}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {campaigns.length > 0 && (
            <Button
              onClick={handleAddToCampaign}
              disabled={!selectedCampaignId || adding}
              className="bg-[#fb2e01] hover:bg-[#e02a01]"
            >
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Add to Campaign
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
