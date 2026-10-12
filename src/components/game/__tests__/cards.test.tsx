import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { tiltFor, MAX_TILT_DEG } from "@/components/game/useTilt";
import { FlipCard } from "@/components/game/FlipCard";
import { ALL_ACHIEVEMENTS } from "@/components/game/achievements";

describe("tiltFor", () => {
  it("is flat with the pointer in the middle", () => {
    expect(tiltFor(50, 50, 100, 100)).toEqual({ rx: 0, ry: 0, sx: 50, sy: 50 });
  });

  it("leans toward the top-right corner, never past the max", () => {
    const t = tiltFor(100, 0, 100, 100);
    expect(t.rx).toBe(MAX_TILT_DEG);
    expect(t.ry).toBe(MAX_TILT_DEG);
    expect(tiltFor(500, -500, 100, 100)).toEqual(t);
  });

  it("stays flat for a zero-size box", () => {
    expect(tiltFor(10, 10, 0, 0)).toEqual({ rx: 0, ry: 0, sx: 50, sy: 50 });
  });
});

function Harness() {
  const [flipped, setFlipped] = useState(false);
  return <FlipCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} front={<p>Front side</p>} back={<p>Back side</p>} />;
}

describe("FlipCard", () => {
  it("shows only the front to screen readers until flipped, by click or keyboard", () => {
    render(<Harness />);
    const card = screen.getByRole("button", { name: /Front side/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card);
    expect(screen.getByRole("button", { name: /Back side/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Front side/ })).toBeInTheDocument();
  });
});

describe("ALL_ACHIEVEMENTS", () => {
  it("lists every badge once", () => {
    const ids = ALL_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("first_move");
    expect(ids).toContain("day_30");
  });
});
