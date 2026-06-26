"use client";

import { useAppStore } from "@/lib/store";

interface BetfairToken {
  token: string | null;
  isConnected: boolean;
  username: string | null;
}

/**
 * Single source of truth: reads from Zustand store.
 * Token is retrieved from localStorage for API headers only.
 */
export function useBetfairToken(): BetfairToken {
  const isConnected = useAppStore((s) => s.isConnected);
  const username = useAppStore((s) => s.username);

  // Token is still in localStorage for API header use (httpOnly cookie is primary)
  let token: string | null = null;
  try {
    if (isConnected) {
      token = localStorage.getItem("betfair_token");
    }
  } catch { /* SSR guard */ }

  return { token, isConnected, username };
}
