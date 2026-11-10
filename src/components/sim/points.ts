// Points as shown on screen. Averages and pro-rated line maxes can be long
// decimals (e.g. 2.142857…); show at most one decimal and drop a trailing .0.

const DECIMALS = 1;
const FACTOR = 10 ** DECIMALS;

export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * FACTOR) / FACTOR);
}
