import { redirect } from 'next/navigation';

export default function LinkedInPostsPage() {
  // Redirect to the LinkedIn tab in settings
  redirect('/settings?tab=linkedin');
} 