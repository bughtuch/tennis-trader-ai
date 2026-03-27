"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import type { SSEMarketBook, SSEStatus } from "@/lib/betfair-stream-types";

interface UseBetfairStreamReturn {
  streamStatus: "disconnected" | "connecting" | "connected" | "fallback";
  isStreaming: boolean;
  suspensionDetected: boolean;
  clearSuspension: () => void;
}

export function useBetfairStream(
  marketId: string | null,
): UseBetfairStreamReturn {
  const [streamStatus, setStreamStatus] = useState<
    "disconnected" | "connecting" | "connected" | "fallback"
  >("disconnected");
  const [suspensionDetected, setSuspensionDetected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const failCountRef = useRef(0);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearSuspension = useCallback(() => setSuspensionDetected(false), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!marketId) {
      // No market — disconnect
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setStreamStatus("disconnected");
      useAppStore.setState({ streamStatus: "disconnected", isStreaming: false });
      prevStatusRef.current = null;
      failCountRef.current = 0;
      backoffRef.current = 1000;
      return;
    }

    function connect() {
      if (!mountedRef.current) return;

      // Close existing
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setStreamStatus("connecting");
      useAppStore.setState({ streamStatus: "connecting", isStreaming: false });

      const es = new EventSource(`/api/betfair/stream?marketId=${marketId}`);
      esRef.current = es;

      es.addEventListener("marketBook", (e) => {
        try {
          const book = JSON.parse(e.data) as SSEMarketBook;

          // Detect SUSPENDED → OPEN transition (game/set change)
          const currentStatus = book.status;
          if (
            prevStatusRef.current === "SUSPENDED" &&
            currentStatus === "OPEN"
          ) {
            setSuspensionDetected(true);
          }
          prevStatusRef.current = currentStatus;

          // Update store — existing UI works unchanged
          useAppStore.setState({ marketBook: book });
        } catch {
          // Malformed data
        }
      });

      es.addEventListener("status", (e) => {
        try {
          const status = JSON.parse(e.data) as SSEStatus;
          if (status.type === "connected" || status.type === "subscribed") {
            setStreamStatus("connected");
            useAppStore.setState({
              streamStatus: "connected",
              isStreaming: true,
            });
            // Reset backoff on successful connection
            failCountRef.current = 0;
            backoffRef.current = 1000;
          } else if (status.type === "reconnect") {
            // Server asking us to reconnect
            es.close();
            esRef.current = null;
            connect();
          } else if (status.type === "error") {
            es.close();
            esRef.current = null;
            handleFailure();
          }
        } catch {
          // Malformed data
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        handleFailure();
      };
    }

    function handleFailure() {
      failCountRef.current++;

      if (failCountRef.current >= 3) {
        // Fall back to polling
        setStreamStatus("fallback");
        useAppStore.setState({
          streamStatus: "fallback",
          isStreaming: false,
        });
        return;
      }

      // Exponential backoff reconnect
      setStreamStatus("connecting");
      useAppStore.setState({ streamStatus: "connecting", isStreaming: false });

      const delay = Math.min(backoffRef.current, 30_000);
      backoffRef.current = delay * 2;

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    }

    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStreamStatus("disconnected");
      useAppStore.setState({ streamStatus: "disconnected", isStreaming: false });
    };
  }, [marketId]);

  const isStreaming = streamStatus === "connected";

  return { streamStatus, isStreaming, suspensionDetected, clearSuspension };
}
