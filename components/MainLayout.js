'use client'

import { usePathname } from 'next/navigation'
import SidebarComponent from '@/components/Sidebar'
import { SidebarProvider } from './ui/sidebar'

export default function MainLayout({ children }) {
  const pathname = usePathname()

  // If we're on the settings page, don't render the sidebar
  if (pathname.startsWith('/settings')) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <SidebarComponent className="fixed inset-y-0 left-0 w-64 bg-[#1C1C1C] text-white" />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}