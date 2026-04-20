import { NextResponse } from "next/server";

// Standard Node runtime — no edge export

export async function GET() {
  try {
    const res = await fetch(
      "https://api.betfair.com/exchange/account/json-rpc/v1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": "fCsY8wIPysRCihHi",
          "X-Authentication": "DUMMY",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "AccountAPING/v1.0/getAccountFunds",
          params: {},
          id: 1,
        }),
      }
    );

    const text = await res.text();
    const isJson = text.trimStart().startsWith("{") || text.trimStart().startsWith("[");

    return NextResponse.json({
      httpStatus: res.status,
      isJson,
      contentType: res.headers.get("content-type"),
      body: text.substring(0, 300),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Fetch failed",
    }, { status: 500 });
  }
}
