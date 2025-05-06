'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Mail } from 'lucide-react'

export default function InviteCompletePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'your email'
  
  return (
    <div className="container flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Invitation Accepted!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-lg">
            You have been successfully added as an approver.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg mt-6">
            <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h3 className="font-medium text-blue-700 mb-2">Check Your Email</h3>
            <p className="text-blue-600">
              We just sent a magic link to <strong>{email}</strong> 
            </p>
            <p className="text-sm text-blue-500 mt-2">
              Click the link in your email to set a password for your account.
            </p>
          </div>
          
          <p className="text-gray-500 text-sm mt-6">
            If you don&apos;t see the email, please check your spam folder. You can also use the Magic Link option on the login page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 