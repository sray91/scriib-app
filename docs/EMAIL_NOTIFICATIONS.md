# Email Notifications Setup Guide

This document explains how to set up email notifications for the Scriib App, specifically for approval notifications when posts are submitted for review.

## Overview

The email notification system sends emails to approvers when:
- A user submits a post for approval (`status: 'pending_approval'`)
- The post has an `approver_id` assigned

## Email Service Options

The system supports multiple email service providers with automatic fallback:

### Option 1: Supabase SMTP (Recommended for existing Supabase users)

Configure SMTP in your `supabase/config.toml`:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"  # or your SMTP provider
port = 587
user = "apikey"  # or your SMTP username
pass = "env(SENDGRID_API_KEY)"  # or your SMTP password
admin_email = "notifications@yourdomain.com"
sender_name = "Scriib Notifications"
```

### Option 2: Resend (Recommended for new setups)

1. Install Resend:
```bash
npm install resend
```

2. Add environment variable:
```env
RESEND_API_KEY=your_resend_api_key_here
```

3. Update the email service to use Resend (uncomment the Resend implementation in `lib/services/emailService.js`)

### Option 3: Nodemailer with Custom SMTP

1. Install Nodemailer:
```bash
npm install nodemailer
```

2. Add environment variables:
```env
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Scriib Notifications <notifications@yourdomain.com>"
```

3. Update the email service to use Nodemailer (uncomment the Nodemailer implementation in `lib/services/emailService.js`)

## Current Implementation

Currently, the system is set up to **log email notifications** instead of actually sending them. This is for development and testing purposes.

To see the email notifications in action:
1. Submit a post for approval
2. Check your server logs/console for the email content
3. The logs will show what email would be sent to which approver

## Enabling Live Email Sending

To enable actual email sending, choose one of the options above and:

1. **For Supabase SMTP**: Configure the SMTP settings in `supabase/config.toml` and restart your Supabase instance
2. **For Resend**: Install the package, add the API key, and uncomment the Resend implementation
3. **For Nodemailer**: Install the package, add the SMTP environment variables, and uncomment the Nodemailer implementation

## Email Template

The email includes:
- **Subject**: "New post awaiting your approval from [Author Name]"
- **Content**: Post preview (first 200 characters)
- **CTA Button**: Link to the approval portal
- **Professional styling** with your brand colors

## Testing

### Development Testing
1. Submit a post for approval with an approver assigned
2. Check console logs for email content
3. Verify the approval portal link works

### Production Testing
1. Set up one of the email services above
2. Create a test post and submit for approval
3. Check that the approver receives the email
4. Verify all links in the email work correctly

## API Endpoints

### Send Approval Notification
```
POST /api/notifications/email
```

**Request Body Options:**

Option 1 (with email details):
```json
{
  "postId": "uuid",
  "approverEmail": "approver@example.com",
  "approverName": "John Doe",
  "authorName": "Jane Smith",
  "postContent": "Post content here..."
}
```

Option 2 (with user IDs - looks up details):
```json
{
  "postId": "uuid",
  "approverId": "uuid",
  "authorId": "uuid",
  "postContent": "Post content here..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Approval notification email sent successfully",
  "method": "resend",
  "approverEmail": "approver@example.com"
}
```

## Troubleshooting

### Common Issues

1. **"All email methods failed"**
   - Check that at least one email service is properly configured
   - Verify environment variables are set correctly
   - Check server logs for specific error messages

2. **Emails not being sent**
   - Verify the email service is uncommented in `emailService.js`
   - Check API keys and SMTP credentials
   - Ensure the sender email is verified with your email provider

3. **Approver not receiving emails**
   - Check that the approver's email exists in the database
   - Verify the post has an `approver_id` set
   - Check spam/junk folders

### Debug Mode

Enable debug logging by checking your server console when:
- Posts are submitted for approval
- Email notifications are triggered
- API calls to `/api/notifications/email` are made

## Environment Variables

Required for email functionality:

```env
# Site URL for email links
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase credentials (already required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Choose one email service:

# Option 1: Resend
RESEND_API_KEY=your_resend_api_key

# Option 2: Custom SMTP (Nodemailer)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Scriib <notifications@yourdomain.com>"

# Option 3: Supabase SMTP (configured in supabase/config.toml)
```

## Future Enhancements

Potential improvements to consider:
- Email preferences for approvers (immediate, daily digest, etc.)
- Email notifications for post approval/rejection
- Rich text email templates
- Email analytics and tracking
- Unsubscribe functionality
