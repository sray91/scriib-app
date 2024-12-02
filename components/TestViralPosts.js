'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

export default function Page() {
  const [notes, setNotes] = useState(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getData = async () => {
      const { data } = await supabase.from('reference_posts').select()
      setNotes(data)
    }
    getData()
  }, [])

  const insertRow = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reference_posts').insert([
      {
        user_id: '00000000-0000-0000-0000-000000000000', // Replace with dynamic value if needed
        description: 'New test post', // Replace with user input or dynamic value
        tweet_id: '987654321', // Replace with user input or dynamic value
        tag: 'example', // Replace with user input or dynamic value
      },
    ])

    if (error) {
      console.error('Error inserting row:', error)
    } else {
      console.log('Row inserted:', data)
      setNotes((prevNotes) => [...(prevNotes || []), ...data])
    }

    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={insertRow}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        disabled={loading}
      >
        {loading ? 'Inserting...' : 'Insert Row'}
      </button>
      <pre>{JSON.stringify(notes, null, 2)}</pre>
    </div>
  )
}
