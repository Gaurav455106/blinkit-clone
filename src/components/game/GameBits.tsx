// ── Game-feel components (SPEC §15) ───────────────────────────────────────────
// Small, dependency-free pieces for the sim layer. Each one renders its final
// state at once under prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/components/game/useCountUp";
import type { Achievement } from "@/components/game/achievements";
import { newAchievements } from "@/components/game/achievements";
import "@/components/game/game.css";

/** A number that ticks to its new value. `format` turns the in-between value into text. */
export function CountUp({ value, format, ms, from }: { value: number; format: (n: number) => string; ms?: number; from?: number }) {
  const shown = useCountUp(value, ms, from);
  return <>{format(shown)}</>;
}

const FLOAT_MS = 1400;

/** Shows the change in `value` as a floating "+…" or "−…" each time it changes (not on first render). */
export function FloatDelta({ value, format, className }: { value: number; format: (delta: number) => string; className?: string }) {
  const prev = useRef(value);
  const [pops, setPops] = useState<{ id: number; delta: number }[]>([]);
  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;
    const id = Date.now() + Math.random();
    setPops((p) => [...p.slice(-2), { id, delta }]);
    const t = window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), FLOAT_MS);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <span className={cn("pointer-events-none absolute right-3 top-2", className)} aria-hidden="true">
      {pops.map((p) => (
        <span key={p.id} className={cn("sim-float-up absolute right-0 whitespace-nowrap text-sm font-semibold", p.delta >= 0 ? "text-sim-good" : "text-sim-bad")}>
          {format(p.delta)}
        </span>
      ))}
    </span>
  );
}

const TOAST_MS = 4200;

/** Pops a toast for each achievement earned after this component first mounted. */
export function AchievementToasts({ earned }: { earned: readonly Achievement[] }) {
  const seen = useRef<string[] | null>(null);
  const [queue, setQueue] = useState<Achievement[]>([]);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = earned.map((a) => a.id); // already earned on load: no toast
      return;
    }
    const fresh = newAchievements(earned, seen.current);
    if (fresh.length === 0) return;
    seen.current = [...seen.current, ...fresh.map((a) => a.id)];
    setQueue((q) => [...q, ...fresh]);
  }, [earned]);
  useEffect(() => {
    if (queue.length === 0) return;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [queue]);
  const current = queue[0];
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
      {current && (
        <div key={current.id} className="sim-toast flex max-w-xs items-start gap-3 rounded-xl bg-card px-4 py-3 shadow-[0_1px_0_hsl(var(--border)),0_16px_40px_-16px_hsl(24_30%_20%/0.45)]">
          <span className="sim-pop-in mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--sim-highlight))] text-base" aria-hidden="true">★</span>
          <span>
            <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Achievement</span>
            <span className="block text-sm font-semibold text-foreground">{current.title}</span>
            <span className="block text-xs text-muted-foreground">{current.detail}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** Three bouncing dots, as when someone is typing. */
export function TypingDots({ label = "Typing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" role="status" aria-label={label}>
      <span className="sim-typing-dot" /><span className="sim-typing-dot" /><span className="sim-typing-dot" />
    </span>
  );
}

/** Re-runs a one-shot CSS animation class each time `trigger` changes. */
export function Replay({ trigger, className, children }: { trigger: unknown; className: string; children: ReactNode }) {
  return <span key={String(trigger)} className={cn("inline-block", className)}>{children}</span>;
}

/** Style for the n-th item of a staggered entrance (pairs with .sim-rise or .sim-reveal). */
export const stagger = (i: number, stepMs = 70): CSSProperties => ({ ["--sim-delay" as string]: `${i * stepMs}ms` });

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, className, delayIndex = 0 }: { children: ReactNode; className?: string; delayIndex?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return <div ref={ref} className={cn("sim-reveal", visible && "is-visible", className)} style={stagger(delayIndex)}>{children}</div>;
}
