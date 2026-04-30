"use client";

import { useState, useEffect } from "react";

interface BetfairToken {
  token: string | null;
  isConnected: boolean;
  username: string | null;
}

export function useBetfairToken(): BetfairToken {
  const [state, setState] = useState<BetfairToken>({
    token: null,
    isConnected: false,
    username: null,
  });

  useEffect(() => {
    try {
      const token = localStorage.getItem("betfair_token");
      const username = localStorage.getItem("betfair_username");
      const connectedAt = localStorage.getItem("betfair_connected_at");

      console.log("[useBetfairToken] Betfair connected:", !!token);

      if (token) {
        // Check expiry only if connectedAt exists
        if (connectedAt) {
          const expired = Date.now() > new Date(connectedAt).getTime() + 8 * 3600000;
          if (expired) {
            localStorage.removeItem("betfair_token");
            localStorage.removeItem("betfair_token_type");
            localStorage.removeItem("betfair_refresh_token");
            localStorage.removeItem("betfair_username");
            localStorage.removeItem("betfair_connected_at");
            setState({ token: null, isConnected: false, username: null });
            return;
          }
        }
        setState({ token, isConnected: true, username });
        return;
      }
    } catch { /* SSR guard */ }

    setState({ token: null, isConnected: false, username: null });
  }, []);

  return state;
}
