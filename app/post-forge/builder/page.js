'use client';

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function PostTemplateBuilder() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState("Monday");
  const [postTemplates, setPostTemplates] = useState([]);

  // Load existing template for current day
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoading(true);
        
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error fetching user:', userError);
          throw userError;
        }

        // Load user-specific templates
        const { data: templates, error: templatesError } = await supabase
          .from('user_time_blocks')
          .select(`
            id,
            title,
            description,
            day,
            user_id,
            user_tasks (
              id,
              text
            )
          `)
          .eq('day', currentDay)
          .eq('user_id', user.id)  // Filter by user_id
          .order('created_at');

        if (templatesError) throw templatesError;

        setPostTemplates(templates?.map(template => ({
          id: template.id,
          title: template.title || '',
          description: template.description || '',
          contentIdeas: template.user_tasks || []
        })) || []);
      } catch (error) {
        console.error('Error loading templates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load post templates. Please try again.',
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

  const addPostTemplate = () => {
    setPostTemplates(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        contentIdeas: []
      }
    ]);
  };

  const updatePostTemplate = (templateId, field, value) => {
    setPostTemplates(prev => prev.map(template =>
      template.id === templateId
        ? { ...template, [field]: value }
        : template
    ));
  };

  const removePostTemplate = (templateId) => {
    setPostTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  const addContentIdea = (templateId) => {
    setPostTemplates(prev => prev.map(template =>
      template.id === templateId
        ? {
            ...template,
            contentIdeas: [
              ...template.contentIdeas,
              { id: crypto.randomUUID(), text: "" }
            ]
          }
        : template
    ));
  };

  const updateContentIdea = (templateId, ideaId, text) => {
    setPostTemplates(prev => prev.map(template =>
      template.id === templateId
        ? {
            ...template,
            contentIdeas: template.contentIdeas.map(idea =>
              idea.id === ideaId
                ? { ...idea, text }
                : idea
            )
          }
        : template
    ));
  };

  const removeContentIdea = (templateId, ideaId) => {
    setPostTemplates(prev => prev.map(template =>
      template.id === templateId
        ? {
            ...template,
            contentIdeas: template.contentIdeas.filter(idea => idea.id !== ideaId)
          }
        : template
    ));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Delete existing templates for this day
      await supabase
        .from('user_time_blocks')
        .delete()
        .eq('day', currentDay);

      // Save new templates
      for (const template of postTemplates) {
        const { data: templateData, error: templateError } = await supabase
          .from('user_time_blocks')
          .insert({
            title: template.title,
            description: template.description,
            day: currentDay,
            user_id: user.id
          })
          .select()
          .single();

        if (templateError) throw templateError;

        if (template.contentIdeas.length > 0) {
          const ideasToInsert = template.contentIdeas.map(idea => ({
            time_block_id: templateData.id,
            text: idea.text
          }));

          const { error: ideasError } = await supabase
            .from('user_tasks')
            .insert(ideasToInsert);

          if (ideasError) throw ideasError;
        }
      }

      toast({ title: 'Success', description: 'Post templates saved successfully!' });
      router.push('/post-forge');
    } catch (error) {
      console.error('Error saving templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to save post templates. Please try again.',
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
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <Link href="/post-forge" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Post Template Builder</h1>
        </div>
        <div className="space-x-4">
          <Button 
            variant="outline" 
            onClick={addPostTemplate}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Post Template
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#FF4400] hover:bg-[#FF4400]/90"
          >
            {isSaving ? "Saving..." : "Save Templates"}
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
        {postTemplates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="space-y-4">
                <Input
                  value={template.title}
                  onChange={(e) => updatePostTemplate(template.id, 'title', e.target.value)}
                  placeholder="Post Template Title"
                  className="text-lg font-semibold"
                />
                <Textarea
                  value={template.description}
                  onChange={(e) => updatePostTemplate(template.id, 'description', e.target.value)}
                  placeholder="Post description or template content"
                  className="text-sm"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePostTemplate(template.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-sm font-medium mb-3">Content Ideas</h3>
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {template.contentIdeas.map((idea) => (
                    <div key={idea.id} className="flex gap-2">
                      <Input
                        value={idea.text}
                        onChange={(e) => updateContentIdea(template.id, idea.id, e.target.value)}
                        placeholder="Enter content idea"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContentIdea(template.id, idea.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addContentIdea(template.id)}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Content Idea
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