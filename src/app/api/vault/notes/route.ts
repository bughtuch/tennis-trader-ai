import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/* GET /api/vault/notes?player=&tag=&active=&recent=&priority= */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const url = req.nextUrl;
    const player = url.searchParams.get("player");
    const tag = url.searchParams.get("tag");
    const active = url.searchParams.get("active");
    const recent = url.searchParams.get("recent");
    const priority = url.searchParams.get("priority");

    let query = supabase
      .from("player_notes")
      .select("*, note_tags(tag)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (player) query = query.eq("player_name", player);
    if (active === "true") query = query.eq("is_active", true);
    if (active === "false") query = query.eq("is_active", false);
    if (priority) query = query.eq("priority", priority);
    if (recent === "true") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", thirtyDaysAgo);
    }

    const { data: notes, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // If filtering by tag, do it in JS (Supabase can't filter on nested join easily)
    let filtered = notes ?? [];
    if (tag) {
      filtered = filtered.filter((n: { note_tags: { tag: string }[] }) =>
        n.note_tags?.some((t: { tag: string }) => t.tag === tag)
      );
    }

    return NextResponse.json({ success: true, notes: filtered });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

/* POST /api/vault/notes */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { player_name, content, tags, form_status, priority } = body as {
      player_name: string;
      content: string;
      tags?: string[];
      form_status?: string;
      priority?: string;
    };

    if (!player_name?.trim() || !content?.trim()) {
      return NextResponse.json({ success: false, error: "player_name and content are required" }, { status: 400 });
    }

    const validPriority = ["low", "medium", "high"];
    const validForm = ["poor", "mixed", "strong", "unknown"];

    const { data: note, error: noteError } = await supabase
      .from("player_notes")
      .insert({
        user_id: user.id,
        player_name: player_name.trim(),
        content: content.trim(),
        form_status: form_status && validForm.includes(form_status) ? form_status : null,
        priority: priority && validPriority.includes(priority) ? priority : "medium",
      })
      .select()
      .single();

    if (noteError) return NextResponse.json({ success: false, error: noteError.message }, { status: 500 });

    // Insert tags
    if (tags && tags.length > 0) {
      const tagRows = tags.map((t: string) => ({
        note_id: note.id,
        tag: t.trim(),
        user_id: user.id,
      }));
      const { error: tagError } = await supabase.from("note_tags").insert(tagRows);
      if (tagError) return NextResponse.json({ success: false, error: tagError.message }, { status: 500 });
    }

    // Refetch with tags
    const { data: full } = await supabase
      .from("player_notes")
      .select("*, note_tags(tag)")
      .eq("id", note.id)
      .single();

    return NextResponse.json({ success: true, note: full });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
