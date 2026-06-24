"use client";

import { PRESET_TAGS } from "./VaultTagPicker";

interface VaultFilterBarProps {
  players: string[];
  customTags: string[];
  activeFilter: string;
  playerFilter: string;
  tagFilter: string;
  priorityFilter: string;
  onActiveChange: (v: string) => void;
  onPlayerChange: (v: string) => void;
  onTagChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onRecentToggle: () => void;
  recentOnly: boolean;
}

export default function VaultFilterBar({
  players, customTags,
  activeFilter, playerFilter, tagFilter, priorityFilter,
  onActiveChange, onPlayerChange, onTagChange, onPriorityChange,
  onRecentToggle, recentOnly,
}: VaultFilterBarProps) {
  const allTags = [...PRESET_TAGS, ...customTags.filter(t => !PRESET_TAGS.includes(t))];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recent toggle */}
      <button
        onClick={onRecentToggle}
        className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
          recentOnly
            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
            : "bg-gray-800/50 text-gray-500 border-gray-700/30 hover:text-gray-300"
        }`}
      >
        Recent 30d
      </button>

      {/* Active filter */}
      <select
        value={activeFilter}
        onChange={e => onActiveChange(e.target.value)}
        className="px-2 py-1 rounded text-[11px] bg-gray-800/50 text-gray-200 border border-gray-700/30 focus:outline-none focus:border-blue-500/50"
      >
        <option value="all">All Notes</option>
        <option value="active">Active</option>
        <option value="inactive">Archived</option>
      </select>

      {/* Player filter */}
      <select
        value={playerFilter}
        onChange={e => onPlayerChange(e.target.value)}
        className="px-2 py-1 rounded text-[11px] bg-gray-800/50 text-gray-200 border border-gray-700/30 focus:outline-none focus:border-blue-500/50 max-w-[140px]"
      >
        <option value="">All Players</option>
        {players.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      {/* Tag filter */}
      <select
        value={tagFilter}
        onChange={e => onTagChange(e.target.value)}
        className="px-2 py-1 rounded text-[11px] bg-gray-800/50 text-gray-200 border border-gray-700/30 focus:outline-none focus:border-blue-500/50"
      >
        <option value="">All Tags</option>
        {allTags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Priority filter */}
      <select
        value={priorityFilter}
        onChange={e => onPriorityChange(e.target.value)}
        className="px-2 py-1 rounded text-[11px] bg-gray-800/50 text-gray-200 border border-gray-700/30 focus:outline-none focus:border-blue-500/50"
      >
        <option value="">Any Priority</option>
        <option value="high">{"\u2605\u2605\u2605"} High</option>
        <option value="medium">{"\u2605\u2605\u2606"} Medium</option>
        <option value="low">{"\u2605\u2606\u2606"} Low</option>
      </select>
    </div>
  );
}
