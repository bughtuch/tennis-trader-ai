import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const JSONRPC_URL = "https://api.betfair.com/exchange/betting/json-rpc/v1";

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

interface ScannerAlert {
  id: string;
  marketId: string;
  players: string;
  alertType: "momentum" | "wom_flip" | "volume_spike";
  description: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken, previousSnapshot } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
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

    const headers = getHeaders(sessionToken, appKey);

    // 1. Fetch all live tennis market catalogues
    const catRes = await fetch(JSONRPC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/listMarketCatalogue",
        params: {
          filter: {
            eventTypeIds: ["2"],
            marketTypeCodes: ["MATCH_ODDS"],
            inPlayOnly: true,
          },
          maxResults: 50,
          marketProjection: ["EVENT", "RUNNER_DESCRIPTION"],
        },
        id: 1,
      }),
    });

    const catData = await catRes.json();
    const catalogues: any[] = catData.result ?? [];

    if (catalogues.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        snapshot: {},
        marketCount: 0,
      });
    }

    // 2. Fetch market books in batches of 10
    const marketIds = catalogues.map((c: any) => c.marketId);
    const bookMap = new Map<string, any>();
    const BATCH = 10;

    for (let i = 0; i < marketIds.length; i += BATCH) {
      const batch = marketIds.slice(i, i + BATCH);
      const bookRes = await fetch(JSONRPC_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "SportsAPING/v1.0/listMarketBook",
          params: {
            marketIds: batch,
            priceProjection: {
              priceData: ["EX_BEST_OFFERS"],
              exBestOffersOverrides: { bestPricesDepth: 3 },
            },
          },
          id: 2,
        }),
      });
      const bookData = await bookRes.json();
      for (const book of bookData.result ?? []) {
        bookMap.set(book.marketId, book);
      }
    }

    // 3. Build current snapshot and detect alerts
    const alerts: ScannerAlert[] = [];
    const currentSnapshot: Record<string, { bestBack: number; totalBack: number; totalLay: number; totalMatched: number }> = {};

    const catMap = new Map<string, any>();
    for (const cat of catalogues) catMap.set(cat.marketId, cat);

    for (const [mId, book] of bookMap) {
      const cat = catMap.get(mId);
      if (!cat?.runners || cat.runners.length < 2) continue;

      const r0 = book.runners?.[0];
      if (!r0?.ex) continue;

      const bestBack = r0.ex.availableToBack?.[0]?.price ?? 0;
      const totalBack = (r0.ex.availableToBack ?? []).reduce((s: number, p: any) => s + p.size, 0);
      const totalLay = (r0.ex.availableToLay ?? []).reduce((s: number, p: any) => s + p.size, 0);
      const totalMatched = book.totalMatched ?? 0;

      currentSnapshot[mId] = { bestBack, totalBack, totalLay, totalMatched };

      const players = `${cat.runners[0].runnerName} vs ${cat.runners[1].runnerName}`;
      const prev = previousSnapshot?.[mId];

      if (!prev) continue;

      // Detect price momentum (10+ ticks = ~0.10 in decimal odds at low prices)
      const priceDiff = Math.abs(bestBack - prev.bestBack);
      const tickThreshold = bestBack < 3 ? 0.10 : bestBack < 5 ? 0.20 : 0.50;
      if (priceDiff >= tickThreshold && prev.bestBack > 0) {
        const direction = bestBack > prev.bestBack ? "drifting" : "shortening";
        const severity = priceDiff >= tickThreshold * 2 ? "high" : "medium";
        alerts.push({
          id: `${mId}-momentum-${Date.now()}`,
          marketId: mId,
          players,
          alertType: "momentum",
          description: `Price ${direction} ${priceDiff.toFixed(2)} ticks (${prev.bestBack.toFixed(2)} → ${bestBack.toFixed(2)}). Momentum shift.`,
          severity,
          timestamp: Date.now(),
        });
      }

      // Detect WOM flip
      const prevWomBack = prev.totalBack + prev.totalLay > 0
        ? prev.totalBack / (prev.totalBack + prev.totalLay)
        : 0.5;
      const currWomBack = totalBack + totalLay > 0
        ? totalBack / (totalBack + totalLay)
        : 0.5;
      if ((prevWomBack > 0.55 && currWomBack < 0.45) || (prevWomBack < 0.45 && currWomBack > 0.55)) {
        const direction = currWomBack > 0.55 ? "back-heavy" : "lay-heavy";
        alerts.push({
          id: `${mId}-wom-${Date.now()}`,
          marketId: mId,
          players,
          alertType: "wom_flip",
          description: `Weight of money flipped to ${direction} (${Math.round(currWomBack * 100)}% back). Smart money moving.`,
          severity: "medium",
          timestamp: Date.now(),
        });
      }

      // Detect volume spike (>30% increase in matched volume)
      if (prev.totalMatched > 0 && totalMatched > 0) {
        const volumeIncrease = (totalMatched - prev.totalMatched) / prev.totalMatched;
        if (volumeIncrease >= 0.30) {
          alerts.push({
            id: `${mId}-volume-${Date.now()}`,
            marketId: mId,
            players,
            alertType: "volume_spike",
            description: `Volume surged ${Math.round(volumeIncrease * 100)}% — big money entering the market.`,
            severity: volumeIncrease >= 0.60 ? "high" : "medium",
            timestamp: Date.now(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      snapshot: currentSnapshot,
      marketCount: catalogues.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
