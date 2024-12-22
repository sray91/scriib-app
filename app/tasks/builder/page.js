'use client';

import { useState, useEffect } from "react"
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

export default function ChecklistBuilder() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState("Monday");
  const [timeBlocks, setTimeBlocks] = useState([]);

  // Load existing template for current day
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoading(true);
        const { data: blocks, error: blocksError } = await supabase
          .from('user_time_blocks')
          .select(`
            id,
            title,
            description,
            start_time,
            end_time,
            day,
            user_tasks (
              id,
              text
            )
          `)
          .eq('day', currentDay)
          .order('start_time');

        if (blocksError) throw blocksError;

        setTimeBlocks(blocks?.map(block => ({
          id: block.id,
          title: block.title || '',
          description: block.description || '',
          startTime: block.start_time || '',
          endTime: block.end_time || '',
          tasks: block.user_tasks || []
        })) || []);
      } catch (error) {
        console.error('Error loading template:', error);
        toast({
          title: 'Error',
          description: 'Failed to load template. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [currentDay, supabase, toast]);

  const handleDayChange = (day) => {
    setCurrentDay(day);
  };

  const addTimeBlock = () => {
    setTimeBlocks(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        startTime: "",
        endTime: "",
        tasks: []
      }
    ]);
  };

  const updateTimeBlock = (blockId, field, value) => {
    setTimeBlocks(prev => prev.map(block =>
      block.id === blockId
        ? { ...block, [field]: value }
        : block
    ));
  };

  const removeTimeBlock = (blockId) => {
    setTimeBlocks(prev => prev.filter(block => block.id !== blockId));
  };

  const addTask = (blockId) => {
    setTimeBlocks(prev => prev.map(block =>
      block.id === blockId
        ? {
            ...block,
            tasks: [
              ...block.tasks,
              { id: crypto.randomUUID(), text: "" }
            ]
          }
        : block
    ));
  };

  const updateTask = (blockId, taskId, text) => {
    setTimeBlocks(prev => prev.map(block =>
      block.id === blockId
        ? {
            ...block,
            tasks: block.tasks.map(task =>
              task.id === taskId
                ? { ...task, text }
                : task
            )
          }
        : block
    ));
  };

  const removeTask = (blockId, taskId) => {
    setTimeBlocks(prev => prev.map(block =>
      block.id === blockId
        ? {
            ...block,
            tasks: block.tasks.filter(task => task.id !== taskId)
          }
        : block
    ));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Delete existing template for this day
      await supabase
        .from('user_time_blocks')
        .delete()
        .eq('day', currentDay);

      // Save new template
      for (const block of timeBlocks) {
        const { data: blockData, error: blockError } = await supabase
          .from('user_time_blocks')
          .insert({
            title: block.title,
            description: block.description,
            start_time: block.startTime,
            end_time: block.endTime,
            day: currentDay
          })
          .select()
          .single();

        if (blockError) throw blockError;

        if (block.tasks.length > 0) {
          const tasksToInsert = block.tasks.map(task => ({
            time_block_id: blockData.id,
            text: task.text
          }));

          const { error: tasksError } = await supabase
            .from('user_tasks')
            .insert(tasksToInsert);

          if (tasksError) throw tasksError;
        }
      }

      toast({ title: 'Success', description: 'Template saved successfully!' });
      router.push('/tasks');
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center">
          <p>Loading template...</p>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold">Template Builder</h1>
        </div>
        <div className="space-x-4">
          <Button 
            variant="outline" 
            onClick={addTimeBlock}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Time Block
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#FF4400] hover:bg-[#FF4400]/90"
          >
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
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
        {timeBlocks.map((block) => (
          <Card key={block.id}>
            <CardHeader>
              <div className="space-y-4">
                <Input
                  value={block.title}
                  onChange={(e) => updateTimeBlock(block.id, 'title', e.target.value)}
                  placeholder="Block Title"
                  className="text-lg font-semibold"
                />
                <Input
                  value={block.description}
                  onChange={(e) => updateTimeBlock(block.id, 'description', e.target.value)}
                  placeholder="Block Description"
                  className="text-sm text-muted-foreground"
                />
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <Input
                      value={block.startTime}
                      onChange={(e) => updateTimeBlock(block.id, 'startTime', e.target.value)}
                      placeholder="Start Time"
                      className="w-24"
                    />
                    <span>-</span>
                    <Input
                      value={block.endTime}
                      onChange={(e) => updateTimeBlock(block.id, 'endTime', e.target.value)}
                      placeholder="End Time"
                      className="w-24"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTimeBlock(block.id)}
                    className="ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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