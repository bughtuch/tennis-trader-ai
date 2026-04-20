import { NextRequest, NextResponse } from "next/server";

// Standard Node runtime — no edge export

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_ID = "157798";
const VENDOR_SECRET = "a3114dca-8775-4a6b-80d3-db338edd8cf5";

export async function POST(req: NextRequest) {
  try {
    const { code, vendorSession } = await req.json();

    if (!code || !vendorSession) {
      return NextResponse.json(
        { error: "code and vendorSession are required" },
        { status: 400 }
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      method: "AccountAPING/v1.0/token",
      params: {
        client_id: VENDOR_ID,
        grant_type: "AUTHORIZATION_CODE",
        code,
        client_secret: VENDOR_SECRET,
      },
      id: 1,
    };

    const res = await fetch(
      "https://api.betfair.com/exchange/account/json-rpc/v1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": vendorSession,
        },
        body: JSON.stringify(rpcBody),
      }
    );

    const text = await res.text();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        error: "Non-JSON response from Betfair",
        httpStatus: res.status,
        body: text.substring(0, 500),
      }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token proxy failed" },
      { status: 500 }
    );
  }
}
