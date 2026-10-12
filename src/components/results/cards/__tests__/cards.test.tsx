import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PartCards, linesByLoss } from "@/components/results/cards/PartCards";
import { BadgeShelf } from "@/components/results/cards/BadgeShelf";
import { ALL_ACHIEVEMENTS } from "@/components/game/achievements";
import type { LineResult } from "@/lib/rubrics";

const line = (key: string, category: string, earned: number, max: number): LineResult => ({ key, label: `Line ${key}`, category, earned, max, note: "" });
const LINES = [line("a", "live", 4, 5), line("b", "live", 0, 6), line("c", "live", 3, 3), line("d", "setup", 10, 25)];

describe("linesByLoss", () => {
  it("keeps one part and puts the biggest loss first", () => {
    expect(linesByLoss(LINES, "live").map((l) => l.key)).toEqual(["b", "a", "c"]);
  });
});

describe("PartCards", () => {
  it("deals one card per v2 part and flips a card to its lines", () => {
    render(<PartCards lines={LINES} />);
    const cards = within(screen.getByRole("list", { name: "Score by part" })).getAllByRole("button");
    expect(cards).toHaveLength(4);
    const live = screen.getByRole("button", { name: /^Live optimisation/ });
    fireEvent.click(live);
    expect(live).toHaveAttribute("aria-pressed", "true");
    expect(within(live).getByText("Line b")).toBeInTheDocument();
  });
});

describe("BadgeShelf", () => {
  it("counts earned badges and marks the rest locked", () => {
    render(<BadgeShelf earned={ALL_ACHIEVEMENTS.slice(0, 2)} />);
    expect(screen.getByText(`2 of ${ALL_ACHIEVEMENTS.length} collected`)).toBeInTheDocument();
    expect(screen.getAllByText(", earned")).toHaveLength(2);
    expect(screen.getAllByText(", locked")).toHaveLength(ALL_ACHIEVEMENTS.length - 2);
  });
});
