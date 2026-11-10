import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, fetchAllPages } from "@/lib/api";

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }), { status: 200 });
const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: start + i }));

afterEach(() => vi.unstubAllGlobals());

describe("fetchAllPages", () => {
  it("keeps asking for pages until one comes back short", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(rows(PAGE_SIZE)))
      .mockResolvedValueOnce(ok(rows(30, PAGE_SIZE)));
    vi.stubGlobal("fetch", fetchMock);

    const all = await fetchAllPages<{ id: number }>("/api/staff", { view: "attempts" }, 5000);

    expect(all).toHaveLength(PAGE_SIZE + 30);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/staff?view=attempts&limit=${PAGE_SIZE}&offset=0`,
      `/api/staff?view=attempts&limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`,
    ]);
  });

  it("stops at the row cap without asking for more", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(rows(PAGE_SIZE))).mockResolvedValueOnce(ok(rows(20, PAGE_SIZE)));
    vi.stubGlobal("fetch", fetchMock);

    const all = await fetchAllPages("/api/leaderboard", { view: "attempts" }, PAGE_SIZE + 20);

    expect(all).toHaveLength(PAGE_SIZE + 20);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("limit=20");
  });

  it("fails as a whole if any page fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(rows(PAGE_SIZE)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, data: null, error: "boom", code: "server_error" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllPages("/api/staff", { view: "attempts" }, 5000)).rejects.toMatchObject({ code: "server_error" });
  });
});
