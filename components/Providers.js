'use client'

import { Toaster } from "@/components/ui/toaster"

/**
 * Providers component
 * Clerk authentication is handled at the layout level via ClerkProvider
 * This component just wraps the toast notifications
 */
export default function Providers({ children }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
} 