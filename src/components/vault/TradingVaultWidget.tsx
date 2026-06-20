"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import VaultFormBadge from "./VaultFormBadge";

interface WidgetNote {
  id: string;
  player_name: string;
  content: string;
  priority: string;
  form_status: string | null;
  is_active: boolean;
  created_at: string;
  note_tags: { tag: string }[];
}

interface PlayerSummary {
  name: string;
  noteCount: number;
  form: string | null;
  topNotes: WidgetNote[];
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_STARS: Record<string, string> = {
  high: "\u2605\u2605\u2605",
  medium: "\u2605\u2605\u2606",
  low: "\u2605\u2606\u2606",
};
const PRIORITY_COLOR: Record<string, string> = {
  high: "text-amber-400",
  medium: "text-gray-400",
  low: "text-gray-600",
};

interface TradingVaultWidgetProps {
  player1Name: string;
  player2Name: string;
  variant?: "dark" | "light";
}

export default function TradingVaultWidget({ player1Name, player2Name, variant = "dark" }: TradingVaultWidgetProps) {
  const [summaries, setSummaries] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player1Name || !player2Name) return;

    async function fetchNotes() {
      setLoading(true);
      try {
        const res = await fetch("/api/vault/notes?active=true");
        const data = await res.json();
        if (!data.success) { setLoading(false); return; }

        const notes = data.notes as WidgetNote[];
        const result: PlayerSummary[] = [];

        for (const name of [player1Name, player2Name]) {
          // Match player by last name (Betfair uses full names, vault may use either)
          const lastName = name.split(" ").pop()?.toLowerCase() ?? "";
          const playerNotes = notes.filter(n =>
            n.player_name.toLowerCase() === name.toLowerCase() ||
            n.player_name.toLowerCase().endsWith(lastName)
          );

          if (playerNotes.length === 0) continue;

          // Sort: high priority first, then newest
          playerNotes.sort((a, b) => {
            const pa = PRIORITY_ORDER[a.priority] ?? 1;
            const pb = PRIORITY_ORDER[b.priority] ?? 1;
            if (pa !== pb) return pa - pb;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          // Get current form from most recent note with form_status
          const formNote = playerNotes.find(n => n.form_status);

          result.push({
            name: name.split(" ").pop() ?? name,
            noteCount: playerNotes.length,
            form: formNote?.form_status ?? null,
            topNotes: playerNotes.slice(0, 2),
          });
        }

        setSummaries(result);
      } catch { /* silent */ }
      setLoading(false);
    }

    fetchNotes();
  }, [player1Name, player2Name]);

  if (loading || summaries.length === 0) return null;

  const isLight = variant === "light";

  return (
    <div className={`rounded-lg border overflow-hidden ${
      isLight ? "border-gray-300 bg-white" : "border-gray-700/50 bg-gray-800/30"
    }`}>
      {/* Header */}
      <div className={`px-3 py-1.5 flex items-center justify-between border-b ${
        isLight ? "border-gray-200 bg-gray-50" : "border-gray-700/30"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${isLight ? "text-gray-600" : "text-gray-400"}`}>
            VAULT
          </span>
          {summaries.map(s => (
            <span key={s.name} className={`text-[9px] px-1.5 py-0.5 rounded ${isLight ? "bg-gray-100 text-gray-600" : "bg-gray-700/40 text-gray-500"}`}>
              {s.name} {s.noteCount}
            </span>
          ))}
        </div>
        <Link href="/vault" className={`text-[9px] font-medium hover:underline ${isLight ? "text-blue-600" : "text-blue-400"}`}>
          Open
        </Link>
      </div>

      {/* Player summaries */}
      <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-700/20"}`}>
        {summaries.map(s => (
          <div key={s.name} className="px-3 py-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? "text-gray-700" : "text-gray-300"}`}>{s.name}</span>
              {s.form && <VaultFormBadge form={s.form} />}
            </div>
            {s.topNotes.map(n => (
              <div key={n.id} className="flex items-start gap-1.5">
                <span className={`text-[10px] shrink-0 ${PRIORITY_COLOR[n.priority] ?? "text-gray-500"}`}>
                  {PRIORITY_STARS[n.priority] ?? "\u2605\u2605\u2606"}
                </span>
                <p className={`text-[11px] leading-snug line-clamp-2 ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                  {n.content}
                </p>
              </div>
            ))}
            {s.topNotes[0]?.note_tags && s.topNotes[0].note_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {/* Show tags from top notes, deduplicated */}
                {[...new Set(s.topNotes.flatMap(n => n.note_tags.map(t => t.tag)))].slice(0, 4).map(tag => (
                  <span key={tag} className={`px-1 py-0.5 rounded text-[8px] font-medium ${
                    tag === "Mental Scar" ? (isLight ? "bg-red-50 text-red-600 border border-red-200" : "bg-red-500/15 text-red-400") :
                    tag === "Watchlist" ? (isLight ? "bg-purple-50 text-purple-600 border border-purple-200" : "bg-purple-500/15 text-purple-400") :
                    (isLight ? "bg-gray-100 text-gray-500 border border-gray-200" : "bg-gray-700/30 text-gray-500")
                  }`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
