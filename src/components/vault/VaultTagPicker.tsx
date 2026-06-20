"use client";

import { useState } from "react";

export const PRESET_TAGS = [
  "Grass", "Clay", "Hard Court",
  "Personality", "Injury", "Fitness",
  "Pressure", "Serving", "Confidence",
  "Form", "Mentality", "Weather",
  "Mental Scar", "Watchlist", "Other",
];

interface VaultTagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
  customTags?: string[];
  onCreateCustomTag?: (tag: string) => void;
}

export default function VaultTagPicker({ selected, onChange, customTags = [], onCreateCustomTag }: VaultTagPickerProps) {
  const [newTag, setNewTag] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const allTags = [...PRESET_TAGS, ...customTags.filter(t => !PRESET_TAGS.includes(t))];

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  function handleAddCustom() {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (!allTags.includes(trimmed)) {
      onCreateCustomTag?.(trimmed);
    }
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setNewTag("");
    setShowCustomInput(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {allTags.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
              selected.includes(tag)
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/50 text-gray-500 border border-gray-700/50 hover:text-gray-300"
            }`}
          >
            {selected.includes(tag) && "\u2713 "}{tag}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="px-2.5 py-1.5 rounded text-[11px] font-medium bg-gray-800/50 text-gray-500 border border-gray-700/50 hover:text-gray-300 transition-colors"
        >
          + Custom
        </button>
      </div>
      {showCustomInput && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddCustom())}
            placeholder="Tag name..."
            className="flex-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            maxLength={30}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
