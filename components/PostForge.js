'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, StopCircle, Send, RefreshCw, History, Copy, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const PostForge = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPost, setCurrentPost] = useState('');
  const [postHistory, setPostHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [processingSteps, setProcessingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [pastPosts, setPastPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [showingExamples, setShowingExamples] = useState(false);
  
  const { toast } = useToast();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef(null);
  const messagesEndRef = useRef(null);
  const processingTimerRef = useRef(null);

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
    setShowingExamples(false);
    
    // Start showing processing steps
    setProcessingSteps([
      "Analyzing your request...",
      "Looking at your past LinkedIn posts to learn your voice...",
      "Studying top-performing content for inspiration...",
      "Crafting content that matches your style..."
    ]);
    setCurrentStep(0);
    
    // Show processing steps one by one
    processingTimerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const newStep = prev < 3 ? prev + 1 : prev;
        
        // When we reach the step about past posts, fetch and display them
        if (newStep === 1 && !showingExamples) {
          fetchExamplePosts();
        }
        
        return newStep;
      });
    }, 1500);
    
    try {
      // Here you would make an API call to your backend
      const response = await fetchAIResponse(userMessage, currentPost);
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      // If the API returned custom processing steps, update them
      if (response.processingSteps) {
        setProcessingSteps(response.processingSteps);
        setCurrentStep(response.processingSteps.length - 1);
      }
      
      // Add AI response to chat
      setMessages(prev => [
        ...prev, 
        ...processingSteps.slice(0, currentStep + 1).map(step => ({ 
          role: 'assistant', 
          content: step,
          isProcessingStep: true
        })),
        { role: 'assistant', content: response.message }
      ]);
      
      // If the AI generated a new post version, update it
      if (response.updatedPost) {
        setCurrentPost(response.updatedPost);
        // Add to history if it's a significant update
        if (response.isSignificantUpdate) {
          setPostHistory(prev => [...prev, { 
            timestamp: new Date().toISOString(),
            content: response.updatedPost 
          }]);
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Error message is now handled in fetchAIResponse
    } finally {
      setIsLoading(false);
      setProcessingSteps([]);
      setCurrentStep(0);
      clearInterval(processingTimerRef.current);
      setShowingExamples(false);
    }
  };

  // Function to fetch and display example posts
  const fetchExamplePosts = async () => {
    setShowingExamples(true);
    
    try {
      // Fetch past posts from the API
      const pastPostsResponse = await fetch('/api/postforge/user-posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!pastPostsResponse.ok) {
        throw new Error('Failed to fetch your past posts');
      }
      
      const pastPostsData = await pastPostsResponse.json();
      
      // Add message about past posts
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: "Looking at your past LinkedIn posts to learn your voice...",
          isProcessingStep: true
        }
      ]);
      
      // If no past posts or error, show a message about it
      if (!pastPostsData.posts || pastPostsData.posts.length === 0) {
        const errorMessage = pastPostsData.error || "No LinkedIn posts found.";
        const isApiRestriction = errorMessage.includes('API') || 
                                 errorMessage.includes('restrictions') ||
                                 errorMessage.includes('permissions');
        const extensionAvailable = pastPostsData.extensionAvailable;
        
        // If we have profile data, at least show that
        const profileInfo = pastPostsData.profileData ? 
          `Connected as ${pastPostsData.profileData.name}` : 
          '';
        
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: errorMessage,
            isProcessingStep: true,
            isWarning: true
          },
          ...(profileInfo ? [{
            role: 'assistant',
            content: profileInfo,
            isProcessingStep: true
          }] : []),
          ...(extensionAvailable ? [{
            role: 'assistant',
            content: "💡 Try our Chrome extension to import your LinkedIn posts directly! [Download Extension](https://your-extension-url)",
            isProcessingStep: true,
            isExtensionPromo: true
          }] : []),
          ...(isApiRestriction ? [{
            role: 'assistant',
            content: "I'll still create great content for you based on best practices and your input. Please provide some details about your professional background and the type of content you'd like to create.",
            isProcessingStep: true
          }] : [])
        ]);
      } else {
        // Add past posts to chat
        setMessages(prev => [
          ...prev,
          ...pastPostsData.posts.map(post => ({
            role: 'assistant',
            content: post.content,
            isExample: true,
            exampleType: 'past',
            engagement: post.engagement
          }))
        ]);
      }
      
      setPastPosts(pastPostsData.posts || []);
      
      // After a delay, fetch trending posts
      setTimeout(async () => {
        setCurrentStep(2);
        
        try {
          // Fetch trending posts from the API
          const trendingPostsResponse = await fetch('/api/postforge/trending-posts', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (!trendingPostsResponse.ok) {
            throw new Error('Failed to fetch trending posts');
          }
          
          const trendingPostsData = await trendingPostsResponse.json();
          
          // Add message about trending posts
          setMessages(prev => [
            ...prev,
            { 
              role: 'assistant', 
              content: "Studying top-performing content for inspiration...",
              isProcessingStep: true
            }
          ]);
          
          // If no trending posts or error, show a message about it
          if (!trendingPostsData.posts || trendingPostsData.posts.length === 0) {
            setMessages(prev => [
              ...prev,
              { 
                role: 'assistant', 
                content: trendingPostsData.error || "No trending posts available at the moment.",
                isProcessingStep: true,
                isWarning: true
              }
            ]);
          } else {
            // Add trending posts to chat
            setMessages(prev => [
              ...prev,
              ...trendingPostsData.posts.map(post => ({
                role: 'assistant',
                content: post.content,
                isExample: true,
                exampleType: 'trending',
                engagement: post.engagement
              }))
            ]);
          }
          
          setTrendingPosts(trendingPostsData.posts || []);
        } catch (error) {
          console.error('Error fetching trending posts:', error);
          setMessages(prev => [
            ...prev,
            { 
              role: 'assistant', 
              content: "Studying top-performing content for inspiration...",
              isProcessingStep: true
            },
            { 
              role: 'assistant', 
              content: "Unable to fetch trending posts: " + error.message,
              isProcessingStep: true,
              isWarning: true
            }
          ]);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error fetching past posts:', error);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: "Looking at your past LinkedIn posts to learn your voice...",
          isProcessingStep: true
        },
        { 
          role: 'assistant', 
          content: "Unable to access your LinkedIn posts: " + error.message,
          isProcessingStep: true,
          isWarning: true
        }
      ]);
      
      // Still try to fetch trending posts after a delay
      setTimeout(() => {
        setCurrentStep(2);
        fetchTrendingPosts();
      }, 2000);
    }
  };

  // Separate function to fetch trending posts (used in error handling)
  const fetchTrendingPosts = async () => {
    try {
      const trendingPostsResponse = await fetch('/api/postforge/trending-posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!trendingPostsResponse.ok) {
        throw new Error('Failed to fetch trending posts');
      }
      
      const trendingPostsData = await trendingPostsResponse.json();
      
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: "Studying top-performing content for inspiration...",
          isProcessingStep: true
        }
      ]);
      
      if (!trendingPostsData.posts || trendingPostsData.posts.length === 0) {
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: "No trending posts available at the moment. Using AI-generated examples instead.",
            isProcessingStep: true,
            isWarning: true
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          ...trendingPostsData.posts.map(post => ({
            role: 'assistant',
            content: post.content,
            isExample: true,
            exampleType: 'trending',
            engagement: post.engagement
          }))
        ]);
      }
      
      setTrendingPosts(trendingPostsData.posts || []);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: "Studying top-performing content for inspiration...",
          isProcessingStep: true
        },
        { 
          role: 'assistant', 
          content: "Unable to fetch trending posts. Using AI-generated examples instead.",
          isProcessingStep: true,
          isWarning: true
        }
      ]);
    }
  };

  // Replace the placeholder fetchAIResponse function with this implementation
  const fetchAIResponse = async (message, currentPostDraft) => {
    setIsLoading(true);
    
    try {
      // Prepare the request payload
      const payload = {
        userMessage: message,
        currentDraft: currentPostDraft || null,
        action: currentPostDraft ? 'refine' : 'create'
      };
      
      // Make the API call to your backend
      const response = await fetch('/api/postforge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        message: data.assistantMessage,
        updatedPost: data.postContent,
        isSignificantUpdate: data.isSignificantUpdate,
        processingSteps: data.processingSteps
      };
    } catch (error) {
      console.error('Error in fetchAIResponse:', error);
      
      // Check if it's a rate limit error
      if (error.message && (
        error.message.includes('rate limit') || 
        error.message.includes('quota') || 
        error.message.includes('429')
      )) {
        // Add a specific error message to the chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm sorry, but we've hit the API rate limit. Please try again later or contact support if this persists."
        }]);
      } else {
        // Add a generic error message to the chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm sorry, but I encountered an error processing your request. Please try again."
        }]);
      }
      
      // If LinkedIn API restrictions are detected
      if (error.message && (
        error.message.includes('API restrictions') || error.message.includes('LinkedIn no longer allows')
      )) {
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: "LinkedIn API restrictions prevent us from accessing your posts directly. Try our Chrome extension instead!",
            isProcessingStep: true,
            isWarning: true
          },
          {
            role: 'assistant',
            content: "💡 [Download our Chrome Extension](https://your-extension-url) to import your LinkedIn posts directly.",
            isProcessingStep: true,
            isExtensionPromo: true
          }
        ]);
      }
      
      throw error;
    }
  };

  // Handle audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // Here you would send the audio to your speech-to-text service
        // For now, we'll simulate it
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setInput('This is simulated speech-to-text conversion of audio input.');
        setIsLoading(false);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      toast({
        title: "Recording stopped",
        description: "Processing your audio...",
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateNewPost = async () => {
    setIsLoading(true);
    setShowingExamples(false);
    
    // Start showing processing steps
    setProcessingSteps([
      "Analyzing your professional profile...",
      "Looking at your past LinkedIn posts to learn your voice...",
      "Studying top-performing content for inspiration...",
      "Crafting a personalized post..."
    ]);
    setCurrentStep(0);
    
    // Show processing steps one by one
    processingTimerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const newStep = prev < 3 ? prev + 1 : prev;
        
        // When we reach the step about past posts, fetch and display them
        if (newStep === 1 && !showingExamples) {
          fetchExamplePosts();
        }
        
        return newStep;
      });
    }, 1500);
    
    try {
      // Call the API to generate a new post
      const response = await fetch('/api/postforge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: 'Generate a new post about my professional expertise and recent industry trends',
          currentDraft: null,
          action: 'create'
        }),
      });
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // If the API returned custom processing steps, update them
      if (data.processingSteps) {
        setProcessingSteps(data.processingSteps);
        setCurrentStep(data.processingSteps.length - 1);
      }
      
      setCurrentPost(data.postContent);
      setPostHistory(prev => [...prev, { 
        timestamp: new Date().toISOString(),
        content: data.postContent 
      }]);
      
      // Add processing steps to messages
      const processingMessages = processingSteps.slice(0, currentStep + 1).map(step => ({
        role: 'assistant',
        content: step,
        isProcessingStep: true
      }));
      
      setMessages(prev => [
        ...prev,
        ...processingMessages,
        { role: 'assistant', content: data.assistantMessage }
      ]);
      
      toast({
        title: "New post generated",
        description: "Created based on your profile and current trends",
      });
    } catch (error) {
      console.error('Error generating new post:', error);
      
      // Check if it's a rate limit error
      const errorMessage = error.message || '';
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('429')) {
        toast({
          title: "API Rate Limit Exceeded",
          description: "We've hit our API usage limit. Please try again later.",
          variant: "destructive",
        });
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm sorry, but we've hit the API rate limit. Please try again later or contact support if this persists."
        }]);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate a new post",
          variant: "destructive",
        });
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm sorry, but I encountered an error generating your post. Please try again."
        }]);
      }
    } finally {
      setIsLoading(false);
      setProcessingSteps([]);
      setCurrentStep(0);
      clearInterval(processingTimerRef.current);
      setShowingExamples(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentPost);
    toast({
      title: "Copied to clipboard",
      description: "Your post has been copied to the clipboard",
    });
  };

  // Clean up the interval when component unmounts
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
    };
  }, []);

  // Add this function to your PostForge component
  const getExtensionUrl = () => {
    // When you publish to Chrome Web Store, replace this with the actual URL
    return process.env.NEXT_PUBLIC_EXTENSION_URL || 'https://chrome.google.com/webstore/detail/your-extension-id';
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">PostForge</h1>
        <Button 
          onClick={handleGenerateNewPost}
          className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          disabled={isLoading}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate New Post
        </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Chat Section */}
            <div className="md:col-span-3 border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex flex-col h-[60vh]">
                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((msg, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user' 
                          ? 'ml-auto bg-[#fb2e01] text-white max-w-[80%]' 
                          : msg.isProcessingStep
                            ? msg.isWarning
                              ? 'bg-yellow-50 text-yellow-700 italic border border-yellow-100 max-w-full'
                              : 'bg-gray-50 text-gray-600 italic border border-gray-100 max-w-full'
                            : msg.isExample
                              ? msg.exampleType === 'past'
                                ? 'bg-blue-50 border border-blue-100 text-gray-800 max-w-full'
                                : 'bg-green-50 border border-green-100 text-gray-800 max-w-full'
                              : 'bg-gray-100 text-gray-800 max-w-[80%]'
                      }`}
                    >
                      {msg.isWarning && (
                        <div className="flex items-center mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      )}
                      {msg.isExample && (
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            msg.exampleType === 'past' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {msg.exampleType === 'past' ? 'Your Past Post' : 'Trending Post'}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <span>👍 {msg.engagement?.likes || 0}</span>
                            <span>💬 {msg.engagement?.comments || 0}</span>
                            <span>🔄 {msg.engagement?.shares || 0}</span>
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                  {isLoading && processingSteps.length > 0 && !showingExamples && (
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
                    >
                      {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
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
            <div className="md:col-span-2 border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Current Draft</h2>
                <div className="flex gap-2">
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
                    {showHistory ? "Hide History" : "Show History"}
                  </Button>
                </div>
              </div>
              
              {showHistory ? (
                <div className="h-[50vh] overflow-y-auto space-y-4">
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
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                            Version {index + 1}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(post.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">
                          {post.content.length > 150 
                            ? `${post.content.substring(0, 150)}...` 
                            : post.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="h-[50vh] overflow-y-auto border rounded-lg p-4 bg-gray-50">
                  {currentPost ? (
                    <p className="whitespace-pre-wrap">{currentPost}</p>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      Start a conversation to create your post
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {postHistory.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-500">
                No post history yet
              </div>
            ) : (
              postHistory.map((post, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                        Version {index + 1}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(post.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mb-4 whitespace-pre-wrap">
                    {post.content.length > 200 
                      ? `${post.content.substring(0, 200)}...` 
                      : post.content}
                  </p>
                  <div className="flex justify-end gap-2">
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
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PostForge;