'use client'

import { usePathname } from 'next/navigation'
import SidebarComponent from '@/components/Sidebar'

export default function MainLayout({ children }) {
  const pathname = usePathname()

  // If we're on the settings page, don't render the sidebar
  if (pathname.startsWith('/settings')) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <SidebarComponent />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-6">
          {children}
        </div>
      </main>
    </div>
  )
}