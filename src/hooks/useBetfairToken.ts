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

      if (token && connectedAt) {
        const expired = Date.now() > new Date(connectedAt).getTime() + 8 * 3600000;
        if (!expired) {
          setState({ token, isConnected: true, username });
          return;
        }
        // Expired — clean up
        localStorage.removeItem("betfair_token");
        localStorage.removeItem("betfair_username");
        localStorage.removeItem("betfair_connected_at");
      }
    } catch { /* SSR guard */ }

    setState({ token: null, isConnected: false, username: null });
  }, []);

  return state;
}
