import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => null),
  fetchAllPages: vi.fn(async () => []),
}));

import { api } from "@/lib/api";
import { SimProvider, useSim } from "@/context/SimContext";
import { marketContextFor } from "@/market/context";
import { defaultDeal } from "@/market/deal";

const apiMock = vi.mocked(api);
const wrapper = ({ children }: { children: ReactNode }) => <SimProvider>{children}</SimProvider>;
const STUDENT = { name: "Asha", email: "asha@x.com", batch: "B1" };

type Call = [string, string, { query?: Record<string, string>; body?: { run_id?: string } }?];
const callsTo = (method: string, path: string) =>
  (apiMock.mock.calls as unknown as Call[]).filter(([m, p]) => m === method && p === path);

/** Signs in, starts a run on one brand, then "Try a different brand". Returns the set-aside run id. */
function startRunThenSwitchBrand(result: { current: ReturnType<typeof useSim> }) {
  act(() => result.current.setStudent(STUDENT));
  act(() => result.current.newScenario("henlo"));
  act(() => result.current.addCampaign({ id: "old-c1", name: "Old campaign" } as never));
  act(() => result.current.startRun());
  const oldRunId = result.current.activeRunId!;
  act(() => result.current.newScenario("munchbox"));
  return oldRunId;
}

describe("starting a new brand while a run is in progress", () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.mockReset();
    apiMock.mockImplementation(async () => null);
  });
  afterEach(() => vi.useRealTimers());

  it("leaves no trace of the old run once the new deal is agreed", () => {
    const { result } = renderHook(() => useSim(), { wrapper });
    const oldRunId = startRunThenSwitchBrand(result);

    expect(result.current.activeRunId).toBeNull();
    expect(result.current.campaigns).toEqual([]);

    // Brief, then the deal with Rohit
    const ctx = marketContextFor(result.current.scenario!, "B1")!;
    act(() => result.current.setOpeningDeal({ terms: defaultDeal(ctx), relationship: 60, log: [] }));

    expect(result.current.scenario!.profile.id).toBe("munchbox");
    expect(result.current.activeRunId).toBeNull();
    expect(result.current.campaigns).toEqual([]);
    expect(result.current.currentDay).toBe(1);
    expect(result.current.runHistory.find((r) => r.id === oldRunId)?.status).toBe("in_progress");
  });

  it("does not bring the set-aside run back when Student view signs in again", async () => {
    const { result } = renderHook(() => useSim(), { wrapper });
    const oldRunId = startRunThenSwitchBrand(result);
    const oldScenario = result.current.runHistory.find((r) => r.id === oldRunId)!.snapshot!.scenario;

    // A late auto-save re-created the old run's server copy after it was dropped
    apiMock.mockImplementation((async (method: string, path: string) =>
      method === "GET" && path === "/api/run-session"
        ? { run_id: oldRunId, started_at: new Date().toISOString(), state: { scenario: oldScenario, campaigns: [{ id: "old-c1" }] } }
        : null) as never);

    // Student view › Launch (same test identity, brand "Any")
    await act(async () => { result.current.setStudent(STUDENT); });

    expect(result.current.scenario!.profile.id).toBe("munchbox");
    expect(result.current.activeRunId).toBeNull();
    expect(result.current.campaigns).toEqual([]);
    // ...and the stale server copy is dropped again
    const drops = callsTo("DELETE", "/api/run-session").filter(([, , o]) => o?.query?.run_id === oldRunId);
    expect(drops.length).toBeGreaterThanOrEqual(2);
  });

  it("still restores a run that is genuinely in progress", async () => {
    const { result } = renderHook(() => useSim(), { wrapper });
    act(() => result.current.setStudent(STUDENT));
    act(() => result.current.newScenario("henlo"));
    const scenario = result.current.scenario!;
    localStorage.clear(); // a new browser: nothing local about this run

    apiMock.mockImplementation((async (method: string, path: string) =>
      method === "GET" && path === "/api/run-session"
        ? { run_id: "run-live", started_at: new Date().toISOString(), state: { scenario, campaigns: [] } }
        : null) as never);
    await act(async () => { result.current.setStudent(STUDENT); });

    expect(result.current.activeRunId).toBe("run-live");
  });

  it("drops the old run only after its in-flight auto-save has landed", async () => {
    vi.useFakeTimers();
    let landPut: () => void = () => {};
    const order: string[] = [];
    apiMock.mockImplementation(((method: string, path: string) => {
      if (path !== "/api/run-session") return Promise.resolve(null);
      if (method === "PUT") {
        order.push("PUT sent");
        return new Promise((resolve) => { landPut = () => { order.push("PUT landed"); resolve(null); }; });
      }
      if (method === "DELETE") order.push("DELETE sent");
      return Promise.resolve(null);
    }) as never);

    const { result } = renderHook(() => useSim(), { wrapper });
    act(() => result.current.setStudent(STUDENT));
    act(() => result.current.newScenario("henlo"));
    act(() => result.current.startRun());
    act(() => { vi.advanceTimersByTime(2000); }); // debounced auto-save fires
    expect(order).toEqual(["PUT sent"]);

    act(() => result.current.newScenario("munchbox"));
    await act(async () => { await Promise.resolve(); });
    expect(order).toEqual(["PUT sent"]); // not before the save lands

    await act(async () => { landPut(); await Promise.resolve(); await Promise.resolve(); });
    expect(order).toEqual(["PUT sent", "PUT landed", "DELETE sent"]);
  });
});
