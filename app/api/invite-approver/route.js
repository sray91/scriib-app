import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Verify current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get request data
    const { email, ghostwriter_id } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if the user trying to invite is the ghostwriter
    if (ghostwriter_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized - You can only invite approvers for yourself" },
        { status: 403 }
      );
    }

    let approver_id;
    let is_registered = false;

    try {
      // Check if the 'users' table exists by trying to query it
      let usersTableExists = false;
      try {
        const { data: usersCheck, error: usersCheckError } = await supabase
          .from('users')
          .select('count(*)')
          .limit(1);
        
        usersTableExists = !usersCheckError;
      } catch (tableCheckError) {
        console.log("Users table check error:", tableCheckError);
        usersTableExists = false;
      }
      
      console.log("Users table exists:", usersTableExists);
      
      // Try to find the user in the profiles table first
      let foundUser = false;
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      
      // If we found a user profile
      if (!profileError && userProfile) {
        approver_id = userProfile.id;
        is_registered = true;
        foundUser = true;
      }
      
      // If we didn't find a user but the users table exists, try there
      if (!foundUser && usersTableExists) {
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();
          
        if (!userCheckError && existingUser) {
          approver_id = existingUser.id;
          is_registered = true;
          foundUser = true;
        }
      }
      
      // If we still haven't found a user, create one
      if (!foundUser) {
        // Generate a new UUID
        approver_id = crypto.randomUUID();
        
        // If users table exists, create a placeholder record for the foreign key constraint
        if (usersTableExists) {
          const { error: userInsertError } = await supabase
            .from('users')
            .insert({
              id: approver_id,
              email: email.toLowerCase(),
              created_at: new Date().toISOString()
            });
          
          if (userInsertError) {
            console.error("Error creating user placeholder:", userInsertError);
            return NextResponse.json(
              { error: "Failed to create user record. Please make sure your database is properly set up." },
              { status: 500 }
            );
          }
        }
        
        // Send invitation email using standard auth
        const { error: signupError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            // Use a dedicated environment variable if available, fall back to constructed URL
            emailRedirectTo: process.env.APPROVER_CALLBACK_URL 
              ? `${process.env.APPROVER_CALLBACK_URL}?ghostwriter=${user.id}`
              : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?ghostwriter=${user.id}`
          }
        });
        
        if (signupError) {
          console.error("Error sending invitation OTP:", signupError);
          return NextResponse.json(
            { error: "Unable to send invitation email. Please check your Supabase configuration." },
            { status: 500 }
          );
        }
      }
    } catch (authError) {
      console.error("Error with auth operations:", authError);
      return NextResponse.json(
        { error: "There was a problem processing your request. Please try again." },
        { status: 500 }
      );
    }

    // Check if the relationship already exists
    const { data: existingLink, error: linkCheckError } = await supabase
      .from('ghostwriter_approver_link')
      .select('id, active')
      .eq('ghostwriter_id', user.id)
      .eq('approver_id', approver_id)
      .maybeSingle();

    if (linkCheckError) {
      console.error("Error checking existing link:", linkCheckError);
      return NextResponse.json(
        { error: "Error checking existing relationship" },
        { status: 500 }
      );
    }

    let result;

    if (existingLink) {
      // Link exists - update if inactive
      if (!existingLink.active) {
        const { data, error: updateError } = await supabase
          .from('ghostwriter_approver_link')
          .update({ 
            active: true, 
            revoked_at: null 
          })
          .eq('id', existingLink.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating link:", updateError);
          return NextResponse.json(
            { error: "Error updating relationship" },
            { status: 500 }
          );
        }

        result = data;
      } else {
        // Already active
        return NextResponse.json(
          { 
            message: "Approver is already linked to your account",
            data: {
              id: existingLink.id,
              approver_id,
              active: true,
              is_registered
            }
          },
          { status: 200 }
        );
      }
    } else {
      // Create new link
      
      // Log the data we're trying to insert for debugging
      console.log("Attempting to create link with:", {
        ghostwriter_id: user.id,
        approver_id: approver_id
      });
      
      // Check if the users exist in the database
      if (usersTableExists) {
        const { data: gwCheck, error: gwError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (gwError) {
          console.error("Ghostwriter doesn't exist in users table:", gwError);
          
          // Try to create the ghostwriter record
          const { error: gwInsertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              created_at: new Date().toISOString()
            });
            
          if (gwInsertError) {
            console.error("Failed to create ghostwriter record:", gwInsertError);
            return NextResponse.json(
              { error: "Could not create relationship - ghostwriter record issue" },
              { status: 500 }
            );
          }
        }
        
        const { data: apCheck, error: apError } = await supabase
          .from('users')
          .select('id')
          .eq('id', approver_id)
          .single();
          
        if (apError) {
          console.error("Approver doesn't exist in users table:", apError);
          return NextResponse.json(
            { error: "Could not create relationship - approver record issue" },
            { status: 500 }
          );
        }
      }
      
      // Now try to create the link
      const { data, error: insertError } = await supabase
        .from('ghostwriter_approver_link')
        .insert({
          ghostwriter_id: user.id,
          approver_id: approver_id,
          active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating link:", insertError);
        
        // Special handling for foreign key violations
        if (insertError.code === '23503') {
          return NextResponse.json(
            { 
              error: "Error creating relationship - foreign key constraint violated. Invitation email was sent, but the approver will need to be added manually after they register.",
              emailSent: true
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          { error: "Error creating relationship" },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({
      message: is_registered ? "Approver added successfully" : "Invitation sent successfully",
      data: {
        ...result,
        is_registered
      }
    });

  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 