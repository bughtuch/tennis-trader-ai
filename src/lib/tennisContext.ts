/* ─── Tennis Context Helpers ─── */

/**
 * Infer playing surface from tournament name.
 * Falls back to provided surface, then "hard" as default.
 */
export function inferSurface(tournament: string | undefined, providedSurface: string | undefined): string {
  const t = (tournament ?? "").toLowerCase();

  // Clay tournaments
  if (
    t.includes("french open") || t.includes("roland garros") ||
    t.includes("monte carlo") || t.includes("rome") || t.includes("internazionali") ||
    t.includes("madrid") || t.includes("barcelona") || t.includes("hamburg") ||
    t.includes("buenos aires") || t.includes("rio") || t.includes("estoril") ||
    t.includes("lyon") || t.includes("bastad") || t.includes("gstaad") ||
    t.includes("umag") || t.includes("kitzbuhel") || t.includes("kitzbühel")
  ) return "clay";

  // Grass tournaments
  if (
    t.includes("wimbledon") ||
    t.includes("queen") || t.includes("halle") ||
    t.includes("eastbourne") || t.includes("s-hertogenbosch") ||
    t.includes("mallorca") || t.includes("stuttgart") && t.includes("grass")
  ) return "grass";

  // Known hard-court grand slams
  if (t.includes("australian open") || t.includes("us open")) return "hard";

  // Use provided surface if available
  if (providedSurface && providedSurface.toLowerCase() !== "unknown") {
    return providedSurface.toLowerCase();
  }

  return "hard";
}

/**
 * Get surface-specific trading context for AI prompts.
 */
export function getSurfaceContext(surface: string): string {
  switch (surface.toLowerCase()) {
    case "clay":
      return "Clay surface: longer rallies reduce pure serve dominance. Return-game pressure and physical endurance matter more. Breaks of serve are more common, so price swings on breaks are smaller. Favourites tend to grind out wins — lay opportunities come from slow starts, not momentum collapses.";
    case "grass":
      return "Grass surface: shorter points amplify serve dominance. Hold percentages are high, so breaks are rare and cause larger price moves. Tiebreaks are more likely — prepare for compressed odds late in sets. First-strike tennis matters; rallies are less common.";
    default:
      return "Hard court: balanced surface. Serve advantage exists but rallies still develop. Standard break/hold dynamics. Price movements follow serve-game patterns predictably.";
  }
}

/**
 * Shared guardrail rules appended to all AI system prompts.
 * Prevents generic financial language, team-sport references,
 * and surface mismatches.
 */
export const TENNIS_PROMPT_GUARDRAILS = `
STRICT RULES — violating these makes the output useless to the trader:
- NEVER mention "team news", "squad", "lineup", "formation", or any team-sport concept. Tennis is an individual sport with two players.
- NEVER use generic financial jargon like "market volatility", "portfolio diversification", "risk-reward ratio", "bull/bear", "P/E ratio". You are a Betfair exchange trader, not a stockbroker.
- NEVER reference a surface that doesn't match the tournament. If the tournament is French Open or Roland Garros, the surface is CLAY — never reference hard-court records.
- Use tennis exchange trading language: hold of serve, break of serve, second serve pressure, return games, tiebreak pressure, clay-court rallies, hard-court serve dominance, grass-court short points, momentum after break, price shortening, price drifting, favourite, underdog, exchange pressure, weight of money, ladder depth.
- Think in terms of individual player form, serve/return stats, surface-specific patterns, and scoreboard pressure — not team dynamics.`.trim();
