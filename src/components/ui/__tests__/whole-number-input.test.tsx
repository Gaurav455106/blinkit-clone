import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WholeNumberInput, cleanDigits } from "@/components/ui/whole-number-input";

function Harness({ start = 0, spy = vi.fn() }: { start?: number; spy?: (n: number) => void }) {
  const [n, setN] = useState(start);
  return <WholeNumberInput aria-label="Units" value={n} onValueChange={(v) => { setN(v); spy(v); }} />;
}

const box = () => screen.getByLabelText("Units") as HTMLInputElement;

describe("cleanDigits", () => {
  it("drops leading zeros and anything that is not a digit", () => {
    expect(cleanDigits("059")).toBe("59");
    expect(cleanDigits("00")).toBe("0");
    expect(cleanDigits("1,200")).toBe("1200");
    expect(cleanDigits("-5")).toBe("5");
    expect(cleanDigits("")).toBe("");
  });
});

describe("WholeNumberInput", () => {
  it("replaces the 0 instead of keeping it in front when you type a number", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.change(box(), { target: { value: "059" } });
    expect(box().value).toBe("59");
    expect(spy).toHaveBeenLastCalledWith(59);
  });

  it("lets the box be empty while editing, stores 0, and shows 0 again on leaving", () => {
    const spy = vi.fn();
    render(<Harness start={120} spy={spy} />);
    fireEvent.change(box(), { target: { value: "" } });
    expect(box().value).toBe("");
    expect(spy).toHaveBeenLastCalledWith(0);
    fireEvent.blur(box());
    expect(box().value).toBe("0");
  });

  it("shows stored decimals rounded", () => {
    render(<Harness start={348.33} />);
    expect(box().value).toBe("348");
  });
});
