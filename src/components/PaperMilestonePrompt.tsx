"use client";

import Link from "next/link";

interface PaperMilestonePromptProps {
  tradeCount: number;
  totalPnl: number;
  onDismiss: () => void;
}

export default function PaperMilestonePrompt({
  tradeCount,
  totalPnl,
  onDismiss,
}: PaperMilestonePromptProps) {
  return (
    <div className="border-b border-purple-500/30 bg-purple-500/5">
      <div className="px-3 md:px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <span className="text-sm font-bold text-purple-400">
                PAPER TRADING MILESTONE
              </span>
            </div>

            <p className="text-xs text-purple-300/80 leading-relaxed">
              You&apos;ve completed{" "}
              <span className="font-semibold text-white">{tradeCount} paper trades</span>
              {" "}with{" "}
              <span
                className={`font-mono font-semibold ${
                  totalPnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {totalPnl >= 0 ? "+" : "-"}£{Math.abs(totalPnl).toFixed(2)}
              </span>
              {" "}profit. Ready to go live?
            </p>

            <Link
              href="/settings"
              className="inline-block px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Subscribe to trade with real money
            </Link>
          </div>

          <button
            onClick={onDismiss}
            className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
