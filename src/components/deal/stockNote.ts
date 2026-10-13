// One plain line on what a product's stock split does in the run: where shoppers
// can't buy it, or where stock will sit. Shown under each product on the deal sheet.

/** A state is short when its stock share is below this fraction of its search share. */
const SHORT_RATIO = 0.5;
/** A state is overloaded when its stock share is above this multiple of its search share… */
const OVER_RATIO = 1.5;
/** …and at least this many points above it. */
const OVER_MIN_GAP = 0.1;
/** States with fewer searches than this aren't worth a warning. */
const MIN_DEMAND = 0.1;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function stockNote(
  row: Readonly<Record<string, number>>,
  demand: Readonly<Record<string, number>>,
  states: readonly string[],
): string | null {
  const placed = states.reduce((s, st) => s + Math.max(0, row[st] ?? 0), 0);
  if (placed <= 0) return null;
  const gaps = states.map((st) => ({ st, stock: Math.max(0, row[st] ?? 0) / placed, searches: demand[st] ?? 0 }));

  const short = gaps
    .filter((g) => g.searches >= MIN_DEMAND && g.stock < g.searches * SHORT_RATIO)
    .sort((a, b) => (b.searches - b.stock) - (a.searches - a.stock))[0];
  if (short) {
    return short.stock === 0
      ? `No stock in ${short.st}: shoppers there (${pct(short.searches)} of searches) can't buy it, and your ads won't show there.`
      : `${short.st} gets ${pct(short.stock)} of this stock for ${pct(short.searches)} of searches: few dark stores there will have it, so your ads show less.`;
  }

  const over = gaps
    .filter((g) => g.stock > g.searches * OVER_RATIO && g.stock - g.searches >= OVER_MIN_GAP)
    .sort((a, b) => (b.stock - b.searches) - (a.stock - a.searches))[0];
  return over
    ? `${over.st} holds ${pct(over.stock)} of this stock for ${pct(over.searches)} of searches: some of it may sit unsold.`
    : null;
}
