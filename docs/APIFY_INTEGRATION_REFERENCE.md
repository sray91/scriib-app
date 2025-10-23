# Apify Integration Reference

## Quick Setup

### 1. Get API Token
```bash
# Visit: https://console.apify.com/account/integrations
# Copy your API token
# Add to .env.local:
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxx
```

### 2. Find Actor IDs

Visit Apify Store and search for these actors:
- **LinkedIn Profile Posts Scraper (No Cookies)** - Gets post URLs
- **LinkedIn Posts Engagers (No Cookies)** - Gets likers/commenters

Actor ID format: `username/actor-name`
Example: `apify/linkedin-scraper`

### 3. Update Code

In `/app/api/crm/scrape-linkedin/route.js`:

```javascript
// Line ~37
const postsActorId = 'YOUR_USERNAME/posts-actor-name'

// Line ~77
const engagementsActorId = 'YOUR_USERNAME/engagements-actor-name'
```

## Apify API Endpoints Used

### Start Actor Run
```javascript
POST https://api.apify.com/v2/acts/{actorId}/runs?token={token}

Body:
{
  "profileUrl": "https://linkedin.com/in/username",
  "maxPosts": 5
}

Response:
{
  "data": {
    "id": "run_id_here",
    "status": "RUNNING"
  }
}
```

### Check Run Status
```javascript
GET https://api.apify.com/v2/actor-runs/{runId}?token={token}

Response:
{
  "data": {
    "status": "SUCCEEDED",  // or RUNNING, FAILED
    "defaultDatasetId": "dataset_id_here"
  }
}
```

### Get Results
```javascript
GET https://api.apify.com/v2/datasets/{datasetId}/items?token={token}

Response: Array of results
[
  {
    "url": "https://linkedin.com/posts/...",
    "name": "John Doe",
    "jobTitle": "Software Engineer",
    "company": "Tech Corp",
    "profileUrl": "https://linkedin.com/in/johndoe",
    "type": "like"  // or "comment"
  }
]
```

## Actor Input Schema

### Posts Scraper Input
```json
{
  "profileUrl": "https://www.linkedin.com/in/username/",
  "maxPosts": 5
}
```

**Expected Output:**
```json
[
  {
    "url": "https://www.linkedin.com/posts/...",
    "text": "Post content...",
    "likes": 42,
    "comments": 5,
    "postedAt": "2025-01-15T10:30:00Z"
  }
]
```

### Engagements Scraper Input
```json
{
  "postUrl": "https://www.linkedin.com/posts/..."
}
```

**Expected Output:**
```json
[
  {
    "profileUrl": "https://www.linkedin.com/in/johndoe",
    "name": "John Doe",
    "jobTitle": "Software Engineer",
    "company": "Tech Corp",
    "type": "like"
  },
  {
    "profileUrl": "https://www.linkedin.com/in/janedoe",
    "name": "Jane Doe",
    "jobTitle": "Product Manager",
    "company": "Startup Inc",
    "type": "comment"
  }
]
```

## Implementation Flow

```javascript
// Step 1: Start posts scraper
const postsRun = await fetch(
  `https://api.apify.com/v2/acts/${postsActorId}/runs?token=${token}`,
  {
    method: 'POST',
    body: JSON.stringify({ profileUrl, maxPosts: 5 })
  }
)

// Step 2: Poll until complete
while (status !== 'SUCCEEDED') {
  await sleep(5000)
  const statusCheck = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
  )
  // Check status
}

// Step 3: Get results
const posts = await fetch(
  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
)

// Step 4: Repeat for each post to get engagements
for (const post of posts) {
  const engagementsRun = await fetch(...)
  // ... same polling and retrieval process
}
```

## Error Handling

### Common Actor Statuses
- `READY` - Waiting to start
- `RUNNING` - Currently executing
- `SUCCEEDED` - Completed successfully
- `FAILED` - Execution failed
- `TIMED-OUT` - Exceeded time limit
- `ABORTED` - Manually stopped

### Error Responses

**401 Unauthorized**
```json
{
  "error": {
    "type": "token-not-provided",
    "message": "Authentication token was not provided"
  }
}
```
**Fix**: Check `APIFY_API_TOKEN` in `.env.local`

**404 Not Found**
```json
{
  "error": {
    "type": "record-not-found",
    "message": "Actor not found"
  }
}
```
**Fix**: Verify actor ID is correct

**402 Payment Required**
```json
{
  "error": {
    "type": "insufficient-credit",
    "message": "You don't have enough credit"
  }
}
```
**Fix**: Add credit to Apify account

## Timeout Configuration

Current implementation waits up to **5 minutes** per actor:

```javascript
const maxAttempts = 60  // attempts
const pollInterval = 5000  // 5 seconds
// Total max wait: 60 × 5 = 300 seconds = 5 minutes
```

To adjust:
```javascript
// In /app/api/crm/scrape-linkedin/route.js
const maxAttempts = 120  // 10 minutes
const pollInterval = 3000  // 3 seconds
```

## Alternative Actors

If the suggested actors don't work, search for alternatives:

### Keywords to Search
- "LinkedIn profile scraper"
- "LinkedIn post scraper"
- "LinkedIn engagement scraper"
- "LinkedIn reactions scraper"

### Filter Criteria
- ⭐ Rating: 4+ stars
- 📊 Runs: 1,000+ successful runs
- 🆓 Pricing: Free tier available
- 🍪 Cookie-free: "No cookies" or "No login required"

## Testing Actors Manually

Before integrating, test actors in Apify Console:

1. Go to https://console.apify.com
2. Navigate to **Actors** → **Store**
3. Find your actor
4. Click **"Try for free"**
5. Input test data:
   ```json
   {
     "profileUrl": "https://www.linkedin.com/in/your-profile"
   }
   ```
6. Click **"Start"**
7. View results in **Dataset** tab
8. Verify output format matches expected schema

## API Rate Limits

Apify applies the following limits:

- **Free tier**: 25 actor runs per month
- **Paid tier**: Unlimited runs (pay per compute time)
- **Concurrent runs**: Varies by plan (typically 10-100)

**Tip**: Monitor usage at https://console.apify.com/billing/usage

## Cost Optimization

### Reduce Costs
1. **Limit posts**: Reduce `maxPosts` from 5 to 3
2. **Cache results**: Store in DB, refresh weekly
3. **Filter engagements**: Only scrape posts with 10+ likes
4. **Batch processing**: Collect multiple users, run overnight

### Example Cost Calculation
```
Current: 5 posts × $0.011/post = $0.055 per populate
Optimized: 3 posts × $0.011/post = $0.033 per populate
Savings: 40% reduction
```

## Webhook Alternative (Advanced)

Instead of polling, use webhooks for async processing:

```javascript
// When starting actor run
POST https://api.apify.com/v2/acts/{actorId}/runs?token={token}
{
  "profileUrl": "...",
  "webhooks": [
    {
      "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
      "requestUrl": "https://yourapp.com/api/crm/webhook"
    }
  ]
}
```

Benefits:
- No polling overhead
- Instant notification when complete
- Reduced API calls

## Debugging

### Enable Verbose Logging

In `/app/api/crm/scrape-linkedin/route.js`:

```javascript
// Add detailed logging
console.log('Step 1: Starting posts scraper...')
console.log('Actor ID:', postsActorId)
console.log('Profile URL:', linkedinUrl)
console.log('Run ID:', postsRunId)
console.log('Status:', statusData.data.status)
console.log('Dataset ID:', postsDatasetId)
console.log('Posts found:', postsData.length)
```

### Check Apify Dashboard

1. Visit https://console.apify.com/actors/runs
2. Find your run by timestamp
3. View logs for errors
4. Check dataset for output format

### Common Issues

**No results returned**
- ✓ Check if profile is public
- ✓ Verify profile URL format
- ✓ Ensure recent posts exist (<6 months)

**Actor fails immediately**
- ✓ Check actor input schema
- ✓ Verify actor is active (not deprecated)
- ✓ Review actor documentation

**Timeout errors**
- ✓ Increase `maxAttempts`
- ✓ Check Apify system status
- ✓ Try different time of day (less load)

## Support Resources

- **Apify Docs**: https://docs.apify.com
- **API Reference**: https://docs.apify.com/api/v2
- **Community Forum**: https://community.apify.com
- **Discord**: https://discord.com/invite/jyEM2PRvMU

## Example: Complete API Request

```bash
# Start actor run
curl -X POST https://api.apify.com/v2/acts/apify/linkedin-profile-posts-scraper/runs \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/yourname/",
    "maxPosts": 5
  }' \
  -G -d "token=apify_api_xxxxx"

# Response
{
  "data": {
    "id": "abc123",
    "status": "RUNNING"
  }
}

# Check status (after 30 seconds)
curl https://api.apify.com/v2/actor-runs/abc123?token=apify_api_xxxxx

# Response
{
  "data": {
    "status": "SUCCEEDED",
    "defaultDatasetId": "dataset123"
  }
}

# Get results
curl https://api.apify.com/v2/datasets/dataset123/items?token=apify_api_xxxxx

# Response: Array of posts with URLs
```

---

**Last Updated**: 2025-01-23
**Status**: Ready for integration
