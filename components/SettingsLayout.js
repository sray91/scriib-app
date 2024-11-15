'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const tabs = [
  { name: 'Social Accounts', href: '/settings' },
  { name: 'Profile', href: '/settings/profile' },
  { name: 'Preferences', href: '/settings/preferences' },
]

export default function SettingsLayout({ children }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" asChild className="-ml-4 mb-6">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
        </Button>

        <h1 className="mb-8 text-4xl font-bold tracking-tight">SETTINGS</h1>

        <div className="mb-8 flex gap-4 border-b">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                'border-b-2 pb-2 text-sm font-medium transition-colors hover:text-foreground/80',
                pathname === tab.href
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-foreground/60'
              )}
            >
              {tab.name}
            </Link>
          ))}
        </div>

        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
    </div>
  )
}