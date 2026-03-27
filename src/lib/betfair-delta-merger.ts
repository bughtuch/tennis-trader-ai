import type {
  MarketChange,
  RunnerChange,
  MarketDefinition,
  PriceSizeTuple,
  SSEMarketBook,
  SSERunner,
} from "./betfair-stream-types";

/* ─── Internal cache types ─── */

interface PriceSizeMap {
  [price: number]: number; // price → size
}

interface RunnerCache {
  id: number;
  atb: PriceSizeMap; // available to back
  atl: PriceSizeMap; // available to lay
  trd: PriceSizeMap; // traded volume
  ltp?: number;
  tv?: number;
}

export interface MarketCache {
  runners: Map<number, RunnerCache>;
  marketDefinition?: MarketDefinition;
  tv?: number; // total market volume
}

/* ─── Helpers ─── */

function applyPriceDeltas(map: PriceSizeMap, deltas: PriceSizeTuple[]): void {
  for (const [price, size] of deltas) {
    if (size === 0) {
      delete map[price];
    } else {
      map[price] = size;
    }
  }
}

function mapToSorted(
  map: PriceSizeMap,
  descending: boolean,
  limit: number = 10,
): { price: number; size: number }[] {
  const entries = Object.entries(map).map(([p, s]) => ({
    price: Number(p),
    size: s,
  }));
  entries.sort((a, b) =>
    descending ? b.price - a.price : a.price - b.price,
  );
  return entries.slice(0, limit);
}

/* ─── Core functions ─── */

export function createMarketCache(): MarketCache {
  return { runners: new Map() };
}

function getOrCreateRunner(cache: MarketCache, id: number): RunnerCache {
  let runner = cache.runners.get(id);
  if (!runner) {
    runner = { id, atb: {}, atl: {}, trd: {} };
    cache.runners.set(id, runner);
  }
  return runner;
}

/**
 * Apply a MarketChange (image or delta) to the cache. Mutates cache in place.
 */
export function applyMarketChange(
  cache: MarketCache,
  mc: MarketChange,
): void {
  // Full image: reset all runners
  if (mc.img) {
    cache.runners = new Map();
  }

  if (mc.marketDefinition) {
    cache.marketDefinition = mc.marketDefinition;
  }

  if (mc.tv !== undefined) {
    cache.tv = mc.tv;
  }

  if (mc.rc) {
    for (const rc of mc.rc) {
      applyRunnerChange(cache, rc);
    }
  }
}

function applyRunnerChange(cache: MarketCache, rc: RunnerChange): void {
  const runner = getOrCreateRunner(cache, rc.id);

  if (rc.atb) applyPriceDeltas(runner.atb, rc.atb);
  if (rc.atl) applyPriceDeltas(runner.atl, rc.atl);
  if (rc.trd) applyPriceDeltas(runner.trd, rc.trd);
  if (rc.ltp !== undefined) runner.ltp = rc.ltp;
  if (rc.tv !== undefined) runner.tv = rc.tv;
}

/**
 * Convert internal cache to the MarketBook shape used by the existing UI.
 */
export function toMarketBook(
  cache: MarketCache,
  marketId: string,
): SSEMarketBook {
  const md = cache.marketDefinition;
  const runners: SSERunner[] = [];

  // Build runner list in order from market definition if available
  const runnerDefs = md?.runners ?? [];
  const orderedIds =
    runnerDefs.length > 0
      ? runnerDefs
          .slice()
          .sort((a, b) => a.sortPriority - b.sortPriority)
          .map((r) => r.id)
      : Array.from(cache.runners.keys());

  for (const id of orderedIds) {
    const rc = cache.runners.get(id);
    const rd = runnerDefs.find((r) => r.id === id);

    runners.push({
      selectionId: id,
      runnerName: rd?.name ?? `Runner ${id}`,
      status: rd?.status,
      ex: {
        availableToBack: rc
          ? mapToSorted(rc.atb, true)
          : [],
        availableToLay: rc
          ? mapToSorted(rc.atl, false)
          : [],
        tradedVolume: rc
          ? mapToSorted(rc.trd, true, 100)
          : [],
      },
      lastTradedPrice: rc?.ltp,
    });
  }

  return {
    marketId,
    status: md?.status ?? "UNKNOWN",
    totalMatched: cache.tv ?? 0,
    inplay: md?.inPlay ?? false,
    runners,
  };
}
