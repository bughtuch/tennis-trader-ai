import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    // Auth check — verify the authenticated user matches the requested profile
    const { createServerClient } = await import("@/lib/supabase-server");
    const authSupabase = await createServerClient();
    const { data: { user: authUser } } = await authSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "userId and email are required" },
        { status: 400 }
      );
    }

    // Only allow creating/updating your own profile
    if (userId !== authUser.id) {
      return NextResponse.json(
        { error: "Cannot create profile for another user" },
        { status: 403 }
      );
    }

    // Use service role key if available, fall back to anon key
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey
    );

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: userId, email },
        { onConflict: "id" }
      );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create profile",
      },
      { status: 500 }
    );
  }
}
