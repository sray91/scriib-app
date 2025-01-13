'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { Toaster } from "@/components/ui/toaster"

export default function Providers({ children }) {
  const supabase = createClientComponentClient()

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
      <Toaster />
    </SessionContextProvider>
  )
} 