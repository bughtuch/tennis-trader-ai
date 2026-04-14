import { NextRequest } from "next/server";
import * as tls from "tls";
import type {
  StreamMessage,
  StreamMCM,
  StreamStatusMessage,
} from "@/lib/betfair-stream-types";
import {
  createMarketCache,
  applyMarketChange,
  toMarketBook,
} from "@/lib/betfair-delta-merger";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const STREAM_HOST = "stream-api.betfair.com";
const STREAM_PORT = 443;
const MAX_LIFETIME_MS = 280_000; // close before maxDuration
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(req: NextRequest) {
  const sessionToken =
    req.headers.get("x-betfair-token") ??
    req.cookies.get("betfair_session")?.value;
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appKey = process.env.BETFAIR_APP_KEY;
  if (!appKey) {
    return new Response(JSON.stringify({ error: "BETFAIR_APP_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const marketId = req.nextUrl.searchParams.get("marketId");
  if (!marketId) {
    return new Response(JSON.stringify({ error: "marketId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cache = createMarketCache();
  let buffer = "";

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream already closed
        }
      }

      function sendComment() {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream already closed
        }
      }

      // SSE heartbeat to prevent CDN/proxy timeouts
      const heartbeatTimer = setInterval(sendComment, HEARTBEAT_INTERVAL_MS);

      // Max lifetime timer — tell client to reconnect
      const lifetimeTimer = setTimeout(() => {
        send("status", { type: "reconnect", message: "Max lifetime reached" });
        cleanup();
      }, MAX_LIFETIME_MS);

      let socket: tls.TLSSocket | null = null;
      let authenticated = false;

      function cleanup() {
        clearInterval(heartbeatTimer);
        clearTimeout(lifetimeTimer);
        if (socket) {
          try { socket.destroy(); } catch { /* ignore */ }
          socket = null;
        }
        try { controller.close(); } catch { /* ignore */ }
      }

      function handleMessage(msg: StreamMessage) {
        if (msg.op === "connection") {
          // Send authentication
          const auth = JSON.stringify({
            op: "authentication",
            id: 1,
            session: sessionToken,
            appKey: appKey,
          });
          socket?.write(auth + "\r\n");
          return;
        }

        if (msg.op === "status") {
          const status = msg as StreamStatusMessage;
          if (status.id === 1) {
            // Auth response
            if (status.statusCode === "SUCCESS") {
              authenticated = true;
              // Send market subscription
              const sub = JSON.stringify({
                op: "marketSubscription",
                id: 2,
                marketFilter: { marketIds: [marketId] },
                marketDataFilter: {
                  fields: [
                    "EX_BEST_OFFERS",
                    "EX_TRADED",
                    "EX_MARKET_DEF",
                    "EX_LTP",
                  ],
                },
                conflateMs: 200,
              });
              socket?.write(sub + "\r\n");
              send("status", { type: "connected", message: "Authenticated" });
            } else {
              send("status", {
                type: "error",
                message: status.errorMessage ?? "Auth failed",
              });
              cleanup();
            }
          } else if (status.id === 2 && status.statusCode === "SUCCESS") {
            send("status", { type: "subscribed", message: "Subscribed to market" });
          }
          return;
        }

        if (msg.op === "mcm") {
          const mcm = msg as StreamMCM;
          if (mcm.mc) {
            for (const mc of mcm.mc) {
              applyMarketChange(cache, mc);
            }
            const book = toMarketBook(cache, marketId!);
            send("marketBook", book);
          }
          return;
        }
      }

      // Connect to Betfair streaming API
      try {
        socket = tls.connect(
          {
            host: STREAM_HOST,
            port: STREAM_PORT,
          },
          () => {
            // TLS connected, wait for connection message
          },
        );

        socket.setEncoding("utf8");

        socket.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\r\n");
          buffer = lines.pop() ?? ""; // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line) as StreamMessage;
              handleMessage(msg);
            } catch {
              // Malformed JSON, skip
            }
          }
        });

        socket.on("error", (err) => {
          send("status", {
            type: "error",
            message: `Socket error: ${err.message}`,
          });
          cleanup();
        });

        socket.on("close", () => {
          if (authenticated) {
            send("status", { type: "reconnect", message: "Connection closed" });
          }
          cleanup();
        });

        // Handle client disconnect
        req.signal.addEventListener("abort", () => {
          cleanup();
        });
      } catch (err) {
        send("status", {
          type: "error",
          message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
