"use client";

/**
 * Unified trade-action risk preview + validation layer.
 *
 * Every Betfair action (place, cancel, close, green-up, scale-out, guardian)
 * goes through validateAndExecute(). It:
 *  1. Calculates liability BEFORE sending
 *  2. Logs [risk-preview] with full structured data
 *  3. Validates all fields and blocks invalid orders client-side
 *  4. Surfaces the exact Betfair error on failure
 */

import { calculateLiability } from "@/lib/tradingMaths";

/* ─── Types ─── */

export type ActionName =
  | "PLACE_TRADE"
  | "CANCEL"
  | "CLOSE"
  | "GREEN_UP"
  | "SCALE_OUT"
  | "GUARDIAN_EXECUTE"
  | "OPTIMISED_GREEN_UP"
  | "KEYBOARD_TRADE"
  | "KEYBOARD_GREEN_UP"
  | "PARTIAL_HEDGE"
  | "BREAK_EVEN_HEDGE";

export interface TradeActionParams {
  actionName: ActionName;
  marketId: string | null | undefined;
  selectionId: number | null | undefined;
  side: "BACK" | "LAY";
  price: number | null | undefined;
  size: number | null | undefined;
  betId?: string | null;
  positionId?: string | null;
  isUnmatched?: boolean;
  isMatchedPosition?: boolean;
}

export interface TradeActionResult {
  success: boolean;
  betId?: string;
  error?: string;
  blocked?: boolean;  // true if blocked client-side (never sent to Betfair)
}

type PlaceTradeFn = (params: {
  marketId: string;
  selectionId: number;
  side: "BACK" | "LAY";
  price: number;
  size: number;
}) => Promise<{ success: boolean; betId?: string }>;

type CancelOrderFn = (params: {
  marketId: string;
  betId?: string;
}) => Promise<boolean>;

/* ─── Risk Preview (computed for every non-cancel action) ─── */

export interface RiskPreview {
  action: ActionName;
  hedgeSide: "BACK" | "LAY";
  hedgeStake: number;
  hedgePrice: number;
  liabilityRequired: number;
  valid: boolean;
  reason: string | null;
}

function computeRiskPreview(p: TradeActionParams): RiskPreview {
  const hedgeSide = p.side;
  const hedgeStake = p.size ?? 0;
  const hedgePrice = p.price ?? 0;
  const liabilityRequired =
    hedgeStake > 0 && hedgePrice > 1
      ? calculateLiability(hedgePrice, hedgeStake, hedgeSide)
      : 0;

  const error = validateFields(p);

  return {
    action: p.actionName,
    hedgeSide,
    hedgeStake,
    hedgePrice,
    liabilityRequired,
    valid: error === null,
    reason: error,
  };
}

/* ─── Pre-flight validation ─── */

function validateFields(p: TradeActionParams): string | null {
  if (!p.marketId) return "Missing marketId";
  if (p.actionName === "CANCEL") {
    if (!p.betId) return "No Betfair betId to cancel";
    return null;
  }
  if (!p.selectionId) return "Missing selectionId";
  if (!p.price || p.price < 1.01) return "No tradable hedge price available.";
  if (p.price > 1000) return `Invalid price: ${p.price}`;
  if (!p.size || !Number.isFinite(p.size)) return "Missing stake size";
  if (p.size < 2)
    return `Betfair minimum stake is £2. This action would place £${p.size.toFixed(2)}.`;

  // Liability sanity check for LAY orders
  if (p.side === "LAY") {
    const liability = (p.price - 1) * p.size;
    if (liability > 10000)
      return `This hedge requires £${Math.round(liability).toLocaleString()} liability. Reduce position or add funds.`;
  }

  return null;
}

/* ─── Unified execute ─── */

export async function validateAndExecute(
  params: TradeActionParams,
  executors: {
    placeTrade: PlaceTradeFn;
    cancelOrder: CancelOrderFn;
    onError: (msg: string) => void;
  }
): Promise<TradeActionResult> {
  // 1. Compute and log risk preview for every action
  if (params.actionName !== "CANCEL") {
    const preview = computeRiskPreview(params);
    console.log(`[risk-preview] ${preview.action}`, {
      hedgeSide: preview.hedgeSide,
      hedgeStake: preview.hedgeStake,
      hedgePrice: preview.hedgePrice,
      liabilityRequired: preview.liabilityRequired,
      valid: preview.valid,
      reason: preview.reason,
      marketId: params.marketId,
      selectionId: params.selectionId,
      positionId: params.positionId ?? null,
    });
  } else {
    console.log(`[risk-preview] CANCEL`, {
      marketId: params.marketId,
      betId: params.betId ?? null,
    });
  }

  // 2. Validate
  const error = validateFields(params);
  if (error) {
    console.warn(`[risk-preview] BLOCKED: ${error}`);
    executors.onError(error);
    return { success: false, error, blocked: true };
  }

  // 3. Execute
  if (params.actionName === "CANCEL") {
    try {
      const ok = await executors.cancelOrder({
        marketId: params.marketId!,
        betId: params.betId!,
      });
      if (ok) {
        console.log(`[risk-preview] CANCEL success betId=${params.betId}`);
        return { success: true };
      }
      console.warn(`[risk-preview] CANCEL failed betId=${params.betId}`);
      return { success: false, error: "Cancel failed" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cancel network error";
      console.error(`[risk-preview] CANCEL exception:`, msg);
      executors.onError(msg);
      return { success: false, error: msg };
    }
  }

  // All other actions go through placeTrade
  const liability = params.side === "LAY"
    ? Math.round((params.price! - 1) * params.size! * 100) / 100
    : params.size!;

  try {
    const result = await executors.placeTrade({
      marketId: params.marketId!,
      selectionId: params.selectionId!,
      side: params.side,
      price: params.price!,
      size: params.size!,
    });

    if (result.success) {
      console.log(`[risk-preview] ${params.actionName} success betId=${result.betId ?? "unknown"} liability=£${liability.toFixed(2)}`);
    } else {
      console.warn(`[risk-preview] ${params.actionName} failed liability=£${liability.toFixed(2)} — error surfaced via store`);
    }

    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error placing trade";
    console.error(`[risk-preview] ${params.actionName} exception:`, msg);
    executors.onError(msg);
    return { success: false, error: msg };
  }
}
