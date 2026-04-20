"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { moveByTicks } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface AutomationRulesProps {
  playerName: string;
  currentOdds: number;
  selectedPlayer: "player1" | "player2";
  marketId: string | null;
}

type ConditionType =
  | "odds_reach"
  | "odds_drop_ticks"
  | "odds_rise_ticks"
  | "rr_exceeds"
  | "strategy_shows";

type ActionType = "back" | "lay" | "green_up" | "scale_out" | "alert";

interface AutomationRule {
  id: string;
  condition: {
    type: ConditionType;
    value: number | string;
  };
  action: {
    type: ActionType;
    value?: number;
  };
  active: boolean;
}

const CONDITION_LABELS: Record<ConditionType, string> = {
  odds_reach: "Odds reach",
  odds_drop_ticks: "Odds drop by X ticks",
  odds_rise_ticks: "Odds rise by X ticks",
  rr_exceeds: "R/R ratio exceeds",
  strategy_shows: "Strategy shows",
};

const ACTION_LABELS: Record<ActionType, string> = {
  back: "Place BACK",
  lay: "Place LAY",
  green_up: "Green up all",
  scale_out: "Scale out %",
  alert: "Alert me",
};

const STRATEGY_OPTIONS = [
  "LAY_FIRST_SET_WINNER",
  "BACK_SERVER",
  "OVERREACTION",
];

const SCALE_OPTIONS = [25, 50, 75];

const MAX_RULES = 5;

function storageKey(marketId: string | null, selectedPlayer: string): string {
  return `automation_rules_${marketId ?? "none"}_${selectedPlayer}`;
}

function loadRules(marketId: string | null, selectedPlayer: string): AutomationRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(marketId, selectedPlayer));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRules(marketId: string | null, selectedPlayer: string, rules: AutomationRule[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(marketId, selectedPlayer), JSON.stringify(rules));
  } catch { /* quota exceeded – silently ignore */ }
}

/* ─── Component ─── */

export default function AutomationRules({
  playerName,
  currentOdds,
  selectedPlayer,
  marketId,
}: AutomationRulesProps) {
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    loadRules(marketId, selectedPlayer)
  );
  const [collapsed, setCollapsed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  // Form state
  const [condType, setCondType] = useState<ConditionType>("odds_reach");
  const [condValue, setCondValue] = useState<string>("");
  const [actType, setActType] = useState<ActionType>("alert");
  const [actValue, setActValue] = useState<string>("");

  // Track snapshot odds when rules are created (for tick-based conditions)
  const snapshotOddsRef = useRef<Record<string, number>>({});

  // Reload rules when market/player changes
  useEffect(() => {
    setRules(loadRules(marketId, selectedPlayer));
  }, [marketId, selectedPlayer]);

  // Persist rules
  useEffect(() => {
    saveRules(marketId, selectedPlayer, rules);
  }, [rules, marketId, selectedPlayer]);

  // Update rules helper
  const updateRules = useCallback((fn: (prev: AutomationRule[]) => AutomationRule[]) => {
    setRules(fn);
  }, []);

  // ─── Alert evaluation ───
  useEffect(() => {
    if (!currentOdds || currentOdds <= 1.01) return;

    const activeRules = rules.filter((r) => r.active && r.action.type === "alert");
    if (activeRules.length === 0) return;

    for (const rule of activeRules) {
      let triggered = false;
      const val = typeof rule.condition.value === "number"
        ? rule.condition.value
        : parseFloat(rule.condition.value as string);

      switch (rule.condition.type) {
        case "odds_reach":
          if (!isNaN(val) && currentOdds <= val) triggered = true;
          break;
        case "odds_drop_ticks": {
          const snapshot = snapshotOddsRef.current[rule.id];
          if (snapshot && !isNaN(val)) {
            const target = moveByTicks(snapshot, -val);
            if (currentOdds <= target) triggered = true;
          }
          break;
        }
        case "odds_rise_ticks": {
          const snapshot = snapshotOddsRef.current[rule.id];
          if (snapshot && !isNaN(val)) {
            const target = moveByTicks(snapshot, val);
            if (currentOdds >= target) triggered = true;
          }
          break;
        }
        case "rr_exceeds":
          // R/R evaluation needs external data - skip for now
          break;
        case "strategy_shows":
          // Strategy evaluation needs external data - skip for now
          break;
      }

      if (triggered) {
        // Play alert sound
        try {
          new Audio("/alert.mp3").play();
        } catch { /* no audio file or blocked */ }

        // Show banner
        const desc = describeRule(rule);
        setAlertBanner(`Rule triggered: ${desc}`);
        setTimeout(() => setAlertBanner(null), 6000);

        // Auto-pause the rule
        updateRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, active: false } : r))
        );
      }
    }
  }, [currentOdds, rules, updateRules]);

  // ─── Helpers ───

  function describeRule(rule: AutomationRule): string {
    const condLabel = CONDITION_LABELS[rule.condition.type];
    const actLabel = ACTION_LABELS[rule.action.type];
    const condVal = rule.condition.value;
    const actVal = rule.action.value;
    const condStr =
      rule.condition.type === "strategy_shows"
        ? `${condLabel} "${condVal}"`
        : `${condLabel} ${condVal}`;
    const actStr =
      rule.action.type === "scale_out"
        ? `${actLabel} ${actVal}%`
        : rule.action.type === "back" || rule.action.type === "lay"
          ? `${actLabel} £${actVal}`
          : actLabel;
    return `${condStr} → ${actStr}`;
  }

  function resetForm() {
    setCondType("odds_reach");
    setCondValue("");
    setActType("alert");
    setActValue("");
    setShowForm(false);
  }

  function handleSave() {
    // Validate condition value
    let parsedCondValue: number | string;
    if (condType === "strategy_shows") {
      if (!condValue) return;
      parsedCondValue = condValue;
    } else {
      const num = parseFloat(condValue);
      if (isNaN(num) || num <= 0) return;
      parsedCondValue = num;
    }

    // Validate action value
    let parsedActValue: number | undefined;
    if (actType === "back" || actType === "lay") {
      const num = parseFloat(actValue);
      if (isNaN(num) || num <= 0) return;
      parsedActValue = num;
    } else if (actType === "scale_out") {
      const num = parseInt(actValue);
      if (!SCALE_OPTIONS.includes(num)) return;
      parsedActValue = num;
    }

    const id = crypto.randomUUID();

    // Snapshot current odds for tick-based rules
    if (condType === "odds_drop_ticks" || condType === "odds_rise_ticks") {
      snapshotOddsRef.current[id] = currentOdds;
    }

    const newRule: AutomationRule = {
      id,
      condition: { type: condType, value: parsedCondValue },
      action: { type: actType, value: parsedActValue },
      active: true,
    };

    updateRules((prev) => [...prev, newRule]);
    resetForm();
  }

  function toggleRule(id: string) {
    updateRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // Re-snapshot odds when re-activating tick-based rules
        if (!r.active && (r.condition.type === "odds_drop_ticks" || r.condition.type === "odds_rise_ticks")) {
          snapshotOddsRef.current[r.id] = currentOdds;
        }
        return { ...r, active: !r.active };
      })
    );
  }

  function deleteRule(id: string) {
    delete snapshotOddsRef.current[id];
    updateRules((prev) => prev.filter((r) => r.id !== id));
  }

  const activeCount = rules.filter((r) => r.active).length;

  // ─── Condition value input ───
  function renderCondValueInput() {
    if (condType === "strategy_shows") {
      return (
        <select
          value={condValue}
          onChange={(e) => setCondValue(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1 min-w-0"
        >
          <option value="">Select…</option>
          {STRATEGY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="number"
        step="any"
        placeholder={condType === "odds_reach" ? "e.g. 1.50" : "e.g. 5"}
        value={condValue}
        onChange={(e) => setCondValue(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white w-20 font-mono"
      />
    );
  }

  // ─── Action value input ───
  function renderActValueInput() {
    if (actType === "back" || actType === "lay") {
      return (
        <input
          type="number"
          step="any"
          placeholder="£ stake"
          value={actValue}
          onChange={(e) => setActValue(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white w-20 font-mono"
        />
      );
    }
    if (actType === "scale_out") {
      return (
        <select
          value={actValue}
          onChange={(e) => setActValue(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white w-20"
        >
          <option value="">%</option>
          {SCALE_OPTIONS.map((v) => (
            <option key={v} value={v}>{v}%</option>
          ))}
        </select>
      );
    }
    return null;
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto mt-3">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-green-400" : "bg-gray-600"}`} />
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            AUTOMATION RULES
          </h2>
          {rules.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-400 font-mono">
              {activeCount}/{rules.length}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-800/50">
          {/* Alert banner */}
          {alertBanner && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {alertBanner}
            </div>
          )}

          {/* Current player context */}
          <div className="px-4 pt-3 pb-1">
            <div className="text-[10px] text-gray-500">
              Rules for <span className="text-gray-300 font-medium">{playerName}</span>
              {currentOdds > 1 && (
                <span className="ml-1 font-mono text-gray-500">@ {currentOdds.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Existing rules */}
          <div className="px-3 pb-2 space-y-1.5">
            {rules.length === 0 && !showForm && (
              <div className="text-center py-4">
                <div className="text-gray-600 text-xs mb-1">No rules yet</div>
                <div className="text-gray-700 text-[10px]">
                  Create IF/THEN rules to automate alerts
                </div>
              </div>
            )}

            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 bg-gray-800/30 rounded-lg px-3 py-2"
              >
                {/* Status dot */}
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    rule.active ? "bg-green-400" : "bg-gray-600"
                  }`}
                />

                {/* Description */}
                <div className="flex-1 min-w-0 text-[10px] text-gray-300 truncate font-mono">
                  {describeRule(rule)}
                </div>

                {/* Phase 2 badge for non-alert actions */}
                {rule.action.type !== "alert" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-500 flex-shrink-0">
                    soon
                  </span>
                )}

                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                    rule.active
                      ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      : "bg-gray-700/50 text-gray-500 hover:bg-gray-700/80"
                  }`}
                >
                  {rule.active ? "ON" : "OFF"}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add rule form */}
          {showForm && (
            <div className="mx-3 mb-3 p-3 bg-gray-800/40 rounded-xl border border-gray-700/50 space-y-2.5">
              {/* Condition row */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                  IF
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={condType}
                    onChange={(e) => {
                      setCondType(e.target.value as ConditionType);
                      setCondValue("");
                    }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1 min-w-0"
                  >
                    {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {renderCondValueInput()}
                </div>
              </div>

              {/* Action row */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                  THEN
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={actType}
                    onChange={(e) => {
                      setActType(e.target.value as ActionType);
                      setActValue("");
                    }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1 min-w-0"
                  >
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {renderActValueInput()}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Save Rule
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-400 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add rule button */}
          {!showForm && rules.length < MAX_RULES && (
            <div className="px-3 pb-3">
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Rule
              </button>
            </div>
          )}

          {!showForm && rules.length >= MAX_RULES && (
            <div className="px-3 pb-3 text-center text-[10px] text-gray-600">
              Maximum {MAX_RULES} rules reached
            </div>
          )}
        </div>
      )}
    </div>
  );
}
