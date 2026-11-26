import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BatchRail } from "@/components/admin/BatchRail";
import type { AttemptRow, BatchSummary } from "@/lib/attemptAnalysis";

const top = { name: "Asha", score_total: 80 } as AttemptRow;
const summary = (batch: string, count: number, avg: number): BatchSummary => ({ batch, count, avg, top, commonLoss: null });
const batches = [summary("mlp_52_ft", 60, 56), summary("mlp_53_ft", 4, 61), summary("MASTER", 1, 40)];

function renderRail(active = "All", onSelect = vi.fn()) {
  render(
    <BatchRail
      batches={batches}
      liveByBatch={new Map([["mlp_53_ft", { live: 3, unsaved: 1 }]])}
      allLabel="All"
      totalStudents={65}
      overallAvg={57}
      active={active}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe("BatchRail", () => {
  it("lists real batches with their size, average and live runs", () => {
    renderRail();
    expect(screen.getByRole("button", { name: "mlp_53_ft: 4 students, average 61, 3 live, 1 score not saved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All: 65 students, average 57/ })).toHaveAttribute("aria-current", "true");
  });

  it("keeps Student view test runs folded away until asked", () => {
    renderRail();
    expect(screen.queryByRole("button", { name: /^MASTER/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Test runs/ }));
    expect(screen.getByRole("button", { name: /^MASTER/ })).toBeInTheDocument();
  });

  it("selects a batch on click", () => {
    const onSelect = renderRail();
    fireEvent.click(screen.getByRole("button", { name: /^mlp_52_ft/ }));
    expect(onSelect).toHaveBeenCalledWith("mlp_52_ft");
  });
});
