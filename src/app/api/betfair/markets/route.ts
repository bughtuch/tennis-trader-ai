import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const BETTING_API = "https://api.betfair.com/exchange/betting/rest/v1.0";

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
  };
}

export async function POST(req: NextRequest) {
  const debug: string[] = [];

  try {
    debug.push("1. Markets API called");

    const body = await req.json();
    const { action, marketIds, sessionToken: bodyToken } = body;

    // Accept session token from request body or cookie
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
      debug.push("5. Calling Betfair listMarketCatalogue...");

      let res: Response;
      try {
        res = await fetch(`${BETTING_API}/listMarketCatalogue/`, {
          method: "POST",
          headers: getHeaders(sessionToken, appKey),
          body: JSON.stringify({
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
          }),
        });
      } catch (fetchErr) {
        debug.push(`5. FAIL: Fetch error: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Network error calling Betfair: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`, debug },
          { status: 502 }
        );
      }

      debug.push(`6. Betfair response: HTTP ${res.status}, content-type: ${res.headers.get("content-type")}`);

      if (!res.ok) {
        const text = await res.text();
        debug.push(`6. FAIL: Betfair error body (first 200): ${text.slice(0, 200)}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair API error: ${res.status} ${text.slice(0, 200)}`, debug },
          { status: res.status }
        );
      }

      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      debug.push(`7. SUCCESS: ${count} markets returned`);
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json({ success: true, markets: data, debug });
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

      debug.push(`5. Calling Betfair listMarketBook for ${marketIds.length} markets...`);

      const res = await fetch(`${BETTING_API}/listMarketBook/`, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify({
          marketIds,
          priceProjection: {
            priceData: ["EX_BEST_OFFERS", "EX_TRADED"],
            exBestOffersOverrides: {
              bestPricesDepth: 10,
            },
          },
        }),
      });

      debug.push(`6. Betfair response: HTTP ${res.status}`);

      if (!res.ok) {
        const text = await res.text();
        debug.push(`6. FAIL: ${text.slice(0, 200)}`);
        console.log("[Markets Debug]", debug.join(" | "));
        return NextResponse.json(
          { success: false, error: `Betfair API error: ${res.status} ${text.slice(0, 200)}`, debug },
          { status: res.status }
        );
      }

      const data = await res.json();
      debug.push(`7. SUCCESS: ${Array.isArray(data) ? data.length : 0} market books returned`);
      console.log("[Markets Debug]", debug.join(" | "));
      return NextResponse.json({ success: true, marketBooks: data, debug });
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
