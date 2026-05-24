# Pro Trader View — Technical Implementation Handoff

**Purpose:** Enable another Claude Code session working on the US ProphetX repo to recreate/port the Pro Trader View safely WITHOUT copying Betfair-specific infrastructure.

**UK Route:** `/classic-trading` (renamed to "Pro Trader View" in UI)

---

## 1. Files Created/Modified

### New Files (all created from scratch)

| File | Purpose |
|------|---------|
| `src/app/classic-trading/page.tsx` | Page orchestrator — all state, handlers, layout |
| `src/components/classic/ClassicLadder.tsx` | Single-runner price ladder (used 2x) |
| `src/components/classic/ClassicPositionPanel.tsx` | Positions, orders, green-up, session stats |
| `src/components/classic/ClassicAIPanel.tsx` | AI signals, guardian, market info sidebar |
| `src/components/classic/ClassicHedgePreview.tsx` | Deterministic hedge math + AI explanation |
| `src/components/classic/ClassicLiabilityTools.tsx` | Liability reduction math + UI (25/50/75/100%) |

### Modified Files (minimal changes)

| File | Change |
|------|--------|
| `src/app/trading/page.tsx` | Added "Pro Trader View" button in market status bar |

---

## 2. Component Hierarchy

```
ClassicTradingPageWrapper (Suspense boundary)
└── ClassicTradingPage (orchestrator)
    ├── RealTradeConfirmModal (Safe Mode confirmation gate)
    ├── <header> (market info + stake controls)
    ├── tradeControlsStrip (GREEN + LIABILITY buttons inline)
    ├── ClassicLadder (Player 1)
    ├── ClassicLadder (Player 2)
    ├── ClassicPositionPanel
    │   ├── ClassicHedgePreview (Player 1)
    │   ├── ClassicHedgePreview (Player 2)
    │   ├── ClassicLiabilityTools (Player 1)
    │   └── ClassicLiabilityTools (Player 2)
    └── ClassicAIPanel
```

---

## 3. Route/Page Structure

**URL:** `/classic-trading?marketId=<id>&p1=<name>&p2=<name>&p1Flag=<emoji>&p2Flag=<emoji>&tournament=<name>`

All params passed via URL search params. Page reads them with `useSearchParams()`.

**Subscription gate:** Redirects to `/paper` with same params if subscription is not active.

**View switching:**
- `/trading` has a "Pro Trader View" button linking to `/classic-trading?${searchParams}`
- `/classic-trading` has a "Modern" link back to `/trading?${searchParams}`

---

## 4. State & Data Dependencies

### Store (Zustand — `useAppStore`)

| Field | Used For |
|-------|----------|
| `marketBook` | Live runner prices, market status, total matched |
| `placeTrade(params)` | Execute order on exchange |
| `cancelOrder(params)` | Cancel unmatched orders |
| `fetchMarketBook(ids)` | Polling fallback for prices |
| `fetchUnmatchedOrders(marketId)` | Poll open orders |
| `unmatchedOrders` | Current unmatched order list |
| `tradeLoading` | Loading state during trade execution |
| `tradeError` / `lastTradeSuccess` | Trade result messages |
| `addPendingOrder(order)` | Track in-play delay orders |
| `subscriptionStatus` / `subscriptionLoaded` | Gate access |

### Hooks

| Hook | Purpose |
|------|---------|
| `useBetfairToken()` | Returns `{ isConnected }` — auth state |
| `useBetfairStream(marketId)` | Returns `{ streamStatus, isStreaming }` — WebSocket prices |

### Supabase (direct)

| Table | Usage |
|-------|-------|
| `trades` | Read closed trades for session history; write on green-up close |

### API Routes Called

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai-signals` | POST | Fetch AI trading signal |
| `/api/ai-guardian` | POST | Fetch AI risk assessment |
| `/api/ai/coach` | POST | Fetch AI hedge explanation (from ClassicHedgePreview) |

---

## 5. UI-Only vs Execution-Aware Components

| Component | Classification | Why |
|-----------|---------------|-----|
| `ClassicLadder` | **Execution-aware** | `onTrade(price, side)` callback triggers trade |
| `ClassicPositionPanel` | **Execution-aware** | `onGreenUp`, `onCancelOrder`, `onCancelAll`, `onReduceLiability` callbacks |
| `ClassicLiabilityTools` | **Execution-aware** | `onExecute(side, price, stake)` directly places trade |
| `ClassicHedgePreview` | **UI-only** | Shows hedge math + AI explanation; does NOT execute |
| `ClassicAIPanel` | **UI-only** | Fetches and displays AI data; no trade execution |

---

## 6. Hedge System Architecture

### Green-Up (equalizes P&L across both outcomes)

**Math function:** `calculateGreenUp(entryPrice, entryStake, entrySide, currentPrice)` from `tradingMaths.ts`

```
greenUpStake = (entryStake × entryPrice) / currentPrice
greenUpSide = opposite of entrySide
profitIfWin = entryStake × (entryPrice - 1) - greenUpStake × (currentPrice - 1)  [BACK entry]
profitIfLose = greenUpStake - entryStake  [BACK entry]
equalProfit = (profitIfWin + profitIfLose) / 2
```

**Execution flow:**
1. Page computes `p1GreenUp` / `p2GreenUp` using aggregated position per runner
2. User clicks GREEN button → `handleGreenUp(runner)`
3. Handler calls `execAction({ actionName: "GREEN_UP", ... })`
4. On success: iterates runner positions, calls `closeTradeAsGreenUp()` to update Supabase

### Hedge Preview (display-only, separate from green-up)

**Math function:** `calculateHedge(agg, backPrice, layPrice)` in `ClassicHedgePreview.tsx`

```
hedgeSide = opposite of netSide
hedgePrice = layPrice (if hedging BACK) or backPrice (if hedging LAY)
hedgeStake = (netStake × avgEntry) / hedgePrice
hedgeType = "green" if equalProfit > 0.01, "red" if < -0.01, else "scratch"
```

**AI explanation:** Fetches `/api/ai/coach` with position context on first expand.

---

## 7. Liability System Architecture

### `calculateLiabilityReduction(agg, backPrice, layPrice, percentage)`

**Exported from:** `ClassicLiabilityTools.tsx`

**Concept:** Unlike hedge (which equalizes both outcomes), liability reduction removes ONLY downside exposure while keeping upside running.

**BACK position** (liability = stake lost if player loses):
```
tradeSide = "LAY"
tradeStake = netStake × (percentage / 100)
remainingLiability = currentLiability × (1 - pct)
remainingUpside = upside - tradeStake × (layPrice - 1)
isFreeBet = (percentage === 100) && (remainingUpside > 0)
```

**LAY position** (liability = stake × (price-1) lost if player wins):
```
tradeSide = "BACK"
tradeStake = (currentLiability × pct) / (backPrice - 1)
remainingLiability = currentLiability × (1 - pct)
remainingUpside = netStake - tradeStake
isFreeBet = (percentage === 100) && (remainingUpside > 0)
```

**Execution flow:**
1. User selects percentage (25/50/75/100) in ClassicLiabilityTools
2. Clicks execute → `onExecute(side, price, stake)` bubbles up
3. Page's `handleReduceLiability` calls `execAction({ actionName: "PLACE_TRADE", ... })`
4. On success: adds to `livePositions`

**Also in Trade Controls strip:** Page-level liability buttons call `calculateLiabilityReduction` directly and execute via `handleReduceLiability`.

---

## 8. AI Hedge Preview Flow

```
User expands ClassicHedgePreview
  → calculateHedge() computes deterministic hedge math
  → Auto-fetches POST /api/ai/coach with:
      { side, entry_price, exit_price, stake, pnl, player, greened_up, market_context }
  → market_context contains full position + hedge description
  → Returns: { success: true, insight: "25-word coaching text" }
  → Displayed in AI ANALYSIS section
```

**Important:** The AI does NOT influence the math. It only explains what the deterministic calculation already shows.

---

## 9. Ladder Structure & Sizing

### Data Generation

```typescript
TICKS_EACH_SIDE = 8  // → 17 total rows (8 + center + 8)
centerPrice = roundToTick(midpoint of bestBack and bestLay)
// Loop: moveByTicks(center, -8) through moveByTicks(center, +8)
```

**Fallback:** When no `runner.ex` data, builds ladder from `playerOdds` prop.

### Row Structure

Each row = 3-column grid: `[BACK | PRICE | LAY]`

| Property | Value |
|----------|-------|
| Row height | `36px` (inline style) |
| Font size (amounts) | `text-sm` (14px) |
| Font size (price) | `text-sm font-bold` (14px) |
| Cell padding | `pr-3` (back), `pl-3` (lay) |
| Depth bar | Proportional width based on `size / maxSize` |
| Best back | `bg-blue-200` with blue-900 text |
| Best lay | `bg-pink-200` with pink-900 text |
| Last traded | `bg-green-100` with ring-green-300 |
| Unmatched dot | `w-1.5 h-1.5 rounded-full bg-amber-500` |

### Header

- Player name (truncated), net position badge, current odds (`text-xl font-bold font-mono`), unrealised P&L

### Footer

- IN-PLAY / PRE-MATCH status, current stake display

---

## 10. Responsive Layout Behavior

### XL (≥1280px) — Wide Desktop
```
[AI 200px] [Ladder P1 flex-1] [Ladder P2 flex-1] [Positions 260px]
```
- Trade Controls Strip above ladders, full width
- Sidebars `self-start` (pin to top)
- Keyboard shortcuts bar fixed at bottom

### LG (1024-1279px) — Mid Desktop / Laptop
```
[Trade Controls Strip — full width]
[Ladder P1 | Ladder P2]  (grid-cols-2)
[AI Panel  | Positions]  (grid-cols-2)
```

### <1024px — Tablet/Mobile
```
[Tab bar: Ladders | Positions | AI]
Selected tab content below
```
- Ladders tab: Trade Controls Strip + grid-cols-1 (mobile) / grid-cols-2 (sm+)
- Positions/AI tabs: centered max-w-600px

### Spacing
- `pt-14` on main (accounts for fixed global navbar h-14)
- `h-12` spacer between navbar and market header
- Sticky market header at `top-14` (below global nav)
- `pt-4` on content sections below sticky header

---

## 11. View Switching

| From | To | Mechanism |
|------|-----|-----------|
| `/trading` | `/classic-trading` | Link button "Pro Trader View" with `searchParams.toString()` |
| `/classic-trading` | `/trading` | Link button "Modern →" with `searchParams.toString()` |

All URL params preserved: `marketId`, `p1`, `p2`, `p1Flag`, `p2Flag`, `tournament`

---

## 12. Betfair-Specific Dependencies (DO NOT PORT)

These are tightly coupled to Betfair Exchange and must be replaced with ProphetX equivalents:

| Dependency | What It Does | ProphetX Equivalent Needed |
|-----------|--------------|---------------------------|
| `useBetfairToken()` | Auth session check | ProphetX auth hook |
| `useBetfairStream(marketId)` | WebSocket price streaming | ProphetX WebSocket/SSE |
| `useAppStore.placeTrade()` | POST to Betfair API via `/api/betfair/trade` | ProphetX order API |
| `useAppStore.cancelOrder()` | Cancel on Betfair | ProphetX cancel API |
| `useAppStore.fetchMarketBook()` | Poll Betfair prices | ProphetX market data |
| `useAppStore.fetchUnmatchedOrders()` | Poll Betfair orders | ProphetX open orders |
| `PendingOrder` + 5s delay | Betfair in-play bet delay | May not apply to ProphetX |
| TICK_TABLE in `tradingMaths.ts` | Betfair's exact price increments | ProphetX price increments |
| `BetfairRunner.selectionId` | Numeric runner identifier | ProphetX runner/outcome ID |
| `BetfairRunner.ex.availableToBack/Lay` | Depth-of-book arrays | ProphetX order book |
| Subscription gate → `/paper` | UK subscription model | ProphetX access model |
| `/api/betfair/trade` route | Server-side Betfair proxy | ProphetX trade route |
| `betfair_session` cookie | Auth token transport | ProphetX auth transport |

---

## 13. Deterministic Math Functions (SAFE TO PORT)

These contain zero exchange-specific logic. Pure arithmetic:

| Function | Location | Portable? |
|----------|----------|-----------|
| `calculateGreenUp()` | `tradingMaths.ts` | YES — universal exchange math |
| `calculateLiability()` | `tradingMaths.ts` | YES — `(price-1)*stake` for lay |
| `calculateLiabilityReduction()` | `ClassicLiabilityTools.tsx` | YES — pure position math |
| `calculateHedge()` | `ClassicHedgePreview.tsx` | YES — deterministic hedge calc |
| `calculatePosition()` | `tradingMaths.ts` | YES — mark-to-market |
| `calculateOptimisedGreenUp()` | `tradingMaths.ts` | YES — weighted profit |
| `r2()` | multiple files | YES — `Math.round(v * 100) / 100` |

### Requires adaptation:

| Function | Location | Why |
|----------|----------|-----|
| `roundToTick()` | `tradingMaths.ts` | Uses Betfair TICK_TABLE; ProphetX has different increments |
| `moveByTicks()` | `tradingMaths.ts` | Same — depends on TICK_TABLE |
| `getTickIncrement()` | `tradingMaths.ts` | Same |

---

## 14. Handlers That Call Execution Logic

| Handler | In File | Calls |
|---------|---------|-------|
| `handleTradeClick` | page.tsx | `execAction({ actionName: "PLACE_TRADE" })` → `store.placeTrade()` |
| `executeConfirmedRealTrade` | page.tsx | Same (after Safe Mode confirmation) |
| `handleGreenUp` | page.tsx | `execAction({ actionName: "GREEN_UP" })` → `store.placeTrade()` |
| `handleReduceLiability` | page.tsx | `execAction({ actionName: "PLACE_TRADE" })` → `store.placeTrade()` |
| Keyboard `B`/`L` | page.tsx | `execAction({ actionName: "KEYBOARD_TRADE" })` |
| Keyboard `G` | page.tsx | `execAction({ actionName: "KEYBOARD_GREEN_UP" })` |
| Keyboard `C` | page.tsx | `store.cancelOrder({ marketId })` |

All execution goes through `validateAndExecute()` which validates params client-side before calling the store method.

---

## 15. Market Structure Assumptions

- **2-runner market** — Tennis match = exactly 2 runners (player 1 vs player 2)
- `marketBook.runners[0]` = Player 1, `marketBook.runners[1]` = Player 2
- Each runner has a unique `selectionId` (numeric)
- Positions tracked per-runner via `selection_id` field matching `String(selectionId)`
- Outcome P&L calculated as: if P1 wins, all P1 BACK positions profit and P2 BACK positions lose (and vice versa)
- Market has two states that matter: `inplay` (live, with bet delay) and pre-match (instant execution)
- Market can be `SUSPENDED` (no trading allowed) or `CLOSED`

**For ProphetX:** If the US product supports different market structures (e.g., multi-runner, moneyline, spreads), the position aggregation and outcome P&L logic needs generalization.

---

## 16. Shared Utilities Reused

| Utility | From | Used By |
|---------|------|---------|
| `calculateGreenUp` | `@/lib/tradingMaths` | page.tsx (green-up calcs) |
| `calculateLiability` | `@/lib/tradingMaths` | ClassicPositionPanel (unmatched order display) |
| `roundToTick` | `@/lib/tradingMaths` | ClassicLadder (price grid building) |
| `moveByTicks` | `@/lib/tradingMaths` | ClassicLadder (ladder range) |
| `validateAndExecute` | `@/lib/tradeActions` | page.tsx (all execution) |
| `createClient` | `@/lib/supabase` | page.tsx (trade history read/write) |
| `useAppStore` | `@/lib/store` | page.tsx (all store access) |
| `useBetfairToken` | `@/hooks/useBetfairToken` | page.tsx (connection state) |
| `useBetfairStream` | `@/hooks/useBetfairStream` | page.tsx (WebSocket prices) |
| `RealTradeConfirmModal` | `@/components/RealTradeConfirmModal` | page.tsx (Safe Mode) |

---

## 17. Styling & Layout Principles

### Design System

- **Light mode only** (unlike /trading which is dark)
- Background: `bg-gray-100` (page), `bg-white` (cards/panels)
- Text: `text-gray-900` primary, `text-gray-500` secondary
- Borders: `border-gray-200` / `border-gray-300`
- Back cells: blue spectrum (`bg-blue-50` → `bg-blue-200`)
- Lay cells: pink spectrum (`bg-pink-50` → `bg-pink-200`)
- Green-up: `bg-emerald-500 text-white` (solid)
- Liability: `bg-amber-50 text-amber-700 border-amber-300`
- Free Bet: `bg-emerald-500 text-white` (same as green)
- Disabled states: muted versions of the active color (not generic gray)

### Typography

- Prices/amounts: `font-mono` always
- Headers: `text-[10px] font-bold tracking-wider uppercase`
- Ladder cells: `text-sm font-mono`
- Panel body: `text-xs` / `text-[11px]`

### Component Boundaries

- Cards: `border border-gray-300 rounded-lg overflow-hidden`
- Sections within cards: `p-3` padding, `divide-y divide-gray-100` between sections
- Buttons: `rounded-lg` with appropriate padding per size context

---

## 18. Remaining TODOs / Testing Concerns

### Known Gaps

1. **No automated tests** — All classic components lack unit/integration tests
2. **No E2E tests** — No Playwright/Cypress coverage for the Pro Trader flow
3. **Position reconciliation is client-side** — If the page reloads, `livePositions` is lost (relies on Supabase `trades` table + unmatched order polling to rebuild)
4. **No WebSocket reconnection UI** — If stream drops, falls back to 2s polling silently
5. **Safe Mode bypassed by keyboard shortcuts** — Keyboard B/L/G respect Safe Mode, but liability reduction buttons do NOT show a confirmation modal
6. **Liability reduction on strip uses first runner with position** — If both runners have positions, only the first one's liability buttons work in the strip (the panel-level tools handle both)
7. **AI Coach latency** — Hedge Preview AI explanation fetch has no timeout/retry
8. **Session P&L resets on page refresh** — `tradeHistory` is fetched from Supabase but only includes trades with this `market_id`

### Testing Priorities for Port

1. Verify ladder builds correctly from market book data (17 rows, centered)
2. Verify green-up math matches expected equal-profit calculation
3. Verify liability reduction at 100% produces a valid free bet (remaining liability = 0, upside > 0)
4. Verify keyboard shortcuts only fire when not in an input field
5. Verify Safe Mode blocks execution and shows confirmation modal
6. Verify position aggregation handles multiple BACK + LAY positions on same runner
7. Verify outcome P&L correctly accounts for positions on both runners
8. Verify responsive breakpoints don't clip or overflow content

---

## Porting Checklist for ProphetX

- [ ] Create ProphetX equivalents for: auth hook, stream hook, store (placeTrade/cancelOrder/marketBook)
- [ ] Map ProphetX price increment system (replace TICK_TABLE)
- [ ] Map ProphetX runner/outcome identifiers (replace selectionId)
- [ ] Map ProphetX order book format (replace BetfairRunner.ex)
- [ ] Decide on bet delay behavior (Betfair has 5s in-play; does ProphetX?)
- [ ] Decide on subscription/access gating model
- [ ] Port all 6 classic components (no Betfair imports needed in them except ClassicLadder which uses `roundToTick`/`moveByTicks`)
- [ ] Port `calculateGreenUp`, `calculateLiability`, `calculatePosition` directly
- [ ] Create ProphetX-specific `roundToTick`/`moveByTicks` with correct price ladder
- [ ] Port `validateAndExecute` with ProphetX validation rules
- [ ] Wire AI endpoints (same interface, different backend if needed)
- [ ] Add `pt-{navbar-height}` to page for fixed nav offset (currently h-14 = 56px)
