"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function BetfairConnect() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Connecting to Betfair...");

  useEffect(() => {
    const code = params.get("code");
    const vs = params.get("vs");
    if (!code || !vs) {
      setStatus("Missing auth code");
      return;
    }

    fetch("https://api.betfair.com/exchange/account/json-rpc/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Application": "fCsY8wIPysRCihHi",
        "X-Authentication": vs,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "AccountAPING/v1.0/token",
        params: {
          client_id: "157798",
          grant_type: "AUTHORIZATION_CODE",
          code,
          client_secret: "a3114dca-8775-4a6b-80d3-db338edd8cf5",
        },
        id: 1,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log("[betfair-connect] response:", data);
        const token = data?.result?.access_token;
        if (token) {
          localStorage.setItem("betfair_token", token);
          localStorage.setItem("betfair_connected_at", new Date().toISOString());
          localStorage.setItem("betfair_username", "Connected via OAuth");
          setStatus("Connected!");
          setTimeout(() => router.push("/settings?betfair=connected"), 1000);
        } else {
          setStatus("Token exchange failed: " + JSON.stringify(data));
        }
      })
      .catch((err) => setStatus("Error: " + err.message));
  }, [params, router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#030712",
        color: "white",
        fontSize: "18px",
      }}
    >
      {status}
    </div>
  );
}
