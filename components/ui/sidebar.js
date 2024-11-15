'use client'

import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

const SidebarContext = createContext({})

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
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
  return <div className={cn('p-4', className)}>{children}</div>
}

export function SidebarContent({ className, children }) {
  return <div className={cn('flex-1 overflow-auto', className)}>{children}</div>
}

export function SidebarFooter({ className, children }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function SidebarMenu({ className, children }) {
  return <nav className={cn('space-y-1', className)}>{children}</nav>
}

export function SidebarMenuItem({ className, children }) {
  return <div className={cn('', className)}>{children}</div>
}

export function SidebarMenuButton({ className, children, isActive, ...props }) {
  return (
    <button
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
        isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}