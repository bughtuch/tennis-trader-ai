"use client";

import { useState } from "react";
import { moveByTicks } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface ClassicTradeToolsProps {
  // Tick Offset
  tickOffsetEnabled: boolean;
  tickOffsetTicks: number;
  onTickOffsetToggle: (enabled: boolean) => void;
  onTickOffsetChange: (ticks: number) => void;

  // Stop Loss
  stopLossEnabled: boolean;
  stopLossPrice: number | null;
  stopLossTriggered: boolean;
  onStopLossToggle: (enabled: boolean) => void;
  onStopLossChange: (price: number | null) => void;
  avgEntry: number | null;
  positionSide: "BACK" | "LAY" | "FLAT" | null;
  currentLTP: number;

  // Fill or Kill
  fokEnabled: boolean;
  fokSeconds: number;
  onFokToggle: (enabled: boolean) => void;
  onFokSecondsChange: (seconds: number) => void;
  unmatchedCount: number;
}

/* ─── Helpers ─── */

function ToggleSwitch({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-1.5"
      type="button"
    >
      <div className={`w-7 h-4 rounded-full transition-colors relative ${enabled ? "bg-blue-500" : "bg-gray-300"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </div>
      <span className="text-[10px] font-semibold text-gray-600">{label}</span>
    </button>
  );
}

const FOK_PRESETS = [5, 10, 15, 30] as const;

/* ─── Component ─── */

export default function ClassicTradeTools({
  tickOffsetEnabled,
  tickOffsetTicks,
  onTickOffsetToggle,
  onTickOffsetChange,
  stopLossEnabled,
  stopLossPrice,
  stopLossTriggered,
  onStopLossToggle,
  onStopLossChange,
  avgEntry,
  positionSide,
  currentLTP,
  fokEnabled,
  fokSeconds,
  onFokToggle,
  onFokSecondsChange,
  unmatchedCount,
}: ClassicTradeToolsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [stopMode, setStopMode] = useState<"price" | "ticks">("ticks");
  const [stopTicks, setStopTicks] = useState(3);

  const hasPosition = positionSide && positionSide !== "FLAT";

  // Calculate stop price from ticks
  function handleStopTicksChange(ticks: number) {
    setStopTicks(ticks);
    if (avgEntry && avgEntry > 0 && positionSide && positionSide !== "FLAT") {
      // BACK position: stop when price drifts (goes UP)
      // LAY position: stop when price shortens (goes DOWN)
      const price = positionSide === "BACK"
        ? moveByTicks(avgEntry, ticks)
        : moveByTicks(avgEntry, -ticks);
      onStopLossChange(price);
    }
  }

  // Distance from current price to stop
  const stopDistance = stopLossPrice && currentLTP > 0
    ? Math.abs(stopLossPrice - currentLTP).toFixed(2)
    : null;

  return (
    <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-1.5 flex items-center justify-between border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-600">
            TRADE TOOLS
          </span>
          {tickOffsetEnabled && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">OFFSET</span>
          )}
          {stopLossEnabled && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              stopLossTriggered ? "bg-red-100 text-red-700 animate-pulse" : "bg-amber-100 text-amber-700"
            }`}>STOP</span>
          )}
          {fokEnabled && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">FoK</span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {/* ─── Tick Offset ─── */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <ToggleSwitch enabled={tickOffsetEnabled} onChange={onTickOffsetToggle} label="TICK OFFSET" />
              {tickOffsetEnabled && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                  ARMED
                </span>
              )}
            </div>
            {tickOffsetEnabled && (
              <div className="mt-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTickOffsetChange(Math.max(1, tickOffsetTicks - 1))}
                    className="w-6 h-6 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold font-mono w-6 text-center">{tickOffsetTicks}</span>
                  <button
                    onClick={() => onTickOffsetChange(Math.min(10, tickOffsetTicks + 1))}
                    className="w-6 h-6 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
                  >
                    +
                  </button>
                  <span className="text-[10px] text-gray-500">ticks</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                  After fill → confirm opposite order {tickOffsetTicks} ticks away
                </p>
              </div>
            )}
          </div>

          {/* ─── Stop Loss ─── */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <ToggleSwitch
                enabled={stopLossEnabled}
                onChange={(v) => {
                  onStopLossToggle(v);
                  if (!v) onStopLossChange(null);
                }}
                label="STOP LOSS"
              />
              {stopLossTriggered && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 animate-pulse">
                  TRIGGERED
                </span>
              )}
            </div>
            {stopLossEnabled && (
              <div className="mt-1.5 space-y-1.5">
                {!hasPosition ? (
                  <p className="text-[10px] text-gray-400 italic">Open a position first</p>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setStopMode("ticks")}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          stopMode === "ticks" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-gray-500 border-gray-200"
                        }`}
                      >
                        Entry +N
                      </button>
                      <button
                        onClick={() => setStopMode("price")}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          stopMode === "price" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-gray-500 border-gray-200"
                        }`}
                      >
                        Price
                      </button>
                    </div>
                    {stopMode === "ticks" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStopTicksChange(Math.max(1, stopTicks - 1))}
                          className="w-6 h-6 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="text-sm font-bold font-mono w-6 text-center">{stopTicks}</span>
                        <button
                          onClick={() => handleStopTicksChange(Math.min(20, stopTicks + 1))}
                          className="w-6 h-6 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-gray-500">ticks from entry</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={stopLossPrice ?? ""}
                        onChange={(e) => onStopLossChange(e.target.value ? Number(e.target.value) : null)}
                        placeholder="Stop price"
                        className="w-24 px-2 py-1 rounded border border-gray-300 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                    {stopLossPrice && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-gray-500">Trigger:</span>
                        <span className="font-mono font-semibold text-red-600">{stopLossPrice.toFixed(2)}</span>
                        {stopDistance && (
                          <span className="text-gray-400">({stopDistance} from LTP)</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── Fill or Kill ─── */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <ToggleSwitch enabled={fokEnabled} onChange={onFokToggle} label="FILL OR KILL" />
              {fokEnabled && unmatchedCount > 0 && (
                <span className="text-[9px] text-gray-500 font-mono">
                  {unmatchedCount} order{unmatchedCount !== 1 ? "s" : ""} watched
                </span>
              )}
            </div>
            {fokEnabled && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1">
                  {FOK_PRESETS.map((s) => (
                    <button
                      key={s}
                      onClick={() => onFokSecondsChange(s)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                        fokSeconds === s
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                  Cancel unmatched orders after {fokSeconds}s
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
