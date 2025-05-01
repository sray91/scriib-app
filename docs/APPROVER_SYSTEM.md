# Approver Invitation System

This document explains how the approver invitation system works and how to troubleshoot common issues.

## Overview

The approver invitation system allows users (ghostwriters) to invite other users to approve their content before publishing. The process involves:

1. Sending an invitation email
2. The approver clicking the link in the email
3. The approver being redirected to accept the invitation
4. Creating a link between the ghostwriter and approver in the database

## Database Schema

The system relies on the following database tables:

- `auth.users` - Supabase's built-in user authentication table
- `public.profiles` - User profile information
- `public.ghostwriter_approver_link` - Links between ghostwriters and approvers

The `ghostwriter_approver_link` table has foreign key constraints to `auth.users` for both the ghostwriter and approver IDs.

## Invitation Flow

1. **Invitation Sent**: 
   - User enters an email address to invite an approver
   - System checks if the email already exists in the system
   - If the user exists, creates a link in the database
   - If the user doesn't exist, sends an invitation email

2. **Authentication**: 
   - Approver clicks the link in the email
   - They're redirected to `/auth/callback` with a code parameter
   - If not logged in, they're redirected to login/signup

3. **Acceptance**:
   - After authentication, approver is redirected to `/accept`
   - System verifies the ghostwriter exists
   - System creates or activates the approver-ghostwriter link
   - Success/error message is displayed

## Troubleshooting

### Common Issues

1. **"Could not find the user who invited you"**:
   - Cause: The ghostwriter ID in the URL doesn't exist in the database
   - Solution: Verify the ghostwriter exists in `auth.users` and has a profile

2. **Foreign Key Constraint Errors**:
   - Cause: Trying to create a link to a user that doesn't exist in `auth.users`
   - Solution: Ensure both users exist before creating the link

3. **Redirect Issues**:
   - Cause: Incorrect environment variables (especially in production)
   - Solution: Check `NEXT_PUBLIC_SITE_URL` and `APPROVER_CALLBACK_URL` for trailing slashes and correct domains

### Database Setup

Run the following SQL to ensure proper setup:

```sql
-- Ensure the ghostwriter_approver_link table exists
CREATE TABLE IF NOT EXISTS public.ghostwriter_approver_link (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ghostwriter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT ghostwriter_approver_link_unique UNIQUE (ghostwriter_id, approver_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS ghostwriter_approver_link_ghostwriter_idx 
ON public.ghostwriter_approver_link(ghostwriter_id);

CREATE INDEX IF NOT EXISTS ghostwriter_approver_link_approver_idx 
ON public.ghostwriter_approver_link(approver_id);

-- Helper RPC function to get user details safely
CREATE OR REPLACE FUNCTION public.get_user_details(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
) 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(
      (u.raw_user_meta_data->>'full_name')::TEXT,
      (u.raw_user_meta_data->>'name')::TEXT,
      u.email
    ) AS full_name
  FROM
    auth.users u
  WHERE
    u.id = user_id;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_user_details(UUID) TO authenticated;
```

## Environment Variables

Ensure these environment variables are properly set:

```
# Site URLs - NO trailing slashes!
NEXT_PUBLIC_SITE_URL=https://your-domain.com
APPROVER_CALLBACK_URL=https://your-domain.com/auth/callback
``` 