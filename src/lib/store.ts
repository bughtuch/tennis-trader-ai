"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase";

/* ─── Types ─── */

export interface PriceSize {
  price: number;
  size: number;
}

export interface BetfairRunner {
  selectionId: number;
  runnerName: string;
  status?: string;
  metadata?: Record<string, string>;
  ex?: {
    availableToBack: PriceSize[];
    availableToLay: PriceSize[];
    tradedVolume: PriceSize[];
  };
}

export interface MarketCatalogue {
  marketId: string;
  marketName: string;
  totalMatched?: number;
  marketStartTime?: string;
  runners?: BetfairRunner[];
  event?: {
    id: string;
    name: string;
    countryCode?: string;
    timezone?: string;
    openDate?: string;
  };
  competition?: {
    id: string;
    name: string;
  };
}

export interface MarketBook {
  marketId: string;
  status: string;
  totalMatched: number;
  inplay: boolean;
  runners: BetfairRunner[];
}

/* ─── Order / Pending Types ─── */

export interface BetfairOrder {
  betId: string;
  marketId: string;
  selectionId: number;
  side: "BACK" | "LAY";
  price: number;
  size: number;
  sizeMatched: number;
  sizeRemaining: number;
  status: string;
  placedDate: string;
}

export interface PendingOrder {
  id: string;
  side: "BACK" | "LAY";
  price: number;
  size: number;
  placedAt: number;
  delaySeconds: number;
}

/* ─── Store ─── */

interface AppState {
  // Auth
  isConnected: boolean;
  username: string | null;
  authError: string | null;
  authLoading: boolean;
  sessionExpiry: string | null;
  sessionLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;

  // Markets
  markets: MarketCatalogue[];
  marketsLoading: boolean;
  marketsError: string | null;
  fetchMarkets: () => Promise<void>;

  // Market book (live prices)
  marketBook: MarketBook | null;
  marketBookLoading: boolean;
  fetchMarketBook: (marketIds: string[]) => Promise<void>;

  // Trading
  tradeLoading: boolean;
  tradeError: string | null;
  lastTradeSuccess: string | null;
  placeTrade: (params: {
    marketId: string;
    selectionId: number;
    side: "BACK" | "LAY";
    price: number;
    size: number;
  }) => Promise<boolean>;
  clearTradeMessages: () => void;

  // Unmatched Orders
  unmatchedOrders: BetfairOrder[];
  unmatchedOrdersLoading: boolean;
  fetchUnmatchedOrders: (marketId: string) => Promise<void>;
  cancelOrder: (params: { marketId: string; betId?: string }) => Promise<boolean>;

  // Pending Orders (bet delay tracking)
  pendingOrders: PendingOrder[];
  addPendingOrder: (order: PendingOrder) => void;
  removePendingOrder: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Auth ───
  isConnected: false,
  username: null,
  authError: null,
  authLoading: false,
  sessionExpiry: null,
  sessionLoading: false,

  login: async (username, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch("/api/betfair/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        set({ isConnected: true, username, authLoading: false, sessionExpiry: expiry });
        return true;
      }
      set({ authError: data.error ?? "Authentication failed", authLoading: false });
      return false;
    } catch {
      set({ authError: "Network error. Please try again.", authLoading: false });
      return false;
    }
  },

  restoreSession: async () => {
    set({ sessionLoading: true });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ sessionLoading: false });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("betfair_connected, betfair_session_token, betfair_connected_at, betfair_username")
        .eq("id", user.id)
        .single();

      if (!profile?.betfair_connected || !profile?.betfair_session_token) {
        set({ isConnected: false, sessionLoading: false });
        return;
      }

      // Check if session is expired (8 hours from connected_at)
      const connectedAt = profile.betfair_connected_at
        ? new Date(profile.betfair_connected_at).getTime()
        : 0;
      const expiresAt = connectedAt + 8 * 60 * 60 * 1000;
      const now = Date.now();

      if (connectedAt > 0 && now > expiresAt) {
        // Session expired — clear it
        set({ isConnected: false, sessionExpiry: null, sessionLoading: false });
        await supabase
          .from("profiles")
          .update({ betfair_connected: false, betfair_session_token: null, betfair_connected_at: null })
          .eq("id", user.id);
        return;
      }

      set({
        isConnected: true,
        username: profile.betfair_username ?? "Connected",
        sessionExpiry: connectedAt > 0 ? new Date(expiresAt).toISOString() : null,
        sessionLoading: false,
      });
    } catch {
      set({ sessionLoading: false });
    }
  },

  logout: async () => {
    set({
      isConnected: false,
      username: null,
      authError: null,
      sessionExpiry: null,
      markets: [],
      marketBook: null,
    });
    // Clear localStorage market
    try { localStorage.removeItem("lastMarket"); } catch { /* SSR guard */ }
    // Clear Supabase profile fields
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            betfair_connected: false,
            betfair_session_token: null,
            betfair_connected_at: null,
          })
          .eq("id", user.id);
      }
    } catch { /* non-critical */ }
    // Delete betfair_session cookie via API
    try {
      await fetch("/api/betfair/keep-alive", { method: "DELETE" });
    } catch { /* non-critical */ }
  },

  // ─── Markets ───
  markets: [],
  marketsLoading: false,
  marketsError: null,

  fetchMarkets: async () => {
    set({ marketsLoading: true, marketsError: null });
    try {
      const res = await fetch("/api/betfair/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listMarkets" }),
      });
      const data = await res.json();
      if (data.success) {
        set({ markets: data.markets ?? [], marketsLoading: false });
      } else {
        set({ marketsError: data.error, marketsLoading: false });
      }
    } catch {
      set({ marketsError: "Failed to fetch markets", marketsLoading: false });
    }
  },

  // ─── Market Book ───
  marketBook: null,
  marketBookLoading: false,

  fetchMarketBook: async (marketIds) => {
    set({ marketBookLoading: true });
    try {
      const res = await fetch("/api/betfair/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMarketBook", marketIds }),
      });
      const data = await res.json();
      if (data.success && data.marketBooks?.[0]) {
        set({ marketBook: data.marketBooks[0], marketBookLoading: false });
      } else {
        set({ marketBookLoading: false });
      }
    } catch {
      set({ marketBookLoading: false });
    }
  },

  // ─── Trading ───
  tradeLoading: false,
  tradeError: null,
  lastTradeSuccess: null,

  placeTrade: async ({ marketId, selectionId, side, price, size }) => {
    set({ tradeLoading: true, tradeError: null, lastTradeSuccess: null });
    try {
      const res = await fetch("/api/betfair/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "placeTrade",
          marketId,
          instructions: [{ selectionId, side, size, price }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        const betId = data.betIds?.[0] ?? "unknown";
        set({
          tradeLoading: false,
          lastTradeSuccess: `${side} £${size} @ ${price} placed (Bet ${betId})`,
        });
        return true;
      }
      set({ tradeError: data.error ?? "Trade failed", tradeLoading: false });
      return false;
    } catch {
      set({ tradeError: "Network error placing trade", tradeLoading: false });
      return false;
    }
  },

  clearTradeMessages: () => {
    set({ tradeError: null, lastTradeSuccess: null });
  },

  // ─── Unmatched Orders ───
  unmatchedOrders: [],
  unmatchedOrdersLoading: false,

  fetchUnmatchedOrders: async (marketId) => {
    set({ unmatchedOrdersLoading: true });
    try {
      const res = await fetch("/api/betfair/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listCurrentOrders", marketId }),
      });
      const data = await res.json();
      if (data.success) {
        set({ unmatchedOrders: data.currentOrders ?? [], unmatchedOrdersLoading: false });
      } else {
        set({ unmatchedOrdersLoading: false });
      }
    } catch {
      set({ unmatchedOrdersLoading: false });
    }
  },

  cancelOrder: async ({ marketId, betId }) => {
    try {
      const res = await fetch("/api/betfair/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelOrder", marketId, betId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh unmatched orders
        get().fetchUnmatchedOrders(marketId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ─── Pending Orders ───
  pendingOrders: [],

  addPendingOrder: (order) => {
    set((state) => ({ pendingOrders: [...state.pendingOrders, order] }));
  },

  removePendingOrder: (id) => {
    set((state) => ({ pendingOrders: state.pendingOrders.filter((o) => o.id !== id) }));
  },
}));
