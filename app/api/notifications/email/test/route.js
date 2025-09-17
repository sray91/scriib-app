import { NextResponse } from 'next/server'

// Test endpoint to verify email notification setup
export async function GET() {
  return NextResponse.json({
    message: 'Email notification test endpoint',
    timestamp: new Date().toISOString(),
    tests: {
      'basic_api': 'GET /api/notifications/email/test - ✅ Working',
      'send_email': 'POST /api/notifications/email - Ready to test',
      'post_submission': 'PostEditor integration - Ready to test'
    },
    instructions: {
      step1: 'Create a post and assign an approver',
      step2: 'Click "Send for Approval"', 
      step3: 'Check server console logs for email content',
      step4: 'Verify approver receives notification (when email service is configured)'
    }
  })
}

// Test endpoint to simulate email sending
export async function POST(request) {
  try {
    const body = await request.json()
    const { testEmail } = body
    
    // Use provided test email or default
    const approverEmail = testEmail || 'test@example.com'
    
    const testData = {
      postId: 'test-post-' + Date.now(),
      approverEmail: approverEmail,
      approverName: 'Test Approver',
      authorName: 'Test Author',
      postContent: 'This is a test post content for email notification testing. It should be long enough to test the preview truncation feature in the email template. This test will verify that Resend is working properly and emails are being sent to the specified recipient.'
    }
    
    // Call the actual email API directly with email details
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/notifications/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })
    
    const emailResult = await emailResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Test email notification triggered',
      testData,
      emailResult,
      note: emailResult.success ? 
        `Email sent successfully via ${emailResult.method} to ${approverEmail}` :
        'Email failed to send - check server logs for details'
    })
    
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Test failed - check server logs for details'
    }, { status: 500 })
  }
}
