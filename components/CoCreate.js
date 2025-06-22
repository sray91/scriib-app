'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, StopCircle, Send, RefreshCw, History, Copy, Sparkles, TrendingUp, User, BarChart3, Edit, Calendar, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import PostEditorDialog from '@/components/post-forge/PostEditorDialog';

// AI Thinking Process Display Component  
const ThinkingDisplay = ({ processingSteps }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-purple-900 flex items-center">
          🧠 AI Thinking Process
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded text-purple-800"
        >
          {isExpanded ? 'Hide' : 'Show'} Steps
        </button>
      </div>
      
      {isExpanded && (
        <div className="space-y-2">
          {processingSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="font-mono text-purple-600 min-w-[20px]">{i + 1}.</span>
              <span className="text-purple-800">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Debug Info Display Component
const DebugInfoDisplay = ({ debugInfo }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-blue-900 flex items-center">
          🔍 Voice Analysis Debug Info
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-blue-800"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium">Past Posts Found:</span> {debugInfo.pastPostsCount}
          </div>
          <div>
            <span className="font-medium">System Mode:</span> 
            <span className={`ml-1 px-1 rounded ${
              debugInfo.systemPromptMode === 'AUTHENTIC_VOICE' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {debugInfo.systemPromptMode}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-3 mt-3 pt-3 border-t border-blue-200">
            {/* Voice Analysis */}
            <div>
              <h5 className="font-medium text-blue-900 mb-1">Voice Analysis Generated:</h5>
              <div className="bg-white p-2 rounded text-xs space-y-1">
                <div><span className="font-medium">Style:</span> {debugInfo.voiceAnalysisGenerated?.style}</div>
                <div><span className="font-medium">Tone:</span> {debugInfo.voiceAnalysisGenerated?.tone}</div>
                <div><span className="font-medium">Uses Emojis:</span> {debugInfo.voiceAnalysisGenerated?.usesEmojis ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Uses Hashtags:</span> {debugInfo.voiceAnalysisGenerated?.usesHashtags ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Avg Length:</span> {debugInfo.voiceAnalysisGenerated?.avgLength} chars</div>
              </div>
            </div>

            {/* Sample Past Posts */}
            {debugInfo.pastPostsSample && debugInfo.pastPostsSample.length > 0 && (
              <div>
                <h5 className="font-medium text-blue-900 mb-1">Sample Past Posts Analyzed:</h5>
                <div className="space-y-2">
                  {debugInfo.pastPostsSample.map((post, i) => (
                    <div key={i} className="bg-white p-2 rounded text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">Post {i + 1}:</span>
                        <span className="text-gray-500">{post.length} chars</span>
                      </div>
                      <p className="text-gray-700 italic">&quot;{post.content.substring(0, 150)}...&quot;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hook Type */}
            {debugInfo.hookTypeChosen && (
              <div>
                <h5 className="font-medium text-blue-900 mb-1">Hook Type Chosen:</h5>
                <div className="bg-white p-2 rounded text-xs">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                    🎣 {debugInfo.hookTypeChosen}
                  </span>
                </div>
              </div>
            )}

            {/* User Message */}
            <div>
              <h5 className="font-medium text-blue-900 mb-1">Your Request:</h5>
              <div className="bg-white p-2 rounded text-xs">
                <p className="italic">&quot;{debugInfo.userMessage}&quot;</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CoCreate = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentPost, setCurrentPost] = useState('');
  const [postHistory, setPostHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [processingSteps, setProcessingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [trendingInsights, setTrendingInsights] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  
  // Post Editor states
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false);
  
  const { toast } = useToast();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef(null);
  const messagesEndRef = useRef(null);
  const processingTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim() && !isRecording) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    
    // Start showing processing steps
    setProcessingSteps([
      "🔍 Analyzing your request...",
      "📚 Loading your past LinkedIn posts for voice analysis...",
      "🧠 Running AI analysis on your writing patterns...",
      "✍️ Generating content in your authentic voice..."
    ]);
    setCurrentStep(0);
    
    // Show processing steps one by one
    processingTimerRef.current = setInterval(() => {
      setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
    }, 1200);
    
    try {
      // Call the real CoCreate API
      const response = await fetch('/api/cocreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          currentDraft: currentPost,
          action: currentPost ? 'refine' : 'create'
        }),
      });

      const data = await response.json();
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }
      
      // Add AI response to chat
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: data.message, insights: true }
      ]);
      
      // Add the actual processing steps that happened
      if (data.processingSteps && data.processingSteps.length > 0) {
        const thinkingMessage = {
          role: 'system',
          content: 'AI Thinking Process',
          processingSteps: data.processingSteps,
          isThinking: true
        };
        setMessages(prev => [...prev, thinkingMessage]);
      }
      
      // Update current post
      if (data.updatedPost) {
        setCurrentPost(data.updatedPost);
        
        // Add to history if it's a significant update
        if (data.isSignificantUpdate) {
          setPostHistory(prev => [...prev, { 
            timestamp: new Date().toISOString(),
            content: data.updatedPost 
          }]);
        }
      }
      
      // Store insights for the insights panel
      if (data.voiceAnalysis) {
        setVoiceAnalysis(data.voiceAnalysis);
      }
      if (data.trendingInsights) {
        setTrendingInsights(data.trendingInsights);
      }
      
      // Add debug information to chat if available
      if (data.debugInfo) {
        const debugMessage = {
          role: 'system',
          content: 'Debug Information',
          debugInfo: data.debugInfo,
          isDebug: true
        };
        setMessages(prev => [...prev, debugMessage]);
      }
      
      toast({
        title: "Content generated successfully!",
        description: "Your post has been created based on your voice and trending insights.",
      });
      
    } catch (error) {
      console.error('Error calling CoCreate API:', error);
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      // Show error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`,
        isError: true
      }]);
      
      toast({
        title: "Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
      
    } finally {
      setIsLoading(false);
      setProcessingSteps([]);
      setCurrentStep(0);
      clearInterval(processingTimerRef.current);
    }
  };

  // Handle audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Optimized for web
      });
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert audio to text using OpenAI Whisper
          setIsLoading(true);
          const transcribedText = await transcribeAudio(audioBlob);
          
          if (transcribedText) {
            setInput(transcribedText);
            toast({
              title: "Speech transcribed successfully",
              description: "Your audio has been converted to text",
            });
          } else {
            throw new Error('Transcription failed');
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast({
            title: "Transcription Error",
            description: "Failed to convert speech to text. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone",
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  // Function to transcribe audio using OpenAI Whisper API
  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Transcription API error');
      }
      
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      toast({
        title: "Recording stopped",
        description: "Processing your audio...",
      });
    }
  };

  // Format recording time
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateNewPost = async () => {
    setIsLoading(true);
    setProcessingSteps([
      "Analyzing your professional profile...",
      "Learning your voice from past posts...",
      "Studying trending content patterns...",
      "Crafting a personalized post..."
    ]);
    setCurrentStep(0);
    
    // Show processing steps one by one
    processingTimerRef.current = setInterval(() => {
      setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
    }, 1500);
    
    try {
      // Generate a variety of post prompts
      const prompts = [
        "Create a post about leadership lessons",
        "Write about productivity and time management",
        "Share insights about career growth",
        "Discuss innovation in the workplace",
        "Write about work-life balance",
        "Share networking tips",
        "Discuss industry trends"
      ];
      
      const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
      
      const response = await fetch('/api/cocreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: randomPrompt,
          action: 'create'
        }),
      });

      const data = await response.json();
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }
      
      setCurrentPost(data.updatedPost);
      setPostHistory(prev => [...prev, { 
        timestamp: new Date().toISOString(),
        content: data.updatedPost 
      }]);
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message }
      ]);
      
      // Store insights
      if (data.voiceAnalysis) {
        setVoiceAnalysis(data.voiceAnalysis);
      }
      if (data.trendingInsights) {
        setTrendingInsights(data.trendingInsights);
      }
      
      // Add debug information to chat if available
      if (data.debugInfo) {
        const debugMessage = {
          role: 'system',
          content: 'Debug Information',
          debugInfo: data.debugInfo,
          isDebug: true
        };
        setMessages(prev => [...prev, debugMessage]);
      }
      
      toast({
        title: "New post generated",
        description: "Created based on your profile and current trends",
      });
      
    } catch (error) {
      console.error('Error generating new post:', error);
      
      clearInterval(processingTimerRef.current);
      
      toast({
        title: "Error",
        description: "Failed to generate a new post",
        variant: "destructive",
      });
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, but I encountered an error generating your post. Please try again.",
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setProcessingSteps([]);
      setCurrentStep(0);
      clearInterval(processingTimerRef.current);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentPost);
    toast({
      title: "Copied to clipboard",
      description: "Your post has been copied to the clipboard",
    });
  };

  // Handle editing post
  const handleEditPost = () => {
    if (!currentPost) {
      toast({
        title: "No post to edit",
        description: "Generate a post first before editing",
        variant: "destructive",
      });
      return;
    }

    // Create a post object compatible with the PostEditor
    const postForEditing = {
      content: currentPost,
      scheduledTime: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
      status: 'draft',
      platforms: {},
      requiresApproval: false,
      approverId: '',
      ghostwriterId: '',
      mediaFiles: [],
      day_of_week: getCurrentDayOfWeek()
    };

    setSelectedPost(postForEditing);
    setIsCreatingNewPost(true);
    setIsPostEditorOpen(true);
  };

  // Handle scheduling post directly
  const handleSchedulePost = () => {
    if (!currentPost) {
      toast({
        title: "No post to schedule",
        description: "Generate a post first before scheduling",
        variant: "destructive",
      });
      return;
    }

    // Create a post object compatible with the PostEditor
    const postForScheduling = {
      content: currentPost,
      scheduledTime: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
      status: 'draft',
      platforms: { linkedin: true }, // Default to LinkedIn
      requiresApproval: false,
      approverId: '',
      ghostwriterId: '',
      mediaFiles: [],
      day_of_week: getCurrentDayOfWeek()
    };

    setSelectedPost(postForScheduling);
    setIsCreatingNewPost(true);
    setIsPostEditorOpen(true);

    toast({
      title: "Opening scheduler",
      description: "Configure your post settings and schedule",
    });
  };

  // Helper function to get current day of week
  const getCurrentDayOfWeek = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    return days[today.getDay()];
  };

  // Handle post save from editor
  const handlePostSave = (savedPost) => {
    // Update the current post if it was saved
    if (savedPost && savedPost.content) {
      setCurrentPost(savedPost.content);
      
      // Add to history
      setPostHistory(prev => [...prev, { 
        timestamp: new Date().toISOString(),
        content: savedPost.content,
        scheduled: savedPost.status === 'scheduled',
        scheduledTime: savedPost.scheduled_time
      }]);
    }

    // Close the editor
    setIsPostEditorOpen(false);
    setSelectedPost(null);

    // Show success message
    toast({
      title: "Post saved successfully!",
      description: savedPost?.status === 'scheduled' 
        ? "Your post has been scheduled in Post Forge" 
        : "Your post has been saved as a draft",
    });
  };

  // Handle editor close
  const handleEditorClose = () => {
    setIsPostEditorOpen(false);
    setSelectedPost(null);
  };

  // Clean up the interval when component unmounts
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6 md:mt-0 mt-10">
        <div>
          <h1 className="text-2xl font-bold md:ml-0 ml-10">CoCreate</h1>
          <p className="text-sm text-gray-600 md:ml-0 ml-10">AI-powered LinkedIn post generator</p>
        </div>
        <div className="flex gap-2">
          {(voiceAnalysis || trendingInsights) && (
            <Button 
              variant="outline"
              onClick={() => setShowInsights(!showInsights)}
              className="mr-2"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Insights
            </Button>
          )}
          <Button 
            onClick={handleGenerateNewPost}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
            disabled={isLoading}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Post
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="chat">
              Chat
            </TabsTrigger>
            <TabsTrigger value="history">
              Post History <span className="ml-1 bg-gray-100 px-1.5 rounded">
                {postHistory.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-[calc(100vh-12rem)]">
            {/* Chat Section */}
            <div className="md:col-span-3 border rounded-lg p-4 bg-white shadow-sm flex flex-col">
              <div className="flex flex-col flex-1 min-h-0">
                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((msg, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user' 
                          ? 'ml-auto bg-[#fb2e01] text-white max-w-[80%]' 
                          : msg.isError
                            ? 'bg-red-50 text-red-700 border border-red-100 max-w-[80%]'
                            : msg.isDebug
                              ? 'bg-blue-50 text-blue-800 border border-blue-200 max-w-[90%]'
                              : msg.isThinking
                                ? 'bg-purple-50 text-purple-800 border border-purple-200 max-w-[90%]'
                                : 'bg-gray-100 text-gray-800 max-w-[80%]'
                      }`}
                    >
                      {msg.isDebug ? (
                        <DebugInfoDisplay debugInfo={msg.debugInfo} />
                      ) : msg.isThinking ? (
                        <ThinkingDisplay processingSteps={msg.processingSteps} />
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.insights && (voiceAnalysis || trendingInsights) && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => setShowInsights(true)}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                              >
                                <BarChart3 className="mr-1 h-3 w-3" />
                                View analysis insights
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {isLoading && processingSteps.length > 0 && (
                    <div className="p-3 rounded-lg bg-gray-50 text-gray-600 italic border border-gray-100">
                      <p className="text-sm">{processingSteps[currentStep]}</p>
                      <div className="mt-1 flex space-x-1">
                        <div className="animate-pulse h-1 w-1 rounded-full bg-gray-400"></div>
                        <div className="animate-pulse delay-150 h-1 w-1 rounded-full bg-gray-400"></div>
                        <div className="animate-pulse delay-300 h-1 w-1 rounded-full bg-gray-400"></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your post idea or feedback..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 resize-none"
                    rows={3}
                    disabled={isRecording || isLoading}
                  />
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant={isRecording ? "destructive" : "outline"}
                      size="icon"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading}
                      title={isRecording ? "Stop recording" : "Start recording"}
                      className={isRecording ? "animate-pulse" : ""}
                    >
                      {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    {isRecording && (
                      <div className="text-xs text-center text-red-600 font-mono">
                        {formatRecordingTime(recordingTime)}
                      </div>
                    )}
                    <Button 
                      variant="default"
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={(!input.trim() && !isRecording) || isLoading}
                      title="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Post Preview Section */}
            <div className="md:col-span-2 border rounded-lg bg-white shadow-sm flex flex-col">
              <div className="flex flex-wrap justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                <h2 className="text-lg font-semibold mb-2 md:mb-0">Current Draft</h2>
                <div className="flex flex-wrap gap-2">
                  {currentPost && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleEditPost}
                        title="Edit in Post Forge"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleSchedulePost}
                        title="Schedule in Post Forge"
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Schedule
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={!currentPost}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    title={showHistory ? "Hide history" : "Show history"}
                  >
                    <History className="h-4 w-4 mr-1" />
                    {showHistory ? "Hide" : "History"}
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                {showHistory ? (
                  <div className="h-full overflow-y-auto p-4 space-y-4">
                    {postHistory.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        No post history yet
                      </div>
                    ) : (
                      postHistory.map((post, index) => (
                        <div 
                          key={index} 
                          className="border rounded-lg p-4 cursor-pointer hover:border-gray-400 transition-colors"
                          onClick={() => {
                            setCurrentPost(post.content);
                            setShowHistory(false);
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                              Version {index + 1}
                            </span>
                            {post.scheduled && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                Scheduled
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {new Date(post.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 line-clamp-3">
                            {post.content}
                          </p>
                          {post.scheduledTime && (
                            <p className="text-xs text-gray-500 mt-1">
                              Scheduled for: {new Date(post.scheduledTime).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    {currentPost ? (
                      <>
                        <div className="flex-1 overflow-y-auto p-4">
                          <div className="prose max-w-none">
                            <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                              {currentPost}
                            </p>
                          </div>
                        </div>
                        <div className="border-t bg-gray-50 p-4">
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleEditPost}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit in Post Forge
                            </Button>
                            <Button 
                              onClick={handleSchedulePost}
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Schedule Post
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="text-center text-gray-500 space-y-4">
                          <div className="space-y-2">
                            <p className="text-lg">Start a conversation to create your post</p>
                            <p className="text-sm text-gray-400">or</p>
                            <Button 
                              onClick={handleGenerateNewPost}
                              variant="outline"
                              size="sm"
                              disabled={isLoading}
                              className="border-dashed"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Generate a post
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Post History</h2>
            {postHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No posts created yet
              </div>
            ) : (
              <div className="space-y-4">
                {postHistory.map((post, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Version {index + 1}
                        </span>
                        {post.scheduled && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            Scheduled
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(post.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCurrentPost(post.content);
                            setActiveTab('chat');
                          }}
                        >
                          Use This Version
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(post.content);
                            toast({
                              title: "Copied to clipboard",
                              description: "Post version has been copied",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>
                    {post.scheduledTime && (
                      <p className="text-xs text-gray-500 mt-2">
                        Scheduled for: {new Date(post.scheduledTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Insights Dialog */}
      <Dialog open={showInsights} onOpenChange={setShowInsights}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Voice & Trending Analysis
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {voiceAnalysis && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Your Voice Analysis
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Style:</span> {voiceAnalysis.style}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Tone:</span> {voiceAnalysis.tone}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Avg Length:</span> {voiceAnalysis.avgLength} chars
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Uses Emojis:</span> {voiceAnalysis.usesEmojis ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Uses Hashtags:</span> {voiceAnalysis.usesHashtags ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Common Topics:</span> {voiceAnalysis.commonTopics.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {trendingInsights && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Trending Post Insights
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Top Formats:</span> {trendingInsights.topFormats.join(', ')}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Avg Engagement:</span> {trendingInsights.avgEngagementRate}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Optimal Length:</span> ~{trendingInsights.optimalLength} chars
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Best Topics:</span> {trendingInsights.bestPerformingTopics.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowInsights(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Editor Dialog */}
      <PostEditorDialog
        isOpen={isPostEditorOpen}
        onOpenChange={setIsPostEditorOpen}
        post={selectedPost}
        isNew={isCreatingNewPost}
        onSave={handlePostSave}
        onClose={handleEditorClose}
        onDelete={() => {
          // Handle delete if needed
          setIsPostEditorOpen(false);
          setSelectedPost(null);
        }}
      />
    </div>
  );
};

export default CoCreate;