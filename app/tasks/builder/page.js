"use client"

import { useState } from "react"
import Link from 'next/link'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock } from 'lucide-react'

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const initialChecklist = {
  day: "Monday",
  timeBlocks: [
    {
      id: "1",
      startTime: "6am",
      endTime: "12pm",
      title: "TOP OF FUNNEL",
      description: "Personal takes, opinions, stories",
      tasks: [
        { id: "1", text: "Post 1 long-form tweet (personal story)", completed: false },
        { id: "2", text: "Post 3 value tweets (personal opinions, experiences)", completed: false },
        { id: "3", text: "Post 2 image-based tweets (memes, gym, family)", completed: false },
        { id: "4", text: "Spend 30 minutes engaging with audience", completed: false },
      ],
    },
    {
      id: "2",
      startTime: "12pm",
      endTime: "6pm",
      title: "MIDDLE OF FUNNEL",
      description: "General niche advice, problem-solving, how-to's",
      tasks: [
        { id: "5", text: "Post 1 long-form tweet (niche advice or insight)", completed: false },
        { id: "6", text: "Post 1 thread (inspirational brand comparison or how-to)", completed: false },
        { id: "7", text: "Post 3 value tweets (what, why, how of niche topics)", completed: false },
      ],
    },
  ],
}

export default function ChecklistBuilder() {
  const [checklist, setChecklist] = useState(initialChecklist)

  const addTask = (blockId) => {
    setChecklist(prevChecklist => ({
      ...prevChecklist,
      timeBlocks: prevChecklist.timeBlocks.map(block => 
        block.id === blockId
          ? {
              ...block,
              tasks: [
                ...block.tasks,
                { id: Math.random().toString(), text: "", completed: false },
              ],
            }
          : block
      ),
    }))
  }

  const updateTask = (blockId, taskId, text) => {
    setChecklist(prevChecklist => ({
      ...prevChecklist,
      timeBlocks: prevChecklist.timeBlocks.map(block => 
        block.id === blockId
          ? {
              ...block,
              tasks: block.tasks.map(task =>
                task.id === taskId
                  ? { ...task, text }
                  : task
              ),
            }
          : block
      ),
    }))
  }

  const removeTask = (blockId, taskId) => {
    setChecklist(prevChecklist => ({
      ...prevChecklist,
      timeBlocks: prevChecklist.timeBlocks.map(block => 
        block.id === blockId
          ? {
              ...block,
              tasks: block.tasks.filter(task => task.id !== taskId),
            }
          : block
      ),
    }))
  }

  return (
    <div className="container max-w-4xl py-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <Link href="/tasks" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Checklist Builder</h1>
        </div>
      </div>

      <div className="mb-6">
        <Label htmlFor="day">Select Day</Label>
        <Select value={checklist.day} onValueChange={(day) => setChecklist(prev => ({ ...prev, day }))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a day" />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((day) => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {checklist.timeBlocks.map((block) => (
          <Card key={block.id}>
            <CardHeader>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {block.startTime} - {block.endTime}
                </span>
              </div>
              <CardTitle>{block.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{block.description}</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {block.tasks.map((task) => (
                    <div key={task.id} className="flex gap-2">
                      <Input
                        value={task.text}
                        onChange={(e) => updateTask(block.id, task.id, e.target.value)}
                        placeholder="Enter task"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTask(block.id, task.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addTask(block.id)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}