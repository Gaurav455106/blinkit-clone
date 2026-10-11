import { describe, expect, it } from "vitest";
import { enabledCategories } from "@/lib/wizardSave";

const CATS = ["Dog Needs", "Pet Food & Accessories"];

describe("enabledCategories", () => {
  it("keeps categories the student never touched, since they show as ticked", () => {
    expect(enabledCategories(CATS, {}, true)).toEqual(CATS);
  });

  it("drops only the categories the student unticked", () => {
    expect(enabledCategories(CATS, { "Pet Food & Accessories": false }, true)).toEqual(["Dog Needs"]);
  });

  it("returns none when category targeting is switched off", () => {
    expect(enabledCategories(CATS, { "Dog Needs": true }, false)).toEqual([]);
  });

  it("ignores stale flags for categories this brand does not have", () => {
    expect(enabledCategories(CATS, { "Baby Care": true }, true)).toEqual(CATS);
  });
});
