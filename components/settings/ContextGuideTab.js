'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Save, FileText, Brain, Lightbulb, Info } from 'lucide-react';
import { useSupabase } from '@/lib/hooks/useSupabase';

const ContextGuideTab = () => {
  const [contextGuide, setContextGuide] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const { supabase, userId, isLoaded } = useSupabase();
  const { toast } = useToast();

  // Load existing context guide
  useEffect(() => {
    if (isLoaded && userId) {
      loadContextGuide();
    }
  }, [isLoaded, userId]);

  // Update word count when content changes
  useEffect(() => {
    const words = contextGuide.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [contextGuide]);

  const loadContextGuide = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('settings, updated_at')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data?.settings?.contextGuide) {
        setContextGuide(data.settings.contextGuide);
        setLastSaved(new Date(data.updated_at));
      } else {
        // Set default template
        setContextGuide(getDefaultTemplate());
      }
    } catch (error) {
      console.error('Error loading context guide:', error);
      toast({
        title: "Error",
        description: "Failed to load your context guide",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveContextGuide = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      // Get existing preferences with id
      const { data: existingPrefs, error: selectError } = await supabase
        .from('user_preferences')
        .select('id, settings')
        .eq('user_id', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error fetching existing preferences:', selectError);
        throw selectError;
      }

      const updatedSettings = {
        ...(existingPrefs?.settings || {}),
        contextGuide: contextGuide.trim()
      };

      let result;
      if (existingPrefs) {
        // Update existing record
        result = await supabase
          .from('user_preferences')
          .update({
            settings: updatedSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPrefs.id);
      } else {
        // Insert new record
        result = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            settings: updatedSettings,
            updated_at: new Date().toISOString()
          });
      }

      if (result.error) {
        console.error('Database operation error:', result.error);
        throw result.error;
      }

      setLastSaved(new Date());
      toast({
        title: "Success",
        description: "Your context guide has been saved!",
      });
    } catch (error) {
      console.error('Error saving context guide:', error);
      toast({
        title: "Error",
        description: "Failed to save your context guide",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDefaultTemplate = () => {
    return `# My Content Creation Guide

## Voice & Tone
- Professional yet approachable
- Confident and knowledgeable
- Authentic and personal

## Content Themes
- Industry insights and trends
- Personal experiences and lessons learned
- Practical tips and actionable advice
- Behind-the-scenes stories

## Writing Style
- Start with engaging hooks
- Use clear, concise language
- Include specific examples
- End with thought-provoking questions

## Target Audience
- Industry professionals
- Aspiring entrepreneurs
- People interested in [your expertise area]

## Content Formats I Prefer
- Personal stories with lessons
- List-based tips and insights
- Industry commentary
- Question-based engagement posts

## Topics I Cover
- [Add your key topics here]
- [Your areas of expertise]
- [Industry insights you share]

## Call-to-Action Preferences
- Ask engaging questions
- Encourage sharing experiences
- Invite connections and conversations

---
Edit this guide to match your unique voice and content strategy. The AI will use this as context when generating ideas for your posts.`;
  };

  const resetToDefault = () => {
    setContextGuide(getDefaultTemplate());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Loading your context guide...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Context Guide</h2>
        <p className="text-gray-600">
          Create a personalized guide that helps AI understand your voice, style, and content preferences.
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How this works:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• The AI uses this guide as context when generating post ideas</li>
              <li>• Include your voice, tone, preferred topics, and content style</li>
              <li>• The more specific you are, the better the AI can match your style</li>
              <li>• You can update this anytime as your content strategy evolves</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Your Context Guide</span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{wordCount} words</span>
            {lastSaved && (
              <span>Last saved: {lastSaved.toLocaleString()}</span>
            )}
          </div>
        </div>

        <Textarea
          value={contextGuide}
          onChange={(e) => setContextGuide(e.target.value)}
          placeholder="Describe your content style, voice, preferred topics, and any specific guidelines..."
          className="min-h-[400px] font-mono text-sm"
          disabled={isSaving}
        />

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={isSaving}
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Use Template
          </Button>

          <Button
            onClick={saveContextGuide}
            disabled={isSaving || !contextGuide.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Guide'}
          </Button>
        </div>
      </div>

      {/* Usage Tips */}
      <Card className="p-4 bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-2">Tips for a great context guide:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Be specific about your industry and expertise areas</li>
          <li>• Include examples of content formats you prefer</li>
          <li>• Describe your target audience in detail</li>
          <li>• Mention your unique perspective or approach</li>
          <li>• Include any topics you want to avoid</li>
          <li>• Specify your preferred call-to-action styles</li>
        </ul>
      </Card>
    </div>
  );
};

export default ContextGuideTab;
