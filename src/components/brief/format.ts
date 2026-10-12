import { formatRupees } from "@/lib/money";
// Number formatting for the brief (Indian grouping, ROAS as "3.2x").

export const inr = formatRupees;

export const roasX = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(1)}x` : "n/a");

export const pct = (share: number, digits = 0): string => `${(share * 100).toFixed(digits)}%`;

export const count = (n: number): string => Math.round(n).toLocaleString("en-IN");

export const dayRange = (from: number, to: number): string => (from === to ? `Day ${from}` : `Days ${from} to ${to}`);
