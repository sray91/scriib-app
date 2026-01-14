'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { getSupabase } from '@/lib/supabase'

/**
 * Hook that provides Supabase client and user ID (from Clerk -> Supabase mapping)
 * Use this instead of createClientComponentClient + supabase.auth.getUser()
 */
export function useSupabase() {
  const [userId, setUserId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoaded } = useUser()

  // Memoize supabase client to avoid recreating on each render
  const supabase = useMemo(() => getSupabase(), [])

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      setUserId(null)
      setIsLoading(false)
      return
    }

    // Fetch the Supabase UUID for the current Clerk user
    fetch('/api/user/get-uuid')
      .then(res => res.json())
      .then(data => {
        if (data.uuid) {
          setUserId(data.uuid)
        }
      })
      .catch(err => {
        console.error('Error fetching user UUID:', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [isLoaded, user])

  return {
    supabase,
    userId,
    user,       // Clerk user object
    isLoaded,   // Clerk auth loaded
    isLoading,  // UUID fetch in progress
  }
}

export default useSupabase
