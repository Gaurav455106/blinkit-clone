// The live ROAS and profit tiles.

type Tone = "neutral" | "good" | "bad";

interface RoasTotals {
  spend: number;
  revenue: number;
  roas: number;
  /** 0 when there are no sales yet, or when every sale loses money (a discount bigger than the margin). */
  breakEvenRoas: number;
}

/** Green only when ROAS covers a real break-even. With sales but no break-even, every unit loses money. */
export function roasTileTone(t: RoasTotals): Tone {
  if (t.spend <= 0) return "neutral";
  if (t.breakEvenRoas <= 0) return t.revenue > 0 ? "bad" : "neutral";
  return t.roas >= t.breakEvenRoas ? "good" : "bad";
}

/** Profit after ads and after what was paid to Rohit (co-funded slots), which also comes out of the budget. */
export function profitAfterFees(adsProfit: number, feesToRohit: number): number {
  return adsProfit - feesToRohit;
}
