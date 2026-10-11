// How much Rohit trusts the student (0–100). Tiers come from cmPitchLogic so
// the meter matches the sidebar and SimContext.

import { cn } from "@/lib/utils";
import { relationshipTier, type CmRelationshipTier } from "@/lib/cmPitchLogic";
import type { Tone } from "@/components/sim/tone";

const TIER: Record<CmRelationshipTier, { label: string; hint: string; tone: Tone }> = {
  trusted: { label: "Trusts you", hint: "Better deals and faster help.", tone: "good" },
  neutral: { label: "Neutral", hint: "Normal help, nothing extra.", tone: "warn" },
  strained: { label: "Unsure of you", hint: "Deals cost more and come slower.", tone: "bad" },
  broken: { label: "Lost trust", hint: "No new deals. Shelf space at risk.", tone: "bad" },
};

const FILL: Record<Tone, string> = {
  neutral: "bg-foreground/60",
  good: "bg-sim-good",
  warn: "bg-sim-warn",
  bad: "bg-sim-bad",
};

const TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-sim-good",
  warn: "text-sim-warn",
  bad: "text-sim-bad",
};

/** Tier boundaries, drawn as ticks on the bar. */
const TICKS = [20, 40, 65];

type Props = {
  value: number;
  /** Change from the last reply, shown next to the number. */
  delta?: number;
  className?: string;
};

export function RelationshipMeter({ value, delta, className }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tier = TIER[relationshipTier(clamped)];
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Relationship with Rohit</p>
        <p className="sim-num text-sm text-muted-foreground">
          {delta !== undefined && delta !== 0 && (
            <span key={`${delta}-${clamped}`} className={cn("sim-pop-in mr-1.5 inline-block font-medium", delta > 0 ? "text-sim-good" : "text-sim-bad")}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          <span className="font-semibold text-foreground">{clamped}</span>/100
        </p>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-label="Relationship with Rohit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${clamped} out of 100, ${tier.label}`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", FILL[tier.tone])}
          style={{ width: `${clamped}%` }}
        />
        {TICKS.map((t) => (
          <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-background" style={{ left: `${t}%` }} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className={cn("font-medium", TEXT[tier.tone])}>{tier.label}.</span> {tier.hint}
      </p>
    </div>
  );
}
