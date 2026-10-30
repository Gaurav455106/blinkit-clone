import { describe, expect, it } from "vitest";
import { summariseSessions, timeAgo, type LiveSessionRow } from "@/lib/liveSessions";
import type { AttemptRow } from "@/lib/attemptAnalysis";

const NOW = Date.parse("2026-10-30T06:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function row(over: Partial<LiveSessionRow>): LiveSessionRow {
  return {
    email: "a@x.com", name: "A", batch_code: "mlp_52_ft", run_id: "run-1",
    started_at: minutesAgo(60), last_seen_at: minutesAgo(1),
    brand: "Henlo", engine: "v2", has_pitch: { score: 1 }, has_deal: null, v2_days: null, v1_day: 1,
    ...over,
  };
}

function attempt(over: Partial<AttemptRow>): AttemptRow {
  return { id: "1", name: "A", email: "a@x.com", batch_code: "mlp_52_ft", profile_id: "henlo", score_total: 50, score_breakdown: {}, created_at: minutesAgo(5), ...over };
}

describe("summariseSessions", () => {
  it("shows the v2 day reached from the synced run log", () => {
    const [s] = summariseSessions([row({ v2_days: 12 })], [], NOW);
    expect(s.stage).toBe("Day 12 of 30");
    expect(s.status).toBe("playing");
  });

  it("describes v2 runs that haven't played a day yet", () => {
    expect(summariseSessions([row({ has_pitch: null })], [], NOW)[0].stage).toBe("Reading the brief");
    expect(summariseSessions([row({})], [], NOW)[0].stage).toBe("Building campaigns");
  });

  it("flags a finished run with no attempt saved since it started", () => {
    const [s] = summariseSessions([row({ v2_days: 30, last_seen_at: minutesAgo(90) })], [], NOW);
    expect(s.status).toBe("unsaved");
  });

  it("does not flag a finished run whose attempt was saved after it started", () => {
    const [s] = summariseSessions([row({ v2_days: 30 })], [attempt({ created_at: minutesAgo(2) })], NOW);
    expect(s.status).toBe("playing");
  });

  it("ignores attempts saved before the run started or by another student", () => {
    const attempts = [attempt({ created_at: minutesAgo(120) }), attempt({ email: "b@x.com", created_at: minutesAgo(2) })];
    expect(summariseSessions([row({ v2_days: 30 })], attempts, NOW)[0].status).toBe("unsaved");
  });

  it("marks runs idle after 10 minutes without a sync", () => {
    expect(summariseSessions([row({ last_seen_at: minutesAgo(11) })], [], NOW)[0].status).toBe("idle");
  });

  it("treats rows without an engine stamp as v1", () => {
    const [s] = summariseSessions([row({ engine: null })], [], NOW);
    expect(s.engine).toBe("v1");
    expect(s.daysDone).toBeNull();
  });

  it("lists unsaved first, then playing, then idle", () => {
    const out = summariseSessions([
      row({ email: "idle@x", last_seen_at: minutesAgo(30) }),
      row({ email: "play@x" }),
      row({ email: "done@x", v2_days: 30, last_seen_at: minutesAgo(40) }),
    ], [], NOW);
    expect(out.map((s) => s.email)).toEqual(["done@x", "play@x", "idle@x"]);
  });
});

describe("timeAgo", () => {
  it("formats minutes, hours and days", () => {
    expect(timeAgo(minutesAgo(0), NOW)).toBe("just now");
    expect(timeAgo(minutesAgo(4), NOW)).toBe("4 min ago");
    expect(timeAgo(minutesAgo(180), NOW)).toBe("3 h ago");
    expect(timeAgo(minutesAgo(60 * 24), NOW)).toBe("1 day ago");
  });
});
