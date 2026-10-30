import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { LiveSessionRow } from "@/lib/liveSessions";

const NOW = Date.parse("2026-10-30T06:00:00Z");
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString();
const base = { run_id: "r", started_at: ago(60), brand: "Henlo", engine: "v2", has_pitch: {}, has_deal: null, v1_day: 1 };
const rows: LiveSessionRow[] = [
  { ...base, email: "asha@x", name: "Asha", batch_code: "mlp_52_ft", last_seen_at: ago(2), v2_days: 14 },
  { ...base, email: "ravi@x", name: "Ravi", batch_code: "mlp_52_ft", last_seen_at: ago(40), v2_days: 30 },
  { ...base, email: "old@x", name: "Old", batch_code: "mlp_49_ft", last_seen_at: ago(3000), v2_days: null, engine: null },
];

vi.mock("@/components/admin/useLiveSessions", () => ({
  useLiveSessions: () => ({ rows, loading: false, error: null, loadedAt: NOW, reload: vi.fn() }),
}));

import { LiveSessionsPanel } from "@/components/admin/LiveSessionsPanel";

describe("LiveSessionsPanel", () => {
  it("lists each live run with stage and status, unsaved first", () => {
    render(<LiveSessionsPanel attempts={[]} />);
    const body = screen.getAllByRole("row").slice(1);
    expect(body.map((r) => within(r).getAllByRole("cell")[0].firstChild?.textContent)).toEqual(["Ravi", "Asha", "Old"]);
    expect(within(body[0]).getByText("Finished, score not saved")).toBeInTheDocument();
    expect(within(body[1]).getByText("Day 14 of 30")).toBeInTheDocument();
    expect(within(body[2]).getByText("v1 run in progress")).toBeInTheDocument();
    expect(screen.getByText(/open their results page/)).toBeInTheDocument();
  });

  it("filters by batch with its own chips", () => {
    render(<LiveSessionsPanel attempts={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "mlp_49_ft" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Old")).toBeInTheDocument();
  });
});
