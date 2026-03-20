"use client";

import { useEffect, useRef } from "react";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

export default function BetfairKeepAlive() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function ping() {
      try {
        const res = await fetch("/api/betfair/keep-alive", {
          method: "POST",
        });
        const data = await res.json();
        if (!data.success) return;
      } catch {
        // Network error — retry next interval
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
