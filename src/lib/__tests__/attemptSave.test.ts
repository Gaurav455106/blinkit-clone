import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ inserts: [] as unknown[], deletes: [] as [string, unknown][][], insertError: null as null | { code: string; message: string } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: unknown) => {
        calls.inserts.push(row);
        return { error: calls.insertError };
      },
      delete: () => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq: (col: string, val: unknown) => { filters.push([col, val]); return chain; },
          then: (resolve: (v: { error: null }) => void) => { calls.deletes.push(filters); resolve({ error: null }); },
        };
        return chain;
      },
      table,
    }),
  },
}));

import { isRunSaved, saveAttempt } from "@/lib/attemptSave";

const ROW = { email: "a@x.com", name: "A", batch_code: "b1", profile_id: "henlo", choices: { campaigns: 2 }, score_total: 50 };

beforeEach(() => {
  localStorage.clear();
  calls.inserts = [];
  calls.deletes = [];
  calls.insertError = null;
});

describe("saveAttempt", () => {
  it("stamps the run id into choices and remembers the run", async () => {
    await expect(saveAttempt(ROW, "run-1")).resolves.toBe("saved");
    expect(calls.inserts[0]).toMatchObject({ choices: { campaigns: 2, runId: "run-1" } });
    expect(isRunSaved("run-1")).toBe(true);
  });

  it("rounds a decimal total because score_total is an integer column", async () => {
    await saveAttempt({ ...ROW, score_total: 56.5 }, "run-1");
    expect(calls.inserts[0]).toMatchObject({ score_total: 57 });
  });

  it("clears only this run's live session after saving", async () => {
    await saveAttempt(ROW, "run-1");
    expect(calls.deletes).toEqual([[["email", "a@x.com"], ["run_id", "run-1"]]]);
  });

  it("treats a unique-index clash as already saved", async () => {
    calls.insertError = { code: "23505", message: "duplicate key" };
    await expect(saveAttempt(ROW, "run-1")).resolves.toBe("already_saved");
    expect(isRunSaved("run-1")).toBe(true);
  });

  it("throws on other errors and leaves the run unsaved so it is retried", async () => {
    calls.insertError = { code: "42P01", message: "relation does not exist" };
    await expect(saveAttempt(ROW, "run-1")).rejects.toMatchObject({ code: "42P01" });
    expect(isRunSaved("run-1")).toBe(false);
    expect(calls.deletes).toEqual([]);
  });

  it("reports unknown and null runs as unsaved", () => {
    expect(isRunSaved(null)).toBe(false);
    expect(isRunSaved("run-x")).toBe(false);
  });
});
