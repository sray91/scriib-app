'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, StopCircle, Send, RefreshCw, History, Copy, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CoCreate = () => {
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
      // Call our simulated AI response function
      const response = await fetchAIResponse(userMessage, currentPost);
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      // Add AI response to chat
      setMessages(prev => [
        ...prev, 
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
    
    // Simulate API call with fake data
    const fakePastPosts = [
      {
        content: "Just wrapped up an amazing project with my team! We delivered ahead of schedule and the client couldn't be happier. Key takeaways: 1) Clear communication is everything 2) Regular check-ins prevent surprises 3) Celebrating small wins keeps momentum high. #ProjectManagement #Leadership",
        engagement: { likes: 124, comments: 18, shares: 7 }
      },
      {
        content: "I'm excited to share that our company has been recognized as a leader in innovation for the third year running! This wouldn't be possible without our incredible team's dedication to pushing boundaries. #Innovation #TeamWork #ProudLeader",
        engagement: { likes: 231, comments: 42, shares: 15 }
      }
    ];
    
    const fakeProfileData = {
      name: "Alex Johnson",
      headline: "Product Manager | Tech Enthusiast | Speaker",
      connections: 2347
    };
    
    // Add message about past posts
    setMessages(prev => [
      ...prev,
      { 
        role: 'assistant', 
        content: "Looking at your past LinkedIn posts to learn your voice...",
        isProcessingStep: true
      }
    ]);
    
    // Show the fake profile data
    setMessages(prev => [
      ...prev,
      { 
        role: 'assistant', 
        content: `Connected as ${fakeProfileData.name}`,
        isProcessingStep: true
      }
    ]);
    
    // Show sample of past posts
    setMessages(prev => [
      ...prev,
      ...fakePastPosts.map(post => ({
        role: 'assistant',
        content: post.content,
        isExample: true,
        exampleType: 'past',
        engagement: post.engagement
      }))
    ]);
    
    // Store the fake posts
    setPastPosts(fakePastPosts);
    
    // After a delay, fetch trending posts
    setTimeout(() => {
      setCurrentStep(2);
      fetchTrendingPosts();
    }, 2000);
  };

  // Separate function to fetch trending posts (used in error handling)
  const fetchTrendingPosts = async () => {
    // Simulate API call with fake trending posts
    const fakeTrendingPosts = [
      {
        content: "I've interviewed over 200 candidates in my career, and here are 5 things that make someone instantly stand out:\n\n1. They've done research on me and the company\n2. They ask thoughtful questions about our business challenges\n3. They bring specific examples of relevant work\n4. They admit when they don't know something\n5. They follow up with insights after the interview\n\nWhat would you add to this list? #Hiring #CareerAdvice",
        engagement: { likes: 3452, comments: 247, shares: 129 }
      },
      {
        content: "The most valuable career skill isn't coding, design, or business strategy.\n\nIt's clear writing.\n\nClear writing = Clear thinking\n\nHere are 7 tips to instantly improve your writing:\n\n1. Write short sentences\n2. Use simple words\n3. Embrace white space\n4. Cut unnecessary words\n5. Active voice > Passive voice\n6. Write how you speak\n7. Read it out loud\n\n#WritingTips #Communication",
        engagement: { likes: 8721, comments: 342, shares: 1203 }
      }
    ];
    
    setMessages(prev => [
      ...prev,
      { 
        role: 'assistant', 
        content: "Studying top-performing content for inspiration...",
        isProcessingStep: true
      }
    ]);
    
    setMessages(prev => [
      ...prev,
      ...fakeTrendingPosts.map(post => ({
        role: 'assistant',
        content: post.content,
        isExample: true,
        exampleType: 'trending',
        engagement: post.engagement
      }))
    ]);
    
    setTrendingPosts(fakeTrendingPosts);
  };

  // Replace the placeholder fetchAIResponse function with this implementation
  const fetchAIResponse = async (message, currentPostDraft) => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Simulate AI response based on user input
      let aiResponse = "";
      let postContent = "";
      
      if (message.toLowerCase().includes("leadership")) {
        postContent = "Leadership isn't about being in charge. It's about taking care of those in your charge.\n\nAfter 10+ years of leading teams, I've learned that the best leaders:\n\n1. Listen more than they speak\n2. Give credit, take blame\n3. Develop other leaders\n4. Make the hard decisions\n5. Stay curious and humble\n\nThe moment you think you've mastered leadership is the moment you've failed at it.\n\nWhat leadership lesson has been most valuable to you? #Leadership #PersonalGrowth";
        aiResponse = "I've created a leadership-focused post that reflects your professional voice. It's structured with a hook, personal insight, and a list format that typically performs well on LinkedIn. I've ended with a question to encourage engagement.";
      } else if (message.toLowerCase().includes("tech") || message.toLowerCase().includes("technology")) {
        postContent = "The most exciting tech isn't always the flashiest.\n\nWhile everyone's talking about AI and the metaverse, I'm equally impressed by these under-appreciated innovations:\n\n• Low-code platforms democratizing software development\n• Edge computing bringing processing power closer to data sources\n• Digital twins optimizing physical systems before they're built\n• Sustainable tech reducing the carbon footprint of our digital world\n\nSometimes the most transformative technologies are the ones working quietly in the background.\n\nWhat under-the-radar tech are you excited about? #Technology #Innovation #FutureTech";
        aiResponse = "I've crafted a technology-focused post that highlights your industry knowledge while taking a slightly contrarian angle. This approach tends to stand out in the feed and generate more thoughtful comments.";
      } else if (message.toLowerCase().includes("shorter") || message.toLowerCase().includes("concise")) {
        postContent = currentPostDraft ? currentPostDraft.split('\n\n')[0] + "\n\nThoughts?" : "Sometimes the most powerful message is the simplest one.\n\nWhat's one business truth you've learned that can be expressed in a single sentence?";
        aiResponse = "I've made your post more concise by focusing on the core message. Short, punchy posts often perform well when they contain a single powerful insight.";
      } else if (message.toLowerCase().includes("longer") || message.toLowerCase().includes("expand")) {
        const basePost = currentPostDraft || "Growth comes from discomfort.";
        postContent = basePost + "\n\nI was reminded of this recently when I took on a project completely outside my expertise. The learning curve was steep, and there were moments I questioned my decision.\n\nBut pushing through that discomfort led to:\n\n• New skills I wouldn't have developed otherwise\n• Connections with experts in different fields\n• A fresh perspective on my core work\n• Renewed confidence in my ability to adapt\n\nWhat uncomfortable challenge have you embraced recently? How did it change you? #PersonalGrowth #CareerDevelopment";
        aiResponse = "I've expanded your post with a personal narrative structure and specific benefits. This storytelling approach tends to resonate well with LinkedIn audiences and makes your insights more relatable.";
      } else {
        postContent = "The best career advice I never received:\n\nYour network isn't about who you know. It's about who knows what you're capable of.\n\nFor years, I focused on collecting connections rather than building relationships. I'd attend events, exchange cards, and add people on LinkedIn without any real follow-up.\n\nThat changed when I started approaching networking differently:\n\n• Helping others without expectation of return\n• Sharing knowledge openly\n• Celebrating others' wins publicly\n• Being consistent in my expertise areas\n• Following up meaningfully after meetings\n\nThe result? Opportunities now find me through people who understand my value, rather than me chasing every opportunity.\n\nHow has your approach to networking evolved? #CareerAdvice #Networking #ProfessionalDevelopment";
        aiResponse = "I've created a post about professional networking that follows the high-performing format of starting with a hook, sharing personal insight, and providing actionable tips. I've included a question at the end to encourage engagement.";
      }
      
      return {
        message: aiResponse,
        updatedPost: postContent,
        isSignificantUpdate: true
      };
    } catch (error) {
      console.error('Error in fetchAIResponse:', error);
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
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate a random post type
      const postTypes = ["leadership", "productivity", "career", "innovation", "work-life"];
      const randomType = postTypes[Math.floor(Math.random() * postTypes.length)];
      
      let postContent = "";
      let assistantMessage = "";
      
      // Generate different content based on the random type
      switch(randomType) {
        case "leadership":
          postContent = "Great leaders don't create followers. They create more leaders.\n\nAfter mentoring 20+ professionals throughout my career, I've noticed these 5 mentorship principles consistently help people grow:\n\n1. Ask questions instead of giving answers\n2. Share failures as openly as successes\n3. Celebrate their wins louder than your own\n4. Connect them with opportunities, not just advice\n5. Learn from them as much as they learn from you\n\nThe best part of leadership isn't the title—it's watching people you've supported achieve things they never thought possible.\n\nWhat's your most valuable mentorship experience? #Leadership #Mentorship #ProfessionalDevelopment";
          assistantMessage = "I've created a leadership-focused post about mentorship that showcases your experience while providing valuable insights. The list format makes it easily scannable, and the personal touch makes it relatable.";
          break;
        case "productivity":
          postContent = "I doubled my productivity by doing less.\n\nFor years, I operated under the illusion that being busy meant being productive. My calendar was packed, my to-do list endless.\n\nThen I tried a different approach:\n\n• Identifying the 20% of tasks that create 80% of value\n• Blocking 2 hours of deep work daily with no interruptions\n• Saying no to meetings without clear agendas\n• Batching similar tasks instead of constant context-switching\n• Setting boundaries on email/Slack response times\n\nThe result? More meaningful output, less burnout, and surprisingly, more recognition for my contributions.\n\nWhat productivity shift has made the biggest difference for you? #Productivity #WorkSmarter #TimeManagement";
          assistantMessage = "I've generated a post about productivity that takes a counterintuitive angle. This approach tends to grab attention, and the practical tips provide real value to your network.";
          break;
        case "career":
          postContent = "The career advice I wish I'd received 10 years ago:\n\nYour professional value isn't in knowing all the answers—it's in asking the right questions.\n\nEarly in my career, I thought success meant having solutions for everything. I've since learned that thoughtful questions create more impact:\n\n• They uncover assumptions that limit innovation\n• They build deeper relationships through genuine curiosity\n• They demonstrate critical thinking better than quick answers\n• They create space for collaborative problem-solving\n\nNow I measure growth by the quality of my questions, not just my answers.\n\nWhat question has led to your most significant professional breakthrough? #CareerAdvice #ProfessionalGrowth";
          assistantMessage = "I've crafted a reflective post about career development that positions you as both experienced and continuously learning. The focus on questions rather than answers creates an inviting space for meaningful engagement.";
          break;
        case "innovation":
          postContent = "Innovation rarely happens in brainstorming sessions.\n\nAfter leading product development across multiple industries, I've found that breakthrough ideas typically come from:\n\n1. Cross-pollination: Applying concepts from unrelated fields\n2. Constraint: Working within tight limitations that force creativity\n3. Observation: Watching users struggle with existing solutions\n4. Iteration: Small improvements that compound over time\n5. Collision: Unexpected connections between different perspectives\n\nThe most innovative companies don't just allocate time for innovation—they create the conditions where it naturally occurs.\n\nWhat's your most unexpected source of innovative ideas? #Innovation #ProductDevelopment #CreativeProblemSolving";
          assistantMessage = "I've generated a post about innovation that challenges conventional wisdom about brainstorming. The insights are based on practical experience rather than theory, which should resonate with your professional network.";
          break;
        case "work-life":
          postContent = "Work-life balance is a myth. Work-life harmony is the goal.\n\nBalance implies equal weight and separation. Harmony acknowledges that different areas of life can complement each other.\n\nThree shifts that helped me find harmony:\n\n1. From rigid boundaries to intentional integration\nI stopped compartmentalizing and started finding synergies between work projects and personal interests.\n\n2. From time management to energy management\nI schedule tasks based on when my energy matches their requirements, not just availability.\n\n3. From productivity guilt to presence\nI measure success by how fully I show up, not how many tasks I complete.\n\nThe result isn't perfect, but it's sustainable.\n\nHow do you create harmony between your professional and personal life? #WorkLifeHarmony #ProfessionalGrowth #Wellbeing";
          assistantMessage = "I've created a post about work-life harmony that offers a fresh perspective on a common topic. The structure moves from insight to practical shifts to results, making it both thoughtful and actionable.";
          break;
        default:
          postContent = "The most underrated professional skill? Effective communication.\n\nTechnical expertise gets you in the door, but clear communication helps you:\n\n• Turn complex ideas into compelling stories\n• Build trust across departments and hierarchies\n• Navigate difficult conversations with confidence\n• Advocate for your ideas and your team\n• Create alignment where there's confusion\n\nI've seen brilliant ideas fail due to poor communication and simple ideas succeed through masterful delivery.\n\nWhat communication technique has most improved your professional effectiveness? #Communication #ProfessionalDevelopment #LeadershipSkills";
          assistantMessage = "I've generated a post about communication skills that highlights their importance across all professional contexts. The format is easily digestible, and the question at the end encourages meaningful engagement.";
      }
      
      // Clear the processing timer
      clearInterval(processingTimerRef.current);
      
      setCurrentPost(postContent);
      setPostHistory(prev => [...prev, { 
        timestamp: new Date().toISOString(),
        content: postContent 
      }]);
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: assistantMessage }
      ]);
      
      toast({
        title: "New post generated",
        description: "Created based on your profile and current trends",
      });
    } catch (error) {
      console.error('Error generating new post:', error);
      
      toast({
        title: "Error",
        description: "Failed to generate a new post",
        variant: "destructive",
      });
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, but I encountered an error generating your post. Please try again."
      }]);
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
      <div className="flex justify-between items-center mb-6 md:mt-0 mt-10">
        <h1 className="text-2xl font-bold md:ml-0 ml-10">CoCreate</h1>
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

export default CoCreate;