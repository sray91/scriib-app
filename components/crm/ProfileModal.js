'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Linkedin, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export default function ProfileModal({ contact, isOpen, onClose, onProfileEnriched }) {
  const [enriching, setEnriching] = useState(false)
  const { toast } = useToast()

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      const response = await fetch('/api/crm/enrich-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          profileUrl: contact.profile_url
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich profile')
      }

      toast({
        title: 'Success!',
        description: 'Profile enriched successfully',
      })

      // Notify parent to refresh the contact data
      if (onProfileEnriched) {
        onProfileEnriched(data.contact)
      }
    } catch (error) {
      console.error('Error enriching profile:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to enrich profile',
        variant: 'destructive'
      })
    } finally {
      setEnriching(false)
    }
  }

  if (!contact) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex-1">
              {contact.name || 'Unknown'}
            </div>
            {contact.profile_url && (
              <a
                href={contact.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="outline" size="sm">
                  <Linkedin className="h-4 w-4 mr-2" />
                  View LinkedIn
                </Button>
              </a>
            )}
          </DialogTitle>
          <DialogDescription>
            Contact details and engagement information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contact Information */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subtitle</label>
              <p className="text-base mt-1">{contact.subtitle || 'Not available'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Job Title</label>
                <p className="text-base mt-1">{contact.job_title || 'Not available'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Company</label>
                <p className="text-base mt-1">{contact.company || 'Not available'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Engagement Type</label>
                <div className="mt-1">
                  <Badge
                    variant={contact.engagement_type === 'like' ? 'default' : 'secondary'}
                    className={
                      contact.engagement_type === 'like'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }
                  >
                    {contact.engagement_type || 'unknown'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Scraped At</label>
                <p className="text-base mt-1">
                  {contact.scraped_at
                    ? new Date(contact.scraped_at).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </div>

            {contact.post_url && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Source Post</label>
                <p className="text-base mt-1">
                  <a
                    href={contact.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View post
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Enrich Profile Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleEnrich}
              disabled={enriching}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {enriching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enriching Profile...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enrich Profile Data
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Fetch detailed job title and company information from LinkedIn
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
