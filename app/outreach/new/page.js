'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ArrowLeft, Linkedin, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [linkedinAccountId, setLinkedinAccountId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [followUpMessage, setFollowUpMessage] = useState('')
  const [followUpDelayDays, setFollowUpDelayDays] = useState(3)
  const [dailyConnectionLimit, setDailyConnectionLimit] = useState(20)

  // Data state
  const [linkedinAccounts, setLinkedinAccounts] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch LinkedIn accounts and pipelines
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch LinkedIn accounts
        const accountsResponse = await fetch('/api/outreach/accounts')
        const accountsData = await accountsResponse.json()

        if (accountsResponse.ok) {
          // Only show active accounts
          const activeAccounts = (accountsData.accounts || []).filter(acc => acc.is_active)
          setLinkedinAccounts(activeAccounts)

          // Pre-select first account if available
          if (activeAccounts.length > 0) {
            setLinkedinAccountId(activeAccounts[0].id)
            setDailyConnectionLimit(activeAccounts[0].daily_connection_limit || 20)
          }
        }

        // Fetch pipelines
        const pipelinesResponse = await fetch('/api/pipelines')
        const pipelinesData = await pipelinesResponse.json()

        if (pipelinesResponse.ok) {
          setPipelines(pipelinesData.pipelines || [])
        }

      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load form data',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  // Handle account selection change
  const handleAccountChange = (accountId) => {
    setLinkedinAccountId(accountId)
    const account = linkedinAccounts.find(acc => acc.id === accountId)
    if (account) {
      setDailyConnectionLimit(account.daily_connection_limit || 20)
    }
  }

  // Insert variable at cursor position
  const insertVariable = (textarea, variable, setValue) => {
    const cursorPos = textarea.selectionStart
    const textBefore = textarea.value.substring(0, cursorPos)
    const textAfter = textarea.value.substring(cursorPos)
    const newValue = textBefore + variable + textAfter
    setValue(newValue)

    // Set cursor position after variable
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = cursorPos + variable.length
      textarea.focus()
    }, 0)
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a campaign name',
        variant: 'destructive'
      })
      return
    }

    if (!linkedinAccountId) {
      toast({
        title: 'Error',
        description: 'Please select a LinkedIn account',
        variant: 'destructive'
      })
      return
    }

    if (!connectionMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a connection message',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          linkedin_outreach_account_id: linkedinAccountId,
          pipeline_id: pipelineId || null,
          connection_message: connectionMessage.trim(),
          follow_up_message: followUpMessage.trim() || '',
          follow_up_delay_days: followUpDelayDays,
          daily_connection_limit: dailyConnectionLimit,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign')
      }

      toast({
        title: 'Success',
        description: 'Campaign created successfully',
      })

      // Redirect to campaigns list
      router.push('/outreach')

    } catch (error) {
      console.error('Error creating campaign:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create campaign',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Check if user has LinkedIn accounts
  if (linkedinAccounts.length === 0) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/outreach">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Button>
          </Link>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No LinkedIn Accounts</AlertTitle>
          <AlertDescription>
            You need to connect a LinkedIn account before creating campaigns.
            <div className="mt-4">
              <Link href="/outreach/accounts">
                <Button className="bg-[#fb2e01] hover:bg-[#e02a01]">
                  <Linkedin className="mr-2 h-4 w-4" />
                  Connect LinkedIn Account
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/outreach">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
        <p className="text-muted-foreground mt-1">
          Set up a new LinkedIn outreach campaign
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Campaign name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 Outbound to SaaS Founders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description of this campaign..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account & Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account & Settings</CardTitle>
              <CardDescription>LinkedIn account and campaign settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedin-account">LinkedIn Account *</Label>
                <Select value={linkedinAccountId} onValueChange={handleAccountChange}>
                  <SelectTrigger id="linkedin-account">
                    <SelectValue placeholder="Select LinkedIn account" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkedinAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_name} ({account.profile_name || account.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pipeline">Pipeline (Optional)</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger id="pipeline">
                    <SelectValue placeholder="No pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No pipeline</SelectItem>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Contacts will be automatically added to this pipeline
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Connection Limit</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  min="1"
                  max="100"
                  value={dailyConnectionLimit}
                  onChange={(e) => setDailyConnectionLimit(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum connection requests to send per day (recommended: 20)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Connection Message */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Request Message *</CardTitle>
              <CardDescription>
                Message sent with connection requests. Use variables to personalize.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connection-message">Message</Label>
                <Textarea
                  id="connection-message"
                  placeholder="Hi {name}, I noticed..."
                  value={connectionMessage}
                  onChange={(e) => setConnectionMessage(e.target.value)}
                  rows={5}
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('connection-message')
                      insertVariable(textarea, '{name}', setConnectionMessage)
                    }}
                  >
                    + Name
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('connection-message')
                      insertVariable(textarea, '{first_name}', setConnectionMessage)
                    }}
                  >
                    + First Name
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('connection-message')
                      insertVariable(textarea, '{company}', setConnectionMessage)
                    }}
                  >
                    + Company
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('connection-message')
                      insertVariable(textarea, '{job_title}', setConnectionMessage)
                    }}
                  >
                    + Job Title
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Message */}
          <Card>
            <CardHeader>
              <CardTitle>Follow-up Message</CardTitle>
              <CardDescription>
                Message sent after connection is accepted (optional but recommended)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="follow-up-delay">Days to Wait Before Follow-up</Label>
                <Input
                  id="follow-up-delay"
                  type="number"
                  min="1"
                  max="30"
                  value={followUpDelayDays}
                  onChange={(e) => setFollowUpDelayDays(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Wait this many days after connection is accepted before sending follow-up
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow-up-message">Message</Label>
                <Textarea
                  id="follow-up-message"
                  placeholder="Thanks for connecting, {first_name}! I wanted to..."
                  value={followUpMessage}
                  onChange={(e) => setFollowUpMessage(e.target.value)}
                  rows={5}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('follow-up-message')
                      insertVariable(textarea, '{name}', setFollowUpMessage)
                    }}
                  >
                    + Name
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('follow-up-message')
                      insertVariable(textarea, '{first_name}', setFollowUpMessage)
                    }}
                  >
                    + First Name
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('follow-up-message')
                      insertVariable(textarea, '{company}', setFollowUpMessage)
                    }}
                  >
                    + Company
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const textarea = document.getElementById('follow-up-message')
                      insertVariable(textarea, '{job_title}', setFollowUpMessage)
                    }}
                  >
                    + Job Title
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/outreach">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#fb2e01] hover:bg-[#e02a01]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Campaign...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
