'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, UserPlus } from 'lucide-react'
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

export default function AddContactModal({ isOpen, onClose, onContactAdded }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    profile_url: '',
    subtitle: '',
    job_title: '',
    company: '',
    email: '',
    engagement_type: 'like',
    post_url: ''
  })

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.name || !formData.profile_url) {
      toast({
        title: 'Validation Error',
        description: 'Name and LinkedIn Profile URL are required',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add contact')
      }

      toast({
        title: 'Success!',
        description: 'Contact added successfully',
      })

      // Reset form
      setFormData({
        name: '',
        profile_url: '',
        subtitle: '',
        job_title: '',
        company: '',
        email: '',
        engagement_type: 'like',
        post_url: ''
      })

      // Notify parent to refresh the contact data
      if (onContactAdded) {
        onContactAdded(data.contact)
      }

      onClose()
    } catch (error) {
      console.error('Error adding contact:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add contact',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Contact
          </DialogTitle>
          <DialogDescription>
            Manually add a new contact to your CRM
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Required Fields */}
          <div className="space-y-2">
            <Label htmlFor="name" className="required">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile_url" className="required">
              LinkedIn Profile URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile_url"
              type="url"
              value={formData.profile_url}
              onChange={(e) => handleInputChange('profile_url', e.target.value)}
              placeholder="https://www.linkedin.com/in/johndoe"
              required
            />
          </div>

          {/* Optional Fields */}
          <div className="space-y-2">
            <Label htmlFor="subtitle">
              Subtitle/Headline
            </Label>
            <Input
              id="subtitle"
              value={formData.subtitle}
              onChange={(e) => handleInputChange('subtitle', e.target.value)}
              placeholder="CEO at Company | Entrepreneur"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_title">
                Job Title
              </Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) => handleInputChange('job_title', e.target.value)}
                placeholder="Chief Executive Officer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">
                Company
              </Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="engagement_type">
              Engagement Type
            </Label>
            <Select
              value={formData.engagement_type}
              onValueChange={(value) => handleInputChange('engagement_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select engagement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="like">Like</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post_url">
              Source Post URL
            </Label>
            <Input
              id="post_url"
              type="url"
              value={formData.post_url}
              onChange={(e) => handleInputChange('post_url', e.target.value)}
              placeholder="https://www.linkedin.com/posts/..."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
