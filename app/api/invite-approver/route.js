import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  // Declare usersTableExists at the function level so it's accessible throughout
  let usersTableExists = false;

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
      
      // If we didn't find a user, check users_view
      if (!foundUser) {
        const { data: viewUser, error: viewUserError } = await supabase
          .from('users_view')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();
          
        if (!viewUserError && viewUser) {
          approver_id = viewUser.id;
          is_registered = true;
          foundUser = true;
        }
      }
      
      // If we didn't find a user but the users table exists, try there as last resort
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
            // Use a new direct approver-signup URL that will handle everything in one page
            emailRedirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai/').replace(/\/$/, '')}/auth/callback?ghostwriter=${encodeURIComponent(user.id)}&email=${encodeURIComponent(email)}&fromApproverSignup=true`,
            // Add email subject
            emailSubject: "Invitation to become an approver",
            // Add a custom message to the email
            data: {
              invite_message: `You have been invited to become an approver. Click the link below to create your account - you will be able to set your password on the next page.`
            }
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
      
      // Check if the users exist in the database - use the variable from the higher scope
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
      
      // First ensure both users exist in profiles table to avoid foreign key constraints
      try {
        // Check if ghostwriter exists in profiles
        const { data: ghostwriterProfile, error: gwProfileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
          
        // If not, create a profile entry for the ghostwriter
        if (gwProfileError || !ghostwriterProfile) {
          // Insert ghostwriter into profiles
          await supabase
            .from('profiles')
            .insert({
              id: user.id,
              created_at: new Date().toISOString()
            })
            .onConflict('id')
            .merge();
        }
        
        // Check if approver exists in profiles
        const { data: approverProfile, error: apProfileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', approver_id)
          .maybeSingle();
          
        // If not found and we know email, create a profile for approver
        if (apProfileError || !approverProfile) {
          // Insert approver into profiles
          await supabase
            .from('profiles')
            .insert({
              id: approver_id,
              created_at: new Date().toISOString()
            })
            .onConflict('id')
            .merge();
        }
      } catch (profileSyncError) {
        console.log('Error syncing profiles:', profileSyncError);
        // Continue anyway - trigger should handle it if profiles table exists
      }
      
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
          // If this is a foreign key error, let's provide more detailed information
          const errorDetails = insertError.details || '';
          
          if (errorDetails.includes('ghostwriter_id')) {
            return NextResponse.json(
              { 
                error: "Your account is not properly set up in the database. Please contact support.",
                details: "Ghostwriter ID foreign key constraint failed"
              },
              { status: 500 }
            );
          } else if (errorDetails.includes('approver_id')) {
            // This is the most common case - approver doesn't exist yet
            return NextResponse.json(
              { 
                error: "The approver account will be created when they register. Invitation email was sent.",
                emailSent: true,
                success: true,
                details: "Approver account will be created when they register"
              },
              { status: 200 }
            );
          } else {
            return NextResponse.json(
              { 
                error: "Database constraint error. The invitation email was sent, but there was a problem updating the database. The approver will need to be added manually after they register.",
                emailSent: true,
                success: true
              },
              { status: 200 }
            );
          }
        }
        
        return NextResponse.json(
          { error: "Error creating relationship: " + insertError.message },
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