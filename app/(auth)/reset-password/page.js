'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Password Reset Page
 * Clerk handles password reset through the SignIn component
 * This page redirects users to login where they can use "Forgot password?"
 */
export default function ResetPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login?message=Click "Forgot password?" to reset your password')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to login...</p>
    </div>
  )
}