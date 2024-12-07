'use client';

import { useState, useEffect } from "react"
import { useSession } from '@supabase/auth-helpers-react'
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
  const session = useSession();
  const [checklist, setChecklist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const getCurrentDay = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    return days[today.getDay()];
  };

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        setIsLoading(true);
        const today = getCurrentDay();
        console.log('Loading checklist for:', today);

        const { data, error } = await supabase
          .from('checklists')
          .select(`
            id,
            day,
            time_blocks (
              id,
              title,
              description,
              start_time,
              end_time,
              tasks (
                id,
                text,
                completed
              )
            )
          `)
          .eq('day', today)
          .maybeSingle();

        if (error) {
          if (error.code !== 'PGRST116') {
            throw error;
          }
        }

        if (data) {
          setChecklist({
            day: data.day,
            timeBlocks: data.time_blocks?.map(block => ({
              id: block.id,
              startTime: block.start_time,
              endTime: block.end_time,
              title: block.title,
              description: block.description,
              tasks: block.tasks?.map(task => ({
                id: task.id,
                text: task.text,
                completed: task.completed
              })) || []
            })) || []
          });
        } else {
          setChecklist(null);
        }
      } catch (error) {
        console.error('Error loading checklist:', error);
        toast({
          title: "Error",
          description: "Failed to load checklist. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadChecklist();
  }, [session, supabase, toast]);

  const handleTaskToggle = async (taskId, completed) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', taskId);

      if (error) throw error;

      setChecklist(prevChecklist => {
        if (!prevChecklist?.timeBlocks) return prevChecklist;
        
        return {
          ...prevChecklist,
          timeBlocks: prevChecklist.timeBlocks.map(block => ({
            ...block,
            tasks: block.tasks.map(task =>
              task.id === taskId
                ? { ...task, completed }
                : task
            )
          }))
        };
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center">
          <p>Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center">
          <p className="mb-4 text-lg">No checklist found for today</p>
          <Link href="/tasks/builder">
            <Button className="bg-[#FF4400] hover:bg-[#FF4400]/90">
              Create Checklist
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalTasks = checklist.timeBlocks.reduce((acc, block) => acc + block.tasks.length, 0);
  const completedTasks = checklist.timeBlocks.reduce(
    (acc, block) => acc + block.tasks.filter(task => task.completed).length,
    0
  );
  const progress = (completedTasks / totalTasks) * 100;

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{checklist.day}&apos;s Checklist</h1>
          <Link href="/tasks/builder">
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Checklist
            </Button>
          </Link>
        </div>
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