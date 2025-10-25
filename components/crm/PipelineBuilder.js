'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Save,
  X as XIcon,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export default function PipelineBuilder({ isOpen, onClose, onPipelineCreated }) {
  const [pipelines, setPipelines] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedPipelines, setExpandedPipelines] = useState({})
  const [editingPipeline, setEditingPipeline] = useState(null)
  const [deletingPipeline, setDeletingPipeline] = useState(null)
  const [deletingStage, setDeletingStage] = useState(null)
  const [newPipeline, setNewPipeline] = useState({ name: '', description: '' })
  const [newStages, setNewStages] = useState({}) // Map of pipeline_id to array of new stages
  const [editingStages, setEditingStages] = useState({}) // Map of stage_id to edited stage data
  const [showCreatePipeline, setShowCreatePipeline] = useState(false)
  const { toast } = useToast()

  // Fetch pipelines
  const fetchPipelines = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/pipelines')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pipelines')
      }

      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pipelines',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchPipelines()
    }
  }, [isOpen])

  // Create new pipeline
  const handleCreatePipeline = async () => {
    if (!newPipeline.name.trim()) {
      toast({
        title: 'Error',
        description: 'Pipeline name is required',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPipeline)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create pipeline')
      }

      toast({
        title: 'Success',
        description: 'Pipeline created successfully'
      })

      setNewPipeline({ name: '', description: '' })
      setShowCreatePipeline(false)
      fetchPipelines()
      onPipelineCreated?.()
    } catch (error) {
      console.error('Error creating pipeline:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create pipeline',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete pipeline
  const handleDeletePipeline = async () => {
    if (!deletingPipeline) return

    setSaving(true)
    try {
      const response = await fetch(`/api/pipelines?id=${deletingPipeline}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete pipeline')
      }

      toast({
        title: 'Success',
        description: 'Pipeline deleted successfully'
      })

      setDeletingPipeline(null)
      fetchPipelines()
      onPipelineCreated?.()
    } catch (error) {
      console.error('Error deleting pipeline:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete pipeline',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Add stage to pipeline
  const handleAddStage = (pipelineId) => {
    setNewStages(prev => ({
      ...prev,
      [pipelineId]: [
        ...(prev[pipelineId] || []),
        { name: '', color: '#3b82f6', order: (prev[pipelineId]?.length || 0) }
      ]
    }))
  }

  // Update new stage
  const handleUpdateNewStage = (pipelineId, index, field, value) => {
    setNewStages(prev => ({
      ...prev,
      [pipelineId]: prev[pipelineId].map((stage, i) =>
        i === index ? { ...stage, [field]: value } : stage
      )
    }))
  }

  // Remove new stage
  const handleRemoveNewStage = (pipelineId, index) => {
    setNewStages(prev => ({
      ...prev,
      [pipelineId]: prev[pipelineId].filter((_, i) => i !== index)
    }))
  }

  // Save new stages
  const handleSaveNewStages = async (pipelineId) => {
    const stages = newStages[pipelineId] || []

    if (stages.length === 0) return

    // Validate all stages have names
    if (stages.some(s => !s.name.trim())) {
      toast({
        title: 'Error',
        description: 'All stages must have a name',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      // Create all stages
      const promises = stages.map(stage =>
        fetch('/api/pipelines/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipeline_id: pipelineId,
            ...stage
          })
        })
      )

      const responses = await Promise.all(promises)
      const failed = responses.filter(r => !r.ok)

      if (failed.length > 0) {
        throw new Error('Failed to create some stages')
      }

      toast({
        title: 'Success',
        description: `${stages.length} stage(s) added successfully`
      })

      setNewStages(prev => {
        const updated = { ...prev }
        delete updated[pipelineId]
        return updated
      })

      fetchPipelines()
      onPipelineCreated?.()
    } catch (error) {
      console.error('Error creating stages:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create stages',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete stage
  const handleDeleteStage = async () => {
    if (!deletingStage) return

    setSaving(true)
    try {
      const response = await fetch(`/api/pipelines/stages?id=${deletingStage}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete stage')
      }

      toast({
        title: 'Success',
        description: 'Stage deleted successfully'
      })

      setDeletingStage(null)
      fetchPipelines()
      onPipelineCreated?.()
    } catch (error) {
      console.error('Error deleting stage:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete stage',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Toggle pipeline expansion
  const togglePipeline = (pipelineId) => {
    setExpandedPipelines(prev => ({
      ...prev,
      [pipelineId]: !prev[pipelineId]
    }))
  }

  const colorOptions = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Yellow' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' }
  ]

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pipeline Builder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Pipeline Button */}
            {!showCreatePipeline && (
              <Button
                onClick={() => setShowCreatePipeline(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Pipeline
              </Button>
            )}

            {/* Create Pipeline Form */}
            {showCreatePipeline && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create New Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="pipeline-name">Pipeline Name *</Label>
                    <Input
                      id="pipeline-name"
                      value={newPipeline.name}
                      onChange={(e) => setNewPipeline(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Sales Pipeline"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pipeline-description">Description</Label>
                    <Textarea
                      id="pipeline-description"
                      value={newPipeline.description}
                      onChange={(e) => setNewPipeline(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreatePipeline} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Create Pipeline
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreatePipeline(false)
                        setNewPipeline({ name: '', description: '' })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Pipelines List */}
            {!loading && pipelines.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No pipelines yet. Create your first pipeline to get started!</p>
              </div>
            )}

            {!loading && pipelines.map(pipeline => (
              <Card key={pipeline.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePipeline(pipeline.id)}
                      >
                        {expandedPipelines[pipeline.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div>
                        <CardTitle className="text-base">{pipeline.name}</CardTitle>
                        {pipeline.description && (
                          <CardDescription className="text-sm mt-1">
                            {pipeline.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingPipeline(pipeline.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>

                {expandedPipelines[pipeline.id] && (
                  <CardContent className="space-y-3">
                    {/* Existing Stages */}
                    {pipeline.pipeline_stages && pipeline.pipeline_stages.length > 0 && (
                      <div className="space-y-2">
                        <Label>Stages ({pipeline.pipeline_stages.length})</Label>
                        {pipeline.pipeline_stages.map(stage => (
                          <div key={stage.id} className="flex items-center gap-2 p-2 border rounded-md">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="flex-1">{stage.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingStage(stage.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* New Stages Being Added */}
                    {newStages[pipeline.id] && newStages[pipeline.id].length > 0 && (
                      <div className="space-y-2">
                        <Label>New Stages</Label>
                        {newStages[pipeline.id].map((stage, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              placeholder="Stage name"
                              value={stage.name}
                              onChange={(e) => handleUpdateNewStage(pipeline.id, index, 'name', e.target.value)}
                            />
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                              value={stage.color}
                              onChange={(e) => handleUpdateNewStage(pipeline.id, index, 'color', e.target.value)}
                            >
                              {colorOptions.map(color => (
                                <option key={color.value} value={color.value}>
                                  {color.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveNewStage(pipeline.id, index)}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={() => handleSaveNewStages(pipeline.id)}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-3 w-3" />
                              Save Stages
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Add Stage Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddStage(pipeline.id)}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Add Stage
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Pipeline Confirmation */}
      <AlertDialog open={!!deletingPipeline} onOpenChange={(open) => !open && setDeletingPipeline(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pipeline? This will also remove all stages and contact assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePipeline}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Stage Confirmation */}
      <AlertDialog open={!!deletingStage} onOpenChange={(open) => !open && setDeletingStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stage? Any contacts in this stage will be removed from the pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
