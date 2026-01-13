import { requireAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const ghostwriterId = url.searchParams.get('id');

  if (!ghostwriterId) {
    return NextResponse.json(
      { error: "No ghostwriter ID provided" },
      { status: 400 }
    );
  }

  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { supabase } = auth;

    // Try to get user data from the profiles table first (most common)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', ghostwriterId)
      .single();

    if (!profileError && profileData) {
      return NextResponse.json({
        id: profileData.id,
        email: profileData.email,
        name: profileData.full_name || profileData.email.split('@')[0]
      });
    }

    console.log("Profile not found, checking users_view");

    // Try using the existing users_view
    const { data: viewUserData, error: viewUserError } = await supabase
      .from('users_view')
      .select('id, email, raw_user_meta_data')
      .eq('id', ghostwriterId)
      .maybeSingle();

    if (!viewUserError && viewUserData) {
      console.log("Found user in users_view");
      const userMetadata = viewUserData.raw_user_meta_data || {};
      return NextResponse.json({
        id: viewUserData.id,
        email: viewUserData.email,
        name: userMetadata.full_name || userMetadata.name || viewUserData.email.split('@')[0]
      });
    }

    // Last resort: just return the ID if we know it exists
    // This is better than failing completely since we have the ID
    return NextResponse.json({
      id: ghostwriterId,
      email: "User not found",
      name: "Unknown User"
    });
    
  } catch (error) {
    console.error("Error checking ghostwriter:", error);
    
    // Return dummy data to prevent UI errors
    return NextResponse.json({
      id: ghostwriterId,
      email: "Error finding user",
      name: "Unknown User"
    });
  }
} 