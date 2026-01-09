import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { anthropic } from '../lib/clients.js';
import fs from 'fs';
import path from 'path';

// Configure the API route for hook generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Shorter timeout for hook generation

// Load hooks knowledge base
let hooksGuide = '';
try {
  const hooksPath = path.join(process.cwd(), 'lib', 'hooks', 'HOOKS_GUIDE.md');
  hooksGuide = fs.readFileSync(hooksPath, 'utf8');
  console.log('📚 HOOKS_GUIDE.md loaded successfully');
} catch (error) {
  console.error('❌ Could not load HOOKS_GUIDE.md:', error.message);
}

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
    const { userMessage, contextUserId } = body;

    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }

    console.log(`🎣 Hook generation request from user ${user.id}: "${userMessage.substring(0, 100)}..."`);

    // Determine which user's context to use
    let targetUserId = user.id;
    if (contextUserId && contextUserId !== user.id) {
      // Validate access (reuse validation logic)
      const hasAccess = await validateUserAccess(supabase, user.id, contextUserId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to use this user\'s context data' },
          { status: 403 }
        );
      }
      targetUserId = contextUserId;
    }

    // Fetch user's context guide
    let contextGuide = null;
    const { data: prefsData, error: prefsError } = await supabase
      .from('user_preferences')
      .select('settings')
      .eq('user_id', targetUserId)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('Error fetching user preferences:', prefsError);
    } else if (prefsData?.settings?.contextGuide) {
      contextGuide = prefsData.settings.contextGuide;
      console.log('📖 Context guide loaded for hook generation');
    }

    // Generate hooks using Claude with HOOKS_GUIDE.md
    const result = await generateHooksWithClaude(
      userMessage,
      contextGuide,
      hooksGuide,
      targetUserId
    );

    return NextResponse.json({
      success: true,
      hooks: result.hooks,
      processingDetails: result.processingDetails,
      contextGuideUsed: !!contextGuide,
      hooksGuideUsed: !!hooksGuide
    });

  } catch (error) {
    console.error('Error in hooks generation API:', error);

    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Hook generation is taking longer than expected. Please try again.' },
        { status: 408 }
      );
    } else if (error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'AI service rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to generate hooks. Please try again.' },
        { status: 500 }
      );
    }
  }
}

/**
 * Generate hooks using Claude with HOOKS_GUIDE.md knowledge
 */
async function generateHooksWithClaude(userMessage, contextGuide, hooksGuide, userId) {
  if (!anthropic) {
    throw new Error('Claude API not available');
  }

  // Build comprehensive prompt with hooks guide
  let prompt = `You are an expert LinkedIn hook creator with deep knowledge of viral content patterns.

USER REQUEST: "${userMessage}"

HOOKS GUIDE KNOWLEDGE:
${hooksGuide}

`;

  // Add context guide if available
  if (contextGuide) {
    prompt += `USER'S PERSONAL CONTEXT GUIDE:
This defines their unique voice, expertise, and content approach:

${contextGuide}

IMPORTANT: Use this context guide to understand their voice and expertise areas when creating hooks.

`;
  }

  prompt += `TASK:
Based on the hooks guide knowledge above, create 12 compelling hooks for the user's request.

Requirements from the HOOKS GUIDE:
1. **Target the 4 eternal markets**: Health, Wealth, Relationships, Happiness
2. **Stop the scroll in 3 seconds**: Each hook must grab attention immediately
3. **Use proven angles**: Insider's Take, Good vs Bad, Before & After, Problem vs Solution, etc.
4. **Be polarizing and confident**: Aim to shock, can't make everyone happy
5. **Include specific numbers and timeframes**: Make it concrete and believable
6. **Spark emotions**: LOL, WTF, AWW, WOW, NSFW, AHA, FINALLY, YAY
7. **One complete sentence each**: Clear and concise
8. **Show benefits**: More money, faster growth, better relationships, etc.

Use the specific hook patterns from the guide:
- Insider's Take: Harsh truths, brutal lessons, counterintuitive mistakes
- Good vs Bad: Contrast what people should stop vs start doing
- Before & After: Transformation stories with specific timeframes
- Problem vs Solution: Call out wrong approach, offer right way
- Competency: Impressive achievements with timeframes
- Personal Stories: Specific stories with lessons learned
- Questions: Target pain points with thresholds/outcomes
- Polarizing: Controversial but confident opinions
- Misdirect: Challenge beliefs, offer alternatives
- Relatable: Personal struggles overcome with tactics

${contextGuide ? 'Match the user\'s voice and expertise areas from their context guide.' : 'Use a professional, engaging tone.'}

Return ONLY the numbered hooks 1-12, one per line. Each should be a complete, ready-to-use opening line.`;

  try {
    // Call Claude with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API timeout')), 25000);
    });

    const message = await Promise.race([
      anthropic.messages.create({
        model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
      timeoutPromise
    ]);

    const hooksResponse = message.content[0].text.trim();

    // Parse hooks from response
    const hookLines = hooksResponse.split('\n').filter(line => line.trim());
    const hooks = hookLines.map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(hook => hook.length > 0);

    return {
      hooks,
      processingDetails: {
        model: "Claude 3.5 Sonnet",
        hooksGuideUsed: !!hooksGuide,
        contextGuideUsed: !!contextGuide,
        hooksGenerated: hooks.length,
        responseLength: hooksResponse.length
      }
    };

  } catch (error) {
    console.error('Claude hook generation failed:', error);
    throw new Error(`Failed to generate hooks: ${error.message}`);
  }
}

/**
 * Validate user access for cross-user context usage
 */
async function validateUserAccess(supabase, currentUserId, targetUserId) {
  try {
    // If user is accessing their own data, allow it
    if (currentUserId === targetUserId) {
      return true;
    }

    // Check if current user is linked to target user through ghostwriter_approver_link
    const { data, error } = await supabase
      .from('ghostwriter_approver_link')
      .select('*')
      .or(`and(ghostwriter_id.eq.${currentUserId},approver_id.eq.${targetUserId}),and(ghostwriter_id.eq.${targetUserId},approver_id.eq.${currentUserId})`)
      .eq('active', true);

    if (error) throw error;

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}
