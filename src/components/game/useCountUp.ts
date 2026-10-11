import { useEffect, useRef, useState } from "react";
import { easeOut, prefersReducedMotion } from "@/components/game/motion";

/** Animates from the last shown value to `target` over `ms`; jumps straight there under reduced motion. */
export function useCountUp(target: number, ms = 700, from?: number): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : from ?? target));
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (prefersReducedMotion() || ms <= 0) {
      setShown(target);
      return;
    }
    const start = shownRef.current;
    if (start === target) return;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setShown(start + (target - start) * easeOut(p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return shown;
}
