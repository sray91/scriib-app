'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Users, Home, Settings, LogOut, Shield, ArrowLeft } from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

const ADMIN_EMAIL = 'swanagan@ghostletter.us'

function isUserAdmin(user) {
  if (!user) return false
  const email = user.primaryEmailAddress?.emailAddress
  return email === ADMIN_EMAIL || user.publicMetadata?.is_admin === true
}

export default function AdminLayout({ children }) {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { signOut } = useClerk()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push('/login')
        return
      }

      const adminStatus = isUserAdmin(user)
      setIsAdmin(adminStatus)
      setChecking(false)

      if (!adminStatus) {
        router.push('/')
      }
    }
  }, [isLoaded, user, router])

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  if (!isLoaded || checking) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="text-white">Access Denied</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F1117] flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-[#1C1F26] border-r border-[#2A2F3C] flex flex-col">
        <div className="p-4 border-b border-[#2A2F3C]">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/scriib-logo.png"
              width={40}
              height={40}
              alt="Scriib Logo"
            />
            <div className="font-bebas-neue text-xl tracking-wide text-white">ADMIN</div>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <Link href="/admin">
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-[#2A2F3C] hover:text-white"
              >
                <Users className="mr-3 h-4 w-4" />
                User Management
              </Button>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-[#2A2F3C] space-y-2">
          <Link href="/">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-[#2A2F3C] hover:text-white"
            >
              <ArrowLeft className="mr-3 h-4 w-4" />
              Back to App
            </Button>
          </Link>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-white bg-[#fb2e01] hover:bg-[#e02a01]"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6 text-[#fb2e01]" />
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
