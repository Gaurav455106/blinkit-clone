import { describe, it, expect } from "vitest";
import {
  attemptLines, attemptTotals, brandOf, filterAttempts, bestPerStudent, latestFirst,
  categoryStats, lineStats, crisisStats, strengthsAndGaps, lineDetailSince, buildSavedBreakdown,
  attemptCrisisResponses, type AttemptRow,
} from "@/lib/attemptAnalysis";
import { RUBRICS, type LineResult } from "@/lib/rubrics";
import {
  scoreSetup, scoreDayparting, scoreNewCampaign, buildLiveOptScore, scoreCrisisResponse,
  buildCrisisScore, scoreResults, assembleFinalScore,
} from "@/lib/newScoring";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function fullLines(overrides: Partial<Record<string, [number, string]>> = {}): LineResult[] {
  return RUBRICS.map((r) => {
    const o = overrides[r.key];
    return { key: r.key, label: r.label, category: r.category, earned: o ? o[0] : r.max, max: r.max, note: o ? o[1] : "Full marks." };
  });
}

function sumCat(lines: LineResult[], cat: string) {
  return lines.filter((l) => l.category === cat).reduce((s, l) => s + l.earned, 0);
}

let seq = 0;
function row(over: Partial<AttemptRow> & { lines?: LineResult[] | null } = {}): AttemptRow {
  const { lines, ...rest } = over;
  const l = lines === undefined ? fullLines() : lines;
  const breakdown = l
    ? { version: 1, grandTotal: l.reduce((s, x) => s + x.earned, 0), setup: sumCat(l, "setup"), liveOpt: sumCat(l, "liveOpt"), crisis: sumCat(l, "crisis"), results: sumCat(l, "results"), lines: l }
    : { grandTotal: 50, setup: 20, liveOpt: 10, crisis: 12, results: 8 };
  seq += 1;
  return {
    id: `a${seq}`, name: "Asha", email: "asha@x.com", batch_code: "B1", profile_id: "henlo",
    score_total: breakdown.grandTotal, score_breakdown: breakdown, created_at: `2026-10-0${(seq % 9) + 1}T10:00:00Z`,
    snapshot: { scenario: { profile: { name: "Henlo" } } },
    ...rest,
  };
}

// ── Parsing ───────────────────────────────────────────────────────────────────

describe("parsing saved attempts", () => {
  it("reads lines when present and validates their shape", () => {
    expect(attemptLines(row())).toHaveLength(11);
    expect(attemptLines(row({ lines: null }))).toBeNull();
    expect(attemptLines({ ...row(), score_breakdown: { lines: [{ key: 1 }] } })).toBeNull();
    expect(attemptLines({ ...row(), score_breakdown: null })).toBeNull();
  });

  it("fills a missing category from the rubric", () => {
    const r = { ...row(), score_breakdown: { lines: [{ key: "geo", label: "Geography", earned: 4, max: 7, note: "x" }] } };
    expect(attemptLines(r)![0].category).toBe("setup");
  });

  it("reads category totals from new and old breakdowns", () => {
    expect(attemptTotals(row({ lines: null }))).toEqual({ setup: 20, liveOpt: 10, crisis: 12, results: 8 });
    expect(attemptTotals({ ...row(), score_breakdown: {}, snapshot: { score_breakdown: { setup: 1, liveOpt: 2, crisis: 3, results: 4 } } }))
      .toEqual({ setup: 1, liveOpt: 2, crisis: 3, results: 4 });
    expect(attemptTotals({ ...row(), score_breakdown: "junk", snapshot: null })).toBeNull();
  });

  it("finds the brand from the snapshot, then scenario, then profile id", () => {
    expect(brandOf(row())).toBe("Henlo");
    expect(brandOf({ ...row(), snapshot: null, scenario: { profile: "FuelUp" } })).toBe("FuelUp");
    expect(brandOf({ ...row(), snapshot: null })).toBe("henlo");
  });
});

// ── Filtering and grouping ────────────────────────────────────────────────────

describe("filtering", () => {
  const rows = [
    row({ email: "a@x", batch_code: "B1", score_total: 40 }),
    row({ email: "a@x", batch_code: "B1", score_total: 70 }),
    row({ email: "b@x", batch_code: "B2", score_total: 60, snapshot: { scenario: { profile: { name: "FuelUp" } } } }),
  ];

  it("filters by batch and brand", () => {
    expect(filterAttempts(rows, { batch: "B1" })).toHaveLength(2);
    expect(filterAttempts(rows, { brand: "FuelUp" })).toHaveLength(1);
    expect(filterAttempts(rows, { batch: "All", brand: "All" })).toHaveLength(3);
  });

  it("keeps the best attempt per student without mutating input", () => {
    const copy = [...rows];
    const best = bestPerStudent(rows);
    expect(best.map((r) => r.score_total).sort()).toEqual([60, 70]);
    expect(rows).toEqual(copy);
  });

  it("sorts newest first", () => {
    const sorted = latestFirst([row({ created_at: "2026-01-01" }), row({ created_at: "2026-05-01" })]);
    expect(sorted[0].created_at).toBe("2026-05-01");
  });
});

// ── Cohort statistics ─────────────────────────────────────────────────────────

describe("categoryStats", () => {
  it("averages each category and bins by share of max", () => {
    const stats = categoryStats([row(), row({ lines: null })]);
    const setup = stats.find((s) => s.category === "setup")!;
    expect(setup.n).toBe(2);
    expect(setup.avg).toBe(27.5);
    expect(setup.pctOfMax).toBe(79);
    expect(setup.bins.reduce((s, b) => s + b.count, 0)).toBe(2);
    expect(setup.bins[setup.bins.length - 1].count).toBe(1);
  });

  it("handles an empty cohort", () => {
    const stats = categoryStats([]);
    expect(stats.every((s) => s.n === 0 && s.avg === 0)).toBe(true);
  });
});

describe("lineStats", () => {
  const rows = [
    row({ lines: fullLines({ dayparting: [0, "Ran all campaigns on 24/7 — dead hours burned budget."] }) }),
    row({ lines: fullLines({ dayparting: [0, "Ran all campaigns on 24/7 — dead hours burned budget."] }) }),
    row({ lines: fullLines({ dayparting: [12, "Good schedule change by Day 9."] }) }),
    row({ lines: null }),
  ];
  const stats = lineStats(rows);
  const dp = stats.find((s) => s.key === "dayparting")!;

  it("ignores attempts without lines", () => {
    expect(dp.n).toBe(3);
  });

  it("averages, counts losses and tier spread", () => {
    expect(dp.avgEarned).toBe(4);
    expect(dp.pctLost).toBe(100);
    expect(dp.tiers.find((t) => t.points === 0)!.count).toBe(2);
    expect(dp.tiers.find((t) => t.points === 12)!.count).toBe(1);
  });

  it("groups reasons, ignoring numbers", () => {
    expect(dp.topReasons[0]).toEqual({ reason: "Ran all campaigns on 24/7 — dead hours burned budget.", count: 2 });
  });

  it("writes a data-driven fix note", () => {
    expect(dp.dataNote).toMatch(/67%/);
    expect(dp.dataNote).toMatch(/teach dayparting/);
    expect(stats.find((s) => s.key === "geo")!.dataNote).toMatch(/full marks/i);
  });

  it("says so when no attempt has line detail", () => {
    expect(lineStats([row({ lines: null })])[0].dataNote).toMatch(/no line-level/i);
  });
});

describe("crisisStats", () => {
  const snap = (key: string, score: number) => ({
    scenario: { profile: { name: "Henlo" } },
    crisisResponses: { x: { crisisId: "x", crisisNum: 1, optionKey: key, optionLabel: `Option ${key}`, score, maxScore: 10, title: "Supply alert" } },
  });
  const rows = [row({ snapshot: snap("a", 10) }), row({ snapshot: snap("a", 10) }), row({ snapshot: snap("c", 0) }), row({ snapshot: null })];

  it("counts option choices and average points per crisis", () => {
    const c1 = crisisStats(rows).find((c) => c.num === 1)!;
    expect(c1.n).toBe(3);
    expect(c1.title).toBe("Supply alert");
    expect(c1.avgPoints).toBeCloseTo(16 / 3, 5);
    expect(c1.options[0]).toMatchObject({ optionKey: "a", count: 2, share: 67 });
    expect(crisisStats(rows).find((c) => c.num === 2)!.n).toBe(0);
  });

  it("reads crisis responses defensively", () => {
    expect(attemptCrisisResponses(row({ snapshot: { crisisResponses: "bad" } }))).toEqual([]);
  });
});

describe("strengthsAndGaps", () => {
  it("finds consistent strengths and recurring gaps", () => {
    const rows = [
      row({ lines: fullLines({ dayparting: [0, "24/7"], keywords: [3, "mixed"] }) }),
      row({ lines: fullLines({ dayparting: [6, "partial"] }) }),
    ];
    const { strengths, gaps } = strengthsAndGaps(rows);
    expect(gaps[0].key).toBe("dayparting");
    expect(gaps[0].lostIn).toBe(2);
    expect(gaps.some((g) => g.key === "keywords")).toBe(false);
    expect(strengths.some((s) => s.key === "geo")).toBe(true);
  });

  it("returns empty lists when no attempt has lines", () => {
    expect(strengthsAndGaps([row({ lines: null })])).toEqual({ strengths: [], gaps: [] });
  });
});

describe("lineDetailSince", () => {
  it("returns the date of the first attempt with lines", () => {
    expect(lineDetailSince([row({ created_at: "2026-10-05", lines: null }), row({ created_at: "2026-10-09" }), row({ created_at: "2026-10-07" })])).toBe("2026-10-07");
    expect(lineDetailSince([row({ lines: null })])).toBeNull();
  });
});

// ── Saved breakdown ───────────────────────────────────────────────────────────

describe("buildSavedBreakdown", () => {
  it("keeps the old fields and adds version, lines and goal rows", () => {
    const profile = BRAND_PROFILES[0];
    const scenario = {
      seed: "s", profile, cityStockMap: BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap),
      season: SEASONS[0], market: MARKET_CONDITIONS[0],
      inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
      budget: 200000,
      clientGoals: { primary: "", performanceGoals: [], reachGoals: [], metrics: [{ label: "ROAS", target: 4, unit: "x" }], threshold: "", lifecycle: "", campaignHint: "" },
      scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "" }, city: profile.primaryState,
    } as unknown as Scenario;
    const fs = assembleFinalScore(
      scoreSetup(scenario, []),
      buildLiveOptScore(
        scoreDayparting({ scenario, campaigns: [], customDayparts: {}, daypartingChangedOnDay: {} }),
        scoreNewCampaign({ scenario, originalCampaigns: [], newCampaigns: [], remainingBudgetAtEnd: 0 }),
      ),
      buildCrisisScore([scoreCrisisResponse(2, "a", 6, 10)]),
      scoreResults(scenario, { days: 30, totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalAtcs: 0, totalUnits: 0, totalRevenue: 0, ctr: 0, roas: 2, cvr: 0, reach: 0, brandedLift: 0, sellThrough: 0 }, 0),
    );
    const bd = buildSavedBreakdown(fs);
    expect(bd).toMatchObject({ version: 1, grandTotal: fs.grandTotal, setup: 0, liveOpt: 3, crisis: 5, results: fs.results.total, grade: fs.grade, gradeLabel: fs.gradeLabel });
    expect(bd.lines).toHaveLength(11);
    expect(bd.goalRows).toEqual(fs.results.goalRows);
    const asRow = { ...row(), score_breakdown: JSON.parse(JSON.stringify(bd)) };
    expect(attemptLines(asRow)).toEqual(bd.lines);
  });
});
