import { describe, it, expect } from "vitest";
import { stockNote } from "@/components/deal/stockNote";

const states = ["Maharashtra", "Gujarat", "Karnataka"];
const demand = { Maharashtra: 0.46, Gujarat: 0.24, Karnataka: 0.29 };

describe("stockNote", () => {
  it("says nothing when stock roughly follows searches", () => {
    expect(stockNote({ Maharashtra: 460, Gujarat: 240, Karnataka: 300 }, demand, states)).toBeNull();
  });

  it("says nothing before any stock is placed", () => {
    expect(stockNote({ Maharashtra: 0, Gujarat: 0, Karnataka: 0 }, demand, states)).toBeNull();
  });

  it("flags a state left empty: its shoppers can't buy and ads won't show there", () => {
    expect(stockNote({ Maharashtra: 1773, Gujarat: 0, Karnataka: 688 }, demand, states))
      .toBe("No stock in Gujarat: shoppers there (24% of searches) can't buy it, and your ads won't show there.");
  });

  it("flags a state with far less stock than its searches", () => {
    expect(stockNote({ Maharashtra: 1182, Gujarat: 59, Karnataka: 400 }, demand, states))
      .toBe("Gujarat gets 4% of this stock for 24% of searches: few dark stores there will have it, so your ads show less.");
  });

  it("flags a state holding far more than its searches when nothing is short", () => {
    expect(stockNote({ Maharashtra: 800, Gujarat: 120, Karnataka: 150 }, { Maharashtra: 0.4, Gujarat: 0.1, Karnataka: 0.12 }, states))
      .toMatch(/^Maharashtra holds 75% of this stock for 40% of searches/);
  });
});
