import { describe, expect, it } from "vitest";
import { formatRupees } from "@/lib/money";

describe("formatRupees", () => {
  it("groups the Indian way and rounds", () => {
    expect(formatRupees(151447.6)).toBe("₹1,51,448");
  });

  it("puts the minus sign before the rupee sign", () => {
    expect(formatRupees(-11644)).toBe("-₹11,644");
  });

  it("never shows minus zero", () => {
    expect(formatRupees(-0.4)).toBe("₹0");
  });
});
