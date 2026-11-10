// ── Input checks for everything the browser sends ────────────────────────────
// Unknown fields are dropped, so a request can't set id, created_at or
// last_seen_at, or write columns the website never sends.

import { z } from "zod";

const MAX_TEXT = 200;
const MAX_EMAIL = 254;

/** Lenient on purpose: staff test identities only need an @. */
export const emailSchema = z.string().trim().toLowerCase().min(3).max(MAX_EMAIL).regex(/^\S+@\S+$/, "Not an email address");
const text = z.string().trim().min(1).max(MAX_TEXT);
const json = z.unknown();

export const attemptSchema = z.object({
  email: emailSchema,
  name: text,
  batch_code: text,
  profile_id: text,
  score_total: z.number().finite(),
  badge: z.string().max(50).nullish(),
  crisis_choice: z.string().max(MAX_TEXT).nullish(),
  crisis_id: z.string().max(MAX_TEXT).nullish(),
  crisis_points: z.number().finite().optional(),
  choices: json.optional(),
  scenario: json.optional(),
  score_breakdown: json.optional(),
  snapshot: json.optional(),
});
export type AttemptInput = z.infer<typeof attemptSchema>;

export const saveAttemptSchema = z.object({
  attempt: attemptSchema,
  runId: text,
});

export const runSessionSchema = z.object({
  email: emailSchema,
  name: text,
  batch_code: text,
  run_id: text,
  /** Lenient: an unreadable date from an old browser save falls back to now instead of dropping the sync. */
  started_at: z.string().max(64).optional(),
  state: z.record(z.unknown()),
});
export type RunSessionInput = z.infer<typeof runSessionSchema>;

export const hubSignInSchema = z.object({ token: z.string().min(1).max(8_192) });
export const masterSignInSchema = z.object({ masterKey: z.string().min(1).max(512) });

/**
 * An email used to look up existing rows, kept exactly as given (older rows may
 * not be lower-case). Null when empty or too long.
 */
export function storedEmail(value: string | undefined): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_EMAIL) return null;
  return value;
}

/** First problem in plain words, for the 400 response. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Largest page any list returns: 100 rows of the biggest attempts seen is under 3 MB. */
export const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100_000;

/** The page asked for in ?limit=&offset=, kept within safe bounds. */
export function pageOf(query: Record<string, string | undefined>): { limit: number; offset: number } {
  return {
    limit: boundedInt(query.limit, MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    offset: boundedInt(query.offset, 0, 0, MAX_OFFSET),
  };
}

/** A whole number within [min, max], or the fallback when absent or invalid. */
export function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
