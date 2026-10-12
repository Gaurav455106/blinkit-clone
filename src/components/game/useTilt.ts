// Tilts a card toward the mouse (pairs with .sim-tilt and .sim-tilt-shine).
// Mouse only: touch and reduced motion get a flat card.

import { useCallback, type PointerEvent } from "react";
import { prefersReducedMotion } from "@/components/game/motion";

/** Largest lean, in degrees. */
export const MAX_TILT_DEG = 7;

/** Tilt angles for a pointer at (x, y) inside a w × h box: the card leans toward the pointer. */
export function tiltFor(x: number, y: number, w: number, h: number): { rx: number; ry: number; sx: number; sy: number } {
  const px = w > 0 ? Math.min(1, Math.max(0, x / w)) : 0.5;
  const py = h > 0 ? Math.min(1, Math.max(0, y / h)) : 0.5;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { rx: round((0.5 - py) * 2 * MAX_TILT_DEG), ry: round((px - 0.5) * 2 * MAX_TILT_DEG), sx: Math.round(px * 100), sy: Math.round(py * 100) };
}

export function useTilt() {
  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const t = tiltFor(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    el.style.setProperty("--tilt-x", `${t.rx}deg`);
    el.style.setProperty("--tilt-y", `${t.ry}deg`);
    el.style.setProperty("--shine-x", `${t.sx}%`);
    el.style.setProperty("--shine-y", `${t.sy}%`);
  }, []);
  const onPointerLeave = useCallback((e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--tilt-x", "0deg");
    e.currentTarget.style.setProperty("--tilt-y", "0deg");
  }, []);
  return { onPointerMove, onPointerLeave };
}
