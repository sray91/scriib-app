# Environment Variables

This document lists all environment variables used in the Creator Task App and explains their purpose.

## Authentication Variables

### General Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL` - The URL of your Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - The public anonymous key for your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` - The service role key for admin operations (required for certain operations)

### Site URLs
- `NEXT_PUBLIC_SITE_URL` - The base URL of your application (e.g. http://localhost:3000 for development or https://your-app.com for production)

### Approver Invitation 
- `APPROVER_CALLBACK_URL` - The URL to redirect approvers to after they click the authentication link in their email
  - Example for development: `http://localhost:3000/auth/callback`
  - Example for production: `https://your-app.com/auth/callback`

### Social Login - Twitter
- `TWITTER_CLIENT_ID` - Your Twitter API client ID
- `TWITTER_CLIENT_SECRET` - Your Twitter API client secret
- `TWITTER_REDIRECT_URI` - The redirect URI for Twitter authentication callbacks
  - Example: `http://localhost:3000/api/auth/twitter/callback` (development)
  - Example: `https://your-app.com/api/auth/twitter/callback` (production)

### Social Login - LinkedIn
- `LINKEDIN_CLIENT_ID` - Your LinkedIn API client ID
- `LINKEDIN_CLIENT_SECRET` - Your LinkedIn API client secret
- `LINKEDIN_REDIRECT_URI` - The redirect URI for LinkedIn authentication callbacks
  - Example: `http://localhost:3000/api/auth/linkedin/callback` (development)
  - Example: `https://your-app.com/api/auth/linkedin/callback` (production)

## Setting Up Environment Variables

1. Create a `.env.local` file in the root of your project
2. Copy the variables from above and set their values according to your environment
3. For production deployment, configure these environment variables in your hosting platform (Vercel, etc.)

Example `.env.local` file for development:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
APPROVER_CALLBACK_URL=http://localhost:3000/auth/callback

# Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_REDIRECT_URI=http://localhost:3000/api/auth/twitter/callback

# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
```

## Notes

- Never commit your `.env.local` file to version control
- Different environments (development, staging, production) should have different values for these variables
- For local development, you may need to restart your development server after changing environment variables 