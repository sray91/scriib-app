'use client'

import { SignIn } from "@clerk/nextjs"
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')
  const nextUrl = searchParams.get('next') || '/'
  const fromApproverInvite = nextUrl.includes('/accept') || searchParams.get('fromInvite') === 'true'

  return (
    <div className="container max-w-sm mx-auto py-8 px-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl">Sign in</CardTitle>
          <CardDescription className="text-center">
            Sign in to your Scriib account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {fromApproverInvite && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                You've clicked an approver invitation link. Please sign in to accept the invitation.
              </AlertDescription>
            </Alert>
          )}

          <SignIn
            routing="path"
            path="/login"
            redirectUrl={nextUrl}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-none",
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}