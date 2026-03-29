"use client";

import { useState } from "react";

interface PostTradeReviewProps {
  review: string | null;
  loading: boolean;
}

export default function PostTradeReview({ review, loading }: PostTradeReviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!review && !loading) return null;

  // Split review into first sentence and rest
  const firstSentence = review
    ? review.split(/(?<=\.)\s+/)[0] ?? review
    : "";
  const hasMore = review ? review.length > firstSentence.length : false;

  return (
    <div className="mt-2 border border-amber-600/30 rounded-lg overflow-hidden bg-amber-500/5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-2.5 py-1.5 flex items-start gap-1.5 text-left hover:bg-amber-500/10 transition-all"
      >
        <span className="text-[10px] shrink-0 mt-px" style={{ color: "#D4A853" }}>
          {loading ? "⏳" : "📋"}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className="text-[9px] font-semibold tracking-wider uppercase block mb-0.5"
            style={{ color: "#D4A853" }}
          >
            POST-TRADE REVIEW
          </span>
          {loading ? (
            <span className="text-[10px] text-gray-500 italic">Generating review...</span>
          ) : (
            <span
              className={`text-[10px] leading-relaxed block ${expanded ? "" : "line-clamp-1"}`}
              style={{ color: "#C8B89A" }}
            >
              {expanded ? review : firstSentence}
              {!expanded && hasMore && (
                <span className="text-gray-500 ml-0.5">...</span>
              )}
            </span>
          )}
        </div>
        {review && hasMore && (
          <svg
            className={`w-3 h-3 shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "#D4A853" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
    </div>
  );
}
