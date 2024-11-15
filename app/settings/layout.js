'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SettingsLayout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Link>
          </Button>
        </div>
      </div>
      <div className="container py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">SETTINGS</h1>
        {children}
      </div>
    </div>
  )
}