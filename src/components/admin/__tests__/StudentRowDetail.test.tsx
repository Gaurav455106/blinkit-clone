import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudentRowDetail } from "@/components/admin/StudentRowDetail";
import type { AttemptRow } from "@/lib/attemptAnalysis";

const line = (key: string, label: string, category: string, earned: number, max: number) => ({ key, label, category, earned, max, note: "" });

const v2 = (id: string, total: number, created: string, extra: Record<string, unknown> = {}): AttemptRow => ({
  id, name: "Akhil", email: "akhil@x.com", batch_code: "B1", profile_id: "munchbox", score_total: total, created_at: created,
  snapshot: { scenario: { profile: { name: "MunchBox" } } },
  score_breakdown: {
    version: 2, setup: 20, live: 20, eventsRohit: 10, results: total - 50,
    lines: [line("formatFit", "Format fit", "setup", 2, 8), line("bids", "Bid discipline", "live", 5, 6)],
    goalRows: [{ label: "ROAS", goal: 3, actual: 2.4, unit: "x", pct: 80 }],
    costliestMistakes: [{ title: "Day 9: Waste on chips", lost: 4200, what: "No action" }],
    ...extra,
  },
});

describe("StudentRowDetail", () => {
  const best = v2("best", 85, "2026-10-02T10:00:00Z");
  const older = v2("old", 60, "2026-10-01T10:00:00Z");

  it("shows run numbers, lost points, goals and costliest mistakes for the best run", () => {
    render(<StudentRowDetail row={best} runs={[best, older]} />);
    expect(screen.getByText("Since first run")).toBeInTheDocument();
    expect(screen.getByText("+25")).toBeInTheDocument();
    expect(screen.getByText("Format fit")).toBeInTheDocument();
    expect(screen.getByText("-6")).toBeInTheDocument();
    expect(screen.getByText("2.4x of 3x")).toBeInTheDocument();
    expect(screen.getByText("Day 9: Waste on chips")).toBeInTheDocument();
    expect(screen.getByText("85/100")).toBeInTheDocument();
  });

  it("switches to another run from the strip", () => {
    render(<StudentRowDetail row={best} runs={[best, older]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs[1]);
    expect(screen.getByText("60/100")).toBeInTheDocument();
  });

  it("opens the full profile", () => {
    const open = vi.fn();
    render(<StudentRowDetail row={best} runs={[best]} onOpenProfile={open} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Full profile/ }));
    expect(open).toHaveBeenCalledWith("akhil@x.com");
  });
});
