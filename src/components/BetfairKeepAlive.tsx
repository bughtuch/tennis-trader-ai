"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (was 20 — C3+H1 fix)

function clearBetfairTokens() {
  try {
    localStorage.removeItem("betfair_token");
    localStorage.removeItem("betfair_token_type");
    localStorage.removeItem("betfair_refresh_token");
    localStorage.removeItem("betfair_username");
    localStorage.removeItem("betfair_connected_at");
  } catch { /* SSR guard */ }
  try {
    document.cookie = "betfair_session=; Max-Age=0; path=/;";
  } catch { /* SSR guard */ }
}

export default function BetfairKeepAlive() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef(0);

  useEffect(() => {
    async function ping() {
      // Only ping if user has a Betfair token
      try {
        if (!localStorage.getItem("betfair_token")) return;
      } catch {
        return;
      }

      // Prevent pings closer than 4 minutes apart
      const now = Date.now();
      if (now - lastPingRef.current < 4 * 60 * 1000) return;
      lastPingRef.current = now;

      try {
        const res = await fetch("/api/betfair/keep-alive", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          // Keep-alive succeeded — ensure store reflects connected state
          useAppStore.setState({ isConnected: true });
        } else {
          // Keep-alive failed (token revoked/expired) — clear all token stores
          clearBetfairTokens();
          useAppStore.setState({ isConnected: false, username: null, sessionExpiry: null });
        }
      } catch {
        // Network error — don't change state, retry next interval
      }
    }

    // Initial ping after 5 seconds (don't block page load, give time for token to be set)
    const initialTimeout = setTimeout(ping, 5000);

    // Then every 5 minutes
    timerRef.current = setInterval(ping, INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null;
}
