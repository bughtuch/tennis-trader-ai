"use client";

import { useEffect, useRef } from "react";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

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

      // Prevent pings closer than 15 minutes apart
      const now = Date.now();
      if (now - lastPingRef.current < 15 * 60 * 1000) return;
      lastPingRef.current = now;

      try {
        await fetch("/api/betfair/keep-alive", { method: "POST" });
      } catch {
        // Network error — retry next interval
      }
    }

    // Initial ping after 5 seconds (don't block page load, give time for token to be set)
    const initialTimeout = setTimeout(ping, 5000);

    // Then every 20 minutes
    timerRef.current = setInterval(ping, INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null;
}
