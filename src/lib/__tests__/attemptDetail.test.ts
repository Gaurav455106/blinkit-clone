import { describe, it, expect } from "vitest";
import { costliestMistakesOf, runHistory, runsByEmail, snapshotCampaigns, topLosses } from "@/lib/attemptDetail";
import { attemptCampaigns } from "@/lib/attemptAnalysis";
import type { SavedCampaign } from "@/context/SimContext";
import type { AttemptRow } from "@/lib/attemptAnalysis";

const row = (over: Partial<AttemptRow>): AttemptRow => ({
  id: "a", name: "Asha", email: "asha@x.com", batch_code: "B1", profile_id: "henlo",
  score_total: 50, score_breakdown: {}, created_at: "2026-10-01T10:00:00Z", ...over,
});

const line = (key: string, earned: number, max: number) => ({ key, label: key.toUpperCase(), category: "setup", earned, max, note: `${key} note` });

describe("topLosses", () => {
  it("lists the lines that lost the most points, biggest first, skipping full marks", () => {
    const r = row({ score_breakdown: { version: 2, lines: [line("a", 8, 8), line("b", 2, 10), line("c", 5, 8), line("d", 0, 2)] } });
    expect(topLosses(r).map((l) => [l.key, l.lost])).toEqual([["b", 8], ["c", 3], ["d", 2]]);
    expect(topLosses(r, 1)).toHaveLength(1);
  });

  it("falls back to whole parts for runs saved without lines", () => {
    const old = row({ score_breakdown: { setup: 35, liveOpt: 10, crisis: 25, results: 15 } });
    expect(topLosses(old).map((l) => [l.key, l.lost])).toEqual([["liveOpt", 15]]);
  });

  it("is empty when nothing was saved", () => {
    expect(topLosses(row({ score_breakdown: null }))).toEqual([]);
  });
});

describe("costliestMistakesOf", () => {
  it("reads saved mistakes and drops malformed ones", () => {
    const r = row({ score_breakdown: { costliestMistakes: [{ title: "Day 9: Waste", lost: 1200, what: "No action" }, { title: "Bad", lost: "x" }, null] } });
    expect(costliestMistakesOf(r)).toEqual([{ title: "Day 9: Waste", lost: 1200, what: "No action" }]);
  });

  it("is empty for v1 runs", () => {
    expect(costliestMistakesOf(row({}))).toEqual([]);
  });
});

describe("runHistory", () => {
  it("finds the best and latest runs and the change since the first", () => {
    const runs = [
      row({ id: "1", score_total: 40, created_at: "2026-10-01T10:00:00Z" }),
      row({ id: "2", score_total: 80, created_at: "2026-10-02T10:00:00Z" }),
      row({ id: "3", score_total: 65, created_at: "2026-10-03T10:00:00Z" }),
    ];
    const h = runHistory(runs)!;
    expect(h.runs).toBe(3);
    expect(h.best.id).toBe("2");
    expect(h.latest.id).toBe("3");
    expect(h.change).toBe(25);
    expect(h.ordered.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("is null with no runs", () => {
    expect(runHistory([])).toBeNull();
  });
});

describe("runsByEmail", () => {
  it("groups attempts by student", () => {
    const map = runsByEmail([row({ id: "1" }), row({ id: "2", email: "b@x.com" }), row({ id: "3" })]);
    expect(map.get("asha@x.com")?.map((r) => r.id)).toEqual(["1", "3"]);
    expect(map.get("b@x.com")).toHaveLength(1);
  });
});

describe("snapshotCampaigns", () => {
  const camp = (over: Partial<SavedCampaign>): SavedCampaign => ({
    id: "c1", name: "Snacks", objective: "performance", adFormat: "product_booster", cities: ["Delhi"], skuIds: ["s1"],
    keywords: ["makhana"], budget: 50000, budgetType: "daily", geography: "select_cities", ...over,
  });

  it("keeps launched campaigns without wizard state, and the staff table can read them back", () => {
    const snap = snapshotCampaigns([camp({ wizardSnapshot: { k: "v" } }), camp({ id: "d", isDraft: true })]);
    expect(snap).toHaveLength(1);
    expect(snap[0]).not.toHaveProperty("wizardSnapshot");
    const read = attemptCampaigns(row({ snapshot: { campaigns: snap } }));
    expect(read[0]).toMatchObject({ name: "Snacks", adFormat: "product_booster", budget: 50000, states: ["Delhi"], keywords: ["makhana"] });
  });
});
