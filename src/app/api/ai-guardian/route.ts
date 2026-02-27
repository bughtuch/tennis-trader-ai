import { NextRequest, NextResponse } from "next/server";
import { calculateGreenUp, moveByTicks } from "@/lib/tradingMaths";

type Side = "BACK" | "LAY";

const BETTING_API = "https://api.betfair.com/exchange/betting/rest/v1.0";

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ─── Action: assessPosition ─── */

interface MatchContext {
  score?: string;
  server?: string;
  surface?: string;
  player?: string;
}

interface AssessPayload {
  entryPrice: number;
  entryStake: number;
  entrySide: Side;
  currentBackPrice: number;
  currentLayPrice: number;
  matchContext?: MatchContext;
}

async function assessPosition(payload: AssessPayload) {
  const {
    entryPrice,
    entryStake,
    entrySide,
    currentBackPrice,
    currentLayPrice,
    matchContext,
  } = payload;

  const exitPrice =
    entrySide === "BACK" ? currentLayPrice : currentBackPrice;

  /* ─── Option A: Exit Now ─── */
  const greenUp = calculateGreenUp(
    entryPrice,
    entryStake,
    entrySide,
    exitPrice
  );

  const optionA = {
    label: "Exit Now",
    description: "Close position immediately at current market price",
    greenUpStake: greenUp.greenUpStake,
    greenUpSide: greenUp.greenUpSide,
    greenUpPrice: exitPrice,
    profitIfWin: greenUp.profitIfWin,
    profitIfLose: greenUp.profitIfLose,
    equalProfit: greenUp.equalProfit,
  };

  /* ─── Option B: Hedge to Break Even ─── */
  let optionB: {
    label: string;
    description: string;
    hedgeStake?: number;
    hedgeSide?: Side;
    hedgePrice?: number;
    targetPrice?: number;
    ticksAway?: number;
    canBreakEven: boolean;
  };

  // Break even means hedging at the original entry price
  // For BACK entry: lay at entryPrice for entryStake → zero P&L
  // For LAY entry: back at entryPrice for entryStake → zero P&L
  const breakEvenSide: Side = entrySide === "BACK" ? "LAY" : "BACK";
  const breakEvenAvailable =
    entrySide === "BACK"
      ? currentLayPrice <= entryPrice
      : currentBackPrice >= entryPrice;

  if (breakEvenAvailable) {
    optionB = {
      label: "Hedge to Break Even",
      description: "Close position at zero profit/loss",
      hedgeStake: entryStake,
      hedgeSide: breakEvenSide,
      hedgePrice: entryPrice,
      canBreakEven: true,
    };
  } else {
    // Calculate how many ticks away the break-even price is
    let ticksAway = 0;
    let testPrice = exitPrice;
    const direction = entrySide === "BACK" ? -1 : 1;
    while (
      (entrySide === "BACK"
        ? testPrice > entryPrice
        : testPrice < entryPrice) &&
      ticksAway < 200
    ) {
      testPrice = moveByTicks(testPrice, direction);
      ticksAway++;
    }

    optionB = {
      label: "Hedge to Break Even",
      description: `Price needs to move ${ticksAway} tick${ticksAway !== 1 ? "s" : ""} to break even`,
      targetPrice: entryPrice,
      ticksAway,
      canBreakEven: false,
    };
  }

  /* ─── Option C: Partial Hedge (50%) ─── */
  const halfStake = r2(entryStake / 2);
  const partialGreenUpStake = r2((halfStake * entryPrice) / exitPrice);
  const partialSide: Side = entrySide === "BACK" ? "LAY" : "BACK";

  let partialBestCase: number;
  let partialWorstCase: number;

  if (entrySide === "BACK") {
    // Best case: selection wins. Profit from backed half minus lay liability on hedged half
    partialBestCase = r2(
      halfStake * (entryPrice - 1) -
        partialGreenUpStake * (exitPrice - 1)
    );
    // Worst case: selection loses. Gain from lay on hedged half minus loss on backed portion
    partialWorstCase = r2(partialGreenUpStake - halfStake);
    // Add the unhedged half's outcome
    // Best: unhedged BACK wins → +halfStake * (entryPrice - 1)
    partialBestCase = r2(partialBestCase + halfStake * (entryPrice - 1));
    // Worst: unhedged BACK loses → -halfStake
    partialWorstCase = r2(partialWorstCase - halfStake);
  } else {
    // Entry was LAY
    partialBestCase = r2(
      partialGreenUpStake * (exitPrice - 1) -
        halfStake * (entryPrice - 1)
    );
    partialWorstCase = r2(halfStake - partialGreenUpStake);
    // Unhedged half
    partialBestCase = r2(partialBestCase + halfStake);
    partialWorstCase = r2(
      partialWorstCase - halfStake * (entryPrice - 1)
    );
  }

  const optionC = {
    label: "Partial Hedge (50%)",
    description: "Hedge half your position, keep upside on the rest",
    hedgeStake: partialGreenUpStake,
    hedgeSide: partialSide,
    hedgePrice: exitPrice,
    bestCase: partialBestCase,
    worstCase: partialWorstCase,
  };

  /* ─── Option D: Hold Position (AI Assessment) ─── */
  // Calculate current P&L to determine if position is losing
  const currentPnl = greenUp.equalProfit;
  const isLosing = currentPnl < 0;

  let optionD: {
    label: string;
    description: string;
    available: boolean;
    recoveryChance?: number;
    reasoning?: string;
    recommendation?: string;
    waitGames?: number;
    worstCaseIfHold?: number;
  } = {
    label: "Hold Position",
    description: "Position is profitable — no need for AI hold assessment",
    available: false,
  };

  if (isLosing && matchContext) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      try {
        const worstCasePrice = moveByTicks(exitPrice, entrySide === "BACK" ? 10 : -10);
        const worstCaseGreenUp = calculateGreenUp(
          entryPrice,
          entryStake,
          entrySide,
          worstCasePrice
        );

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            system:
              "You are a tennis trading risk advisor. Assess position recovery likelihood. Respond ONLY in JSON: {\"recoveryChance\": 0-100, \"reasoning\": \"one sentence\", \"recommendation\": \"exit|hedge|hold\", \"waitGames\": number}",
            messages: [
              {
                role: "user",
                content: `Position: ${entrySide} at ${entryPrice} for £${entryStake}. Current exit price: ${exitPrice}. Current P&L: £${currentPnl}. Match: ${matchContext.player ?? "unknown"}, score: ${matchContext.score ?? "unknown"}, server: ${matchContext.server ?? "unknown"}, surface: ${matchContext.surface ?? "unknown"}. Should I hold, hedge, or exit?`,
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text =
            data.content?.[0]?.type === "text"
              ? data.content[0].text
              : "";

          // Extract JSON from response (handle potential markdown wrapping)
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const ai = JSON.parse(jsonMatch[0]);
            optionD = {
              label: "Hold Position",
              description: ai.reasoning ?? "AI assessment completed",
              available: true,
              recoveryChance: ai.recoveryChance,
              reasoning: ai.reasoning,
              recommendation: ai.recommendation,
              waitGames: ai.waitGames,
              worstCaseIfHold: worstCaseGreenUp.equalProfit,
            };
          }
        }
      } catch {
        optionD = {
          label: "Hold Position",
          description: "AI assessment unavailable",
          available: false,
        };
      }
    } else {
      optionD = {
        label: "Hold Position",
        description: "ANTHROPIC_API_KEY not configured",
        available: false,
      };
    }
  }

  /* ─── Urgency + Status ─── */
  let urgency: "none" | "low" | "medium" | "high";
  if (currentPnl >= 0) {
    urgency = "none";
  } else if (currentPnl > -5) {
    urgency = "low";
  } else if (currentPnl > -20) {
    urgency = "medium";
  } else {
    urgency = "high";
  }

  let statusMessage: string;
  if (currentPnl >= 0) {
    statusMessage = `Position is profitable. Lock in £${currentPnl.toFixed(2)} or hold for more.`;
  } else if (urgency === "low") {
    statusMessage = `Slightly underwater at £${currentPnl.toFixed(2)}. Consider hedging.`;
  } else if (urgency === "medium") {
    statusMessage = `Position losing £${Math.abs(currentPnl).toFixed(2)}. Hedge recommended.`;
  } else {
    statusMessage = `Significant loss of £${Math.abs(currentPnl).toFixed(2)}. Exit or hedge urgently.`;
  }

  // AI recommendation: prefer the best option given the situation
  let aiRecommendation: "A" | "B" | "C" | "D";
  if (currentPnl >= 0) {
    aiRecommendation = "A"; // Take profit
  } else if (optionD.available && optionD.recommendation === "hold") {
    aiRecommendation = "D";
  } else if (optionB.canBreakEven) {
    aiRecommendation = "B"; // Break even if possible
  } else if (urgency === "high") {
    aiRecommendation = "A"; // Cut losses
  } else {
    aiRecommendation = "C"; // Partial hedge as middle ground
  }

  return {
    currentPnl,
    urgency,
    statusMessage,
    aiRecommendation,
    options: { A: optionA, B: optionB, C: optionC, D: optionD },
  };
}

/* ─── Action: executeOption ─── */

async function executeOption(
  req: NextRequest,
  payload: {
    marketId: string;
    selectionId: number;
    hedgeSide: Side;
    hedgePrice: number;
    hedgeStake: number;
  }
) {
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

  const { marketId, selectionId, hedgeSide, hedgePrice, hedgeStake } =
    payload;

  if (!marketId || !selectionId || !hedgeSide || !hedgePrice || !hedgeStake) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing required fields: marketId, selectionId, hedgeSide, hedgePrice, hedgeStake",
      },
      { status: 400 }
    );
  }

  const res = await fetch(`${BETTING_API}/placeOrders/`, {
    method: "POST",
    headers: {
      "X-Authentication": sessionToken,
      "X-Application": appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      marketId,
      instructions: [
        {
          selectionId,
          side: hedgeSide,
          orderType: "LIMIT",
          limitOrder: {
            size: hedgeStake,
            price: hedgePrice,
            persistenceType: "LAPSE",
          },
        },
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

/* ─── Route Handler ─── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "assessPosition") {
      const result = await assessPosition(body);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "executeOption") {
      return executeOption(req, body);
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
