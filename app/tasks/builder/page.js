'use client';

import { useState } from "react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const getInitialTimeBlocks = () => [
  {
    id: crypto.randomUUID(),
    startTime: "6am",
    endTime: "12pm",
    title: "TOP OF FUNNEL",
    description: "Personal takes, opinions, stories",
    tasks: [
      { id: crypto.randomUUID(), text: "Post 1 long-form tweet (personal story)", completed: false },
      { id: crypto.randomUUID(), text: "Post 3 value tweets (personal opinions, experiences)", completed: false },
      { id: crypto.randomUUID(), text: "Post 2 image-based tweets (memes, gym, family)", completed: false },
      { id: crypto.randomUUID(), text: "Spend 30 minutes engaging with audience", completed: false },
    ],
  },
  {
    id: crypto.randomUUID(),
    startTime: "12pm",
    endTime: "4pm",  // Updated time
    title: "MIDDLE OF FUNNEL",
    description: "General niche advice, problem-solving, how-to's",
    tasks: [
      { id: crypto.randomUUID(), text: "Post 1 long-form tweet (niche advice or insight)", completed: false },
      { id: crypto.randomUUID(), text: "Post 1 thread (inspirational brand comparison or how-to)", completed: false },
      { id: crypto.randomUUID(), text: "Post 3 value tweets (what, why, how of niche topics)", completed: false },
    ],
  },
  {
    id: crypto.randomUUID(),
    startTime: "4pm",
    endTime: "12am",
    title: "TOP OF FUNNEL",
    description: "Personal takes, opinions, stories",
    tasks: [
      { id: crypto.randomUUID(), text: "Post 1 long-form tweet (personal story)", completed: false },
      { id: crypto.randomUUID(), text: "Post 3 value tweets (personal opinions, experiences)", completed: false },
      { id: crypto.randomUUID(), text: "Post 2 image-based tweets (memes, gym, family)", completed: false },
      { id: crypto.randomUUID(), text: "Spend 30 minutes engaging with audience", completed: false },
    ],
  },
];

export default function ChecklistBuilder() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentDay, setCurrentDay] = useState("Monday");
  const [checklists, setChecklists] = useState(() => {
    const initial = {};
    DAYS_OF_WEEK.forEach(day => {
      initial[day] = {
        day,
        timeBlocks: getInitialTimeBlocks()
      };
    });
    return initial;
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const checklist = checklists[currentDay];

      // Delete existing checklist for this day first
      const { error: deleteError } = await supabase
        .from('checklists')
        .delete()
        .match({ day: currentDay });

      if (deleteError) throw deleteError;

      // Create new checklist
      const { data: checklistData, error: checklistError } = await supabase
        .from('checklists')
        .insert({ day: currentDay })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create time blocks and their tasks
      for (const block of checklist.timeBlocks) {
        const { data: blockData, error: blockError } = await supabase
          .from('time_blocks')
          .insert({
            checklist_id: checklistData.id,
            title: block.title,
            description: block.description,
            start_time: block.startTime,
            end_time: block.endTime
          })
          .select()
          .single();

        if (blockError) throw blockError;

        if (block.tasks?.length > 0) {
          const tasksToInsert = block.tasks.map(task => ({
            time_block_id: blockData.id,
            text: task.text,
            completed: false
          }));

          const { error: tasksError } = await supabase
            .from('tasks')
            .insert(tasksToInsert);

          if (tasksError) throw tasksError;
        }
      }

      toast({ title: 'Success', description: 'Checklist saved successfully!' });
      router.push('/tasks');
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast({
        title: 'Error',
        description: 'Failed to save checklist. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayChange = (day) => {
    setCurrentDay(day);
  };

  const addTask = (blockId) => {
    setChecklists(prev => ({
      ...prev,
      [currentDay]: {
        ...prev[currentDay],
        timeBlocks: prev[currentDay].timeBlocks.map(block =>
          block.id === blockId
            ? {
                ...block,
                tasks: [
                  ...block.tasks,
                  { id: crypto.randomUUID(), text: "", completed: false },
                ],
              }
            : block
        ),
      }
    }));
  };

  const updateTask = (blockId, taskId, text) => {
    setChecklists(prev => ({
      ...prev,
      [currentDay]: {
        ...prev[currentDay],
        timeBlocks: prev[currentDay].timeBlocks.map(block =>
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
      }
    }));
  };

  const removeTask = (blockId, taskId) => {
    setChecklists(prev => ({
      ...prev,
      [currentDay]: {
        ...prev[currentDay],
        timeBlocks: prev[currentDay].timeBlocks.map(block =>
          block.id === blockId
            ? {
                ...block,
                tasks: block.tasks.filter(task => task.id !== taskId),
              }
            : block
        ),
      }
    }));
  };

  const currentChecklist = checklists[currentDay];

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
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-[#FF4400] hover:bg-[#FF4400]/90"
        >
          {isSaving ? "Saving..." : "Save Checklist"}
        </Button>
      </div>

      <div className="mb-6">
        <Tabs 
          value={currentDay} 
          onValueChange={handleDayChange}
          className="w-full"
        >
          <TabsList className="w-full justify-between">
            {DAYS_OF_WEEK.map((day) => (
              <TabsTrigger 
                key={day} 
                value={day}
                className="flex-1"
              >
                {day}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-6">
        {currentChecklist.timeBlocks.map((block) => (
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addTask(block.id)}
                    className="mt-2"
                  >
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
  );
}