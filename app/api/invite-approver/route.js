import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Check if the target user already exists
    const { data: existingUsers, error: searchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (searchError) {
      console.error("Error searching for user:", searchError);
      return NextResponse.json(
        { error: "Error searching for user" },
        { status: 500 }
      );
    }

    let approver_id;
    let is_registered = false;

    if (existingUsers) {
      // User exists
      approver_id = existingUsers.id;
      is_registered = true;
    } else {
      // Generate a temporary UUID for the future user
      const { data: uuidData } = await supabase.rpc('generate_uuid');
      approver_id = uuidData;

      // Send invitation email with magic link
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/accept?ghostwriter=${user.id}`
      });

      if (inviteError) {
        console.error("Error sending invitation:", inviteError);
        return NextResponse.json(
          { error: "Error sending invitation email" },
          { status: 500 }
        );
      }
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