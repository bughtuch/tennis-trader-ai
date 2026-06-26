"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import VaultNoteCard, { type VaultNote } from "@/components/vault/VaultNoteCard";
import VaultNoteForm from "@/components/vault/VaultNoteForm";
import VaultFilterBar from "@/components/vault/VaultFilterBar";
import VaultFormBadge from "@/components/vault/VaultFormBadge";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function VaultPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  // Filters
  const [activeFilter, setActiveFilter] = useState("active");
  const [playerFilter, setPlayerFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/auth/login");
    });
  }, [router]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (playerFilter) params.set("player", playerFilter);
    if (activeFilter === "active") params.set("active", "true");
    if (activeFilter === "inactive") params.set("active", "false");
    if (recentOnly) params.set("recent", "true");
    if (priorityFilter) params.set("priority", priorityFilter);
    if (tagFilter) params.set("tag", tagFilter);

    try {
      const res = await fetch(`/api/vault/notes?${params}`);
      const data = await res.json();
      if (data.success) setNotes(data.notes);
    } catch { /* silent */ }
    setLoading(false);
  }, [playerFilter, activeFilter, recentOnly, priorityFilter, tagFilter]);

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/players");
      const data = await res.json();
      if (data.success) setPlayers(data.players);
    } catch { /* silent */ }
  }, []);

  // Fetch custom tags
  const fetchCustomTags = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/tags");
      const data = await res.json();
      if (data.success) setCustomTags(data.tags.map((t: { tag: string }) => t.tag));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchPlayers(); fetchCustomTags(); }, [fetchPlayers, fetchCustomTags]);

  // Handlers
  async function handleSaveNote(note: { player_name: string; content: string; tags: string[]; form_status: string | null; priority: string }) {
    setVaultError(null);
    try {
      const res = await fetch("/api/vault/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });
      const data = await res.json();
      if (data.success) {
        fetchNotes();
        fetchPlayers();
      } else {
        setVaultError(data.error ?? "Failed to save note");
      }
    } catch {
      setVaultError("Network error — note not saved");
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setVaultError(null);
    try {
      const res = await fetch(`/api/vault/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      if (!res.ok) setVaultError("Failed to update note status");
      fetchNotes();
    } catch {
      setVaultError("Network error — update failed");
    }
  }

  async function handleDelete(id: string) {
    setVaultError(null);
    try {
      const res = await fetch(`/api/vault/notes/${id}`, { method: "DELETE" });
      if (!res.ok) setVaultError("Failed to delete note");
      fetchNotes();
    } catch {
      setVaultError("Network error — delete failed");
    }
  }

  async function handleUpdatePriority(id: string, priority: string) {
    setVaultError(null);
    try {
      const res = await fetch(`/api/vault/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) setVaultError("Failed to update priority");
      fetchNotes();
    } catch {
      setVaultError("Network error — update failed");
    }
  }

  async function handleCreateCustomTag(tag: string) {
    await fetch("/api/vault/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    fetchCustomTags();
  }

  // Sort: high priority first, then newest
  const sortedNotes = [...notes].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Search filter
  const displayNotes = search.trim()
    ? sortedNotes.filter(n =>
        n.content.toLowerCase().includes(search.toLowerCase()) ||
        n.player_name.toLowerCase().includes(search.toLowerCase())
      )
    : sortedNotes;

  // Group by player
  const playerGroups = new Map<string, VaultNote[]>();
  for (const note of displayNotes) {
    const existing = playerGroups.get(note.player_name) ?? [];
    existing.push(note);
    playerGroups.set(note.player_name, existing);
  }

  // Get current form for a player
  function getPlayerForm(playerNotes: VaultNote[]): string | null {
    const sorted = [...playerNotes].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted.find(n => n.form_status)?.form_status ?? null;
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Intelligence Vault</h1>
            <p className="text-xs text-gray-500 mt-0.5">{notes.length} notes across {playerGroups.size} players</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            {showForm ? "Cancel" : "+ Add Note"}
          </button>
        </div>

        {/* Note Form */}
        {showForm && (
          <div className="mb-6">
            <VaultNoteForm
              players={players}
              customTags={customTags}
              onSave={handleSaveNote}
              onCreateCustomTag={handleCreateCustomTag}
              onClose={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes and players..."
            className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Error banner */}
        {vaultError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
            <span>{vaultError}</span>
            <button onClick={() => setVaultError(null)} className="text-red-400 hover:text-red-300 ml-2 text-xs">Dismiss</button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <VaultFilterBar
            players={players}
            customTags={customTags}
            activeFilter={activeFilter}
            playerFilter={playerFilter}
            tagFilter={tagFilter}
            priorityFilter={priorityFilter}
            onActiveChange={setActiveFilter}
            onPlayerChange={setPlayerFilter}
            onTagChange={setTagFilter}
            onPriorityChange={setPriorityFilter}
            onRecentToggle={() => setRecentOnly(!recentOnly)}
            recentOnly={recentOnly}
          />
        </div>

        {/* Notes grouped by player */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-lg bg-gray-800/30" />
            ))}
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-600 text-sm">
              {notes.length === 0 ? "No notes yet. Add your first observation." : "No notes match your filters."}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(playerGroups.entries()).map(([player, playerNotes]) => (
              <div key={player}>
                {/* Player header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-white">{player}</span>
                  <VaultFormBadge form={getPlayerForm(playerNotes)} />
                  <span className="text-[10px] text-gray-600">{playerNotes.length} {playerNotes.length === 1 ? "note" : "notes"}</span>
                </div>
                {/* Notes */}
                <div className="space-y-2">
                  {playerNotes.map(note => (
                    <VaultNoteCard
                      key={note.id}
                      note={note}
                      onToggleActive={handleToggleActive}
                      onDelete={handleDelete}
                      onUpdatePriority={handleUpdatePriority}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
