// ── Seeded randomness for the market engine (SPEC §2, §14 F1) ─────────────────
// Every random draw comes from a stream keyed by what it is for (batch, brand,
// keyword, state, slot, day...). Streams are independent, so a student's action
// on one campaign never shifts the random numbers used anywhere else, and the
// same seed plus the same actions always replays the same run.

export type Rand = () => number;

/** Above this mean, Poisson draws use a normal approximation (error < 1%). */
const POISSON_NORMAL_CUTOFF = 30;

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: small, fast, good-enough PRNG. Returns numbers in [0, 1). */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An independent stream keyed by its parts, e.g. streamFor(seed, "demand", kw, state, slot, day). */
export function streamFor(...parts: Array<string | number>): Rand {
  return mulberry32(hashString(parts.join("|")));
}

/** Standard normal draw (Box–Muller). */
export function normal(rand: Rand): number {
  const u = Math.max(rand(), Number.EPSILON);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson draw with mean `lambda`; noise scales with volume by itself. */
export function poisson(lambda: number, rand: Rand): number {
  if (!(lambda > 0)) return 0;
  if (lambda > POISSON_NORMAL_CUTOFF) {
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rand)));
  }
  // Knuth's method for small means
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

/** Log-normal draw with the given median and log-space spread. */
export function logNormal(median: number, sigma: number, rand: Rand): number {
  return median * Math.exp(sigma * normal(rand));
}
