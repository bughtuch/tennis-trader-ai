import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/* PATCH /api/vault/notes/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== "string"))) {
      return NextResponse.json({ success: false, error: "tags must be an array of strings" }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.content !== undefined && typeof body.content === "string") updates.content = body.content.trim();
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.priority !== undefined && ["low", "medium", "high"].includes(body.priority)) {
      updates.priority = body.priority;
    }
    if (body.form_status !== undefined) {
      if (body.form_status === null || ["poor", "mixed", "strong", "unknown"].includes(body.form_status)) {
        updates.form_status = body.form_status;
      }
    }

    const { data: note, error } = await supabase
      .from("player_notes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, note_tags(tag)")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!note) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });

    // Update tags if provided
    if (body.tags !== undefined) {
      await supabase.from("note_tags").delete().eq("note_id", id).eq("user_id", user.id);
      if (body.tags.length > 0) {
        const tagRows = body.tags.map((t: string) => ({
          note_id: id,
          tag: t.trim(),
          user_id: user.id,
        }));
        await supabase.from("note_tags").insert(tagRows);
      }
      // Refetch with updated tags
      const { data: updated } = await supabase
        .from("player_notes")
        .select("*, note_tags(tag)")
        .eq("id", id)
        .single();
      return NextResponse.json({ success: true, note: updated });
    }

    return NextResponse.json({ success: true, note });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

/* DELETE /api/vault/notes/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { error } = await supabase
      .from("player_notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
