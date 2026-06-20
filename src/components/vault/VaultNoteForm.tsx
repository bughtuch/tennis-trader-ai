"use client";

import { useState } from "react";
import VaultTagPicker from "./VaultTagPicker";

interface VaultNoteFormProps {
  players: string[];
  customTags: string[];
  onSave: (note: {
    player_name: string;
    content: string;
    tags: string[];
    form_status: string | null;
    priority: string;
  }) => Promise<void>;
  onCreateCustomTag: (tag: string) => void;
  onClose: () => void;
}

const FORM_OPTIONS = [
  { value: "poor", label: "Poor", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { value: "mixed", label: "Mixed", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { value: "strong", label: "Strong", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  { value: "unknown", label: "Unknown", color: "text-gray-500 border-gray-600/30 bg-gray-500/10" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "\u2605\u2606\u2606", title: "Low" },
  { value: "medium", label: "\u2605\u2605\u2606", title: "Medium" },
  { value: "high", label: "\u2605\u2605\u2605", title: "High" },
];

export default function VaultNoteForm({ players, customTags, onSave, onCreateCustomTag, onClose }: VaultNoteFormProps) {
  const [playerName, setPlayerName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = playerName.trim()
    ? players.filter(p => p.toLowerCase().includes(playerName.toLowerCase()))
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await onSave({ player_name: playerName.trim(), content: content.trim(), tags, form_status: formStatus, priority });
      setPlayerName("");
      setContent("");
      setTags([]);
      setFormStatus(null);
      setPriority("medium");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider uppercase text-gray-400">Add Note</h3>
        <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-400 text-sm">&times;</button>
      </div>

      {/* Player */}
      <div className="relative">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Player</label>
        <input
          type="text"
          value={playerName}
          onChange={e => { setPlayerName(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search or type player name..."
          className="w-full mt-0.5 px-3 py-1.5 text-sm bg-gray-900/50 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          required
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 w-full mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-32 overflow-y-auto">
            {filtered.slice(0, 8).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setPlayerName(p); setShowSuggestions(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Note</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Your observation..."
          rows={3}
          className="w-full mt-0.5 px-3 py-1.5 text-sm bg-gray-900/50 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
          required
        />
      </div>

      {/* Priority */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Priority</label>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                priority === opt.value
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-gray-800/50 text-gray-600 border border-gray-700/30 hover:text-gray-400"
              }`}
              title={opt.title}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Tags</label>
        <div className="mt-0.5">
          <VaultTagPicker selected={tags} onChange={setTags} customTags={customTags} onCreateCustomTag={onCreateCustomTag} />
        </div>
      </div>

      {/* Form Status */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Current Form (optional)</label>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {FORM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormStatus(formStatus === opt.value ? null : opt.value)}
              className={`px-2.5 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                formStatus === opt.value ? opt.color : "text-gray-600 border-gray-700/30 bg-gray-800/30 hover:text-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={saving || !playerName.trim() || !content.trim()}
        className="w-full py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
      >
        {saving ? "Saving..." : "Save Note"}
      </button>
    </form>
  );
}
