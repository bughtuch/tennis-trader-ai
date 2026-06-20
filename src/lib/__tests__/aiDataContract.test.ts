/* ─── AI Trust Architecture Test Cases (Stage 10) ─── */

import {
  buildDataContract,
  buildPromptRestrictions,
  buildFactPanel,
  getSourcesUsed,
  getSourcesNotUsed,
  selfCheckOutput,
} from "../aiDataContract";

/* ─── Test Runner ─── */

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

/* ─── Test 1: Verified ATP clay match ─── */
function test1_verifiedAtpClay(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Carlos Alcaraz",
      player2: "Jannik Sinner",
      tournament: "Roland Garros",
      surface: "clay",
      surfaceVerified: true,
      odds1: 1.85,
      odds2: 2.1,
      matchStatus: "pre_match",
    });

    assert(contract.surface.status === "verified", "Surface should be verified for Roland Garros");
    assert(contract.dataConfidence === "HIGH", `Data confidence should be HIGH, got ${contract.dataConfidence}`);
    assert(contract.playerOne.status === "verified", "Player should be verified");

    const restrictions = buildPromptRestrictions(contract);
    assert(restrictions.canMentionSurface === true, "Should be able to mention surface");
    assert(restrictions.canMentionOpeningOdds === false, "Should NOT mention opening odds");
    assert(restrictions.canClaimPlayerStats === false, "Should NOT claim player stats");
    assert(restrictions.canProjectSetPrices === false, "Should NOT project set prices");

    const factPanel = buildFactPanel(contract);
    assert(factPanel.surface === "clay", "Fact panel surface should be clay");
    assert(factPanel.surfaceVerified === true, "Surface should be marked verified");
    assert(factPanel.dataConfidence === "HIGH", "Fact panel confidence should be HIGH");

    details.push("Surface verified: PASS");
    details.push("Data confidence HIGH: PASS");
    details.push("Can mention surface: PASS");
    details.push("Cannot claim player stats: PASS");
    details.push("Cannot project set prices: PASS");
    return { name: "Test 1: Verified ATP clay match", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 1: Verified ATP clay match", passed: false, details };
  }
}

/* ─── Test 2: Verified WTA hard-court match ─── */
function test2_verifiedWtaHard(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Iga Swiatek",
      player2: "Aryna Sabalenka",
      tournament: "Australian Open",
      surface: "hard",
      surfaceVerified: true,
      odds1: 2.3,
      odds2: 1.7,
      matchStatus: "pre_match",
    });

    assert(contract.surface.status === "verified", "Surface verified for AO");
    assert(contract.dataConfidence === "HIGH", "Confidence HIGH");

    details.push("Surface verified: PASS");
    details.push("Data confidence HIGH: PASS");
    return { name: "Test 2: Verified WTA hard-court match", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 2: Verified WTA hard-court match", passed: false, details };
  }
}

/* ─── Test 3: Challenger with unknown surface ─── */
function test3_challengerUnknownSurface(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Unknown Player A",
      player2: "Unknown Player B",
      tournament: "Challenger Braunschweig",
      surface: "hard",
      surfaceVerified: false,
      odds1: 1.5,
      odds2: 2.8,
      matchStatus: "pre_match",
    });

    assert(contract.surface.status === "unverified", "Surface should be unverified");
    assert(contract.dataConfidence === "MEDIUM", `Confidence should be MEDIUM, got ${contract.dataConfidence}`);

    const restrictions = buildPromptRestrictions(contract);
    assert(restrictions.canMentionSurface === false, "Should NOT mention surface");
    assert(restrictions.bannedTopics.some(t => t.includes("SURFACE")), "Should have surface ban");

    details.push("Surface unverified: PASS");
    details.push("Data confidence MEDIUM: PASS");
    details.push("Cannot mention surface: PASS");
    return { name: "Test 3: Challenger unknown surface", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 3: Challenger unknown surface", passed: false, details };
  }
}

/* ─── Test 4: Match with no score available ─── */
function test4_noScoreAvailable(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Player A",
      player2: "Player B",
      tournament: "Wimbledon",
      surface: "grass",
      surfaceVerified: true,
      odds1: 1.3,
      odds2: 4.0,
      scoreConfidence: "unavailable",
      matchStatus: "in_play",
    });

    assert(contract.currentScore.status === "missing", "Score should be missing");
    assert(contract.dataConfidence === "LOW", `Confidence should be LOW for in-play without score, got ${contract.dataConfidence}`);

    const restrictions = buildPromptRestrictions(contract);
    assert(restrictions.canMentionScore === false, "Should NOT mention score");
    assert(restrictions.canProvideDetailedAnalysis === false, "Should NOT provide trade advice");
    assert(restrictions.restrictedMode === true, "Should be in restricted mode");

    details.push("Score missing: PASS");
    details.push("Data confidence LOW: PASS");
    details.push("Restricted mode: PASS");
    return { name: "Test 4: No score available (in-play)", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 4: No score available (in-play)", passed: false, details };
  }
}

/* ─── Test 5: In-play with verified score ─── */
function test5_inPlayVerifiedScore(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Djokovic",
      player2: "Nadal",
      tournament: "Roland Garros",
      surface: "clay",
      surfaceVerified: true,
      odds1: 1.42,
      odds2: 3.1,
      score: "6-4, 2-1",
      server: "Djokovic",
      scoreConfidence: "reliable",
      isScoreStale: false,
      matchStatus: "in_play",
    });

    assert(contract.currentScore.status === "verified", "Score should be verified");
    assert(contract.dataConfidence === "HIGH", "Confidence should be HIGH");

    const restrictions = buildPromptRestrictions(contract);
    assert(restrictions.canMentionScore === true, "Should be able to mention score");
    assert(restrictions.canProvideDetailedAnalysis === true, "Should be able to provide trade advice");

    details.push("Score verified: PASS");
    details.push("Data confidence HIGH: PASS");
    details.push("Can mention score: PASS");
    return { name: "Test 5: In-play verified score", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 5: In-play verified score", passed: false, details };
  }
}

/* ─── Test 6: Pre-match with no opening odds ─── */
function test6_noOpeningOdds(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Player A",
      player2: "Player B",
      tournament: "Monte Carlo",
      surface: "clay",
      surfaceVerified: true,
      odds1: 1.8,
      odds2: 2.2,
      matchStatus: "pre_match",
    });

    assert(contract.openingOddsPlayerOne.status === "missing", "Opening odds should be missing");

    const restrictions = buildPromptRestrictions(contract);
    assert(restrictions.canMentionOpeningOdds === false, "Should NOT mention opening odds");
    assert(restrictions.bannedTopics.some(t => t.includes("OPENING ODDS")), "Should have opening odds ban");

    details.push("Opening odds missing: PASS");
    details.push("Cannot mention opening odds: PASS");
    return { name: "Test 6: Pre-match no opening odds", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 6: Pre-match no opening odds", passed: false, details };
  }
}

/* ─── Test 7: Match with only current odds ─── */
function test7_onlyCurrentOdds(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Player A",
      player2: "Player B",
      odds1: 1.5,
      odds2: 2.8,
      matchStatus: "pre_match",
    });

    assert(contract.tournament.status === "missing", "Tournament missing");
    assert(contract.surface.status === "missing", "Surface missing");
    assert(contract.currentOddsPlayerOne.status === "verified", "Current odds verified");
    assert(contract.dataConfidence === "LOW", `Confidence LOW without surface for pre-match, got ${contract.dataConfidence}`);

    details.push("Tournament missing: PASS");
    details.push("Current odds verified: PASS");
    details.push("Data confidence LOW: PASS");
    return { name: "Test 7: Only current odds", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 7: Only current odds", passed: false, details };
  }
}

/* ─── Test 8: Ambiguous player names ─── */
function test8_ambiguousPlayers(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "",
      player2: "Player B",
      odds1: 2.0,
      odds2: 2.0,
      matchStatus: "in_play",
    });

    assert(contract.playerOne.status === "missing", "Player 1 should be missing");
    assert(contract.dataConfidence === "LOW", "Confidence LOW with missing player");

    details.push("Missing player detected: PASS");
    details.push("Data confidence LOW: PASS");
    return { name: "Test 8: Ambiguous player names", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 8: Ambiguous player names", passed: false, details };
  }
}

/* ─── Test 9: No traded volume ─── */
function test9_noTradedVolume(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Player A",
      player2: "Player B",
      tournament: "Wimbledon",
      surface: "grass",
      surfaceVerified: true,
      odds1: 1.6,
      odds2: 2.5,
      matchStatus: "pre_match",
    });

    assert(contract.tradedVolume.status === "missing", "Traded volume should be missing");

    const sources = getSourcesUsed(contract);
    const notUsed = getSourcesNotUsed();
    assert(!sources.includes("Traded volume"), "Sources used should not include traded volume");
    assert(notUsed.length > 0, "Sources not used should be populated");

    details.push("Traded volume missing: PASS");
    details.push("Sources transparency correct: PASS");
    return { name: "Test 9: No traded volume", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 9: No traded volume", passed: false, details };
  }
}

/* ─── Test 10: Self-check output ─── */
function test10_selfCheck(): TestResult {
  const details: string[] = [];
  try {
    const contract = buildDataContract({
      player1: "Player A",
      player2: "Player B",
      tournament: "Unknown Tournament",
      surface: "hard",
      surfaceVerified: false,
      odds1: 1.5,
      odds2: 2.8,
      matchStatus: "pre_match",
    });

    const restrictions = buildPromptRestrictions(contract);

    // Test banned phrase removal
    const input1 = "The market shows perfect equilibrium with favourite heavily compressed.";
    const cleaned1 = selfCheckOutput(input1, restrictions);
    assert(!cleaned1.includes("perfect equilibrium"), "Should remove 'perfect equilibrium'");
    assert(!cleaned1.includes("heavily compressed"), "Should remove 'heavily compressed'");

    // Test opening odds removal
    const input2 = "Player A opened at 1.50 and has drifted to 1.80.";
    const cleaned2 = selfCheckOutput(input2, restrictions);
    assert(!cleaned2.includes("opened at 1.50"), "Should remove opening odds reference");

    // Test set price projection removal
    const input3 = "The projected set-end price would be around 1.30.";
    const cleaned3 = selfCheckOutput(input3, restrictions);
    assert(!cleaned3.includes("projected set-end price"), "Should remove set price projection");

    details.push("Banned phrases removed: PASS");
    details.push("Opening odds stripped: PASS");
    details.push("Set price projections stripped: PASS");
    return { name: "Test 10: Self-check output validation", passed: true, details };
  } catch (e) {
    details.push((e as Error).message);
    return { name: "Test 10: Self-check output validation", passed: false, details };
  }
}

/* ─── Run All Tests ─── */

export function runAllTests(): { results: TestResult[]; summary: string } {
  const tests = [
    test1_verifiedAtpClay,
    test2_verifiedWtaHard,
    test3_challengerUnknownSurface,
    test4_noScoreAvailable,
    test5_inPlayVerifiedScore,
    test6_noOpeningOdds,
    test7_onlyCurrentOdds,
    test8_ambiguousPlayers,
    test9_noTradedVolume,
    test10_selfCheck,
  ];

  const results = tests.map((t) => t());
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const summary = `${passed}/${results.length} tests passed. ${failed > 0 ? `${failed} FAILED.` : "All tests passed."}`;

  return { results, summary };
}

// Allow direct execution
if (typeof process !== "undefined" && process.argv?.includes("--run")) {
  const { results, summary } = runAllTests();
  for (const r of results) {
    console.log(`${r.passed ? "PASS" : "FAIL"}: ${r.name}`);
    for (const d of r.details) {
      console.log(`  ${d}`);
    }
  }
  console.log(`\n${summary}`);
}
