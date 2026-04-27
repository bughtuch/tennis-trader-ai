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
    const { action, marketId, instructions, betId, marketIds } = body;

    const sessionToken =
      req.headers.get("x-betfair-token") ??
      req.cookies.get("betfair_session")?.value;

    console.log("[trade] Token present:", !!sessionToken);
    console.log("[trade] Token preview:", sessionToken ? sessionToken.substring(0, 10) + "..." : "NONE");
    console.log("[trade] Action:", action);

    if (!sessionToken) {
      console.log("[trade] REJECTED — no token found in header or cookie");
      return NextResponse.json(
        { success: false, error: "Not authenticated. Please log in first." },
        { status: 401 }
      );
    }

    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      console.log("[trade] REJECTED — BETFAIR_APP_KEY not configured");
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured" },
        { status: 500 }
      );
    }

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

      // Validate instruction fields before sending to Betfair
      for (const inst of instructions) {
        if (!Number.isInteger(inst.selectionId) || inst.selectionId <= 0) {
          return NextResponse.json(
            { success: false, error: "Invalid selection ID" },
            { status: 400 }
          );
        }
        if (inst.side !== "BACK" && inst.side !== "LAY") {
          return NextResponse.json(
            { success: false, error: "Side must be BACK or LAY" },
            { status: 400 }
          );
        }
        if (!Number.isFinite(inst.price) || inst.price < 1.01 || inst.price > 1000) {
          return NextResponse.json(
            { success: false, error: "Invalid price" },
            { status: 400 }
          );
        }
        if (!Number.isFinite(inst.size) || inst.size <= 0) {
          return NextResponse.json(
            { success: false, error: "Invalid stake size" },
            { status: 400 }
          );
        }
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

      const rpcBody = {
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/placeOrders",
        params: {
          marketId,
          instructions: formattedInstructions,
        },
        id: 1,
      };

      console.log("[trade] Request body:", JSON.stringify(rpcBody, null, 2));

      const res = await fetch(JSONRPC_URL, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(rpcBody),
      });

      const responseText = await res.text();
      if (!res.ok) {
        console.log("[trade] HTTP error:", res.status, responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status} — ${responseText.slice(0, 300)}` },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.log("[trade] Non-JSON response:", responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair returned non-JSON: ${responseText.slice(0, 300)}` },
          { status: 502 }
        );
      }

      console.log("[trade] Full Betfair response:", JSON.stringify(parsed, null, 2));

      if (parsed.error) {
        console.log("[trade] Error code:", parsed.error?.data?.APINGException?.errorCode);
        console.log("[trade] Error details:", parsed.error?.data?.APINGException?.errorDetails);
        return NextResponse.json(
          { success: false, error: parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Betfair error" },
          { status: 400 }
        );
      }

      const data = parsed.result;

      if (data?.status === "FAILURE") {
        console.log("[trade] Order FAILURE:", data.errorCode);
        return NextResponse.json(
          { success: false, error: data.errorCode ?? "Order placement failed" },
          { status: 400 }
        );
      }

      const betIds = (data?.instructionReports ?? []).map(
        (r: { betId: string }) => r.betId
      );

      // Save trades to Supabase
      try {
        const { createServerClient } = await import("@/lib/supabase-server");
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const tradeRows = instructions.map(
            (inst: { selectionId: number; side: string; price: number; size: number }) => ({
              user_id: user.id,
              market_id: marketId,
              selection_id: String(inst.selectionId),
              side: inst.side,
              entry_price: inst.price,
              stake: inst.size,
              status: "open",
            })
          );
          await supabase.from("trades").insert(tradeRows);
        }
      } catch {
        // Trade recording is non-critical — don't block the response
      }

      return NextResponse.json({ success: true, betIds, result: data });
    }

    if (action === "cancelOrder") {
      const cancelParams: Record<string, unknown> = {};
      if (marketId) cancelParams.marketId = marketId;
      if (betId) {
        cancelParams.instructions = [{ betId }];
      }
      if (marketIds) cancelParams.marketIds = marketIds;

      const rpcBody = {
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/cancelOrders",
        params: cancelParams,
        id: 1,
      };

      console.log("[trade] cancelOrder request:", JSON.stringify(rpcBody, null, 2));

      const res = await fetch(JSONRPC_URL, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(rpcBody),
      });

      const responseText = await res.text();
      if (!res.ok) {
        console.log("[trade] cancelOrder HTTP error:", res.status, responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status} — ${responseText.slice(0, 300)}` },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.log("[trade] cancelOrder non-JSON:", responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair returned non-JSON: ${responseText.slice(0, 300)}` },
          { status: 502 }
        );
      }

      console.log("[trade] cancelOrder response:", JSON.stringify(parsed, null, 2));

      if (parsed.error) {
        console.log("[trade] cancelOrder error code:", parsed.error?.data?.APINGException?.errorCode);
        console.log("[trade] cancelOrder error details:", parsed.error?.data?.APINGException?.errorDetails);
        return NextResponse.json(
          { success: false, error: parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Betfair error" },
          { status: 400 }
        );
      }

      const data = parsed.result;
      if (data?.status === "FAILURE") {
        console.log("[trade] cancelOrder FAILURE:", data.errorCode);
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

    if (action === "listCurrentOrders") {
      const orderParams: Record<string, unknown> = {
        orderProjection: "EXECUTABLE",
      };
      if (marketId) orderParams.marketIds = [marketId];
      if (marketIds) orderParams.marketIds = marketIds;

      const rpcBody = {
        jsonrpc: "2.0",
        method: "SportsAPING/v1.0/listCurrentOrders",
        params: orderParams,
        id: 1,
      };

      console.log("[trade] listCurrentOrders request:", JSON.stringify(rpcBody, null, 2));

      const res = await fetch(JSONRPC_URL, {
        method: "POST",
        headers: getHeaders(sessionToken, appKey),
        body: JSON.stringify(rpcBody),
      });

      const responseText = await res.text();
      if (!res.ok) {
        console.log("[trade] listCurrentOrders HTTP error:", res.status, responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair API error: HTTP ${res.status} — ${responseText.slice(0, 300)}` },
          { status: res.status }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.log("[trade] listCurrentOrders non-JSON:", responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: `Betfair returned non-JSON: ${responseText.slice(0, 300)}` },
          { status: 502 }
        );
      }

      console.log("[trade] listCurrentOrders response:", JSON.stringify(parsed, null, 2));

      if (parsed.error) {
        console.log("[trade] listCurrentOrders error code:", parsed.error?.data?.APINGException?.errorCode);
        console.log("[trade] listCurrentOrders error details:", parsed.error?.data?.APINGException?.errorDetails);
        return NextResponse.json(
          { success: false, error: parsed.error?.data?.exceptionname ?? parsed.error?.message ?? "Betfair error" },
          { status: 400 }
        );
      }

      const data = parsed.result;
      const currentOrders = (data?.currentOrders ?? []).map(
        (o: Record<string, unknown>) => ({
          betId: o.betId,
          marketId: o.marketId,
          selectionId: o.selectionId,
          side: o.side,
          price: (o.priceSize as Record<string, unknown>)?.price ?? 0,
          size: (o.priceSize as Record<string, unknown>)?.size ?? 0,
          sizeMatched: o.sizeMatched ?? 0,
          sizeRemaining: o.sizeRemaining ?? 0,
          status: o.status,
          placedDate: o.placedDate,
        })
      );

      return NextResponse.json({ success: true, currentOrders });
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
