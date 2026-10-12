import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { ClueCard } from "@/components/brief/ClueCard";
import { useClues } from "@/components/brief/useClues";

function Clue() {
  const clues = useClues("seed-1");
  return <ClueCard title="Season" open={clues.isOpen("season")} onOpen={() => clues.open("season")}><p>Festival week</p></ClueCard>;
}

describe("ClueCard", () => {
  beforeEach(() => localStorage.clear());

  it("starts face down and turns over for good when clicked", () => {
    render(<Clue />);
    const card = screen.getByRole("button", { name: "Season: turn over" });
    fireEvent.click(card);
    expect(screen.queryByRole("button", { name: "Season: turn over" })).toBeNull();
    expect(screen.getByText("Festival week")).toBeInTheDocument();
  });
});

describe("useClues", () => {
  beforeEach(() => localStorage.clear());

  it("remembers turned cards per scenario and counts each once", () => {
    const first = renderHook(() => useClues("seed-1"));
    act(() => { first.result.current.open("stock"); first.result.current.open("stock"); });
    expect(first.result.current.count).toBe(1);
    expect(renderHook(() => useClues("seed-1")).result.current.isOpen("stock")).toBe(true);
    expect(renderHook(() => useClues("seed-2")).result.current.count).toBe(0);
  });
});
