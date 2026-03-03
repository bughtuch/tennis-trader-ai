import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const JSONRPC_URL = "https://api.betfair.com/exchange/betting/json-rpc/v1";

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

export async function POST(req: NextRequest) {
  const debug: string[] = [];

  try {
    debug.push("1. Markets API called (JSON-RPC)");

    const body = await req.json();
    const { action, marketIds, sessionToken: bodyToken } = body;

    const cookieToken = req.cookies.get("betfair_session")?.value;
    debug.push(`2. bodyToken: ${bodyToken ? `yes (${bodyToken.slice(0, 8)}...)` : "no"}`);
    debug.push(`2. cookieToken: ${cookieToken ? `yes (${cookieToken.slice(0, 8)}...)` : "no"}`);

    const sessionToken = bodyToken || cookieToken;
    if (!sessionToken) {
      debug.push("3. FAIL: No session token from body or cookie");
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json(
        { success: false, error: "Not authenticated. Please log in first.", debug },
        { status: 401 }
      );
    }
    debug.push(`3. Using token: ${bodyToken ? "from body" : "from cookie"}`);

    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      debug.push("4. FAIL: BETFAIR_APP_KEY not configured");
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured", debug },
        { status: 500 }
      );
    }
    debug.push(`4. APP_KEY: yes (${appKey.slice(0, 4)}..., len=${appKey.length})`);

    if (action === "listMarkets") {
      debug.push("5. Calling Betfair JSON-RPC listMarketCatalogue...");

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

      let res: Response;
      try {
        res = await fetch(JSONRPC_URL, {
          method: "POST",
          headers: getHeaders(sessionToken, appKey),
          body: JSON.stringify(rpcBody),
        });
      } catch (fetchErr) {
        debug.push(`5. FAIL: Fetch error: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Network error calling Betfair: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`, debug },
          { status: 502 }
        );
      }

      const responseText = await res.text();
      debug.push(`6. Betfair HTTP ${res.status}, content-type: ${res.headers.get("content-type")}, body (first 500): ${responseText.slice(0, 500)}`);

      if (!res.ok) {
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status} — ${responseText.slice(0, 300)}`, debug },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        debug.push("7. FAIL: Could not parse response as JSON");
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair returned non-JSON (HTTP ${res.status}): ${responseText.slice(0, 300)}`, debug },
          { status: 502 }
        );
      }

      if (parsed.error) {
        debug.push(`7. FAIL: JSON-RPC error: ${JSON.stringify(parsed.error).slice(0, 200)}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair error: ${parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Unknown"}`, debug },
          { status: 400 }
        );
      }

      const markets = parsed.result ?? [];
      const count = Array.isArray(markets) ? markets.length : 0;
      debug.push(`7. SUCCESS: ${count} markets returned`);
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json({ success: true, markets, debug });
    }

    if (action === "getMarketBook") {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        debug.push("5. FAIL: No marketIds provided for getMarketBook");
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: "marketIds array is required", debug },
          { status: 400 }
        );
      }

      debug.push(`5. Calling Betfair JSON-RPC listMarketBook for ${marketIds.length} markets...`);

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

      let res: Response;
      try {
        res = await fetch(JSONRPC_URL, {
          method: "POST",
          headers: getHeaders(sessionToken, appKey),
          body: JSON.stringify(rpcBody),
        });
      } catch (fetchErr) {
        debug.push(`5. FAIL: Fetch error: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Network error calling Betfair: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`, debug },
          { status: 502 }
        );
      }

      const responseText = await res.text();
      debug.push(`6. Betfair HTTP ${res.status}, content-type: ${res.headers.get("content-type")}`);

      if (!res.ok) {
        debug.push(`6. FAIL: ${responseText.slice(0, 300)}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status} — ${responseText.slice(0, 300)}`, debug },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        debug.push("7. FAIL: Could not parse response as JSON");
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair returned non-JSON: ${responseText.slice(0, 300)}`, debug },
          { status: 502 }
        );
      }

      if (parsed.error) {
        debug.push(`7. FAIL: JSON-RPC error: ${JSON.stringify(parsed.error).slice(0, 200)}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair error: ${parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Unknown"}`, debug },
          { status: 400 }
        );
      }

      const marketBooks = parsed.result ?? [];
      debug.push(`7. SUCCESS: ${Array.isArray(marketBooks) ? marketBooks.length : 0} market books returned`);
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json({ success: true, marketBooks, debug });
    }

    debug.push(`5. FAIL: Unknown action: ${action}`);
    console.log("[Markets Debug]", debug.join(" | "));
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}`, debug },
      { status: 400 }
    );
  } catch (error) {
    debug.push(`CRASH: ${error instanceof Error ? error.message : "unknown"}`);
    console.log("[Markets Debug]", debug.join(" | "));
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        debug,
      },
      { status: 500 }
    );
  }
}
