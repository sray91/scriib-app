'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Workflow, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function PipelineAssignment({ contactId, contactName }) {
  const [pipelines, setPipelines] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const { toast } = useToast()

  // Fetch pipelines and current assignments
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch pipelines
      const pipelinesResponse = await fetch('/api/pipelines')
      const pipelinesData = await pipelinesResponse.json()

      if (!pipelinesResponse.ok) {
        throw new Error(pipelinesData.error || 'Failed to fetch pipelines')
      }

      setPipelines(pipelinesData.pipelines || [])

      // Fetch current assignments for this contact
      const assignmentsResponse = await fetch(`/api/pipelines/contacts?contact_id=${contactId}`)
      const assignmentsData = await assignmentsResponse.json()

      if (!assignmentsResponse.ok) {
        throw new Error(assignmentsData.error || 'Failed to fetch assignments')
      }

      setAssignments(assignmentsData.pipeline_contacts || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pipeline data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, contactId])

  // Add contact to pipeline stage
  const handleAddToPipeline = async () => {
    if (!selectedPipeline || !selectedStage) {
      toast({
        title: 'Error',
        description: 'Please select both a pipeline and a stage',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pipelines/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: selectedPipeline,
          stage_id: selectedStage,
          contact_id: contactId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add contact to pipeline')
      }

      toast({
        title: 'Success',
        description: data.updated
          ? 'Contact moved to new stage'
          : 'Contact added to pipeline'
      })

      // Reset selections
      setSelectedPipeline('')
      setSelectedStage('')

      // Refresh assignments
      fetchData()
    } catch (error) {
      console.error('Error adding to pipeline:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add contact to pipeline',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Remove contact from pipeline
  const handleRemoveFromPipeline = async (assignmentId) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/pipelines/contacts?id=${assignmentId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove contact from pipeline')
      }

      toast({
        title: 'Success',
        description: 'Contact removed from pipeline'
      })

      // Refresh assignments
      fetchData()
    } catch (error) {
      console.error('Error removing from pipeline:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove contact from pipeline',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  // Get stages for selected pipeline
  const selectedPipelineData = pipelines.find(p => p.id === selectedPipeline)
  const availableStages = selectedPipelineData?.pipeline_stages || []

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Workflow className="h-4 w-4" />
          {assignments.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
              {assignments.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Pipeline Assignment</h4>
            <p className="text-xs text-muted-foreground">
              Assign {contactName || 'this contact'} to pipeline stages
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Current Assignments */}
              {assignments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Current Assignments</Label>
                  {assignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-2 border rounded-md text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {assignment.pipelines?.name || 'Unknown Pipeline'}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: assignment.pipeline_stages?.color || '#3b82f6' }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {assignment.pipeline_stages?.name || 'Unknown Stage'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromPipeline(assignment.id)}
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Pipeline */}
              {pipelines.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-xs">Add to Pipeline</Label>

                  <div className="space-y-2">
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map(pipeline => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedPipeline && (
                      <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStages.length > 0 ? (
                            availableStages.map(stage => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  {stage.name}
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                              No stages in this pipeline
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {selectedPipeline && selectedStage && (
                      <Button
                        onClick={handleAddToPipeline}
                        disabled={saving}
                        className="w-full"
                        size="sm"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add to Pipeline'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    No pipelines created yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create a pipeline using the Pipeline Builder
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
