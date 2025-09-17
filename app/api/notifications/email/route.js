import { NextResponse } from 'next/server'
import { 
  sendApprovalNotification, 
  getApproverDetails, 
  getAuthorDetails 
} from '../../../../lib/services/emailService.js'

// API endpoint to send approval notification
export async function POST(request) {
  try {
    const body = await request.json()
    const { postId, approverId, authorId, postContent, approverEmail, approverName, authorName } = body
    
    // Method 1: Use provided email details (faster)
    if (approverEmail && authorName && postContent && postId) {
      const result = await sendApprovalNotification({
        approverEmail,
        approverName: approverName || 'there',
        authorName,
        postContent,
        postId
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Approval notification email sent successfully',
        method: result.method
      })
    }
    
    // Method 2: Look up details from database using IDs
    if (postId && approverId && authorId && postContent) {
      const [approverDetails, authorDetails] = await Promise.all([
        getApproverDetails(approverId),
        getAuthorDetails(authorId)
      ])
      
      const result = await sendApprovalNotification({
        approverEmail: approverDetails.email,
        approverName: approverDetails.name,
        authorName: authorDetails.name,
        postContent,
        postId
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Approval notification email sent successfully',
        method: result.method,
        approverEmail: approverDetails.email
      })
    }
    
    // Neither method has sufficient data
    return NextResponse.json(
      { 
        error: 'Missing required fields. Provide either: (postId, approverEmail, authorName, postContent) or (postId, approverId, authorId, postContent)',
        received: Object.keys(body)
      },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Error in email notification API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Email notification API is running',
    endpoints: {
      POST: 'Send approval notification email',
      required_fields: ['postId', 'approverEmail', 'authorName', 'postContent'],
      optional_fields: ['approverName']
    }
  })
}
