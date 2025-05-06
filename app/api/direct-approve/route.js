import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from 'crypto';

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
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // First, check if we already have a session
    const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
    let userId;
    
    if (sessionCheckError || !session) {
      // No session, we need to create one
      console.log("No session found, creating a temporary login");
      
      // Use admin sign-in if available, otherwise create a fake session with data
      try {
        // First, check if user already exists
        const { data: existingUser, error: lookupError } = await supabase.auth.admin.getUserByEmail(email);
        
        if (!lookupError && existingUser) {
          userId = existingUser.id;
          console.log("Found existing user:", userId);
        } else {
          // Generate new user ID
          userId = generateUUID();
          
          // Create the user with admin API if available
          try {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email: email,
              email_confirm: true,
              user_metadata: { 
                created_via: 'direct_approver_invite',
                invited_by: ghostwriterId
              }
            });
            
            if (!createError && newUser) {
              userId = newUser.id;
              console.log("Created new user:", userId);
            }
          } catch (adminError) {
            console.log("Admin API not available, using standard auth:", adminError);
          }
        }
      } catch (adminError) {
        console.log("Could not use admin API, falling back to standard auth");
        
        // Try standard authentication
        const { data, error: signInError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: true
          }
        });
        
        if (signInError) {
          console.error("Failed to create session:", signInError);
          return NextResponse.redirect(new URL(`/login?error=auth_error&message=${encodeURIComponent("We couldn't create a session. Please try the magic link option on the login page.")}&email=${encodeURIComponent(email)}`, url.origin));
        }
        
        // Get the user from the session 
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          console.log("Created and authenticated user:", userId);
        }
      }
    } else {
      // We have a session, use the user ID from it
      userId = session.user.id;
      console.log("Using existing session for user:", userId);
    }
    
    if (!userId) {
      console.error("Could not determine user ID");
      return NextResponse.redirect(new URL(`/login?error=auth_error&message=${encodeURIComponent("Unable to determine your user account. Please try the magic link option on the login page.")}&email=${encodeURIComponent(email)}`, url.origin));
    }
    
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
      
      // Send the magic link for setting a password
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${url.origin}/settings?tab=password&success=invite_accepted&ghostwriter=${ghostwriterId}`
        }
      });
      
      if (magicLinkError) {
        console.error("Error sending magic link:", magicLinkError);
      }
      
      // Redirect to a special page that doesn't require auth
      return NextResponse.redirect(new URL(`/invite-complete?email=${encodeURIComponent(email)}`, url.origin));
      
    } catch (error) {
      console.error("Error in direct approve process:", error);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`, url.origin));
    }
  } catch (error) {
    console.error("Unexpected error in direct-approve:", error);
    return NextResponse.redirect(new URL('/?error=direct_approve_error', new URL(request.url).origin));
  }
} 