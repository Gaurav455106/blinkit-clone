// ── Emergency staff sign-in ───────────────────────────────────────────────────
// Replaces the key that used to sit in the website's code. The key now lives
// only in the MASTER_KEY environment variable and is compared on the server.

import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Constant-time comparison, so response timing gives nothing away. */
export function masterKeyMatches(candidate: unknown, masterKey: string | null): boolean {
  if (!masterKey || typeof candidate !== "string" || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(masterKey));
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
/** Bounds memory if many different clients fail; forgetting them only relaxes the limit. */
const MAX_TRACKED_CLIENTS = 5_000;

/**
 * Counts failed tries per client within one warm server instance. Instances
 * don't share memory, so this slows guessing rather than stopping it; the
 * real protection is a long random MASTER_KEY.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly maxFailures = MAX_FAILURES, private readonly windowMs = WINDOW_MS) {}

  private recent(client: string, now: number): number[] {
    return (this.failures.get(client) ?? []).filter((at) => now - at < this.windowMs);
  }

  isBlocked(client: string, now = Date.now()): boolean {
    return this.recent(client, now).length >= this.maxFailures;
  }

  recordFailure(client: string, now = Date.now()): void {
    if (this.failures.size >= MAX_TRACKED_CLIENTS && !this.failures.has(client)) this.failures.clear();
    this.failures.set(client, [...this.recent(client, now), now]);
  }
}
