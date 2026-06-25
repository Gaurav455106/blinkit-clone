/**
 * Seeded daily noise generator for the Blinkit simulation.
 * Produces deterministic per-day multipliers so every student with the
 * same scenario seed sees identical market variance — fair, reproducible.
 *
 * Three multipliers per day (indices 0-29):
 *   cpmMult  — affects how many impressions ₹1 buys  (high CPM = fewer impressions)
 *   ctrMult  — affects click-through rate
 *   cvrMult  — affects add-to-cart / conversion rate
 */

export interface DailyNoise {
  cpmMult: number[]; // 120 values; >1 = CPM spike (fewer impressions per ₹)
  ctrMult: number[]; // 120 values; includes creative fatigue decay
  cvrMult: number[]; // 120 values; includes weekend boost
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert an arbitrary string to a numeric seed
export function strToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateDailyNoise(seed: string): DailyNoise {
  const rng = mulberry32(strToSeed(seed));

  const DAYS = 120;

  // ── CPM multiplier ────────────────────────────────────────────────────────
  // Base range 0.75 – 1.40.  2-3 spike days at 1.7 – 2.2×.
  const cpmBase: number[] = Array.from({ length: DAYS }, () => 0.75 + rng() * 0.65);

  // Pick 2-3 spike days (not consecutive)
  const spikeCount = 2 + (rng() < 0.4 ? 1 : 0);
  const spikeDays = new Set<number>();
  let attempts = 0;
  while (spikeDays.size < spikeCount && attempts < 50) {
    attempts++;
    const d = Math.floor(rng() * DAYS);
    const tooClose = [...spikeDays].some((s) => Math.abs(s - d) < 2);
    if (!tooClose) spikeDays.add(d);
  }
  const cpmMult = cpmBase.map((v, i) => {
    if (spikeDays.has(i)) return Math.min(2.5, 1.7 + rng() * 0.5);
    return Math.max(0.5, v);
  });

  // ── CTR multiplier ────────────────────────────────────────────────────────
  // Base noise 0.70 – 1.30, then multiply by creative fatigue decay.
  // Fatigue: day 1 = 1.0, day 30 = ~0.65.  Honeymoon days 1-3 get +0.08/day boost.
  const ctrMult: number[] = Array.from({ length: DAYS }, (_, i) => {
    const base    = 0.70 + rng() * 0.60;
    const fatigue = 1.0 - (0.35 * (i / (DAYS - 1)));       // 1.0 → 0.65
    const honey   = i < 3 ? (3 - i) * 0.08 : 0;             // +0.24, +0.16, +0.08
    return Math.max(0.15, base * (fatigue + honey));
  });

  // ── CVR multiplier ────────────────────────────────────────────────────────
  // Base 0.80 – 1.25, with weekend boost (+0.10) on days that land on Sat/Sun
  // (treating sim day 1 = Monday — every 6th & 7th day of each 7-day week).
  const weekendDays = new Set(
    Array.from({ length: DAYS }, (_, i) => i).filter((i) => i % 7 === 5 || i % 7 === 6),
  );
  const cvrMult: number[] = Array.from({ length: DAYS }, (_, i) => {
    const base    = 0.80 + rng() * 0.45;
    const weekend = weekendDays.has(i) ? 0.10 : 0;
    return Math.min(1.5, Math.max(0.4, base + weekend));
  });

  return { cpmMult, ctrMult, cvrMult };
}
