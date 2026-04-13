import { NextRequest, NextResponse } from "next/server";

const BETFAIR_APP_KEY = "fCsY8wIPysRCihHi";

export async function GET(req: NextRequest) {
  const sessionToken =
    req.cookies.get("betfair_session")?.value ??
    req.headers.get("x-betfair-token");

  if (!sessionToken) {
    return NextResponse.json(
      { error: "No session token. Log in to Betfair first." },
      { status: 401 }
    );
  }

  try {
    const res = await fetch(
      "https://api.betfair.com/exchange/account/json-rpc/v1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Application": BETFAIR_APP_KEY,
          "X-Authentication": sessionToken,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "AccountAPING/v1.0/getDeveloperAppKeys",
          params: {},
          id: 1,
        }),
      }
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 502 }
    );
  }
}
