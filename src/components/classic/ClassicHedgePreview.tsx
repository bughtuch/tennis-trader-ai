"use client";

import { useState } from "react";
import { BETFAIR_MIN_STAKE } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface AggregatedPosition {
  netSide: "BACK" | "LAY" | "FLAT";
  netStake: number;
  avgEntry: number;
  count: number;
  backTotal: number;
  layTotal: number;
}

interface HedgeCalc {
  hedgeSide: "BACK" | "LAY";
  hedgeStake: number;
  hedgePrice: number;
  profitIfWin: number;
  profitIfLose: number;
  equalProfit: number;
  hedgeType: "green" | "red" | "scratch";
  liability: number;
}

type PositionState = "open" | "free_bet" | "locked_green" | "locked_red";

interface ClassicHedgePreviewProps {
  playerName: string;
  agg: AggregatedPosition;
  currentBackPrice: number;
  currentLayPrice: number;
  marketSuspended: boolean;
  positionState: PositionState;
}

/* ─── Deterministic hedge math ─── */

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function calculateHedge(
  agg: AggregatedPosition,
  currentBackPrice: number,
  currentLayPrice: number,
): HedgeCalc | null {
  if (agg.netSide === "FLAT") return null;
  if (agg.avgEntry <= 1.01 || agg.netStake <= 0) return null;

  const hedgeSide: "BACK" | "LAY" = agg.netSide === "BACK" ? "LAY" : "BACK";
  const hedgePrice = hedgeSide === "LAY" ? currentLayPrice : currentBackPrice;

  if (!hedgePrice || hedgePrice <= 1.01) return null;

  // hedge stake = (entryStake × entryPrice) / currentHedgePrice
  const hedgeStake = r2((agg.netStake * agg.avgEntry) / hedgePrice);

  if (hedgeStake < BETFAIR_MIN_STAKE || !Number.isFinite(hedgeStake)) return null;

  let profitIfWin: number;
  let profitIfLose: number;

  if (agg.netSide === "BACK") {
    // Entered BACK, hedge by LAYing
    profitIfWin = r2(agg.netStake * (agg.avgEntry - 1) - hedgeStake * (hedgePrice - 1));
    profitIfLose = r2(hedgeStake - agg.netStake);
  } else {
    // Entered LAY, hedge by BACKing
    profitIfWin = r2(hedgeStake * (hedgePrice - 1) - agg.netStake * (agg.avgEntry - 1));
    profitIfLose = r2(agg.netStake - hedgeStake);
  }

  const equalProfit = r2((profitIfWin + profitIfLose) / 2);

  const liability = hedgeSide === "LAY"
    ? r2((hedgePrice - 1) * hedgeStake)
    : r2(hedgeStake);

  const hedgeType: "green" | "red" | "scratch" =
    equalProfit > 0.01 ? "green" : equalProfit < -0.01 ? "red" : "scratch";

  return {
    hedgeSide,
    hedgeStake,
    hedgePrice,
    profitIfWin,
    profitIfLose,
    equalProfit,
    hedgeType,
    liability,
  };
}

/* ─── Raw hedge stake (for min-stake detection) ─── */

function getRawHedgeStake(agg: AggregatedPosition, currentBackPrice: number, currentLayPrice: number): number | null {
  if (agg.netSide === "FLAT" || agg.avgEntry <= 1.01 || agg.netStake <= 0) return null;
  const hedgeSide = agg.netSide === "BACK" ? "LAY" : "BACK";
  const hedgePrice = hedgeSide === "LAY" ? currentLayPrice : currentBackPrice;
  if (!hedgePrice || hedgePrice <= 1.01) return null;
  return r2((agg.netStake * agg.avgEntry) / hedgePrice);
}

/* ─── Component ─── */

export default function ClassicHedgePreview({
  playerName,
  agg,
  currentBackPrice,
  currentLayPrice,
  marketSuspended,
  positionState,
}: ClassicHedgePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const hedge = calculateHedge(agg, currentBackPrice, currentLayPrice);
  const rawStake = getRawHedgeStake(agg, currentBackPrice, currentLayPrice);
  const belowMinStake = !hedge && rawStake !== null && rawStake > 0 && rawStake < BETFAIR_MIN_STAKE;
  const playerShort = playerName.split(" ").pop() ?? playerName;
  const isLockedGreen = positionState === "locked_green";
  const disabled = isLockedGreen || (!hedge && !belowMinStake) || marketSuspended;

  async function fetchAiExplanation() {
    if (!hedge) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: agg.netSide,
          entry_price: agg.avgEntry,
          exit_price: hedge.hedgePrice,
          stake: agg.netStake,
          pnl: hedge.equalProfit,
          player: playerName,
          greened_up: false,
          market_context: `HEDGE PREVIEW (not yet executed). ${agg.netSide} £${agg.netStake.toFixed(2)} @ ${agg.avgEntry.toFixed(2)}. Hedge: ${hedge.hedgeSide} £${hedge.hedgeStake.toFixed(2)} @ ${hedge.hedgePrice.toFixed(2)}. Locked P&L: £${hedge.equalProfit.toFixed(2)}. Type: ${hedge.hedgeType}. Explain what this hedge does in plain English for a tennis trader. Include whether waiting might improve or worsen the position.`,
        }),
      });
      const data = await res.json();
      if (data.success && data.insight) {
        setAiExplanation(data.insight);
      } else {
        setAiExplanation("Unable to generate explanation.");
      }
    } catch {
      setAiExplanation("Network error — try again.");
    }
    setAiLoading(false);
  }

  function handleToggle() {
    if (!expanded && !aiExplanation && hedge) {
      fetchAiExplanation();
    }
    setExpanded(!expanded);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-gray-100 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500">
            AI HEDGE PREVIEW
          </span>
          <span className="text-[10px] text-gray-400">{playerShort}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLockedGreen ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700">
              LOCKED
            </span>
          ) : belowMinStake ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-700">
              BELOW £{BETFAIR_MIN_STAKE} MIN
            </span>
          ) : hedge ? (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              hedge.hedgeType === "green"
                ? "bg-green-100 text-green-700"
                : hedge.hedgeType === "red"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-200 text-gray-600"
            }`}>
              {hedge.hedgeType === "green" ? "GREEN" : hedge.hedgeType === "red" ? "RED" : "SCRATCH"}
            </span>
          ) : null}
          <span className="text-[10px] text-gray-400">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200 space-y-2.5">
          {/* Locked green — no hedge needed */}
          {isLockedGreen && (
            <div className="text-[11px] text-emerald-700 font-semibold text-center py-2">
              Position already locked green. No hedge needed.
            </div>
          )}

          {/* Below min stake message */}
          {belowMinStake && !isLockedGreen && (
            <div className="text-center py-2 space-y-1">
              <div className="text-[11px] text-amber-600 font-semibold">
                Hedge stake £{rawStake?.toFixed(2)} — below Betfair £{BETFAIR_MIN_STAKE} minimum
              </div>
              <div className="text-[10px] text-gray-500 italic">
                Position already close to fully hedged
              </div>
            </div>
          )}

          {/* Normal hedge content */}
          {hedge && !isLockedGreen && (
            <>
              {/* Position summary */}
              <div className="text-[11px] text-gray-600">
                <span className={`font-semibold ${agg.netSide === "BACK" ? "text-blue-700" : "text-pink-700"}`}>
                  {agg.netSide}
                </span>
                {" "}£{agg.netStake.toFixed(2)} @ {agg.avgEntry.toFixed(2)}
              </div>

              {/* Hedge action */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide">Hedge Action</div>
                  <div className="text-xs font-bold mt-0.5">
                    <span className={hedge.hedgeSide === "LAY" ? "text-pink-700" : "text-blue-700"}>
                      {hedge.hedgeSide}
                    </span>
                    {" "}£{hedge.hedgeStake.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">@ {hedge.hedgePrice.toFixed(2)}</div>
                </div>
                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide">Locked P&L</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${
                    hedge.equalProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {hedge.equalProfit >= 0 ? "+" : ""}£{hedge.equalProfit.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500">liability £{hedge.liability.toFixed(2)}</div>
                </div>
              </div>

              {/* Outcome breakdown */}
              <div className="flex gap-2 text-[10px]">
                <div className="flex-1 rounded bg-white border border-gray-200 px-2 py-1.5 text-center">
                  <div className="text-gray-500">If wins</div>
                  <div className={`font-mono font-semibold ${hedge.profitIfWin >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {hedge.profitIfWin >= 0 ? "+" : ""}£{hedge.profitIfWin.toFixed(2)}
                  </div>
                </div>
                <div className="flex-1 rounded bg-white border border-gray-200 px-2 py-1.5 text-center">
                  <div className="text-gray-500">If loses</div>
                  <div className={`font-mono font-semibold ${hedge.profitIfLose >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {hedge.profitIfLose >= 0 ? "+" : ""}£{hedge.profitIfLose.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* AI explanation */}
              <div className="rounded border border-blue-200 bg-blue-50/50 p-2">
                <div className="text-[9px] font-semibold text-blue-600 uppercase tracking-wide mb-1">AI ANALYSIS</div>
                {aiLoading ? (
                  <div className="text-[11px] text-blue-400 animate-pulse">Thinking...</div>
                ) : aiExplanation ? (
                  <p className="text-[11px] text-gray-700 leading-relaxed">{aiExplanation}</p>
                ) : (
                  <button
                    onClick={fetchAiExplanation}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Get AI explanation
                  </button>
                )}
              </div>

              {/* Hint — context-aware */}
              <div className="text-[10px] text-gray-400 text-center italic">
                {positionState === "free_bet"
                  ? "Position is risk-free. Optional green-up available to lock guaranteed profit."
                  : "Use the GREEN button above to execute this hedge"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
