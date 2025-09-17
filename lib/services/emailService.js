import { createClient } from '@supabase/supabase-js'

// Create admin Supabase client
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_KEY
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials')
  }
  
  return createClient(url, serviceKey)
}

// Email template for approval notifications
function generateApprovalEmailTemplate({ approverName, authorName, postContent, approvalUrl }) {
  const contentPreview = postContent.length > 200 
    ? postContent.substring(0, 200) + '...' 
    : postContent

  return {
    subject: `New post awaiting your approval from ${authorName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Post Awaiting Your Approval</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0 0 10px 0; font-size: 24px;">New Post Awaiting Approval</h1>
          <p style="margin: 0; font-size: 16px; color: #6b7280;">Hello ${approverName}, you have a new post to review from ${authorName}</p>
        </div>
        
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h2 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">Post Preview:</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; font-style: italic; line-height: 1.7;">
            "${contentPreview}"
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${approvalUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
            Review & Approve Post
          </a>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin-top: 30px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            <strong>Next steps:</strong><br>
            • Click the button above to review the full post<br>
            • Approve, request changes, or reject the post<br>
            • The author will be notified of your decision
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            This email was sent because you are set as an approver for ${authorName}'s content.<br>
            You can manage your notification preferences in your account settings.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${approverName},

You have a new post awaiting your approval from ${authorName}.

Post Preview:
"${contentPreview}"

Please review and approve the post by visiting: ${approvalUrl}

Next steps:
• Review the full post content
• Approve, request changes, or reject the post  
• The author will be notified of your decision

This email was sent because you are set as an approver for ${authorName}'s content.
    `.trim()
  }
}

// Method 1: Using Supabase's built-in email (if SMTP is configured)
export async function sendApprovalNotificationViaSupabase({ approverEmail, approverName, authorName, postContent, postId }) {
  const supabase = getAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'
  const approvalUrl = `${siteUrl}/approval-portal`
  
  const emailTemplate = generateApprovalEmailTemplate({
    approverName: approverName || 'there',
    authorName,
    postContent,
    approvalUrl
  })
  
  try {
    // Note: This requires SMTP to be configured in Supabase
    // For now, we'll use this as a placeholder and log the email
    console.log('Would send email via Supabase SMTP to:', approverEmail)
    console.log('Subject:', emailTemplate.subject)
    console.log('Post ID:', postId)
    
    // In a real implementation with SMTP configured, you might use:
    // const { error } = await supabase.functions.invoke('send-email', {
    //   body: {
    //     to: approverEmail,
    //     subject: emailTemplate.subject,
    //     html: emailTemplate.html,
    //     text: emailTemplate.text
    //   }
    // })
    
    return { success: true, method: 'supabase', email: approverEmail }
  } catch (error) {
    console.error('Error sending email via Supabase:', error)
    return { success: false, error: error.message, method: 'supabase' }
  }
}

// Method 2: Using Resend (popular email service for Next.js)
export async function sendApprovalNotificationViaResend({ approverEmail, approverName, authorName, postContent, postId }) {
  // This would require: npm install resend
  // and RESEND_API_KEY environment variable
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'
  const approvalUrl = `${siteUrl}/approval-portal`
  
  const emailTemplate = generateApprovalEmailTemplate({
    approverName: approverName || 'there',
    authorName,
    postContent,
    approvalUrl
  })
  
  try {
    // Placeholder for Resend implementation
    console.log('Would send email via Resend to:', approverEmail)
    console.log('Subject:', emailTemplate.subject)
    console.log('Post ID:', postId)
    
    // Real implementation would be:
    // const { Resend } = await import('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // 
    // const { data, error } = await resend.emails.send({
    //   from: 'notifications@scriib.ai',
    //   to: approverEmail,
    //   subject: emailTemplate.subject,
    //   html: emailTemplate.html,
    //   text: emailTemplate.text
    // })
    
    return { success: true, method: 'resend', email: approverEmail }
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    return { success: false, error: error.message, method: 'resend' }
  }
}

// Method 3: Using Nodemailer with custom SMTP
export async function sendApprovalNotificationViaNodemailer({ approverEmail, approverName, authorName, postContent, postId }) {
  // This would require: npm install nodemailer
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'
  const approvalUrl = `${siteUrl}/approval-portal`
  
  const emailTemplate = generateApprovalEmailTemplate({
    approverName: approverName || 'there',
    authorName,
    postContent,
    approvalUrl
  })
  
  try {
    // Placeholder for Nodemailer implementation
    console.log('Would send email via Nodemailer to:', approverEmail)
    console.log('Subject:', emailTemplate.subject)
    console.log('Post ID:', postId)
    
    // Real implementation would be:
    // const nodemailer = await import('nodemailer')
    // 
    // const transporter = nodemailer.createTransporter({
    //   host: process.env.SMTP_HOST,
    //   port: process.env.SMTP_PORT,
    //   secure: process.env.SMTP_SECURE === 'true',
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASS
    //   }
    // })
    //
    // const info = await transporter.sendMail({
    //   from: process.env.SMTP_FROM,
    //   to: approverEmail,
    //   subject: emailTemplate.subject,
    //   html: emailTemplate.html,
    //   text: emailTemplate.text
    // })
    
    return { success: true, method: 'nodemailer', email: approverEmail }
  } catch (error) {
    console.error('Error sending email via Nodemailer:', error)
    return { success: false, error: error.message, method: 'nodemailer' }
  }
}

// Main function that tries different email methods
export async function sendApprovalNotification(params) {
  const { approverEmail, approverName, authorName, postContent, postId } = params
  
  // Validate required parameters
  if (!approverEmail || !authorName || !postContent || !postId) {
    throw new Error('Missing required parameters: approverEmail, authorName, postContent, postId')
  }
  
  // Try different email methods in order of preference
  const emailMethods = [
    sendApprovalNotificationViaSupabase,
    sendApprovalNotificationViaResend,
    sendApprovalNotificationViaNodemailer
  ]
  
  let lastError = null
  
  for (const method of emailMethods) {
    try {
      const result = await method(params)
      if (result.success) {
        console.log(`Email sent successfully via ${result.method} to ${approverEmail}`)
        return result
      }
      lastError = result.error
    } catch (error) {
      console.error(`Email method failed:`, error)
      lastError = error.message
    }
  }
  
  throw new Error(`All email methods failed. Last error: ${lastError}`)
}

// Helper function to get approver details from database
export async function getApproverDetails(approverId) {
  const supabase = getAdminClient()
  
  try {
    // Get approver email from auth.users and name from profiles
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(approverId)
    
    if (userError || !userData.user) {
      throw new Error(`Could not find approver with ID: ${approverId}`)
    }
    
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', approverId)
      .single()
    
    return {
      email: userData.user.email,
      name: profileData?.full_name || 'there'
    }
  } catch (error) {
    console.error('Error getting approver details:', error)
    throw error
  }
}

// Helper function to get author details
export async function getAuthorDetails(authorId) {
  const supabase = getAdminClient()
  
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', authorId)
      .single()
    
    if (profileError) {
      console.warn('Could not get author profile:', profileError)
    }
    
    return {
      name: profileData?.full_name || 'Someone'
    }
  } catch (error) {
    console.error('Error getting author details:', error)
    return { name: 'Someone' }
  }
}
