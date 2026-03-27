/* ─── Betfair Streaming API Types ─── */

// Outbound messages (client → Betfair)
export interface StreamAuthMessage {
  op: "authentication";
  id: number;
  session: string;
  appKey: string;
}

export interface StreamMarketSubscription {
  op: "marketSubscription";
  id: number;
  marketFilter: { marketIds: string[] };
  marketDataFilter: {
    fields: string[];
  };
  conflateMs?: number;
}

// Inbound messages (Betfair → client)
export interface StreamConnectionMessage {
  op: "connection";
  connectionId: string;
}

export interface StreamStatusMessage {
  op: "status";
  id?: number;
  statusCode: string;
  errorMessage?: string;
  errorCode?: string;
  connectionClosed?: boolean;
  connectionsAvailable?: number;
}

export interface RunnerDefinition {
  id: number;
  sortPriority: number;
  status: string;
  name?: string;
}

export interface MarketDefinition {
  status: string;
  inPlay: boolean;
  version: number;
  runners?: RunnerDefinition[];
  marketType?: string;
  eventId?: string;
}

// [price, size] tuple
export type PriceSizeTuple = [number, number];

export interface RunnerChange {
  id: number;
  atb?: PriceSizeTuple[]; // available to back
  atl?: PriceSizeTuple[]; // available to lay
  trd?: PriceSizeTuple[]; // traded volume
  ltp?: number; // last traded price
  tv?: number; // total volume
  spn?: number; // starting price near
  spf?: number; // starting price far
}

export interface MarketChange {
  id: string; // market ID
  img?: boolean; // true = full image, false/absent = delta
  rc?: RunnerChange[];
  marketDefinition?: MarketDefinition;
  tv?: number; // total volume
  con?: boolean; // conflated
}

export interface StreamMCM {
  op: "mcm";
  id?: number;
  ct: "SUB_IMAGE" | "RESUB_DELTA" | "HEARTBEAT";
  clk?: string;
  initialClk?: string;
  mc?: MarketChange[];
  pt: number; // publish time
  conflateMs?: number;
}

export type StreamMessage =
  | StreamConnectionMessage
  | StreamStatusMessage
  | StreamMCM;

// SSE event payloads sent to the browser
export interface SSEMarketBook {
  marketId: string;
  status: string;
  totalMatched: number;
  inplay: boolean;
  runners: SSERunner[];
}

export interface SSERunner {
  selectionId: number;
  runnerName: string;
  status?: string;
  ex: {
    availableToBack: { price: number; size: number }[];
    availableToLay: { price: number; size: number }[];
    tradedVolume: { price: number; size: number }[];
  };
  lastTradedPrice?: number;
}

export interface SSEStatus {
  type: "connected" | "reconnect" | "error" | "subscribed";
  message?: string;
}
