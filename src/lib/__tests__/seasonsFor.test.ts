import { describe, expect, it } from "vitest";
import { BRAND_PROFILES, seasonsFor } from "@/data/scenarios";

const names = (category: string) => seasonsFor(category).map((s) => s.name);

describe("seasonsFor", () => {
  it("keeps category seasons off brands they don't move", () => {
    expect(names("Dog Treats")).not.toContain("Summer Season");
    expect(names("Dog Treats")).not.toContain("New Year Health Spike");
  });

  it("offers each category season to the brand it fits", () => {
    expect(names("Premium Skincare")).toContain("Summer Season");
    expect(names("Health Supplements")).toContain("New Year Health Spike");
    expect(names("Protein & Fitness")).toContain("New Year Health Spike");
  });

  it("always leaves every brand the general seasons", () => {
    for (const p of BRAND_PROFILES) expect(names(p.category)).toContain("Normal Week");
  });
});
