"use client";

import { useState } from "react";

/* ─── Types ─── */

interface AISignal {
  type: string;
  confidence: number;
  edgeSize: string;
  analysis: string;
  model: string;
  timestamp: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuardianData = any;

interface ClassicAIPanelProps {
  aiSignal: AISignal | null;
  aiSignalLoading: boolean;
  guardianData: GuardianData;
  guardianLoading: boolean;
  onFetchSignal: () => void;
  onFetchGuardian: () => void;
  player1Name: string;
  player2Name: string;
  player1Odds: number;
  player2Odds: number;
  isInPlay: boolean;
  sessionPnl: number;
  consecutiveLosses: number;
}

/* ─── Component ─── */

export default function ClassicAIPanel({
  aiSignal,
  aiSignalLoading,
  guardianData,
  guardianLoading,
  onFetchSignal,
  onFetchGuardian,
  player1Name,
  player2Name,
  player1Odds,
  player2Odds,
  isInPlay,
  sessionPnl,
  consecutiveLosses,
}: ClassicAIPanelProps) {
  const [signalOpen, setSignalOpen] = useState(true);
  const [guardianOpen, setGuardianOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-gray-900 h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-bold tracking-wider uppercase text-gray-600">
          AI ASSISTANT
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* ─── AI Signal ─── */}
        <div className="p-3">
          <button
            onClick={() => setSignalOpen(!signalOpen)}
            className="w-full flex items-center justify-between mb-1"
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
              AI SIGNAL
            </span>
            <span className="text-[10px] text-gray-400">{signalOpen ? "▾" : "▸"}</span>
          </button>

          {signalOpen && (
            <div className="space-y-2">
              <button
                onClick={onFetchSignal}
                disabled={aiSignalLoading}
                className="w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {aiSignalLoading ? "Analysing..." : "Get AI Signal"}
              </button>

              {aiSignal && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1.5">
                  {/* Confidence badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      aiSignal.confidence >= 70
                        ? "bg-green-100 text-green-700"
                        : aiSignal.confidence >= 40
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}>
                      {aiSignal.confidence}% confidence
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      aiSignal.edgeSize === "large"
                        ? "bg-green-100 text-green-700"
                        : aiSignal.edgeSize === "medium"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {aiSignal.edgeSize} edge
                    </span>
                  </div>

                  {/* Analysis */}
                  <p className="text-[11px] text-gray-700 leading-relaxed">
                    {aiSignal.analysis}
                  </p>

                  <div className="text-[9px] text-gray-400">
                    {new Date(aiSignal.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── AI Guardian ─── */}
        <div className="p-3">
          <button
            onClick={() => setGuardianOpen(!guardianOpen)}
            className="w-full flex items-center justify-between mb-1"
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
              AI GUARDIAN
            </span>
            <span className="text-[10px] text-gray-400">{guardianOpen ? "▾" : "▸"}</span>
          </button>

          {guardianOpen && (
            <div className="space-y-2">
              <button
                onClick={onFetchGuardian}
                disabled={guardianLoading}
                className="w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                {guardianLoading ? "Checking..." : "Risk Check"}
              </button>

              {guardianData?.assessment && (
                <div className={`rounded-lg border p-2 space-y-1 ${
                  guardianData.assessment.riskLevel === "high"
                    ? "border-red-200 bg-red-50"
                    : guardianData.assessment.riskLevel === "medium"
                      ? "border-amber-200 bg-amber-50"
                      : "border-green-200 bg-green-50"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      guardianData.assessment.riskLevel === "high"
                        ? "bg-red-100 text-red-700"
                        : guardianData.assessment.riskLevel === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                    }`}>
                      {guardianData.assessment.riskLevel?.toUpperCase()} RISK
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed">
                    {guardianData.assessment.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Quick Stats ─── */}
        <div className="p-3">
          <button
            onClick={() => setStatsOpen(!statsOpen)}
            className="w-full flex items-center justify-between mb-1"
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
              MARKET INFO
            </span>
            <span className="text-[10px] text-gray-400">{statsOpen ? "▾" : "▸"}</span>
          </button>

          {statsOpen && (
            <div className="space-y-2">
              {/* Implied probabilities */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                <div className="text-[10px] text-gray-500 mb-1">Implied Probability</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-700">{p1Short}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: `${player1Odds > 0 ? Math.min((1 / player1Odds) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono font-semibold text-gray-700 w-10 text-right">
                        {player1Odds > 0 ? `${Math.round((1 / player1Odds) * 100)}%` : "--"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-700">{p2Short}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-pink-400"
                          style={{ width: `${player2Odds > 0 ? Math.min((1 / player2Odds) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono font-semibold text-gray-700 w-10 text-right">
                        {player2Odds > 0 ? `${Math.round((1 / player2Odds) * 100)}%` : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session health */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                <div className="text-[10px] text-gray-500 mb-1">Session Health</div>
                <div className="flex items-center gap-3 text-[11px]">
                  <div>
                    <span className="text-gray-500">P&L: </span>
                    <span className={`font-mono font-semibold ${sessionPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {sessionPnl >= 0 ? "+" : ""}£{sessionPnl.toFixed(2)}
                    </span>
                  </div>
                  {consecutiveLosses >= 2 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">
                      {consecutiveLosses}L streak
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="text-[10px] text-center text-gray-400">
                {isInPlay ? (
                  <span className="text-green-600 font-semibold">IN-PLAY ~5s delay</span>
                ) : (
                  <span className="text-blue-600">PRE-MATCH</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
