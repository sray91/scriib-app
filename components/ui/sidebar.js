'use client'

import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

const SidebarContext = createContext({})

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true) // Default to collapsed

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, children }) {
  const { isCollapsed } = useContext(SidebarContext)

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-background transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {children}
    </aside>
  )
}

export function SidebarHeader({ className, children }) {
  const { isCollapsed } = useContext(SidebarContext)
  
  return (
    <div className={cn('p-4', isCollapsed && 'px-2', className)}>
      {children}
    </div>
  )
}

export function SidebarContent({ className, children }) {
  return <div className={cn('flex-1 overflow-auto', className)}>{children}</div>
}

export function SidebarFooter({ className, children }) {
  const { isCollapsed } = useContext(SidebarContext)
  
  return (
    <div className={cn('p-4', isCollapsed && 'px-2', className)}>
      {children}
    </div>
  )
}

export function SidebarMenu({ className, children }) {
  return <nav className={cn('space-y-1', className)}>{children}</nav>
}

export function SidebarMenuItem({ className, children }) {
  return <div className={cn('', className)}>{children}</div>
}

export function SidebarMenuButton({ className, children, isActive, ...props }) {
  const { isCollapsed } = useContext(SidebarContext)
  
  return (
    <button
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
        isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
        isCollapsed && 'justify-center px-2',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Custom hook to use sidebar context
export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}