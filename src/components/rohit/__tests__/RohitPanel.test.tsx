import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RohitPanel } from "@/components/rohit/RohitPanel";
import { CommitmentsList } from "@/components/rohit/CommitmentsList";
import type { RohitAsk, CommitmentResult } from "@/market/rohit";

const ask: RohitAsk = {
  id: "restock",
  title: "Send stock or stop the ads",
  line: "Only 42% of stores in Karnataka have your whey in stock.",
  chips: [{ label: "Stores with stock (OSA), Karnataka", value: "42%", tone: "bad" }],
  options: [
    {
      id: "expedite", label: "Rush 400 units to Karnataka", cost: "Costs ₹5,000 now. Stock arrives in 2 days.", quality: "strong",
      effect: { relationshipDelta: 4, cost: 5000 },
      commitment: { text: "More than half the stores have stock by day 12", kind: "osa_at_least", target: 0.5, fromDay: 9, dueDay: 12, keptDelta: 6, brokenDelta: -10 },
    },
    { id: "pull_out", label: "Stop ads in Karnataka", cost: "No cost.", quality: "ok", effect: { relationshipDelta: 2 } },
  ],
};

describe("RohitPanel", () => {
  it("shows Rohit typing, then his line, the data chips and every reply's cost before a choice", { timeout: 20000 }, async () => {
    render(<RohitPanel ask={ask} onChoose={() => {}} isClockPaused relationship={52} day={8} />);
    expect(screen.getAllByRole("status", { name: "Rohit is typing" }).length).toBeGreaterThan(0);
    expect(await screen.findByText(ask.line, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("Stores with stock (OSA), Karnataka")).toBeInTheDocument();
    expect(screen.getByText("Costs ₹5,000 now. Stock arrives in 2 days.")).toBeInTheDocument();
    expect(screen.getByText("You promise:")).toBeInTheDocument();
    expect(screen.getByText("Clock paused")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Relationship with Rohit" })).toHaveAttribute("aria-valuenow", "52");
    expect(screen.queryByText(/strong|weak/i)).toBeNull();
  });

  it("returns the chosen option through the callback", { timeout: 20000 }, () => {
    const onChoose = vi.fn();
    render(<RohitPanel ask={ask} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /Rush 400 units/ }));
    expect(onChoose).toHaveBeenCalledWith(ask.options[0]);
  });

  it("after a choice, shows the reply, the relationship change and a way back", { timeout: 20000 }, async () => {
    const onClose = vi.fn();
    render(<RohitPanel ask={ask} onChoose={() => {}} chosenOptionId="expedite" relationship={56} rohitReply="Good. I'll watch the delivery." onClose={onClose} />);
    expect(screen.queryByRole("button", { name: /Stop ads in Karnataka/ })).toBeNull();
    expect(await screen.findByText("Good. I'll watch the delivery.", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to the dashboard" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CommitmentsList", () => {
  const commitment = ask.options[0].commitment!;
  const result = (status: CommitmentResult["status"]): CommitmentResult => ({ commitment: { ...commitment, id: status, askId: "restock" }, status, actual: 0.6 });

  it("shows each promise with its due day and status", { timeout: 20000 }, () => {
    render(<CommitmentsList results={[result("pending"), result("kept"), result("broken")]} currentDay={10} />);
    expect(screen.getAllByText(commitment.text)).toHaveLength(3);
    expect(screen.getByText(/Due day 12, 2 days left/)).toBeInTheDocument();
    expect(screen.getByText("Kept")).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
    expect(screen.getByText(/Relationship -10/)).toBeInTheDocument();
  });

  it("explains the empty state", { timeout: 20000 }, () => {
    render(<CommitmentsList results={[]} />);
    expect(screen.getByText(/No promises yet/)).toBeInTheDocument();
  });
});
