"use client";

import { useState } from "react";
import { calculateGreenUp } from "@/lib/tradingMaths";

type Side = "BACK" | "LAY";

interface TestCase {
  label: string;
  entryPrice: number;
  entryStake: number;
  entrySide: Side;
  currentPrice: number;
  expectedGreenStake: number;
}

const TEST_CASES: TestCase[] = [
  {
    label: "Back £10 at 3.20, lay at 2.40",
    entryPrice: 3.2,
    entryStake: 10,
    entrySide: "BACK",
    currentPrice: 2.4,
    expectedGreenStake: 13.33,
  },
  {
    label: "Back £25 at 1.80, lay at 1.50",
    entryPrice: 1.8,
    entryStake: 25,
    entrySide: "BACK",
    currentPrice: 1.5,
    expectedGreenStake: 30.0,
  },
  {
    label: "Lay £10 at 2.00, back at 3.00",
    entryPrice: 2.0,
    entryStake: 10,
    entrySide: "LAY",
    currentPrice: 3.0,
    expectedGreenStake: 6.67,
  },
  {
    label: "Back £50 at 1.54, lay at 1.56",
    entryPrice: 1.54,
    entryStake: 50,
    entrySide: "BACK",
    currentPrice: 1.56,
    expectedGreenStake: 49.36,
  },
];

function r2(v: number) {
  return Math.round(v * 100) / 100;
}

export default function GreenUpTestPage() {
  const [entryPrice, setEntryPrice] = useState("3.20");
  const [entryStake, setEntryStake] = useState("10");
  const [entrySide, setEntrySide] = useState<Side>("BACK");
  const [currentPrice, setCurrentPrice] = useState("2.40");

  const manualResult =
    Number(entryPrice) > 0 && Number(entryStake) > 0 && Number(currentPrice) > 0
      ? calculateGreenUp(
          Number(entryPrice),
          Number(entryStake),
          entrySide,
          Number(currentPrice)
        )
      : null;

  const testResults = TEST_CASES.map((tc) => {
    const result = calculateGreenUp(
      tc.entryPrice,
      tc.entryStake,
      tc.entrySide,
      tc.currentPrice
    );
    const pass = result.greenUpStake === tc.expectedGreenStake;
    return { ...tc, result, pass };
  });

  const allPass = testResults.every((t) => t.pass);

  return (
    <main className="min-h-screen bg-[#030712] text-gray-100 p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">Green-Up Calculator Test</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tests <code className="text-gray-400">calculateGreenUp()</code> from{" "}
        <code className="text-gray-400">src/lib/tradingMaths.ts</code>
      </p>

      {/* ─── Formula Reference ─── */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Formula</h2>
        <div className="space-y-2 text-xs font-mono text-gray-300">
          <p>
            <span className="text-blue-400">greenUpStake</span> = round2( entryStake * entryPrice / currentPrice )
          </p>
          <p>
            <span className="text-blue-400">greenUpSide</span> = opposite of entrySide
          </p>
          <div className="border-t border-gray-800/50 pt-2 mt-2">
            <p className="text-gray-500 mb-1">If entry was BACK (green up by LAYing):</p>
            <p>
              <span className="text-green-400">profitIfWin</span>  = round2( entryStake * (entryPrice - 1) - greenUpStake * (currentPrice - 1) )
            </p>
            <p>
              <span className="text-red-400">profitIfLose</span> = round2( greenUpStake - entryStake )
            </p>
          </div>
          <div className="border-t border-gray-800/50 pt-2 mt-2">
            <p className="text-gray-500 mb-1">If entry was LAY (green up by BACKing):</p>
            <p>
              <span className="text-green-400">profitIfWin</span>  = round2( greenUpStake * (currentPrice - 1) - entryStake * (entryPrice - 1) )
            </p>
            <p>
              <span className="text-red-400">profitIfLose</span> = round2( entryStake - greenUpStake )
            </p>
          </div>
          <div className="border-t border-gray-800/50 pt-2 mt-2">
            <p>
              <span className="text-yellow-400">equalProfit</span> = round2( (profitIfWin + profitIfLose) / 2 )
            </p>
          </div>
        </div>
      </div>

      {/* ─── Auto Test Cases ─── */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Auto Tests</h2>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              allPass
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {allPass
              ? `ALL PASS (${testResults.length}/${testResults.length})`
              : `${testResults.filter((t) => t.pass).length}/${testResults.length} PASS`}
          </span>
        </div>
        <div className="space-y-3">
          {testResults.map((t, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 border ${
                t.pass
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-red-500/5 border-red-500/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-300">
                  {i + 1}. {t.label}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    t.pass ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {t.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                <div>
                  <span className="text-gray-500">Expected greenStake: </span>
                  <span className="text-white">£{t.expectedGreenStake.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Got greenStake: </span>
                  <span className={t.pass ? "text-green-400" : "text-red-400"}>
                    £{t.result.greenUpStake.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">greenUpSide: </span>
                  <span className="text-white">{t.result.greenUpSide}</span>
                </div>
                <div>
                  <span className="text-gray-500">equalProfit: </span>
                  <span className={t.result.equalProfit >= 0 ? "text-green-400" : "text-red-400"}>
                    {t.result.equalProfit >= 0 ? "+" : ""}£{t.result.equalProfit.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">profitIfWin: </span>
                  <span className="text-white">£{t.result.profitIfWin.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">profitIfLose: </span>
                  <span className="text-white">£{t.result.profitIfLose.toFixed(2)}</span>
                </div>
              </div>
              {/* Show working */}
              <div className="mt-2 pt-2 border-t border-gray-800/30 text-[10px] font-mono text-gray-500">
                greenUpStake = round2({t.entryStake} * {t.entryPrice} / {t.currentPrice}) = round2({r2(t.entryStake * t.entryPrice / t.currentPrice * 100) / 100 !== r2(t.entryStake * t.entryPrice / t.currentPrice) ? `${t.entryStake * t.entryPrice / t.currentPrice}` : `${t.entryStake * t.entryPrice / t.currentPrice}`}) = {t.result.greenUpStake.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Manual Calculator ─── */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Manual Calculator</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Entry Price
            </label>
            <input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Entry Stake
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                £
              </span>
              <input
                type="number"
                step="0.01"
                value={entryStake}
                onChange={(e) => setEntryStake(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Entry Side
            </label>
            <select
              value={entrySide}
              onChange={(e) => setEntrySide(e.target.value as Side)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
            >
              <option value="BACK" className="bg-gray-900">
                BACK
              </option>
              <option value="LAY" className="bg-gray-900">
                LAY
              </option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
              Current Price
            </label>
            <input
              type="number"
              step="0.01"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {manualResult && (
          <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
              <div>
                <span className="text-gray-500">greenUpStake: </span>
                <span className="text-blue-400 font-semibold">
                  £{manualResult.greenUpStake.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">greenUpSide: </span>
                <span className="text-white font-semibold">{manualResult.greenUpSide}</span>
              </div>
              <div>
                <span className="text-gray-500">profitIfWin: </span>
                <span
                  className={
                    manualResult.profitIfWin >= 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {manualResult.profitIfWin >= 0 ? "+" : ""}£{manualResult.profitIfWin.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">profitIfLose: </span>
                <span
                  className={
                    manualResult.profitIfLose >= 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {manualResult.profitIfLose >= 0 ? "+" : ""}£{manualResult.profitIfLose.toFixed(2)}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-gray-700/50">
                <span className="text-gray-500">equalProfit: </span>
                <span
                  className={`font-semibold ${
                    manualResult.equalProfit >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {manualResult.equalProfit >= 0 ? "+" : ""}£{manualResult.equalProfit.toFixed(2)}
                </span>
              </div>
            </div>
            {/* Working */}
            <div className="pt-2 border-t border-gray-700/30 text-[10px] font-mono text-gray-500 space-y-0.5">
              <p>
                greenUpStake = round2({entryStake} * {entryPrice} / {currentPrice}) ={" "}
                {manualResult.greenUpStake.toFixed(2)}
              </p>
              {entrySide === "BACK" ? (
                <>
                  <p>
                    profitIfWin = round2({entryStake} * ({entryPrice} - 1) -{" "}
                    {manualResult.greenUpStake.toFixed(2)} * ({currentPrice} - 1)) ={" "}
                    {manualResult.profitIfWin.toFixed(2)}
                  </p>
                  <p>
                    profitIfLose = round2({manualResult.greenUpStake.toFixed(2)} - {entryStake}) ={" "}
                    {manualResult.profitIfLose.toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    profitIfWin = round2({manualResult.greenUpStake.toFixed(2)} * ({currentPrice} -
                    1) - {entryStake} * ({entryPrice} - 1)) = {manualResult.profitIfWin.toFixed(2)}
                  </p>
                  <p>
                    profitIfLose = round2({entryStake} - {manualResult.greenUpStake.toFixed(2)}) ={" "}
                    {manualResult.profitIfLose.toFixed(2)}
                  </p>
                </>
              )}
              <p>
                equalProfit = round2(({manualResult.profitIfWin.toFixed(2)} +{" "}
                {manualResult.profitIfLose.toFixed(2)}) / 2) = {manualResult.equalProfit.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
