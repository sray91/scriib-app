import { getSupabaseServiceRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// Helper function to generate IDs in the same format as Supabase
function generateUUID() {
  return crypto.randomUUID();
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const ghostwriterId = url.searchParams.get('ghostwriter');
    const email = url.searchParams.get('email');

    if (!ghostwriterId || !email) {
      return NextResponse.redirect(new URL('/login', url.origin));
    }

    console.log("Direct approve request for", { ghostwriterId, email });

    // Get the Clerk user if authenticated
    const { userId: clerkUserId } = await auth();
    let userId = clerkUserId;

    // Get service role client for database operations
    const supabase = getSupabaseServiceRole();

    // If no Clerk user, this is a direct invite link - user needs to sign up first
    if (!userId) {
      console.log("No authenticated session - user needs to sign up");
      return NextResponse.redirect(new URL(`/sign-up?message=${encodeURIComponent("Please sign up with your email to accept the approver invitation.")}&email=${encodeURIComponent(email)}&ghostwriter=${ghostwriterId}`, url.origin));
    }

    console.log("Using authenticated Clerk user:", userId);

    // Now create the profile and relationship
    try {
      // Ensure profile exists
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email.toLowerCase(),
          created_at: new Date().toISOString()
        })
        .onConflict('id')
        .merge();

      if (profileError) {
        console.error("Error creating profile:", profileError);
      }

      // Create or update the relationship
      const { error: relationshipError } = await supabase
        .from('ghostwriter_approver_link')
        .insert({
          ghostwriter_id: ghostwriterId,
          approver_id: userId,
          active: true
        })
        .onConflict(['ghostwriter_id', 'approver_id'])
        .merge({ active: true, revoked_at: null });

      if (relationshipError) {
        console.error("Error creating relationship:", relationshipError);
        throw new Error("Could not create approver relationship");
      }
      
      // Approver relationship created successfully
      // Since magic links are removed, redirect to login page with success message
      return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent("You have been successfully added as an approver. Please sign in with your account.")}&email=${encodeURIComponent(email)}`, url.origin));
      
    } catch (error) {
      console.error("Error in direct approve process:", error);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`, url.origin));
    }
  } catch (error) {
    console.error("Unexpected error in direct-approve:", error);
    return NextResponse.redirect(new URL('/?error=direct_approve_error', new URL(request.url).origin));
  }
} 