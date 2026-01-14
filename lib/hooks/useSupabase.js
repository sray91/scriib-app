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
    const fetchOrCreateMapping = async () => {
      try {
        const res = await fetch('/api/user/get-uuid')
        const data = await res.json()

        if (data.uuid) {
          setUserId(data.uuid)
          return
        }

        // If mapping doesn't exist, create it
        if (res.status === 404) {
          console.log('User mapping not found, creating...')
          const createRes = await fetch('/api/user/create-mapping', { method: 'POST' })
          const createData = await createRes.json()

          if (createData.uuid) {
            setUserId(createData.uuid)
            console.log('User mapping created:', createData.uuid)
          } else {
            console.error('Failed to create user mapping:', createData.error)
          }
        }
      } catch (err) {
        console.error('Error fetching/creating user UUID:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrCreateMapping()
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
