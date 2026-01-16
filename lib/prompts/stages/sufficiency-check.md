# Information Sufficiency Check

Before generating content, you must verify we have enough information to write an authentic post without fabricating.

## User Request

{{userRequest}}

## Available Context

{{#if contextGuide}}
**Context Guide Available:** Yes ({{contextGuideWords}} words)
{{else}}
**Context Guide Available:** No
{{/if}}

{{#if pastPostsCount}}
**Past Posts Available:** {{pastPostsCount}} posts
{{else}}
**Past Posts Available:** None
{{/if}}

{{#if additionalContext}}
**Additional Context Provided:**
{{additionalContext}}
{{/if}}

## Content Type Detection

Based on the request, identify what type of post this is:

| Type | Requires | Optional |
|------|----------|----------|
| Personal Story | Specific event, outcome/lesson | Date, people involved |
| Thought Leadership | Main argument, supporting evidence | Contrarian angle |
| How-To/Tips | Topic, steps or tips | Personal experience |
| Announcement | What happened, why it matters | Next steps, gratitude |
| Question/Poll | Clear question, context | Your take on the answer |
| Observation | The observation, insight | Examples |

## Your Task

Analyze whether we have sufficient information to write this post authentically.

## Output Format

Return your analysis in this exact JSON format:

```json
{
  "detected_content_type": "<personal_story|thought_leadership|how_to|announcement|question|observation>",
  "information_provided": [
    "List each piece of concrete information we have"
  ],
  "information_missing": [
    {
      "item": "What's missing",
      "importance": "<required|recommended|optional>",
      "why_needed": "Why this would improve the post"
    }
  ],
  "can_write_authentically": <true|false>,
  "confidence": "<high|medium|low>",
  "recommendation": "<proceed|ask_questions|cannot_proceed>",
  "questions_to_ask": [
    {
      "question": "Specific question to ask the user",
      "purpose": "What this will help with"
    }
  ],
  "writing_guidance": "If proceeding, specific guidance for the content draft stage"
}
```

## Decision Rules

- **proceed**: We have all required info, can write without fabricating
- **ask_questions**: Missing required/recommended info, should clarify first
- **cannot_proceed**: Request is too vague or would require significant fabrication

### Critical Rules by Content Type

**Personal stories**: ALWAYS require specific details. Never proceed with generic "a time when..." framing. If they say "write about a time I learned X" without providing the actual story, ask_questions.

**Thought leadership**: Can proceed with principles/frameworks, but ONLY if:
- The user provided a clear opinion/argument to make
- OR the user's context guide contains relevant expertise
- If proceeding, set writing_guidance to explicitly forbid adding fake personal anecdotes

**How-to/Tips**: Can proceed if topic is clear. Forbid fake "when I tried this..." framing.

**Observation**: Can proceed if observation is clear. Forbid fake "I noticed when I..." framing.

### The Fabrication Trap

The biggest failure mode is: user gives vague input → we classify as "thought leadership" → we proceed → the generation model adds fake personal stories to make it "engaging."

**To prevent this**: If the request is vague enough that the generation model might be tempted to invent a story to make it interesting, ask_questions instead. Better to clarify than to produce LinkedIn slop.

**Red flags that require clarification:**
- "Write about [vague topic]" with no angle or opinion
- "Share my thoughts on [X]" without actual thoughts provided
- "Something about [topic]" - too vague
- Anything that would benefit from a personal example but none was provided

Now analyze the request:
