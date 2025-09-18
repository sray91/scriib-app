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
    // Note: This requires SMTP to be configured in Supabase or an Edge Function for email
    console.log('Attempting to send email via Supabase to:', approverEmail)
    console.log('Subject:', emailTemplate.subject)
    console.log('Post ID:', postId)
    
    // Try to use Supabase Edge Function if available
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: approverEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text
        }
      })
      
      if (error) {
        console.log('Supabase Edge Function not available or failed:', error.message)
        return { success: false, error: `Supabase email function failed: ${error.message}`, method: 'supabase' }
      }
      
      console.log('Email sent successfully via Supabase Edge Function')
      return { success: true, method: 'supabase', email: approverEmail }
    } catch (functionError) {
      console.log('Supabase Edge Function not available, this is expected if not configured')
      return { success: false, error: 'Supabase SMTP/Edge Function not configured', method: 'supabase' }
    }
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
    // Check if Resend API key is available
    if (!process.env.RESEND_API_KEY) {
      console.log('RESEND_API_KEY not found, falling back to logging')
      console.log('Would send email via Resend to:', approverEmail)
      console.log('Subject:', emailTemplate.subject)
      console.log('Post ID:', postId)
      return { success: false, error: 'RESEND_API_KEY not configured', method: 'resend' }
    }

    // Real Resend implementation
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { data, error } = await resend.emails.send({
      from: 'notifications@scriib.ai',
      to: approverEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    })

    if (error) {
      console.error('Resend API error:', error)
      return { success: false, error: error.message, method: 'resend' }
    }

    console.log('Email sent successfully via Resend:', data)
    return { success: true, method: 'resend', email: approverEmail, messageId: data.id }
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    return { success: false, error: error.message, method: 'resend' }
  }
}

// Method 3: Using Nodemailer with custom SMTP
export async function sendApprovalNotificationViaNodemailer({ approverEmail, approverName, authorName, postContent, postId }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'
  const approvalUrl = `${siteUrl}/approval-portal`
  
  const emailTemplate = generateApprovalEmailTemplate({
    approverName: approverName || 'there',
    authorName,
    postContent,
    approvalUrl
  })
  
  try {
    // Check if Nodemailer SMTP settings are available
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.log('❌ Nodemailer SMTP settings missing:', missingVars.join(', '))
      return { 
        success: false, 
        error: `Missing SMTP environment variables: ${missingVars.join(', ')}`, 
        method: 'nodemailer' 
      }
    }
    
    console.log('✅ All Nodemailer SMTP environment variables are configured')
    console.log('📧 Attempting to send email via SendGrid SMTP...')

    // Import nodemailer dynamically
    const nodemailerModule = await import('nodemailer')
    const nodemailer = nodemailerModule.default || nodemailerModule
    
    console.log('🔍 Nodemailer module structure:', {
      hasDefault: !!nodemailerModule.default,
      hasCreateTransport: !!nodemailer.createTransport,
      hasCreateTransporter: !!nodemailer.createTransporter,
      type: typeof nodemailer.createTransport
    })
    
    if (!nodemailer.createTransport) {
      throw new Error('nodemailer.createTransport is not available')
    }
    
    // Create transporter (note: it's createTransport, not createTransporter)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    
    // Verify connection configuration
    console.log('🔍 Verifying SMTP connection to SendGrid...')
    await transporter.verify()
    console.log('✅ SMTP server connection verified successfully!')
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: approverEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    })

    console.log('🎉 Email sent successfully via SendGrid/Nodemailer!')
    console.log('📧 Message ID:', info.messageId)
    console.log('📬 Sent to:', approverEmail)
    return { 
      success: true, 
      method: 'nodemailer', 
      email: approverEmail, 
      messageId: info.messageId 
    }
  } catch (error) {
    console.error('❌ Error sending email via Nodemailer/SendGrid:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    })
    return { 
      success: false, 
      error: error.message, 
      method: 'nodemailer' 
    }
  }
}

// Development fallback - logs email instead of sending
export async function sendApprovalNotificationViaDevelopmentLog({ approverEmail, approverName, authorName, postContent, postId }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'
  const approvalUrl = `${siteUrl}/approval-portal`
  
  const emailTemplate = generateApprovalEmailTemplate({
    approverName: approverName || 'there',
    authorName,
    postContent,
    approvalUrl
  })
  
  console.log('=== EMAIL NOTIFICATION (Development Mode) ===')
  console.log(`To: ${approverEmail}`)
  console.log(`Subject: ${emailTemplate.subject}`)
  console.log(`Post ID: ${postId}`)
  console.log(`Approval URL: ${approvalUrl}`)
  console.log('Email Content:')
  console.log(emailTemplate.text)
  console.log('=== END EMAIL NOTIFICATION ===')
  
  return { 
    success: true, 
    method: 'development-log', 
    email: approverEmail,
    message: 'Email logged to console (development mode)'
  }
}

// Main function that tries different email methods
export async function sendApprovalNotification(params) {
  const { approverEmail, approverName, authorName, postContent, postId } = params
  
  // Validate required parameters
  if (!approverEmail || !authorName || !postContent || !postId) {
    throw new Error('Missing required parameters: approverEmail, authorName, postContent, postId')
  }
  
  // Check if we're in development mode or if email services are configured
  const isProduction = process.env.NODE_ENV === 'production'
  const hasResendKey = !!process.env.RESEND_API_KEY
  const hasNodemailerConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM)
  
  // Try different email methods in order of preference
  const emailMethods = []
  
  // Prioritize Nodemailer since that's what user requested
  if (hasNodemailerConfig) {
    emailMethods.push(sendApprovalNotificationViaNodemailer)
  }
  
  // Fallback to Resend if available
  if (hasResendKey) {
    emailMethods.push(sendApprovalNotificationViaResend)
  }
  
  // Always add development log as final fallback
  emailMethods.push(sendApprovalNotificationViaDevelopmentLog)
  
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
