import { redirect } from 'next/navigation';

export default function LinkedInPostsPage() {
  // Redirect to the Training Data tab in settings (formerly LinkedIn tab)
  redirect('/settings?tab=training-data');
} 