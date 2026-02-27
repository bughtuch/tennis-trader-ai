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

    const { action, marketId, instructions, betId, marketIds } =
      await req.json();

    if (action === "placeTrade") {
      if (!marketId || !instructions || !Array.isArray(instructions)) {
        return NextResponse.json(
          {
            success: false,
            error: "marketId and instructions array are required",
          },
          { status: 400 }
        );
      }

      const formattedInstructions = instructions.map(
        (inst: {
          selectionId: number;
          side: "BACK" | "LAY";
          size: number;
          price: number;
        }) => ({
          selectionId: inst.selectionId,
          side: inst.side,
          orderType: "LIMIT" as const,
          limitOrder: {
            size: inst.size,
            price: inst.price,
            persistenceType: "LAPSE" as const,
          },
        })
      );

      const res = await fetch(`${BETTING_API}/placeOrders/`, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify({
          marketId,
          instructions: formattedInstructions,
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

      if (data.status === "FAILURE") {
        return NextResponse.json(
          { success: false, error: data.errorCode ?? "Order placement failed" },
          { status: 400 }
        );
      }

      const betIds = (data.instructionReports ?? []).map(
        (r: { betId: string }) => r.betId
      );

      return NextResponse.json({ success: true, betIds, result: data });
    }

    if (action === "cancelOrder") {
      const body: Record<string, unknown> = {};
      if (marketId) body.marketId = marketId;
      if (betId) {
        body.instructions = [{ betId }];
      }
      if (marketIds) body.marketIds = marketIds;

      const res = await fetch(`${BETTING_API}/cancelOrders/`, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `Betfair API error: ${res.status} ${text}` },
          { status: res.status }
        );
      }

      const data = await res.json();

      if (data.status === "FAILURE") {
        return NextResponse.json(
          {
            success: false,
            error: data.errorCode ?? "Order cancellation failed",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, result: data });
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
