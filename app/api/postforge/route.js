import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_POSTFORGE_API_KEY,
});

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    const { userMessage, currentDraft, action } = body;
    
    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // 1. Fetch user's LinkedIn account
    const { data: linkedInAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single();
    
    if (accountError && accountError.code !== 'PGRST116') {
      console.error('Error fetching LinkedIn account:', accountError);
    }
    
    // 2. Fetch user's past LinkedIn posts (if available)
    let pastPosts = [];
    if (linkedInAccount?.access_token && linkedInAccount?.platform_user_id) {
      pastPosts = await fetchUserLinkedInPosts(linkedInAccount.access_token, linkedInAccount.platform_user_id);
    } else {
      // If no LinkedIn account, use mock data or fetch from your database
      pastPosts = await fetchUserPostsFromDatabase(user.id);
    }
    
    // 3. Fetch top-performing LinkedIn posts in relevant categories
    const topPosts = await fetchTopLinkedInPosts();
    
    // 4. Generate or refine post content using AI
    const result = await generatePostContent(userMessage, currentDraft, action, pastPosts, topPosts);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in postforge API:', error);
    return NextResponse.json(
      { message: "Internal server error", error: "server_error" }, 
      { status: 500 }
    );
  }
}

// Function to fetch user's past LinkedIn posts
async function fetchUserLinkedInPosts(accessToken, platformUserId) {
  try {
    // Call LinkedIn API to get user's posts
    const response = await fetch(
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${platformUserId})`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304',
      }
    });
    
    if (!response.ok) {
      console.error('LinkedIn API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    // Transform the response into a more usable format
    return (data.elements || []).map(post => {
      try {
        const content = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
        const likes = post.socialDetail?.totalSocialActivityCounts?.numLikes || 0;
        const comments = post.socialDetail?.totalSocialActivityCounts?.numComments || 0;
        const shares = post.socialDetail?.totalSocialActivityCounts?.numShares || 0;
        
        return {
          id: post.id,
          content,
          engagement: { likes, comments, shares },
          timestamp: post.created?.time
        };
      } catch (e) {
        console.error('Error parsing LinkedIn post:', e);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error('Error fetching LinkedIn posts:', error);
    return [];
  }
}

// Fallback function to fetch posts from your database if LinkedIn is not connected
async function fetchUserPostsFromDatabase(userId) {
  // This would be your implementation to fetch posts from your database
  // For now, we'll return mock data
  return [
    {
      id: 'post1',
      content: 'Excited to announce our new product launch! #innovation #tech',
      engagement: { likes: 45, comments: 12, shares: 8 },
      timestamp: '2023-10-15T14:30:00Z'
    },
    {
      id: 'post2',
      content: 'Just finished an amazing workshop with our team. The creativity and collaboration were inspiring! Looking forward to implementing these new ideas. #teamwork #leadership',
      engagement: { likes: 78, comments: 23, shares: 15 },
      timestamp: '2023-09-28T10:15:00Z'
    },
    {
      id: 'post3',
      content: 'Reflecting on the challenges and opportunities in our industry today. What trends are you seeing? I\'d love to hear your thoughts in the comments below.',
      engagement: { likes: 32, comments: 41, shares: 5 },
      timestamp: '2023-09-10T16:45:00Z'
    }
  ];
}

// Function to fetch top-performing LinkedIn posts
async function fetchTopLinkedInPosts() {
  // In a real implementation, you might use a service that provides trending content
  // For now, we'll return mock data
  return [
    {
      content: 'Three key lessons I learned from scaling our startup to 100 employees in 18 months:\n\n1. Culture eats strategy for breakfast\n2. Hire for attitude, train for skill\n3. Communicate until you\'re sick of hearing yourself\n\nWhat lessons have you learned from scaling your business?',
      engagement: { likes: 1245, comments: 89, shares: 134 }
    },
    {
      content: 'I asked ChatGPT to help me write a cold email. The results shocked me.\n\nOpen rate: 78%\nResponse rate: 42%\nMeetings booked: 12\n\nAI isn\'t replacing jobs. It\'s replacing people who don\'t know how to use AI.',
      engagement: { likes: 3567, comments: 245, shares: 567 }
    },
    {
        content: 'The best career advice I\'ve ever received:\n\n"Your network is your net worth."\n\nSimple but powerful.',
      engagement: { likes: 2134, comments: 156, shares: 321 }
    }
  ];
}

// Function to generate or refine post content using AI
async function generatePostContent(userMessage, currentDraft, action, pastPosts, topPosts) {
  // Format past posts for the AI prompt
  const pastPostsText = pastPosts.map(post => 
    `Post: "${post.content}"\nEngagement: ${post.engagement.likes} likes, ${post.engagement.comments} comments, ${post.engagement.shares} shares`
  ).join('\n\n');
  
  // Format top posts for the AI prompt
  const topPostsText = topPosts.map(post => 
    `Post: "${post.content}"\nEngagement: ${post.engagement.likes} likes, ${post.engagement.comments} comments, ${post.engagement.shares} shares`
  ).join('\n\n');
  
  // Create the system prompt
  let systemPrompt = `You are PostForge, an expert LinkedIn post writer assistant. Your task is to ${action === 'refine' ? 'refine' : 'create'} a LinkedIn post that matches the user's personal style while incorporating elements from top-performing posts.

PAST POSTS BY THE USER (for style analysis):
${pastPostsText || "No past posts available."}

TOP-PERFORMING LINKEDIN POSTS (for inspiration):
${topPostsText}

GUIDELINES:
1. Maintain the user's authentic voice and style based on their past posts
2. Incorporate elements that drive engagement (questions, lists, personal stories, etc.)
3. Keep the post concise and impactful
4. Use appropriate formatting (line breaks, emojis if appropriate)
5. Include a call to action when relevant
`;

  // Create the user prompt
  let userPrompt = action === 'refine' 
    ? `Please refine this LinkedIn post draft based on my feedback: 
    
CURRENT DRAFT:
${currentDraft}

MY FEEDBACK:
${userMessage}`
    : `Please create a LinkedIn post based on this idea: ${userMessage}`;
  
  try {
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4.5-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    // Extract the generated content
    const assistantMessage = completion.choices[0].message.content;
    
    // Extract the post content (assuming the AI formats it properly)
    // In a real implementation, you might want to parse this more carefully
    let postContent = assistantMessage;
    
    // If the response contains explanations, try to extract just the post
    if (assistantMessage.includes("Here's the refined post:")) {
      postContent = assistantMessage.split("Here's the refined post:")[1].trim();
    } else if (assistantMessage.includes("Here's the post:")) {
      postContent = assistantMessage.split("Here's the post:")[1].trim();
    }
    
    // Determine if this is a significant update
    const isSignificantUpdate = action === 'create' || 
      (currentDraft && levenshteinDistance(currentDraft, postContent) > currentDraft.length * 0.2);
    
    return {
      assistantMessage,
      postContent,
      isSignificantUpdate,
      processingSteps: [
        "Analyzed your past LinkedIn posts to understand your writing style",
        "Reviewed top-performing content for inspiration",
        "Generated content that matches your voice while optimizing for engagement",
        action === 'refine' ? "Refined your draft based on your feedback" : "Created a new post based on your idea"
      ]
    };
  } catch (error) {
    console.error("Error generating post content:", error);
    
    // Check if it's a rate limit error from OpenAI
    if (error.status === 429 || 
        (error.error && error.error.type === 'insufficient_quota') ||
        (error.message && error.message.includes('quota'))) {
      
      return { 
        message: "You've reached the API rate limit. Please try again later.",
        error: "rate_limit_exceeded"
      };
    }
    
    // For other errors
    return { 
      message: "Failed to generate post content",
      error: "generation_failed"
    };
  }
}

// Helper function to calculate Levenshtein distance (edit distance) between two strings
// Used to determine if an update is "significant"
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Initialize the first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}