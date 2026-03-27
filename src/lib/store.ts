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
  setAuthError: (error: string | null) => void;
  sessionExpiry: string | null;
  sessionLoading: boolean;
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

  // Streak Protection
  consecutiveLosses: number;
  setConsecutiveLosses: (n: number) => void;
  streakCooldownUntil: number | null;
  setStreakCooldownUntil: (ts: number | null) => void;
  streakBannerDismissed: boolean;
  setStreakBannerDismissed: (v: boolean) => void;

  // Subscription
  subscriptionStatus: "active" | "inactive" | "cancelled" | "loading";
  subscriptionLoaded: boolean;
  fetchSubscriptionStatus: () => Promise<void>;

  // Streaming
  streamStatus: "disconnected" | "connecting" | "connected" | "fallback";
  isStreaming: boolean;

  // Shadow Mode
  shadowMode: boolean;
  setShadowMode: (enabled: boolean) => void;
  placeShadowTrade: (params: {
    marketId: string;
    selectionId: number;
    side: "BACK" | "LAY";
    price: number;
    size: number;
    player: string;
  }) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Auth ───
  isConnected: false,
  username: null,
  authError: null,
  setAuthError: (error) => set({ authError: error }),
  sessionExpiry: null,
  sessionLoading: false,

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
        .select("betfair_connected, betfair_session_token, betfair_connected_at, betfair_username, subscription_status")
        .eq("id", user.id)
        .single();

      // Set subscription status from profile
      const subStatus = profile?.subscription_status;
      if (subStatus === "active" || subStatus === "cancelled") {
        set({ subscriptionStatus: subStatus, subscriptionLoaded: true });
      } else {
        set({ subscriptionStatus: "inactive", subscriptionLoaded: true });
      }

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

  // ─── Streak Protection ───
  consecutiveLosses: 0,
  setConsecutiveLosses: (n) => set({ consecutiveLosses: n }),
  streakCooldownUntil: null,
  setStreakCooldownUntil: (ts) => set({ streakCooldownUntil: ts }),
  streakBannerDismissed: false,
  setStreakBannerDismissed: (v) => set({ streakBannerDismissed: v }),

  // ─── Subscription ───
  subscriptionStatus: "loading",
  subscriptionLoaded: false,

  fetchSubscriptionStatus: async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ subscriptionStatus: "inactive", subscriptionLoaded: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .single();
      const status = profile?.subscription_status;
      if (status === "active" || status === "cancelled") {
        set({ subscriptionStatus: status, subscriptionLoaded: true });
      } else {
        set({ subscriptionStatus: "inactive", subscriptionLoaded: true });
      }
    } catch {
      set({ subscriptionStatus: "inactive", subscriptionLoaded: true });
    }
  },

  // ─── Streaming ───
  streamStatus: "disconnected",
  isStreaming: false,

  // ─── Shadow Mode ───
  shadowMode: false,
  setShadowMode: (enabled) => set({ shadowMode: enabled }),

  placeShadowTrade: async ({ marketId, selectionId, side, price, size, player }) => {
    set({ tradeLoading: true, tradeError: null, lastTradeSuccess: null });
    try {
      const res = await fetch("/api/trades/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "placeShadowTrade",
          marketId,
          selectionId,
          side,
          price,
          size,
          player,
        }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          tradeLoading: false,
          lastTradeSuccess: `SHADOW ${side} £${size} @ ${price.toFixed(2)} recorded`,
        });
        return true;
      }
      set({ tradeError: data.error ?? "Shadow trade failed", tradeLoading: false });
      return false;
    } catch {
      set({ tradeError: "Network error placing shadow trade", tradeLoading: false });
      return false;
    }
  },
}));
