import { NextRequest, NextResponse } from "next/server";

const BETTING_API = "https://api.betfair.com/exchange/betting/rest/v1.0";

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
  };
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get("betfair_session")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated. Please log in first." },
        { status: 401 }
      );
    }

    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured" },
        { status: 500 }
      );
    }

    const { action, marketIds } = await req.json();

    if (action === "listMarkets") {
      const res = await fetch(`${BETTING_API}/listMarketCatalogue/`, {
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

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `Betfair API error: ${res.status} ${text}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json({ success: true, markets: data });
    }

    if (action === "getMarketBook") {
      if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "marketIds array is required" },
          { status: 400 }
        );
      }

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

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `Betfair API error: ${res.status} ${text}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json({ success: true, marketBooks: data });
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
