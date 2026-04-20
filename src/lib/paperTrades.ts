/**
 * Paper trades — localStorage-only storage.
 * No Supabase, no network calls. Practice trades stay on the device.
 */

const STORAGE_KEY = "paper_trades";

export interface PaperTrade {
  id: string;
  user_id: string;
  market_id: string | null;
  selection_id: string | null;
  player: string | null;
  side: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stake: number | null;
  pnl: number | null;
  status: string;
  greened_up: boolean;
  is_shadow: boolean;
  ai_signal_used: boolean;
  notes: string | null;
  coach_insight: string | null;
  created_at: string;
  closed_at: string | null;
}

function readAll(): PaperTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(trades: PaperTrade[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch { /* quota exceeded — silently ignore */ }
}

/** Return all open paper trades, newest first. */
export function getOpenPaperTrades(): PaperTrade[] {
  return readAll()
    .filter((t) => t.status === "open")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Return closed paper trades, newest first, up to `limit`. */
export function getClosedPaperTrades(limit = 20): PaperTrade[] {
  return readAll()
    .filter((t) => t.status === "closed")
    .sort((a, b) => (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at))
    .slice(0, limit);
}

/** Add a new open paper trade and return it. */
export function addPaperTrade(params: {
  market_id: string;
  selection_id: string;
  side: "BACK" | "LAY";
  entry_price: number;
  stake: number;
  player: string;
}): PaperTrade {
  const trade: PaperTrade = {
    id: crypto.randomUUID(),
    user_id: "local",
    market_id: params.market_id,
    selection_id: params.selection_id,
    player: params.player,
    side: params.side,
    entry_price: params.entry_price,
    exit_price: null,
    stake: params.stake,
    pnl: null,
    status: "open",
    greened_up: false,
    is_shadow: true,
    ai_signal_used: false,
    notes: null,
    coach_insight: null,
    created_at: new Date().toISOString(),
    closed_at: null,
  };
  const all = readAll();
  all.push(trade);
  writeAll(all);
  return trade;
}

/** Close a paper trade (green-up, manual close, etc.). */
export function closePaperTrade(
  id: string,
  exitPrice: number,
  pnl: number,
  greenedUp = false
): boolean {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  all[idx] = {
    ...all[idx],
    exit_price: exitPrice,
    pnl,
    status: "closed",
    greened_up: greenedUp,
    closed_at: new Date().toISOString(),
  };
  writeAll(all);
  return true;
}

/** Aggregate stats for paper milestone prompt. */
export function getPaperStats(): {
  totalTrades: number;
  totalPnl: number;
  wins: number;
} {
  const closed = readAll().filter((t) => t.status === "closed");
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  return {
    totalTrades: closed.length,
    totalPnl: Math.round(totalPnl * 100) / 100,
    wins,
  };
}
