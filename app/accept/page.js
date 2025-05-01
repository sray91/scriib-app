'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react'

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [isProcessing, setIsProcessing] = useState(true)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [ghostwriterData, setGhostwriterData] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  
  // Get ghostwriter ID from URL
  const ghostwriterId = searchParams.get('ghostwriter')
  
  // First check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          setAuthenticated(false)
        } else {
          setAuthenticated(true)
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        setAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    
    checkAuth()
  }, [supabase.auth])
  
  // If authenticated and have ghostwriter ID, proceed with activation
  useEffect(() => {
    if (isCheckingAuth || !authenticated || !ghostwriterId) {
      return
    }
    
    // Verify the user is authenticated and activate the relationship
    const activateLink = async () => {
      try {
        setIsProcessing(true)
        setError(null)
        
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          setError('You must be logged in to accept an invitation.')
          setIsProcessing(false)
          return
        }
        
        // Get ghostwriter data
        const { data: ghostwriterUserData, error: userError } = await supabase
          .from('users')
          .select('id, email, user_metadata')
          .eq('id', ghostwriterId)
          .single()
          
        if (userError) {
          console.error('Error fetching ghostwriter data:', userError)
          setError('Could not find the user who invited you.')
          setIsProcessing(false)
          return
        }
        
        setGhostwriterData({
          id: ghostwriterUserData.id,
          email: ghostwriterUserData.email,
          name: ghostwriterUserData.user_metadata?.full_name || ghostwriterUserData.email.split('@')[0]
        })
        
        // Check if relationship already exists
        const { data: existingLink, error: linkError } = await supabase
          .from('ghostwriter_approver_link')
          .select('id, active')
          .eq('ghostwriter_id', ghostwriterId)
          .eq('approver_id', user.id)
          .maybeSingle()
          
        if (linkError) {
          console.error('Error checking relationship:', linkError)
          setError('Error checking invitation status.')
          setIsProcessing(false)
          return
        }
        
        if (existingLink) {
          if (existingLink.active) {
            // Already active
            setSuccess(true)
            setIsProcessing(false)
            return
          }
          
          // Update the existing link
          const { error: updateError } = await supabase
            .from('ghostwriter_approver_link')
            .update({ 
              active: true,
              revoked_at: null
            })
            .eq('id', existingLink.id)
            
          if (updateError) {
            console.error('Error activating link:', updateError)
            setError('Failed to accept invitation.')
            setIsProcessing(false)
            return
          }
          
          setSuccess(true)
        } else {
          // Create new link
          const { error: insertError } = await supabase
            .from('ghostwriter_approver_link')
            .insert({
              ghostwriter_id: ghostwriterId,
              approver_id: user.id,
              active: true
            })
            
          if (insertError) {
            console.error('Error creating link:', insertError)
            setError('Failed to accept invitation.')
            setIsProcessing(false)
            return
          }
          
          setSuccess(true)
        }
        
      } catch (error) {
        console.error('Error processing invitation:', error)
        setError('An unexpected error occurred.')
      } finally {
        setIsProcessing(false)
      }
    }
    
    activateLink()
  }, [ghostwriterId, authenticated, isCheckingAuth, supabase])
  
  // Function to redirect to login
  const goToLogin = () => {
    router.push(`/login?next=${encodeURIComponent(`/accept?ghostwriter=${ghostwriterId}`)}&email=${encodeURIComponent(searchParams.get('email') || '')}`)
  }
  
  // Function to redirect to signup
  const goToSignup = () => {
    router.push(`/signup?next=${encodeURIComponent(`/accept?ghostwriter=${ghostwriterId}`)}&email=${encodeURIComponent(searchParams.get('email') || '')}`)
  }
  
  // Show authentication prompt if not logged in
  if (!isCheckingAuth && !authenticated) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              You need to log in or create an account to accept this invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <LogIn className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Please Log In or Sign Up</h3>
            <p className="text-gray-600 mb-6">
              You must have an account to accept this invitation. Choose an option below.
            </p>
            <div className="flex flex-col w-full gap-4 sm:flex-row sm:gap-2">
              <Button onClick={goToLogin} variant="outline" className="sm:flex-1">
                I have an account
              </Button>
              <Button onClick={goToSignup} className="sm:flex-1 bg-[#fb2e01] hover:bg-[#fb2e01]/90">
                Create an account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="container flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Invitation</CardTitle>
          <CardDescription>
            Accept invitation to become an approver
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCheckingAuth || isProcessing ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
              <p className="text-gray-600">
                {isCheckingAuth ? 'Checking authentication...' : 'Processing your invitation...'}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invitation Error</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button onClick={() => router.push('/')}>
                Go to Dashboard
              </Button>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invitation Accepted</h3>
              <p className="text-gray-600 mb-2">
                You are now connected with {ghostwriterData?.name}.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                You will be able to review and approve their content.
              </p>
              <Button onClick={() => router.push('/settings?tab=ghostwriters')} className="bg-[#fb2e01] hover:bg-[#fb2e01]/90">
                View Ghostwriters
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
} 