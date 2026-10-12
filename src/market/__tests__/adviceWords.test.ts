import { describe, expect, it } from "vitest";
import { adviceWords } from "@/market/liveFactors";
import type { DayResult } from "@/market/engineTypes";

const run = (...inventories: string[]) => [{ day: 1, cells: inventories.map((inventory) => ({ inventory })) }] as unknown as DayResult[];

describe("adviceWords", () => {
  it("sends a placement-only account to the Campaigns tab and the placement report", () => {
    const w = adviceWords(run("spotlight", "category"));
    expect(w.tab).toBe("the Campaigns tab");
    expect(w.reports).toContain("R6 Placement");
    expect(w.reports).not.toContain("Keyword");
    expect(w.things).toBe("placement");
  });

  it("keeps keyword advice for a keyword-only account", () => {
    expect(adviceWords(run("keyword")).tab).toBe("the Keywords tab");
  });

  it("names both for a mixed account", () => {
    expect(adviceWords(run("keyword", "stories")).things).toBe("keyword or placement");
  });
});
