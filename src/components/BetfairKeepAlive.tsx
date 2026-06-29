"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
        // Send localStorage token as header — matches trade/stream/scanner pattern
        const headers: Record<string, string> = {};
        try {
          const t = localStorage.getItem("betfair_token");
          if (t) headers["x-betfair-token"] = t;
        } catch { /* SSR guard */ }
        const res = await fetch("/api/betfair/keep-alive", { method: "POST", headers });
        const data = await res.json();
        if (data.success) {
          // Keep-alive succeeded — ensure store reflects connected state
          useAppStore.setState({ isConnected: true });
          // Sync rotated token to localStorage so x-betfair-token header stays current
          if (data.newToken) {
            try { localStorage.setItem("betfair_token", data.newToken); } catch { /* SSR guard */ }
          }
        } else {
          // Keep-alive failed — do NOT change connection state.
          // The SSO keepAlive endpoint rejects vendor OAuth tokens even though
          // they work for Exchange API trades. If the token is truly invalid,
          // actual API calls will return SESSION_EXPIRED and handleSessionExpired()
          // will properly disconnect.
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
