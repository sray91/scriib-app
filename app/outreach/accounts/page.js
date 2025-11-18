'use client'

import LinkedInAccountManager from '@/components/outreach/LinkedInAccountManager'

export default function OutreachAccountsPage() {
  return (
    <div className="container py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">LinkedIn Accounts</h1>
        <p className="text-muted-foreground mt-1">
          Manage LinkedIn accounts for outreach campaigns
        </p>
      </div>

      <LinkedInAccountManager />
    </div>
  )
}
