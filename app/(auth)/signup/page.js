'use client'

import { SignUp } from "@clerk/nextjs"
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

export default function SignUpPage() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')
  const nextUrl = searchParams.get('next') || '/'
  const inviteEmail = searchParams.get('email') || ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign up</CardTitle>
          <CardDescription>
            Create an account to start managing your content creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <SignUp
            routing="path"
            path="/signup"
            redirectUrl={nextUrl}
            initialValues={{
              emailAddress: inviteEmail,
            }}
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