'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Database, AlertCircle, CheckCircle, Loader2, Linkedin, Search, Upload, FileText, File, Brain, Save, Lightbulb, Info, Sparkles, Zap } from 'lucide-react';
import DirectUpload from './DirectUpload';
import UserSelector from './UserSelector';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PastPostsViewer from '@/components/PastPostsViewer';
import LinkedInScraperComponent from '@/components/LinkedInScraperComponent';

const TrainingDataTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('context-guide');
  const [urls, setUrls] = useState(['']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({});
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // User selection for accessing other users' training data
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('ghostwriter');

  // Document upload states
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [documentStatus, setDocumentStatus] = useState({});

  // Context guide states
  const [contextGuide, setContextGuide] = useState('');
  const [isSavingGuide, setIsSavingGuide] = useState(false);
  const [guideWordCount, setGuideWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [lastTrainingDate, setLastTrainingDate] = useState(null);
  
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  // Fetch existing trending posts on component mount
  useEffect(() => {
    initializeComponent();
  }, []);

  // Refresh data when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      fetchTrendingPosts();
      fetchUploadedDocuments();
      loadContextGuide();
    }
  }, [selectedUserId]);

  const initializeComponent = async () => {
    await getCurrentUserRole();
    fetchTrendingPosts();
    fetchUploadedDocuments();
    loadContextGuide();
  };

  const getCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user is a ghostwriter (has approver links)
      const { data: ghostwriterLinks, error: ghostwriterError } = await supabase
        .from('ghostwriter_approver_link')
        .select('id')
        .eq('ghostwriter_id', user.id)
        .limit(1);

      if (ghostwriterError) throw ghostwriterError;

      // Check if user is an approver (has ghostwriter links)
      const { data: approverLinks, error: approverError } = await supabase
        .from('ghostwriter_approver_link')
        .select('id')
        .eq('approver_id', user.id)
        .limit(1);

      if (approverError) throw approverError;

      // Determine role based on links (can be both, but default to ghostwriter)
      if (ghostwriterLinks.length > 0) {
        setCurrentUserRole('ghostwriter');
      } else if (approverLinks.length > 0) {
        setCurrentUserRole('approver');
      } else {
        // Default to ghostwriter if no links found
        setCurrentUserRole('ghostwriter');
      }
    } catch (error) {
      console.error('Error getting user role:', error);
      // Default to ghostwriter if we can't determine role
      setCurrentUserRole('ghostwriter');
    }
  };

  const handleUserSelect = (userId, userInfo) => {
    setSelectedUserId(userId);
    setSelectedUserInfo(userInfo);
  };

  // Update word count when context guide changes
  useEffect(() => {
    const words = contextGuide.trim().split(/\s+/).filter(word => word.length > 0);
    setGuideWordCount(words.length);
  }, [contextGuide]);

  const fetchTrendingPosts = async () => {
    setIsLoading(true);
    try {
      let data;

      if (selectedUserId) {
        // Fetch data for selected user
        const response = await fetch(`/api/training-data/user?userId=${selectedUserId}&type=trending_posts`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error);
        data = result.data;
      } else {
        // Fetch data for current user
        const { data: supabaseData, error } = await supabase
          .from('trending_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = supabaseData;
      }

      setTrendingPosts(data || []);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trending posts',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch uploaded documents
  const fetchUploadedDocuments = async () => {
    try {
      let data;

      if (selectedUserId) {
        // Fetch data for selected user
        const response = await fetch(`/api/training-data/user?userId=${selectedUserId}&type=training_documents`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error);
        data = result.data;
      } else {
        // Fetch data for current user
        const { data: supabaseData, error } = await supabase
          .from('training_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = supabaseData;
      }

      setUploadedDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load training documents',
        variant: 'destructive'
      });
    }
  };

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const isValidLinkedInUrl = (url) => {
    const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
    return linkedinPattern.test(url);
  };

  const processUrls = async () => {
    const validUrls = urls.filter(url => url.trim() && isValidLinkedInUrl(url.trim()));
    
    if (validUrls.length === 0) {
      toast({
        title: 'No valid URLs',
        description: 'Please enter at least one valid LinkedIn post URL',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStatus({});

    try {
      // Process each URL
      for (const url of validUrls) {
        setProcessingStatus(prev => ({
          ...prev,
          [url]: { status: 'processing', message: 'Extracting post data...' }
        }));

        try {
          const response = await fetch('/api/training-data/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to extract post data');
          }

          setProcessingStatus(prev => ({
            ...prev,
            [url]: { 
              status: 'success', 
              message: 'Post data extracted and added to training data',
              data: result.data
            }
          }));

        } catch (error) {
          console.error('Error processing URL:', url, error);
          setProcessingStatus(prev => ({
            ...prev,
            [url]: { 
              status: 'error', 
              message: error.message || 'Failed to extract post data'
            }
          }));
        }
      }

      // Refresh trending posts after processing
      await fetchTrendingPosts();

      toast({
        title: 'Processing complete',
        description: `Processed ${validUrls.length} URLs. Check the results below.`,
      });

    } catch (error) {
      console.error('Error in processUrls:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while processing URLs',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const deletePost = async (postId) => {
    try {
      const { error } = await supabase
        .from('trending_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setTrendingPosts(prev => prev.filter(post => post.id !== postId));
      
      toast({
        title: 'Post deleted',
        description: 'Training data post has been removed',
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive'
      });
    }
  };

  const togglePostStatus = async (postId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('trending_posts')
        .update({ is_active: !currentStatus })
        .eq('id', postId);

      if (error) throw error;

      setTrendingPosts(prev => 
        prev.map(post => 
          post.id === postId 
            ? { ...post, is_active: !currentStatus }
            : post
        )
      );
      
      toast({
        title: 'Post updated',
        description: `Post ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating post status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update post status',
        variant: 'destructive'
      });
    }
  };



  const deleteDocument = async (docId) => {
    try {
      const { error } = await supabase
        .from('training_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
      
      toast({
        title: 'Document deleted',
        description: 'Training document has been removed',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive'
      });
    }
  };

  const toggleDocumentStatus = async (docId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('training_documents')
        .update({ is_active: !currentStatus })
        .eq('id', docId);

      if (error) throw error;

      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === docId 
            ? { ...doc, is_active: !currentStatus }
            : doc
        )
      );
      
      toast({
        title: 'Document updated',
        description: `Document ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating document status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document status',
        variant: 'destructive'
      });
    }
  };

  // Context Guide Functions
  const loadContextGuide = async () => {
    try {
      let data;

      if (selectedUserId) {
        // Load context guide for selected user
        const response = await fetch(`/api/training-data/user?userId=${selectedUserId}&type=context_guide`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error);
        data = result.data;

        if (data) {
          console.log('Loaded existing context guide for selected user');
          setContextGuide(data);
          setLastSaved(new Date());
        } else {
          console.log('No existing context guide found for selected user, setting default template');
          setContextGuide(getDefaultTemplate());
        }
      } else {
        // Load context guide for current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        console.log('Loading context guide for user:', user.id);

        const { data: supabaseData, error } = await supabase
          .from('user_preferences')
          .select('settings, updated_at')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading context guide:', error);
          throw error;
        }

        if (supabaseData?.settings?.contextGuide) {
          console.log('Loaded existing context guide');
          setContextGuide(supabaseData.settings.contextGuide);
          setLastSaved(new Date(supabaseData.updated_at));
          if (supabaseData.settings.lastTrainingDate) {
            setLastTrainingDate(new Date(supabaseData.settings.lastTrainingDate));
          }
        } else {
          console.log('No existing context guide found, setting default template');
          // Set default template
          setContextGuide(getDefaultTemplate());
        }
      }
    } catch (error) {
      console.error('Error loading context guide:', error);
      toast({
        title: "Error",
        description: `Failed to load context guide: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const saveContextGuide = async () => {
    setIsSavingGuide(true);
    try {
      if (selectedUserId) {
        // Save context guide for selected user
        const response = await fetch('/api/training-data/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: selectedUserId,
            dataType: 'context_guide',
            data: {
              contextGuide: contextGuide.trim(),
              lastTrainingDate: lastTrainingDate?.toISOString()
            }
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save context guide');
        }

        console.log('Context guide saved successfully for selected user');
        setLastSaved(new Date());
        toast({
          title: "Success",
          description: `Context guide saved for ${selectedUserInfo?.full_name || selectedUserInfo?.email}!`,
        });
      } else {
        // Save context guide for current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        console.log('Saving context guide for user:', user.id);

        // First, try to get existing preferences with id
        const { data: existingPrefs, error: selectError } = await supabase
          .from('user_preferences')
          .select('id, settings')
          .eq('user_id', user.id)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error fetching existing preferences:', selectError);
          throw selectError;
        }

        const updatedSettings = {
          ...(existingPrefs?.settings || {}),
          contextGuide: contextGuide.trim(),
          lastTrainingDate: lastTrainingDate?.toISOString()
        };

        console.log('Updated settings:', updatedSettings);

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
              user_id: user.id,
              settings: updatedSettings,
              updated_at: new Date().toISOString()
            });
        }

        if (result.error) {
          console.error('Database operation error:', result.error);
          throw result.error;
        }

        console.log('Context guide saved successfully');
        setLastSaved(new Date());
        toast({
          title: "Success",
          description: "Your context guide has been saved!",
        });
      }
    } catch (error) {
      console.error('Error saving context guide:', error);
      toast({
        title: "Error",
        description: `Failed to save context guide: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSavingGuide(false);
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

  const trainContextGuide = async () => {
    setIsTraining(true);
    setTrainingStatus('Analyzing your training data...');
    
    try {
      const response = await fetch('/api/training-data/synthesize-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to train context guide');
      }

      setTrainingStatus('Context guide generated successfully!');
      setContextGuide(result.contextGuide);
      setLastTrainingDate(new Date());
      
      // Also update lastSaved since the guide was automatically saved
      setLastSaved(new Date());

      toast({
        title: 'Context Guide Trained!',
        description: `Successfully analyzed ${result.dataAnalyzed.totalDataPoints} data points to create your personalized guide.`,
      });

      // Clear status after a delay
      setTimeout(() => {
        setTrainingStatus('');
      }, 3000);

    } catch (error) {
      console.error('Error training context guide:', error);
      setTrainingStatus('');
      toast({
        title: 'Training Failed',
        description: error.message || 'Failed to train context guide. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-white" />
                </div>
                Training Data Manager
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Import and manage LinkedIn posts for AI training data. Extract data from URLs or scrape posts using professional APIs.
              </p>
            </div>
            <div className="w-80 ml-6">
              <UserSelector
                selectedUserId={selectedUserId}
                onUserSelect={handleUserSelect}
                currentUserRole={currentUserRole}
              />
              {selectedUserInfo && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    Currently managing training data for: <strong>{selectedUserInfo.full_name || selectedUserInfo.email}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tabs for different training data methods */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="context-guide" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Context Guide
          </TabsTrigger>
          <TabsTrigger value="trending-training" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Trending Training Data
          </TabsTrigger>
          <TabsTrigger value="context-documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Context Documents
          </TabsTrigger>
          <TabsTrigger value="my-posts" className="flex items-center gap-2">
            <Linkedin className="w-4 h-4" />
            My Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="context-guide" className="mt-6">
          <div className="space-y-6">
            {/* Context Guide Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Context Guide
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create a personalized guide that helps AI understand your voice, style, and content preferences.
                  This guide is used by the ideation system to generate content that matches your unique style.
                </p>
              </CardHeader>
            </Card>

            {/* Info Card */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
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
              </CardContent>
            </Card>

            {/* AI Training Section */}
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-purple-900">AI-Powered Context Guide Training</h3>
                      {lastTrainingDate && (
                        <span className="text-sm text-purple-700">
                          Last trained: {lastTrainingDate.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-purple-800 mb-3">
                      Let AI analyze all your training data (trending posts, documents, your posts) to automatically 
                      generate a personalized context guide that captures your unique voice and style.
                    </p>
                    
                    {trainingStatus && (
                      <div className="mb-3 p-2 bg-purple-100 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-purple-800">
                          {isTraining && <Loader2 className="h-4 w-4 animate-spin" />}
                          {trainingStatus}
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={trainContextGuide}
                      disabled={isTraining}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isTraining ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Train Context Guide
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editor */}
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-gray-600" />
                    <span className="font-medium">Your Context Guide</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{guideWordCount} words</span>
                    {lastSaved && (
                      <span>Last saved: {lastSaved.toLocaleString()}</span>
                    )}
                    {lastTrainingDate && (
                      <span>Last trained: {lastTrainingDate.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <Textarea
                  value={contextGuide}
                  onChange={(e) => setContextGuide(e.target.value)}
                  placeholder="Describe your content style, voice, preferred topics, and any specific guidelines..."
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isSavingGuide}
                />

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={resetToDefault}
                    disabled={isSavingGuide}
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>

                  <Button
                    onClick={saveContextGuide}
                    disabled={isSavingGuide || !contextGuide.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingGuide ? 'Saving...' : 'Save Guide'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Usage Tips */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Tips for a great context guide:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Be specific about your industry and expertise areas</li>
                  <li>• Include examples of content formats you prefer</li>
                  <li>• Describe your target audience in detail</li>
                  <li>• Mention your unique perspective or approach</li>
                  <li>• Include any topics you want to avoid</li>
                  <li>• Specify your preferred call-to-action styles</li>
                </ul>
              </CardContent>
            </Card>

            {/* Integration Info */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">How Training Works:</p>
                    <ul className="space-y-1 text-green-700">
                      <li>• <strong>Trending Posts:</strong> Analyzes high-performing content for successful patterns</li>
                      <li>• <strong>Your Documents:</strong> Extracts your unique voice from uploaded files</li>
                      <li>• <strong>Your Posts:</strong> Studies your personal writing style and preferences</li>
                      <li>• <strong>AI Synthesis:</strong> Claude Sonnet 4 combines all data into a personalized guide</li>
                      <li>• <strong>Auto-Integration:</strong> Guide is immediately available for CoCreate ideation</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trending-training" className="mt-6">
          <div className="space-y-6">
            {/* URL Extraction Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Extract from URLs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Enter LinkedIn post URLs to extract and add high-performing content to your training data. 
                  This will help improve the CoCreate AI&apos;s ability to generate engaging posts.
                </div>

                <div className="space-y-3">
                  {urls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://www.linkedin.com/posts/..."
                        value={url}
                        onChange={(e) => updateUrl(index, e.target.value)}
                        className={`flex-1 ${
                          url && !isValidLinkedInUrl(url) 
                            ? 'border-red-300 focus:border-red-500' 
                            : ''
                        }`}
                      />
                      {urls.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeUrlField(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {urls.some(url => url && !isValidLinkedInUrl(url)) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please enter valid LinkedIn post URLs (e.g., https://www.linkedin.com/posts/username-123456789/)
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={addUrlField}
                    disabled={isProcessing}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add URL
                  </Button>
                  <Button
                    onClick={processUrls}
                    disabled={isProcessing || urls.every(url => !url.trim())}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Extract Data
                      </>
                    )}
                  </Button>
                </div>

                {/* Processing Status */}
                {Object.keys(processingStatus).length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="font-medium">Processing Status:</h4>
                    {Object.entries(processingStatus).map(([url, status]) => (
                      <div key={url} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium truncate">{url}</div>
                          <div className={`text-sm flex items-center gap-1 mt-1 ${
                            status.status === 'success' ? 'text-green-600' :
                            status.status === 'error' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {status.status === 'success' && <CheckCircle className="h-3 w-3" />}
                            {status.status === 'error' && <AlertCircle className="h-3 w-3" />}
                            {status.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status.message}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Training Data Posts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Training Data Posts ({trendingPosts.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchTrendingPosts}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : trendingPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No training data posts yet. Add some LinkedIn post URLs above to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trendingPosts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={post.is_active ? "default" : "secondary"}>
                                {post.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {post.author_name && (
                                <span className="text-sm text-gray-600">
                                  by {post.author_name}
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                {new Date(post.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
                              {post.content.length > 200 
                                ? `${post.content.substring(0, 200)}...`
                                : post.content
                              }
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>👍 {post.likes}</span>
                              <span>💬 {post.comments}</span>
                              <span>🔄 {post.shares}</span>
                              {post.engagement_rate && (
                                <span>📊 {post.engagement_rate}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePostStatus(post.id, post.is_active)}
                            >
                              {post.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deletePost(post.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="context-documents" className="mt-6">
          <div className="space-y-6">
            {/* Document Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Context Documents
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload emails, transcripts, writing samples, or other documents to enhance AI voice analysis. 
                  Supported formats: PDF, DOC, DOCX, TXT, MD, CSV
                </p>
              </CardHeader>
              <CardContent>
                {/* Direct Upload */}
                <DirectUpload onUploadComplete={fetchUploadedDocuments} />

                {/* Upload Status */}
                {Object.keys(documentStatus).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Upload Status:</h4>
                    {Object.entries(documentStatus).map(([fileName, status]) => (
                      <div key={fileName} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium truncate">{fileName}</div>
                          <div className={`text-sm flex items-center gap-1 mt-1 ${
                            status.status === 'success' ? 'text-green-600' :
                            status.status === 'error' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {status.status === 'success' && <CheckCircle className="h-3 w-3" />}
                            {status.status === 'error' && <AlertCircle className="h-3 w-3" />}
                            {status.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Uploaded Documents List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Uploaded Documents ({uploadedDocuments.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchUploadedDocuments}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No training documents uploaded yet. Upload some documents above to enhance voice analysis.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uploadedDocuments.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <File className="h-4 w-4" />
                              <span className="font-medium">{doc.file_name}</span>
                              <Badge variant={doc.is_active ? "default" : "secondary"}>
                                {doc.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {new Date(doc.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {doc.description && (
                              <div className="text-sm text-gray-600 mb-2">
                                {doc.description}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>📄 {doc.file_type.toUpperCase()}</span>
                              <span>📊 {doc.word_count} words</span>
                              {doc.processing_status === 'completed' && (
                                <span className="text-green-600">✅ Processed</span>
                              )}
                              {doc.processing_status === 'failed' && (
                                <span className="text-red-600">❌ Processing failed</span>
                              )}
                              {doc.processing_status === 'processing' && (
                                <span className="text-blue-600">⏳ Processing...</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDocumentStatus(doc.id, doc.is_active)}
                            >
                              {doc.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteDocument(doc.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Analysis Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Voice Enhancement Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      Email Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Upload past emails to understand your professional communication style and tone patterns.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Transcript Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Process meeting transcripts or presentations to capture your speaking patterns and vocabulary.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      Writing Samples
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Include articles, reports, or other writing samples to enhance voice authenticity.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Database className="w-4 h-4 text-orange-600" />
                      Enhanced AI Training
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      More context data leads to better voice analysis and more authentic post generation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="my-posts" className="mt-6">
          <div className="space-y-6">
            {/* LinkedIn Post Scraper Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  LinkedIn Post Scraper
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Search LinkedIn posts by keywords, scrape specific URLs, or use preset configurations.
                  All scraped posts are automatically saved to your database.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6">
                  <LinkedInScraperComponent />
                </div>
              </CardContent>
            </Card>

            {/* Imported Posts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Linkedin className="h-5 w-5" />
                  Imported LinkedIn Posts
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and manage your LinkedIn posts that have been imported via scraping or API sync.
                  Analyze engagement metrics and content performance.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6">
                  <PastPostsViewer />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


      </Tabs>

      {/* Feature Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                URL Extraction
              </h4>
              <p className="text-sm text-muted-foreground">
                Extract content directly from LinkedIn post URLs to quickly add high-performing posts to your training data.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Professional Scraping
              </h4>
              <p className="text-sm text-muted-foreground">
                Uses Apify&apos;s LinkedIn scraper with proxy rotation and anti-blocking measures for reliable data collection.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-green-600" />
                Automatic Storage
              </h4>
              <p className="text-sm text-muted-foreground">
                All scraped posts are automatically stored in your database with full metadata and engagement metrics.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-purple-600" />
                Multiple Sources
              </h4>
              <p className="text-sm text-muted-foreground">
                Scrape from search results, specific URLs, company pages, or user profiles with flexible filtering options.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingDataTab; 