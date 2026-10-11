import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BriefQuiz } from "@/components/brief/BriefQuiz";
import { BLINKIT_STATES, type CityStockMap } from "@/data/scenarios";

const stockOf = (entries: Partial<CityStockMap>): CityStockMap =>
  ({ ...Object.fromEntries(BLINKIT_STATES.map((s) => [s, 0])), ...entries }) as CityStockMap;

describe("BriefQuiz: which state has the most stock", () => {
  it("the answer is the state with the most stock, even when a secondary state beats the primary", () => {
    render(<BriefQuiz goalType="ROAS-First" primaryState="Karnataka" stock={stockOf({ Karnataka: 66, Maharashtra: 70, Delhi: 30 })} onStatusChange={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Drive sales/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Maharashtra" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText(/Both correct/)).toBeInTheDocument();
  });

  it("offers the other stocked states as wrong answers, not just empty ones", () => {
    render(<BriefQuiz goalType="ROAS-First" primaryState="Karnataka" stock={stockOf({ Karnataka: 80, Maharashtra: 40, Delhi: 30 })} onStatusChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Maharashtra" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Delhi" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Andhra Pradesh" })).toBeNull();
  });
});
