// Where a total sits on the grade bands (40 / 60 / 75 / 90).

import { scoreTone } from "@/components/sim/tone";
import { cn } from "@/lib/utils";

const BANDS = [
  { from: 0, label: "Back to Basics" },
  { from: 40, label: "Still Learning" },
  { from: 60, label: "Growing Fast" },
  { from: 75, label: "Sharp Strategist" },
  { from: 90, label: "QCommerce Pro" },
] as const;

const FILL = { good: "bg-sim-good", warn: "bg-sim-warn", bad: "bg-sim-bad", neutral: "bg-foreground/60" } as const;

export function GradeScale({ total }: { total: number }) {
  const pct = Math.max(0, Math.min(100, total));
  const current = [...BANDS].reverse().find((b) => total >= b.from) ?? BANDS[0];
  return (
    <div className="rounded-2xl bg-card px-6 py-5 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
      <div
        className="relative h-3 rounded-full bg-secondary"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={total}
        aria-label={`Total score ${total} out of 100, grade ${current.label}`}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700", FILL[scoreTone(total, 100)])} style={{ width: `${pct}%` }} />
        {BANDS.slice(1).map((b) => (
          <span key={b.from} className="absolute top-[-3px] h-[18px] w-0.5 rounded bg-card" style={{ left: `${b.from}%` }} aria-hidden />
        ))}
      </div>
      <ol className="relative mt-2 hidden h-8 text-[11px] text-muted-foreground sm:block" aria-hidden>
        {BANDS.map((b, i) => (
          <li
            key={b.from}
            className={cn("absolute whitespace-nowrap", i % 2 ? "top-4" : "top-0", b.label === current.label && "font-semibold text-foreground")}
            style={b.from === 90 ? { right: 0 } : { left: `${b.from}%` }}
          >
            <span className="sim-num">{b.from}</span> {b.label}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-sm text-muted-foreground sm:hidden">Grade: <span className="font-medium text-foreground">{current.label}</span></p>
    </div>
  );
}
