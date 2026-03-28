"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { moveByTicks, roundToTick } from "@/lib/tradingMaths";

const SHIFT_THRESHOLD_TICKS = 10;
const STABLE_DURATION_MS = 5_000;
const AUTO_DISMISS_MS = 90_000;

function countTicks(from: number, to: number): number {
  if (from <= 0 || to <= 0 || from === to) return 0;
  let count = 0;
  let current = from;
  const up = to > from;
  const limit = 300;
  while (count < limit) {
    const next = moveByTicks(current, up ? 1 : -1);
    if (up ? next <= current : next >= current) break;
    current = next;
    count++;
    if (up ? current >= to : current <= to) break;
  }
  return count;
}

interface ChangeoverAlertProps {
  playerOdds: number;
  isInPlay: boolean;
}

interface AlertData {
  tickShift: number;
  preGamePrice: number;
  currentPrice: number;
  reboundTarget: number;
}

export default function ChangeoverAlert({
  playerOdds,
  isInPlay,
}: ChangeoverAlertProps) {
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Track price anchor and movement
  const anchorRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(Date.now());
  const shiftAccumRef = useRef<number>(0);
  const prevPriceRef = useRef<number>(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = useCallback((data: AlertData) => {
    setAlert(data);
    setDismissed(false);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setAlert(null);
      setDismissed(false);
    }, AUTO_DISMISS_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isInPlay || playerOdds <= 1.01) {
      prevPriceRef.current = 0;
      anchorRef.current = 0;
      return;
    }

    const now = Date.now();
    const prev = prevPriceRef.current;

    // First reading
    if (prev === 0) {
      prevPriceRef.current = playerOdds;
      anchorRef.current = playerOdds;
      lastMoveRef.current = now;
      shiftAccumRef.current = 0;
      return;
    }

    // Detect price movement
    if (playerOdds !== prev) {
      const moved = countTicks(prev, playerOdds);
      if (moved > 0) {
        // If direction changed, reset anchor
        const wasRising = prev > anchorRef.current;
        const nowRising = playerOdds > prev;
        if (anchorRef.current === 0 || (shiftAccumRef.current > 3 && wasRising !== nowRising)) {
          // Direction reversal after accumulation — new movement phase
          anchorRef.current = prev;
          shiftAccumRef.current = 0;
        }
        shiftAccumRef.current = countTicks(anchorRef.current, playerOdds);
        lastMoveRef.current = now;
      }
      prevPriceRef.current = playerOdds;
      return;
    }

    // Price hasn't changed — check if stable for 5+ seconds after a big shift
    const stableMs = now - lastMoveRef.current;
    const totalShift = shiftAccumRef.current;

    if (stableMs >= STABLE_DURATION_MS && totalShift >= SHIFT_THRESHOLD_TICKS && !alert && !dismissed) {
      const preGamePrice = anchorRef.current;
      // Calculate midpoint rebound target (~half the shift back)
      const shiftDirection = playerOdds > preGamePrice ? -1 : 1;
      const reboundTicks = Math.round(totalShift * 0.4);
      const reboundTarget = roundToTick(
        moveByTicks(playerOdds, shiftDirection * reboundTicks)
      );

      showAlert({
        tickShift: totalShift,
        preGamePrice,
        currentPrice: playerOdds,
        reboundTarget,
      });

      // Reset tracking for next game
      anchorRef.current = playerOdds;
      shiftAccumRef.current = 0;
    }
  }, [playerOdds, isInPlay, alert, dismissed, showAlert]);

  if (!alert || dismissed || !isInPlay) return null;

  const isOverreaction = alert.tickShift >= 15;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/5">
      <div className="px-3 md:px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-400">
                CHANGEOVER / BREAK IN PLAY
              </span>
            </div>

            {/* Details */}
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Odds shifted {alert.tickShift} ticks during last game.{" "}
              <span className="font-mono font-semibold text-white">
                Current: {alert.currentPrice.toFixed(2)}
              </span>
              {" | "}
              <span className="font-mono text-gray-400">
                Pre-game: {alert.preGamePrice.toFixed(2)}
              </span>
            </p>

            {isOverreaction && (
              <p className="text-xs text-amber-300/80">
                If overreaction: potential rebound to{" "}
                <span className="font-mono font-semibold text-white">
                  ~{alert.reboundTarget.toFixed(2)}
                </span>
              </p>
            )}

            {/* Warning */}
            <div className="flex items-start gap-1.5 pt-1">
              <span className="text-amber-400 shrink-0 text-xs leading-none mt-0.5">⚠️</span>
              <p className="text-[11px] text-amber-400/70 leading-relaxed">
                Check live stream before trading — odds shift may reflect injury, medical
                timeout, or retirement risk. Only trade if you can see the match.
              </p>
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => {
              setDismissed(true);
              setAlert(null);
              if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            }}
            className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
