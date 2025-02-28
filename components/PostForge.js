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
  
  const { toast } = useToast();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

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
    
    try {
      // Here you would make an API call to your backend
      // This is a placeholder for the actual API call
      const response = await fetchAIResponse(userMessage, currentPost);
      
      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      
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
      toast({
        title: "Error",
        description: "Sorry, I encountered an error while processing your request.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder for the actual API call
  const fetchAIResponse = async (message, currentPostDraft) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // This is where you would make the actual API call to your backend
    // which would handle:
    // 1. Looking at past LinkedIn posts
    // 2. Checking top-performing posts
    // 3. Creating/updating the post
    
    // Placeholder response
    return {
      message: `I've analyzed your past LinkedIn posts and current trends. Here's an updated version of your post.`,
      updatedPost: currentPostDraft ? 
        `${currentPostDraft}\n\nImproved with more engaging hooks and better formatting.` : 
        `Here's a draft based on your input: "${message}"\n\nThis is crafted to match your style while incorporating elements from top-performing posts.`,
      isSignificantUpdate: true
    };
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

  const handleGenerateNewPost = () => {
    setIsLoading(true);
    // Simulate generating a completely new post
    setTimeout(() => {
      const newPost = "This is a completely new post generated based on your profile and current LinkedIn trends.";
      setCurrentPost(newPost);
      setPostHistory(prev => [...prev, { 
        timestamp: new Date().toISOString(),
        content: newPost 
      }]);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I've created a new post for you based on your profile and current LinkedIn trends." 
      }]);
      setIsLoading(false);
      
      toast({
        title: "New post generated",
        description: "Created based on your profile and current trends",
      });
    }, 2000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentPost);
    toast({
      title: "Copied to clipboard",
      description: "Your post has been copied to the clipboard",
    });
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
                      className={`p-3 rounded-lg max-w-[80%] ${
                        msg.role === 'user' 
                          ? 'ml-auto bg-[#fb2e01] text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-center my-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#fb2e01]"></div>
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