'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Save, X, FileText, File, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'

const GUIDE_TYPES = [
  { value: 'content_creation', label: 'Content Creation' },
  { value: 'voice_analysis', label: 'Voice Analysis' },
  { value: 'brand_guidelines', label: 'Brand Guidelines' },
  { value: 'custom', label: 'Custom' },
]

export default function ContextDocManager({ user }) {
  const [guides, setGuides] = useState([])
  const [trainingDocs, setTrainingDocs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingGuide, setEditingGuide] = useState(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [expandedGuides, setExpandedGuides] = useState({})
  const { toast } = useToast()

  // Form state for creating new guide
  const [newGuide, setNewGuide] = useState({
    title: '',
    content: '',
    guide_type: 'custom',
  })

  useEffect(() => {
    if (user?.supabaseId) {
      fetchContextDocs()
    }
  }, [user?.supabaseId])

  const fetchContextDocs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/context-docs?user_id=${user.supabaseId}`)
      const data = await response.json()

      if (data.success) {
        setGuides(data.data.guides || [])
        setTrainingDocs(data.data.trainingDocs || [])
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch context docs',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching context docs:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch context docs',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createGuide = async () => {
    if (!newGuide.title.trim() || !newGuide.content.trim()) {
      toast({
        title: 'Error',
        description: 'Title and content are required',
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/admin/context-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.supabaseId,
          ...newGuide,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Context guide created',
        })
        setNewGuide({ title: '', content: '', guide_type: 'custom' })
        setIsCreateDialogOpen(false)
        fetchContextDocs()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create guide',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating guide:', error)
      toast({
        title: 'Error',
        description: 'Failed to create guide',
        variant: 'destructive',
      })
    }
  }

  const updateGuide = async (guide) => {
    try {
      const response = await fetch('/api/admin/context-docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          title: guide.title,
          content: guide.content,
          guide_type: guide.guide_type,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Context guide updated',
        })
        setEditingGuide(null)
        fetchContextDocs()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update guide',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating guide:', error)
      toast({
        title: 'Error',
        description: 'Failed to update guide',
        variant: 'destructive',
      })
    }
  }

  const deleteGuide = async (guideId) => {
    try {
      const response = await fetch(`/api/admin/context-docs?id=${guideId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Context guide deleted',
        })
        fetchContextDocs()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete guide',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting guide:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete guide',
        variant: 'destructive',
      })
    }
  }

  const toggleGuideExpansion = (guideId) => {
    setExpandedGuides(prev => ({
      ...prev,
      [guideId]: !prev[guideId],
    }))
  }

  const getGuideTypeLabel = (type) => {
    return GUIDE_TYPES.find(t => t.value === type)?.label || type
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="text-center text-gray-400 py-8">Loading context documents...</div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Create New Button */}
      <div className="mb-4">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#fb2e01] hover:bg-[#e02a01] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Context Guide
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1C1F26] border-[#2A2F3C] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Create Context Guide</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new context guide for {user.fullName || 'this user'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-white">Title</Label>
                <Input
                  value={newGuide.title}
                  onChange={(e) => setNewGuide(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter guide title..."
                  className="bg-[#0F1117] border-[#2A2F3C] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Type</Label>
                <Select
                  value={newGuide.guide_type}
                  onValueChange={(value) => setNewGuide(prev => ({ ...prev, guide_type: value }))}
                >
                  <SelectTrigger className="bg-[#0F1117] border-[#2A2F3C] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1F26] border-[#2A2F3C]">
                    {GUIDE_TYPES.map(type => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="text-white hover:bg-[#2A2F3C]"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Content</Label>
                <Textarea
                  value={newGuide.content}
                  onChange={(e) => setNewGuide(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter guide content..."
                  rows={8}
                  className="bg-[#0F1117] border-[#2A2F3C] text-white resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                className="bg-[#2A2F3C] text-white border-[#2A2F3C] hover:bg-[#3A3F4C]"
              >
                Cancel
              </Button>
              <Button
                onClick={createGuide}
                className="bg-[#fb2e01] hover:bg-[#e02a01] text-white"
              >
                Create Guide
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Context Guides Section */}
      <div className="flex-1 overflow-hidden">
        <h3 className="text-sm font-medium text-gray-400 mb-2 px-1">
          Context Guides ({guides.length})
        </h3>
        <ScrollArea className="h-[calc(100%-8rem)]">
          {guides.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No context guides</p>
            </div>
          ) : (
            <div className="space-y-2">
              {guides.map(guide => (
                <Card key={guide.id} className="bg-[#1C1F26] border-[#2A2F3C]">
                  <CardContent className="p-4">
                    {editingGuide?.id === guide.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <Input
                          value={editingGuide.title}
                          onChange={(e) => setEditingGuide(prev => ({ ...prev, title: e.target.value }))}
                          className="bg-[#0F1117] border-[#2A2F3C] text-white"
                        />
                        <Select
                          value={editingGuide.guide_type}
                          onValueChange={(value) => setEditingGuide(prev => ({ ...prev, guide_type: value }))}
                        >
                          <SelectTrigger className="bg-[#0F1117] border-[#2A2F3C] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1C1F26] border-[#2A2F3C]">
                            {GUIDE_TYPES.map(type => (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                className="text-white hover:bg-[#2A2F3C]"
                              >
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={editingGuide.content}
                          onChange={(e) => setEditingGuide(prev => ({ ...prev, content: e.target.value }))}
                          rows={6}
                          className="bg-[#0F1117] border-[#2A2F3C] text-white resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateGuide(editingGuide)}
                            className="bg-[#fb2e01] hover:bg-[#e02a01] text-white"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingGuide(null)}
                            className="bg-[#2A2F3C] text-white border-[#2A2F3C] hover:bg-[#3A3F4C]"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-white font-medium">{guide.title}</h4>
                              <Badge variant="outline" className="text-xs border-[#2A2F3C] text-gray-400">
                                {getGuideTypeLabel(guide.guide_type)}
                              </Badge>
                              {!guide.is_active && (
                                <Badge variant="outline" className="text-xs border-red-500 text-red-500">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {guide.word_count || 0} words • Updated {formatDate(guide.updated_at)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleGuideExpansion(guide.id)}
                              className="text-gray-400 hover:text-white hover:bg-[#2A2F3C]"
                            >
                              {expandedGuides[guide.id] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingGuide({ ...guide })}
                              className="text-gray-400 hover:text-white hover:bg-[#2A2F3C]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-[#1C1F26] border-[#2A2F3C]">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">
                                    Delete Context Guide
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-gray-400">
                                    Are you sure you want to delete &ldquo;{guide.title}&rdquo;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-[#2A2F3C] text-white border-[#2A2F3C] hover:bg-[#3A3F4C]">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteGuide(guide.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {expandedGuides[guide.id] && (
                          <div className="mt-3 p-3 bg-[#0F1117] rounded border border-[#2A2F3C]">
                            <p className="text-gray-300 text-sm whitespace-pre-wrap">
                              {guide.content}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Training Documents Section (read-only) */}
      <div className="mt-4 pt-4 border-t border-[#2A2F3C]">
        <h3 className="text-sm font-medium text-gray-400 mb-2 px-1">
          Training Documents ({trainingDocs.length})
        </h3>
        {trainingDocs.length === 0 ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            No training documents
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {trainingDocs.map(doc => (
              <Card key={doc.id} className="bg-[#1C1F26] border-[#2A2F3C]">
                <CardContent className="p-3 flex items-center gap-3">
                  <File className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{doc.file_name}</p>
                    <p className="text-gray-500 text-xs">
                      {doc.file_type?.toUpperCase()} • {(doc.file_size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      doc.processing_status === 'completed'
                        ? 'border-green-500 text-green-500'
                        : doc.processing_status === 'failed'
                        ? 'border-red-500 text-red-500'
                        : 'border-yellow-500 text-yellow-500'
                    }`}
                  >
                    {doc.processing_status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
