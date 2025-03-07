import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSearchParams } from 'next/navigation';

export function useLinkedInAuthStatus() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  useEffect(() => {
    const error = searchParams.get('error');
    const details = searchParams.get('details');
    const success = searchParams.get('success');
    
    if (success === 'true') {
      toast({
        title: 'Success',
        description: 'LinkedIn account connected successfully',
      });
      
      // Force a page refresh to ensure the latest data is loaded
      // Only do this once when the success parameter is present
      if (window.location.href.includes('success=true')) {
        // Remove the success parameter to prevent infinite refresh
        const newUrl = window.location.href.replace(/[?&]success=true/, '');
        window.history.replaceState({}, document.title, newUrl);
        
        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } else if (error) {
      let errorMessage = 'Failed to connect LinkedIn account';
      
      switch (error) {
        case 'linkedin_not_configured':
          errorMessage = 'LinkedIn API is not properly configured';
          break;
        case 'no_code':
          errorMessage = 'No authorization code received from LinkedIn';
          break;
        case 'token_exchange_failed':
          errorMessage = 'Failed to exchange authorization code for access token';
          break;
        case 'profile_fetch_failed':
          errorMessage = 'Failed to fetch LinkedIn profile';
          break;
        case 'database_error':
          errorMessage = 'Failed to save LinkedIn account to database';
          break;
        case 'linkedin_auth_error':
          errorMessage = 'LinkedIn authentication error';
          break;
        default:
          errorMessage = 'An error occurred during LinkedIn authentication';
      }
      
      if (details) {
        errorMessage += `: ${details}`;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Log the error for debugging
      console.error('LinkedIn auth error:', error, details);
    }
  }, [searchParams, toast]);
} 