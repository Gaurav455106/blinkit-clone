import { describe, expect, it } from "vitest";
import { STAFF_ATTEMPT_COLUMNS, staffAttemptFrom } from "../store.js";

describe("staff list of attempts", () => {
  it("asks only for the snapshot parts the staff pages read", () => {
    expect(STAFF_ATTEMPT_COLUMNS).not.toMatch(/(^|,)snapshot(,|$)/); // never the whole snapshot
    expect(STAFF_ATTEMPT_COLUMNS).not.toContain("*");
    for (const part of ["scenario", "campaigns", "crisisResponses", "score_breakdown"]) {
      expect(STAFF_ATTEMPT_COLUMNS).toContain(`snapshot->${part}`);
    }
  });

  it("rebuilds a small snapshot from the flattened parts", () => {
    const row = staffAttemptFrom({
      id: "a1", email: "asha@x", score_total: 64,
      snap_scenario: { profile: { name: "Henlo" } },
      snap_campaigns: [{ id: "c1" }],
      snap_crisis: null,
      snap_breakdown: null,
    });
    expect(row).toEqual({
      id: "a1", email: "asha@x", score_total: 64,
      snapshot: { scenario: { profile: { name: "Henlo" } }, campaigns: [{ id: "c1" }] },
    });
  });

  it("keeps snapshot null when the run saved none", () => {
    const row = staffAttemptFrom({ id: "a2", snap_scenario: null, snap_campaigns: null, snap_crisis: null, snap_breakdown: null });
    expect(row).toEqual({ id: "a2", snapshot: null });
  });
});
