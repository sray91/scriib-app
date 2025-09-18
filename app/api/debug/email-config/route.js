import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check which email environment variables are configured
    const emailConfig = {
      // Nodemailer SMTP
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT, 
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASS: !!process.env.SMTP_PASS,
      SMTP_FROM: !!process.env.SMTP_FROM,
      SMTP_SECURE: !!process.env.SMTP_SECURE,
      
      // Resend (fallback)
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      
      // Other
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
    }
    
    // Determine which email method would be used
    const hasNodemailerConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM)
    const hasResendKey = !!process.env.RESEND_API_KEY
    
    let primaryMethod = 'development-log'
    if (hasNodemailerConfig) {
      primaryMethod = 'nodemailer'
    } else if (hasResendKey) {
      primaryMethod = 'resend'
    }
    
    // Show actual values for debugging (masked for security)
    const actualValues = {
      SMTP_HOST: process.env.SMTP_HOST || 'NOT_SET',
      SMTP_PORT: process.env.SMTP_PORT || 'NOT_SET',
      SMTP_USER: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : 'NOT_SET',
      SMTP_PASS: process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 3)}***` : 'NOT_SET',
      SMTP_FROM: process.env.SMTP_FROM || 'NOT_SET'
    }
    
    return NextResponse.json({
      configured: emailConfig,
      primaryEmailMethod: primaryMethod,
      hasNodemailerConfig,
      hasResendKey,
      actualValues,
      message: hasNodemailerConfig 
        ? 'Nodemailer is configured and will be used'
        : hasResendKey 
        ? 'Only Resend is configured'
        : 'No email service configured - using development log'
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
