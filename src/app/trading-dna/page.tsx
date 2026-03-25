"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DnaData {
  bestSurface: string;
  bestTournamentLevel: string;
  bestTimeOfDay: string;
  avgWinSize: number;
  avgLossSize: number;
  winRate: number;
  revengeTradeRate: number;
  bestEntryTiming: string;
  worstPattern: string;
  oneLineSummary: string;
}

export default function TradingDnaPage() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [tradesNeeded, setTradesNeeded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDna() {
      try {
        const res = await fetch("/api/ai/trading-dna", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) {
          setReady(data.ready);
          setTradeCount(data.tradeCount ?? 0);
          if (data.ready) {
            setDna(data.dna);
          } else {
            setTradesNeeded(data.tradesNeeded ?? 0);
          }
        } else {
          setError(data.error);
        }
      } catch {
        setError("Failed to load Trading DNA");
      }
      setLoading(false);
    }
    fetchDna();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-400 text-sm">Analysing your trading patterns...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <Link href="/trading" className="text-blue-400 text-sm hover:underline">
            Back to Trading
          </Link>
        </div>
      </main>
    );
  }

  // Not enough trades
  if (!ready) {
    const progress = Math.round((tradeCount / 20) * 100);
    return (
      <main className="min-h-screen pt-14 bg-[#030712]">
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center space-y-6">
            <div className="text-5xl">🧬</div>
            <h1 className="text-2xl font-bold text-white">Trading DNA</h1>
            <p className="text-gray-400 text-sm">
              Complete <span className="text-white font-semibold">{tradesNeeded} more trade{tradesNeeded !== 1 ? "s" : ""}</span> to unlock your personal trading pattern analysis.
            </p>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{tradeCount} / 20 trades</span>
                <span className="text-blue-400 font-mono">{progress}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 space-y-3 text-left">
              <h3 className="text-sm font-semibold text-white">What you&apos;ll unlock</h3>
              {[
                "Your best surface, tournament level & time of day",
                "Win rate trends and average trade sizes",
                "Revenge trading detection",
                "AI-identified patterns and weaknesses",
                "Personalised one-line trading summary",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>

            <Link
              href="/trading"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Start Trading
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // DNA ready
  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧬</span>
            <div>
              <h1 className="text-xl font-bold text-white">Trading DNA</h1>
              <p className="text-sm text-gray-500">Personal pattern analysis from {tradeCount} trades</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* AI Summary */}
        {dna?.oneLineSummary && (
          <div className="rounded-2xl p-4 border" style={{ borderColor: "rgba(200, 184, 154, 0.3)", background: "rgba(200, 184, 154, 0.05)" }}>
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">🧠</span>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "#C8B89A" }}>
                {dna.oneLineSummary}
              </p>
            </div>
          </div>
        )}

        {/* Core Stats */}
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="text-sm font-semibold text-white">Performance</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="WIN RATE" value={`${dna?.winRate ?? 0}%`} color={
                (dna?.winRate ?? 0) >= 55 ? "text-green-400" : (dna?.winRate ?? 0) >= 45 ? "text-yellow-400" : "text-red-400"
              } />
              <StatCard label="AVG WIN" value={`+£${(dna?.avgWinSize ?? 0).toFixed(2)}`} color="text-green-400" />
              <StatCard label="AVG LOSS" value={`-£${Math.abs(dna?.avgLossSize ?? 0).toFixed(2)}`} color="text-red-400" />
              <StatCard
                label="REVENGE RATE"
                value={`${dna?.revengeTradeRate ?? 0}%`}
                color={(dna?.revengeTradeRate ?? 0) <= 15 ? "text-green-400" : (dna?.revengeTradeRate ?? 0) <= 30 ? "text-yellow-400" : "text-red-400"}
                hint="Lower is better"
              />
            </div>
          </div>
        </div>

        {/* Strengths */}
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="text-sm font-semibold text-white">Your Strengths</h2>
          </div>
          <div className="p-5 space-y-3">
            <DnaRow label="Best Surface" value={dna?.bestSurface ?? "—"} />
            <DnaRow label="Best Tournament Level" value={dna?.bestTournamentLevel ?? "—"} />
            <DnaRow label="Best Time of Day" value={dna?.bestTimeOfDay ?? "—"} />
            <DnaRow label="Best Entry Timing" value={dna?.bestEntryTiming ?? "—"} />
          </div>
        </div>

        {/* Weakness */}
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="text-sm font-semibold text-white">Area to Improve</h2>
          </div>
          <div className="p-5">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs text-red-400 leading-relaxed">{dna?.worstPattern ?? "Not enough data"}</p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-600 pb-8">
          Your DNA updates daily as you trade more
        </p>
      </div>
    </main>
  );
}

function StatCard({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="bg-gray-800/30 rounded-xl p-3">
      <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      {hint && <div className="text-[9px] text-gray-600 mt-0.5">{hint}</div>}
    </div>
  );
}

function DnaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-white font-medium capitalize">{value}</span>
    </div>
  );
}
