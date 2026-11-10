import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GivesPicker } from "@/components/deal/DealTermsPicker";
import { BRAND_PROFILES } from "@/data/scenarios";

// Editing an offer used to be ignored unless its box was ticked, so a student
// could set ₹3,000 a day and send nothing.
const skus = BRAND_PROFILES.find((b) => b.id === "henlo")!.skus;

describe("GivesPicker", () => {
  it("editing an unticked offer ticks it, so what the student set is what gets sent", () => {
    const onChange = vi.fn();
    render(<GivesPicker skus={skus} states={["Delhi", "Karnataka"]} gives={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Ad spend per day"), { target: { value: "3000" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ kind: "adSpend", perDay: 3000 })]);
  });
});
