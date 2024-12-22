'use client';

import { useState, useEffect } from "react"
import Link from 'next/link'
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Clock, Edit } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from "@/components/ui/use-toast"

export default function TaskList() {
  const [template, setTemplate] = useState(null);
  const [progress, setProgress] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const getCurrentDay = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    return days[today.getDay()];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  useEffect(() => {
    const loadTemplateAndProgress = async () => {
      try {
        setIsLoading(true);
        const today = getTodayDate();
        const currentDay = getCurrentDay();

        // Load template
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

        if (!blocks?.length) {
          setTemplate(null);
          return;
        }

        // Load today's progress
        const { data: progressData, error: progressError } = await supabase
          .from('daily_progress')
          .select('percentage_complete')
          .eq('date', today)
          .eq('day', currentDay)
          .single();

        if (progressError && progressError.code !== 'PGRST116') throw progressError;

        const savedProgress = progressData?.percentage_complete || 0;
        setProgress(savedProgress);

        // Calculate how many tasks should be marked complete based on percentage
        const totalTasks = blocks.reduce((acc, block) => acc + block.user_tasks.length, 0);
        const tasksToComplete = Math.round((savedProgress / 100) * totalTasks);
        
        // Mark tasks as complete up to the calculated number
        const completedTasksSet = new Set();
        let completedCount = 0;
        
        for (const block of blocks) {
          for (const task of block.user_tasks) {
            if (completedCount < tasksToComplete) {
              completedTasksSet.add(task.id);
              completedCount++;
            } else {
              break;
            }
          }
        }
        
        setCompletedTasks(completedTasksSet);

        setTemplate({ timeBlocks: blocks.map(block => ({
          id: block.id,
          title: block.title,
          description: block.description,
          startTime: block.start_time,
          endTime: block.end_time,
          tasks: block.user_tasks.map(task => ({
            id: task.id,
            text: task.text,
            completed: completedTasksSet.has(task.id)
          }))
        }))});

      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load tasks. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplateAndProgress();
  }, [supabase, toast]);

  const updateProgress = async (newCompletedTasks) => {
    const currentDay = getCurrentDay();
    const today = getTodayDate();
    const totalTasks = template.timeBlocks.reduce((acc, block) => acc + block.tasks.length, 0);
    const newProgress = Math.round((newCompletedTasks.size / totalTasks) * 100);

    try {
      const { error } = await supabase
        .from('daily_progress')
        .upsert({
          date: today,
          day: currentDay,
          percentage_complete: newProgress
        }, {
          onConflict: 'date,day'
        });

      if (error) throw error;
      setProgress(newProgress);
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTaskToggle = async (taskId, completed) => {
    const newCompletedTasks = new Set(completedTasks);
    if (completed) {
      newCompletedTasks.add(taskId);
    } else {
      newCompletedTasks.delete(taskId);
    }
    
    setCompletedTasks(newCompletedTasks);
    
    setTemplate(prev => ({
      ...prev,
      timeBlocks: prev.timeBlocks.map(block => ({
        ...block,
        tasks: block.tasks.map(task =>
          task.id === taskId
            ? { ...task, completed }
            : task
        )
      }))
    }));

    await updateProgress(newCompletedTasks);
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center">
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (!template || !template.timeBlocks?.length) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center">
          <p className="mb-4 text-lg">No template found for {getCurrentDay()}</p>
          <Link href="/tasks/builder">
            <Button className="bg-[#FF4400] hover:bg-[#FF4400]/90">
              Create Template
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalTasks = template.timeBlocks.reduce((acc, block) => acc + block.tasks.length, 0);

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{getCurrentDay()}&apos;s Tasks</h1>
          <Link href="/tasks/builder">
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Template
            </Button>
          </Link>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{completedTasks.size} of {totalTasks} tasks completed ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
      <div className="space-y-6">
        {template.timeBlocks.map((block) => (
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
                        onCheckedChange={(checked) => handleTaskToggle(task.id, checked)}
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
  );
}