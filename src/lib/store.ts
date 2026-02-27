"use client";

import { create } from "zustand";

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

/* ─── Store ─── */

interface AppState {
  // Auth
  isConnected: boolean;
  username: string | null;
  authError: string | null;
  authLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;

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
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Auth ───
  isConnected: false,
  username: null,
  authError: null,
  authLoading: false,

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
        set({ isConnected: true, username, authLoading: false });
        return true;
      }
      set({ authError: data.error ?? "Authentication failed", authLoading: false });
      return false;
    } catch {
      set({ authError: "Network error. Please try again.", authLoading: false });
      return false;
    }
  },

  logout: () => {
    set({
      isConnected: false,
      username: null,
      authError: null,
      markets: [],
      marketBook: null,
    });
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
}));
