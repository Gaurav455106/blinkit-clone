// ── Confetti (SPEC §15): a small canvas burst, no dependencies ────────────────

import { prefersReducedMotion } from "@/components/game/motion";

const COLORS = ["#2f7d4f", "#f2c94c", "#e07a2e", "#3b82f6", "#d64545"];
const PIECES = 120;
const DURATION_MS = 2200;
const GRAVITY = 0.18;

/** Fires one burst from the top centre of the window. Does nothing under reduced motion. */
export function fireConfetti(): void {
  if (prefersReducedMotion() || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(canvas);
  ctx.scale(dpr, dpr);
  const w = window.innerWidth;
  const parts = Array.from({ length: PIECES }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: -10,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * 4 + 2,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 6 + 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const t0 = performance.now();
  const frame = (now: number) => {
    const elapsed = now - t0;
    ctx.clearRect(0, 0, w, window.innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION_MS);
    for (const p of parts) {
      p.vy += GRAVITY; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
