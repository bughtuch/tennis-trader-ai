import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/* GET /api/vault/tags — list user's custom tags */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { data: tags, error } = await supabase
      .from("user_custom_tags")
      .select("*")
      .eq("user_id", user.id)
      .order("tag", { ascending: true });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, tags: tags ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

/* POST /api/vault/tags — create custom tag */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { tag } = await req.json() as { tag: string };
    if (!tag?.trim()) return NextResponse.json({ success: false, error: "Tag is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("user_custom_tags")
      .upsert({ user_id: user.id, tag: tag.trim() }, { onConflict: "user_id,tag" })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, tag: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
