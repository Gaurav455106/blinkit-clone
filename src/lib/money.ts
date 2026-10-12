// ── Rupee formatting ──────────────────────────────────────────────────────────
// One formatter so a loss reads "-₹11,644", never "₹-11,644".

/** "₹1,51,448" (Indian grouping), "-₹11,644" for a negative amount. */
export function formatRupees(n: number): string {
  const rounded = Math.round(n);
  const body = `₹${Math.abs(rounded).toLocaleString("en-IN")}`;
  return rounded < 0 ? `-${body}` : body;
}
