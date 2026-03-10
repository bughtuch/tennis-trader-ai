"use client";

import { useEffect, useRef } from "react";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

export default function BetfairKeepAlive() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function ping() {
      let token: string | null = null;
      try {
        token = localStorage.getItem("betfair_token");
      } catch {
        return;
      }
      if (!token) return;

      try {
        const res = await fetch("/api/betfair/keep-alive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: token }),
        });
        const data = await res.json();

        if (!data.success) {
          // Session expired or invalid — clear token
          try {
            localStorage.removeItem("betfair_token");
          } catch { /* SSR guard */ }
          return;
        }

        // If Betfair returned a refreshed token, update localStorage
        if (data.token && data.token !== token) {
          try {
            localStorage.setItem("betfair_token", data.token);
          } catch { /* SSR guard */ }
        }
      } catch {
        // Network error — don't clear token, retry next interval
      }
    }

    // Initial ping after 1 second (don't block page load)
    const initialTimeout = setTimeout(ping, 1000);

    // Then every 20 minutes
    timerRef.current = setInterval(ping, INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null;
}
