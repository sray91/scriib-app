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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
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
                  You&apos;ve clicked an approver invitation link. Please sign in to accept the invitation.
                </AlertDescription>
              </Alert>
            )}

            <SignIn
              routing="path"
              path="/login"
              fallbackRedirectUrl={nextUrl}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-none",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}