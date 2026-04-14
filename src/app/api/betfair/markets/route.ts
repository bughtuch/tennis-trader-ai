import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const JSONRPC_URL = "https://api.betfair.com/exchange/betting/json-rpc/v1";

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, marketIds } = body;

    // Use user's token if available, otherwise fall back to vendor session for public market data
    // Priority: header (from localStorage via frontend) > cookie > vendor session
    const VENDOR_SESSION = "6gI2QVT80KvjC84XfTu4DlrbZyCaIBXKAOc3Cs8yIYs=";
    const sessionToken =
      req.headers.get("x-betfair-token") ??
      req.cookies.get("betfair_session")?.value ??
      VENDOR_SESSION;

    const appKey = process.env.BETFAIR_APP_KEY ?? "fCsY8wIPysRCihHi";
    if (!appKey) {
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured" },
        { status: 500 }
      );
    }

    if (action === "listMarkets") {
      const rpcBody = {
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/listMarketCatalogue",
        params: {
          filter: {
            eventTypeIds: ["2"],
            marketTypeCodes: ["MATCH_ODDS"],
          },
          maxResults: 50,
          marketProjection: [
            "EVENT",
            "COMPETITION",
            "MARKET_START_TIME",
            "RUNNER_DESCRIPTION",
          ],
        },
        id: 1,
      };

      const res = await fetch(JSONRPC_URL, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(rpcBody),
      });

      const responseText = await res.text();

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status}` },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        return NextResponse.json(
          { success: false, error: "Betfair returned non-JSON response" },
          { status: 502 }
        );
      }

      if (parsed.error) {
        return NextResponse.json(
          { success: false, error: parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Betfair error" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, markets: parsed.result ?? [] });
    }

    if (action === "getMarketBook") {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "marketIds array is required" },
          { status: 400 }
        );
      }

      const rpcBody = {
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/listMarketBook",
        params: {
          marketIds,
          priceProjection: {
            priceData: ["EX_BEST_OFFERS", "EX_TRADED"],
            exBestOffersOverrides: {
              bestPricesDepth: 10,
            },
          },
        },
        id: 2,
      };

      const res = await fetch(JSONRPC_URL, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(rpcBody),
      });

      const responseText = await res.text();

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status}` },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        return NextResponse.json(
          { success: false, error: "Betfair returned non-JSON response" },
          { status: 502 }
        );
      }

      if (parsed.error) {
        return NextResponse.json(
          { success: false, error: parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Betfair error" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, marketBooks: parsed.result ?? [] });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
