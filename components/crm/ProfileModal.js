'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Linkedin, Sparkles, Plus, Trash2, Edit2, Save, X, Clock, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AddToCampaignModal from './AddToCampaignModal'

export default function ProfileModal({ contact, isOpen, onClose, onProfileEnriched }) {
  const [enriching, setEnriching] = useState(false)
  const [notes, setNotes] = useState([])
  const [activities, setActivities] = useState([])
  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [isAddToCampaignModalOpen, setIsAddToCampaignModalOpen] = useState(false)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [editedContact, setEditedContact] = useState({})
  const [savingContact, setSavingContact] = useState(false)
  const { toast } = useToast()

  // Fetch notes and activities when modal opens or contact changes
  useEffect(() => {
    if (contact && isOpen) {
      fetchNotes()
      fetchActivities()
    }
  }, [contact, isOpen])

  const fetchNotes = async () => {
    if (!contact) return
    setLoadingNotes(true)
    try {
      const response = await fetch(`/api/crm/notes?contactId=${contact.id}`)
      const data = await response.json()
      if (response.ok) {
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  const fetchActivities = async () => {
    if (!contact) return
    setLoadingActivities(true)
    try {
      const response = await fetch(`/api/crm/activities?contactId=${contact.id}`)
      const data = await response.json()
      if (response.ok) {
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          note: newNote
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add note')
      }

      setNotes([data.note, ...notes])
      setNewNote('')
      toast({
        title: 'Success!',
        description: 'Note added successfully',
      })
      // Refresh activities to show the note_added activity
      fetchActivities()
    } catch (error) {
      console.error('Error adding note:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add note',
        variant: 'destructive'
      })
    } finally {
      setSavingNote(false)
    }
  }

  const handleUpdateNote = async (noteId) => {
    if (!editingNoteText.trim()) return
    setSavingNote(true)
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId,
          note: editingNoteText
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update note')
      }

      setNotes(notes.map(n => n.id === noteId ? data.note : n))
      setEditingNoteId(null)
      setEditingNoteText('')
      toast({
        title: 'Success!',
        description: 'Note updated successfully',
      })
    } catch (error) {
      console.error('Error updating note:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update note',
        variant: 'destructive'
      })
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    try {
      const response = await fetch(`/api/crm/notes?noteId=${noteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete note')
      }

      setNotes(notes.filter(n => n.id !== noteId))
      toast({
        title: 'Success!',
        description: 'Note deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting note:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete note',
        variant: 'destructive'
      })
    }
  }

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

  const handleEditContact = () => {
    setIsEditingContact(true)
    setEditedContact({
      name: contact.name || '',
      subtitle: contact.subtitle || '',
      job_title: contact.job_title || '',
      company: contact.company || '',
      email: contact.email || '',
      profile_url: contact.profile_url || '',
      engagement_type: contact.engagement_type || '',
      post_url: contact.post_url || '',
    })
  }

  const handleCancelEdit = () => {
    setIsEditingContact(false)
    setEditedContact({})
  }

  const handleSaveContact = async () => {
    setSavingContact(true)
    try {
      const response = await fetch('/api/crm/contacts/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          ...editedContact
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contact')
      }

      toast({
        title: 'Success!',
        description: 'Contact updated successfully',
      })

      setIsEditingContact(false)

      // Notify parent to refresh the contact data
      if (onProfileEnriched) {
        onProfileEnriched(data.contact)
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update contact',
        variant: 'destructive'
      })
    } finally {
      setSavingContact(false)
    }
  }

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'post_liked':
      case 'post_commented':
        return '👍'
      case 'added_to_pipeline':
        return '📊'
      case 'stage_changed':
        return '🔄'
      case 'note_added':
        return '📝'
      default:
        return '•'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

    return date.toLocaleDateString()
  }

  if (!contact) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
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
            Contact details, notes, and activity history
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Contact Info</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="history">Activity History ({activities.length})</TabsTrigger>
          </TabsList>

          {/* Contact Information Tab */}
          <TabsContent value="info" className="space-y-6 py-4">
            {/* Edit/Save buttons */}
            <div className="flex justify-end gap-2">
              {isEditingContact ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={savingContact}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveContact}
                    disabled={savingContact}
                  >
                    {savingContact ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditContact}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Contact
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                {isEditingContact ? (
                  <Input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="mt-1"
                    placeholder="Enter name"
                  />
                ) : (
                  <p className="text-base mt-1">{contact.name || 'Not available'}</p>
                )}
              </div>

              {/* Subtitle */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subtitle</label>
                {isEditingContact ? (
                  <Input
                    value={editedContact.subtitle}
                    onChange={(e) => setEditedContact({ ...editedContact, subtitle: e.target.value })}
                    className="mt-1"
                    placeholder="Enter subtitle"
                  />
                ) : (
                  <p className="text-base mt-1">{contact.subtitle || 'Not available'}</p>
                )}
              </div>

              {/* Job Title and Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Job Title</label>
                  {isEditingContact ? (
                    <Input
                      value={editedContact.job_title}
                      onChange={(e) => setEditedContact({ ...editedContact, job_title: e.target.value })}
                      className="mt-1"
                      placeholder="Enter job title"
                    />
                  ) : (
                    <p className="text-base mt-1">{contact.job_title || 'Not available'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Company</label>
                  {isEditingContact ? (
                    <Input
                      value={editedContact.company}
                      onChange={(e) => setEditedContact({ ...editedContact, company: e.target.value })}
                      className="mt-1"
                      placeholder="Enter company"
                    />
                  ) : (
                    <p className="text-base mt-1">{contact.company || 'Not available'}</p>
                  )}
                </div>
              </div>

              {/* Email and Profile URL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  {isEditingContact ? (
                    <Input
                      type="email"
                      value={editedContact.email}
                      onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                      className="mt-1"
                      placeholder="Enter email"
                    />
                  ) : (
                    <p className="text-base mt-1">{contact.email || 'Not available'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Profile URL</label>
                  {isEditingContact ? (
                    <Input
                      value={editedContact.profile_url}
                      onChange={(e) => setEditedContact({ ...editedContact, profile_url: e.target.value })}
                      className="mt-1"
                      placeholder="Enter LinkedIn URL"
                    />
                  ) : (
                    <p className="text-base mt-1">
                      {contact.profile_url ? (
                        <a
                          href={contact.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate block"
                        >
                          {contact.profile_url}
                        </a>
                      ) : (
                        'Not available'
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Engagement Type and Scraped At */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Engagement Type</label>
                  {isEditingContact ? (
                    <Input
                      value={editedContact.engagement_type}
                      onChange={(e) => setEditedContact({ ...editedContact, engagement_type: e.target.value })}
                      className="mt-1"
                      placeholder="like, comment, etc."
                    />
                  ) : (
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
                  )}
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

              {/* Post URL */}
              {(contact.post_url || isEditingContact) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source Post</label>
                  {isEditingContact ? (
                    <Input
                      value={editedContact.post_url || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, post_url: e.target.value })}
                      className="mt-1"
                      placeholder="Enter post URL"
                    />
                  ) : (
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
                  )}
                </div>
              )}
            </div>

            {/* Enrich Profile Button */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleEnrich}
                  disabled={enriching || isEditingContact}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                <p className="text-xs text-muted-foreground text-center">
                  Fetch detailed job title and company information from LinkedIn
                </p>
              </div>

              {/* Add to Campaign Button */}
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={() => setIsAddToCampaignModalOpen(true)}
                  disabled={isEditingContact}
                  className="bg-[#fb2e01] hover:bg-[#e02a01]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Add to Campaign
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Add this contact to an outreach campaign
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 py-4">
            {/* Add Note Form */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add a note</label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Enter your note here..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                size="sm"
              >
                {savingNote ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Note
                  </>
                )}
              </Button>
            </div>

            {/* Notes List */}
            <div className="border-t pt-4">
              <ScrollArea className="h-[400px] pr-4">
                {loadingNotes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No notes yet</p>
                    <p className="text-sm mt-1">Add your first note above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="border rounded-lg p-4 space-y-2">
                        {editingNoteId === note.id ? (
                          <>
                            <Textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateNote(note.id)}
                                disabled={savingNote}
                              >
                                {savingNote ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNoteId(null)
                                  setEditingNoteText('')
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(note.created_at)}
                                {note.updated_at !== note.created_at && ' (edited)'}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingNoteId(note.id)
                                    setEditingNoteText(note.note)
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteNote(note.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Activity History Tab */}
          <TabsContent value="history" className="py-4">
            <ScrollArea className="h-[500px] pr-4">
              {loadingActivities ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No activity history yet</p>
                  <p className="text-sm mt-1">Activity will appear here as you interact with this contact</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 pb-4 border-b last:border-0">
                      <div className="text-2xl">{getActivityIcon(activity.activity_type)}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {activity.metadata.pipeline_name && (
                              <span>Pipeline: {activity.metadata.pipeline_name}</span>
                            )}
                            {activity.metadata.stage_name && (
                              <span> • Stage: {activity.metadata.stage_name}</span>
                            )}
                            {activity.metadata.old_stage && activity.metadata.new_stage && (
                              <span>
                                {activity.metadata.old_stage} → {activity.metadata.new_stage}
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground block mt-1">
                          {formatDate(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Add to Campaign Modal */}
        <AddToCampaignModal
          isOpen={isAddToCampaignModalOpen}
          onClose={() => setIsAddToCampaignModalOpen(false)}
          selectedContactIds={contact ? [contact.id] : []}
          onSuccess={() => {
            setIsAddToCampaignModalOpen(false)
            toast({
              title: 'Success',
              description: 'Contact added to campaign',
            })
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
