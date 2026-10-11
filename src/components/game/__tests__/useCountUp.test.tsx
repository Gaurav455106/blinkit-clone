import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCountUp } from "@/components/game/useCountUp";

const setReduced = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));

describe("useCountUp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the final value at once under reduced motion", () => {
    setReduced(true);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 700, 0), { initialProps: { v: 500 } });
    expect(result.current).toBe(500);
    rerender({ v: 900 });
    expect(result.current).toBe(900);
  });

  it("starts from the given value when motion is allowed", () => {
    setReduced(false);
    const { result } = renderHook(() => useCountUp(500, 700, 0));
    expect(result.current).toBe(0);
  });
});
