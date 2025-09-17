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
    const testData = {
      postId: 'test-post-123',
      approverId: 'test-approver-456', 
      authorId: 'test-author-789',
      postContent: 'This is a test post content for email notification testing. It should be long enough to test the preview truncation feature in the email template.'
    }
    
    // Call the actual email API
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
      note: 'Check server console logs to see the email content that would be sent'
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
