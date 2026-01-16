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

For personal stories: ALWAYS require specific details from the user. Never proceed with generic "a time when..." stories.

For thought leadership: Can proceed with principles/frameworks even without personal examples.

Now analyze the request:
