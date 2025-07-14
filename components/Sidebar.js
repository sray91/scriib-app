'use client'

import { GalleryVerticalEnd, LayoutList, Calendar, Users, Lightbulb, Search, Settings, LogOut, Menu, X, PenTool, Image as ImageIcon, LayoutDashboard, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Button } from './ui/button'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'

const betaNavigation = [
  { name: 'Engagement Lists', href: '/engagement', icon: Users },
  { name: 'Content Strategy', href: '/content', icon: GalleryVerticalEnd },
  { name: 'ICP Builder', href: '/icp', icon: Users },
]

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Swipe File', href: '/viral', icon: Search },
  { name: 'CoCreate', href: '/cocreate', icon: Lightbulb },
  { name: 'Post Forge', href: '/post-forge', icon: PenTool },
]

export default function SidebarComponent() {
  const pathname = usePathname()
  const supabase = createClientComponentClient()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle window resize to detect mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Check on initial load
    checkIfMobile()
    
    // Add event listener
    window.addEventListener('resize', checkIfMobile)
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])

  // Close mobile menu when navigating
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Mobile hamburger button
  const MobileMenuButton = () => (
    <button 
      className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[#1C1F26] text-white"
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
    >
      {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  )

  return (
    <>
      <MobileMenuButton />
      
      <Sidebar 
        className={`bg-[#1C1F26] border-r-0 transition-all duration-300 ${
          isMobile 
            ? isMobileMenuOpen 
              ? 'translate-x-0 fixed inset-y-0 left-0 z-40' 
              : '-translate-x-full fixed inset-y-0 left-0 z-40'
            : 'translate-x-0'
        }`}
      >
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className={`flex items-center justify-center transition-all duration-300 ${
                isCollapsed ? 'h-12 w-12' : 'h-12 w-12'
              }`}>
                <Image 
                  src="/scriib-logo.png" 
                  width={isCollapsed ? 48 : 100} 
                  height={isCollapsed ? 48 : 100} 
                  alt="Scriib Logo" 
                  className="transition-all duration-300"
                />
              </div>
              {!isCollapsed && (
                <div className="font-bebas-neue text-2xl tracking-wide text-white">SCRIIB</div>
              )}
            </Link>
            
            {/* Desktop toggle button */}
            <div className="hidden md:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="text-white hover:bg-[#2A2F3C] hover:text-white p-1 h-8 w-8 flex items-center justify-center"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <div className="text-white">
                  {isCollapsed ? <Menu size={16} /> : <X size={16} />}
                </div>
              </Button>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = item.href === '/' ? (pathname === '/' || pathname === '') : pathname === item.href
              return (
                <SidebarMenuItem key={item.name}>
                  <Link href={item.href} className="block">
                    <SidebarMenuButton 
                      isActive={isActive}
                      className={`text-white hover:bg-[#fb2e01] ${isActive ? 'bg-[#fb2e01] text-white' : ''}`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : ''}`} />
                      {!isCollapsed && (
                        <span className="font-lexend-deca">{item.name}</span>
                      )}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings" className="block">
                <SidebarMenuButton 
                  isActive={pathname === '/settings'}
                  className="text-white hover:bg-[#2A2F3C] data-[active=true]:bg-[#fb2e01] data-[active=true]:text-black"
                  title={isCollapsed ? 'Settings' : undefined}
                >
                  <Settings className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'} group-data-[active=true]:text-black`} />
                  {!isCollapsed && (
                    <span className="font-lexend-deca">Settings</span>
                  )}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={handleLogout}
                className="text-white bg-[#fb2e01] hover:bg-[#e02a01] mt-2"
                title={isCollapsed ? 'Logout' : undefined}
              >
                <LogOut className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && (
                  <span className="font-lexend-deca">Logout</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      {/* Overlay for mobile menu */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}