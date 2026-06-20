"use client";

import { useState } from "react";
import VaultFormBadge from "./VaultFormBadge";

interface NoteTag {
  tag: string;
}

export interface VaultNote {
  id: string;
  player_name: string;
  content: string;
  form_status: string | null;
  priority: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  note_tags: NoteTag[];
}

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

interface VaultNoteCardProps {
  note: VaultNote;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onUpdatePriority: (id: string, priority: string) => void;
}

export default function VaultNoteCard({ note, onToggleActive, onDelete, onUpdatePriority }: VaultNoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const age = formatAge(note.created_at);
  const stars = PRIORITY_STARS[note.priority] ?? PRIORITY_STARS.medium;
  const starColor = PRIORITY_COLOR[note.priority] ?? PRIORITY_COLOR.medium;

  const priorities = ["low", "medium", "high"];
  const nextPriority = priorities[(priorities.indexOf(note.priority) + 1) % priorities.length];

  return (
    <div className={`rounded-lg border p-3 space-y-1.5 transition-opacity ${
      note.is_active
        ? "border-gray-700/50 bg-gray-800/30"
        : "border-gray-800/30 bg-gray-900/30 opacity-60"
    }`}>
      {/* Top row: priority, form, age, actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdatePriority(note.id, nextPriority)}
            className={`text-sm leading-none ${starColor} hover:text-amber-300 transition-colors`}
            title={`Priority: ${note.priority} (click to cycle)`}
          >
            {stars}
          </button>
          {note.form_status && <VaultFormBadge form={note.form_status} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-600">{age}</span>
          <button
            onClick={() => onToggleActive(note.id, !note.is_active)}
            className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors"
            title={note.is_active ? "Mark inactive" : "Mark active"}
          >
            {note.is_active ? "Archive" : "Restore"}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(note.id)} className="text-[9px] text-red-400 hover:text-red-300">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[9px] text-gray-600 hover:text-gray-400">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[9px] text-gray-700 hover:text-red-400 transition-colors">&times;</button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className={`text-xs leading-relaxed ${note.is_active ? "text-gray-300" : "text-gray-600 line-through"}`}>
        {note.content}
      </p>

      {/* Tags */}
      {note.note_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.note_tags.map(t => (
            <span
              key={t.tag}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                t.tag === "Mental Scar" ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                t.tag === "Watchlist" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                t.tag === "Injury" ? "bg-orange-500/15 text-orange-400 border border-orange-500/20" :
                "bg-gray-700/30 text-gray-500 border border-gray-700/30"
              }`}
            >
              {t.tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
