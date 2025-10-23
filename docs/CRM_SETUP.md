# CRM Setup Guide

This guide explains how to set up and use the CRM feature that populates contact data from LinkedIn using Apify.

## Overview

The CRM feature scrapes your LinkedIn profile to:
1. Find your last 5 posts
2. Extract engagement data (likes and comments) from each post
3. Store contact information (name, job title, company, profile URL) in your CRM

## Prerequisites

### 1. Apify Account Setup

1. Sign up for an Apify account at https://apify.com
2. Get your API token from https://console.apify.com/account/integrations
3. Subscribe to the following actors (or find similar alternatives):
   - **LinkedIn Profile Posts Scraper** - Extracts post URLs from a profile
   - **LinkedIn Posts Engagers** - Extracts likers and commenters from posts

### 2. Environment Variables

Add the following to your `.env.local` file:

```bash
APIFY_API_TOKEN=your_apify_api_token_here
```

### 3. Database Setup

Run the following SQL migrations in your Supabase dashboard (SQL Editor):

#### Step 1: Add LinkedIn URL to profiles
```bash
# Run this file in Supabase SQL Editor:
lib/table-definitions/profiles_add_linkedin_url.sql
```

#### Step 2: Create CRM contacts table
```bash
# Run this file in Supabase SQL Editor:
lib/table-definitions/crm_contacts.sql
```

## How to Use

### 1. Add Your LinkedIn Profile URL

1. Go to **Settings** → **Profile** tab
2. Add your LinkedIn profile URL (e.g., `https://www.linkedin.com/in/yourname/`)
3. Save your profile

### 2. Populate Your CRM

1. Navigate to `/crm` in your app
2. Click the **"Populate from LinkedIn"** button
3. The system will:
   - Scrape your last 5 LinkedIn posts
   - For each post, extract all likers and commenters
   - Store their contact information in your CRM

### 3. View and Search Contacts

- All contacts are displayed in a table with:
  - Name
  - Job Title
  - Company
  - Engagement Type (like or comment)
  - Source Post (link to the post where they engaged)
  - LinkedIn Profile (link to their profile)
- Use the search bar to filter contacts by name, job title, or company

## Features

### Automatic Deduplication
- Contacts are stored with a unique constraint on `user_id` + `profile_url`
- If the same person engages with multiple posts, their information is updated rather than duplicated

### Row Level Security
- Each user can only see their own CRM contacts
- All database queries are automatically scoped to the authenticated user

### Real-time Updates
- After scraping completes, the contact list automatically refreshes
- Toast notifications show progress and results

## Cost Estimation

Based on Apify pricing:
- **LinkedIn Profile Posts Scraper**: ~$0.03 per run (5 posts)
- **LinkedIn Posts Engagers**: ~$0.005 per post
- **Total per CRM populate**: ~$0.055 (5 posts × $0.011)

Example: If you populate your CRM once per week, monthly cost ≈ $0.22

## Troubleshooting

### "LinkedIn URL Required" Error
- Make sure you've added your LinkedIn profile URL in Settings → Profile

### "Apify API token not configured" Error
- Verify that `APIFY_API_TOKEN` is set in your `.env.local` file
- Restart your development server after adding the environment variable

### Scraping Timeout
- The default timeout is 5 minutes per step
- If scraping takes longer, check your Apify dashboard for actor run status
- You may need to adjust the `maxAttempts` value in `/app/api/crm/scrape-linkedin/route.js`

### Wrong Actor IDs
- The current implementation uses placeholder actor IDs:
  - `apify/linkedin-profile-posts-scraper`
  - `apify/linkedin-posts-engagers`
- Replace these with the actual actor IDs from your Apify account
- Find actor IDs in the Apify Store or your actor's settings

## API Route Details

### Endpoint
`POST /api/crm/scrape-linkedin`

### Request Body
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/yourname/"
}
```

### Response
```json
{
  "success": true,
  "contactsAdded": 42,
  "postsScraped": 5
}
```

## Database Schema

### Table: `crm_contacts`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users (foreign key) |
| profile_url | TEXT | LinkedIn profile URL (unique per user) |
| name | TEXT | Contact's full name |
| job_title | TEXT | Contact's job title |
| company | TEXT | Contact's company name |
| email | TEXT | Contact's email (if available) |
| engagement_type | TEXT | 'like' or 'comment' |
| post_url | TEXT | URL of the post where engagement occurred |
| scraped_at | TIMESTAMP | When the data was scraped |
| created_at | TIMESTAMP | When the record was created |
| updated_at | TIMESTAMP | When the record was last updated |

### Indexes
- `user_id` - For fast user-scoped queries
- `created_at` - For chronological sorting
- `name` - For search functionality
- `company` - For company-based filtering

## Future Enhancements

Potential features to add:
- Email enrichment using third-party APIs
- Export contacts to CSV
- Contact notes and tags
- Engagement scoring (frequent vs. one-time engagers)
- Filter by engagement type, company, or date range
- Automatic periodic syncing (scheduled jobs)
- Integration with email marketing tools
- Bulk LinkedIn message sending (via LinkedIn API)

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Review Apify actor run logs in the Apify dashboard
3. Verify database table structure in Supabase
4. Ensure all environment variables are correctly set
