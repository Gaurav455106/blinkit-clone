import { describe, expect, it } from "vitest";
import { roasTileTone, profitAfterFees } from "@/components/live/roasTile";

describe("roasTileTone", () => {
  it("is neutral before any spend", () => {
    expect(roasTileTone({ spend: 0, revenue: 0, roas: 0, breakEvenRoas: 0 })).toBe("neutral");
  });

  it("is good at or above break-even and bad below it", () => {
    expect(roasTileTone({ spend: 100, revenue: 500, roas: 5, breakEvenRoas: 4 })).toBe("good");
    expect(roasTileTone({ spend: 100, revenue: 300, roas: 3, breakEvenRoas: 4 })).toBe("bad");
  });

  it("is bad when sales lose money on every unit (no break-even), whatever the ROAS", () => {
    expect(roasTileTone({ spend: 100, revenue: 900, roas: 9, breakEvenRoas: 0 })).toBe("bad");
  });
});

describe("profitAfterFees", () => {
  it("takes what was paid to Rohit off the ads profit", () => {
    expect(profitAfterFees(25_000, 10_000)).toBe(15_000);
    expect(profitAfterFees(25_000, 0)).toBe(25_000);
  });
});
