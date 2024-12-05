"use client"

import { useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock } from 'lucide-react'

// This would come from your database in a real app
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
        { id: "2", text: "Post 3 value tweets (personal opinions, experiences)", completed: true },
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
        { id: "7", text: "Post 3 value tweets (what, why, how of niche topics)", completed: true },
      ],
    },
  ],
}

export default function TaskList() {
  const [checklist, setChecklist] = useState(initialChecklist)

  const totalTasks = checklist.timeBlocks.reduce((acc, block) => acc + block.tasks.length, 0)
  const completedTasks = checklist.timeBlocks.reduce(
    (acc, block) => acc + block.tasks.filter(task => task.completed).length,
    0
  )
  const progress = (completedTasks / totalTasks) * 100

  const handleTaskToggle = (blockId, taskId) => {
    setChecklist(prevChecklist => ({
      ...prevChecklist,
      timeBlocks: prevChecklist.timeBlocks.map(block => 
        block.id === blockId
          ? {
              ...block,
              tasks: block.tasks.map(task =>
                task.id === taskId
                  ? { ...task, completed: !task.completed }
                  : task
              )
            }
          : block
      )
    }))
  }

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{checklist.day}&apos;s Checklist</h1>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{completedTasks} of {totalTasks} tasks completed</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
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
                    <div key={task.id} className="flex items-start space-x-3">
                      <Checkbox 
                        id={task.id} 
                        checked={task.completed}
                        onCheckedChange={() => handleTaskToggle(block.id, task.id)}
                      />
                      <label
                        htmlFor={task.id}
                        className={`text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                          task.completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.text}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}