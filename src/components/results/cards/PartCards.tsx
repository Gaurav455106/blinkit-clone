// The four parts of the score as cards dealt onto the table. Click a card to
// flip it and see where its marks came from and went.

import { useState } from "react";
import { ScoreBar } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { CountUp, stagger } from "@/components/game/GameBits";
import { FlipCard } from "@/components/game/FlipCard";
import { SCORE_SCHEMES, type LineResult } from "@/lib/rubrics";
import { cn } from "@/lib/utils";

const DEAL_STEP_MS = 140;
const DEAL_ROTATIONS = ["-7deg", "-2deg", "3deg", "8deg"];
const LINES_ON_BACK = 5;
const one = (n: number) => Math.round(n * 10) / 10;

const TONE_EDGE = { good: "border-t-sim-good", warn: "border-t-sim-warn", bad: "border-t-sim-bad", neutral: "border-t-border" } as const;

/** A part's lines, biggest loss first. */
export function linesByLoss(lines: readonly LineResult[], part: string): LineResult[] {
  return lines.filter((l) => l.category === part).sort((a, b) => (b.max - b.earned) - (a.max - a.earned));
}

function Front({ label, earned, max, index }: { label: string; earned: number; max: number; index: number }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="sim-num text-3xl font-semibold text-foreground">
        <CountUp value={earned} from={0} ms={900 + index * DEAL_STEP_MS} format={(n) => one(n).toString()} />
        <span className="text-base font-normal text-muted-foreground"> / {max}</span>
      </p>
      <ScoreBar earned={one(earned)} max={max} label={`${label} total`} className="[&>span]:hidden" />
      <p className="text-xs text-muted-foreground">Click to see the lines</p>
    </div>
  );
}

function Back({ label, lines }: { label: string; lines: readonly LineResult[] }) {
  return (
    <div className="flex h-full flex-col gap-2 p-5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {lines.length === 0 ? <p className="text-xs text-muted-foreground">Nothing was scored in this part.</p> : (
        <ul className="space-y-1.5 text-xs">
          {lines.slice(0, LINES_ON_BACK).map((l) => (
            <li key={l.key} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-foreground" title={l.label}>{l.label}</span>
              <span className={cn("sim-num shrink-0", l.earned >= l.max ? "text-sim-good" : "text-muted-foreground")}>{one(l.earned)}/{one(l.max)}</span>
            </li>
          ))}
        </ul>
      )}
      {lines.length > LINES_ON_BACK && <p className="mt-auto text-xs text-muted-foreground">+{lines.length - LINES_ON_BACK} more below</p>}
    </div>
  );
}

export function PartCards({ lines }: { lines: readonly LineResult[] }) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setFlipped((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Score by part">
      {SCORE_SCHEMES[2].map((part, i) => {
        const mine = linesByLoss(lines, part.key);
        const earned = mine.reduce((s, l) => s + l.earned, 0);
        const face = cn("border border-border border-t-4 bg-card shadow-sm", TONE_EDGE[scoreTone(earned, part.max)]);
        return (
          <li key={part.key} className="sim-deal" style={{ ...stagger(i, DEAL_STEP_MS), ["--sim-deal-rot" as string]: DEAL_ROTATIONS[i] }}>
            <FlipCard
              className="h-full"
              faceClassName={face}
              flipped={flipped.has(part.key)}
              onFlip={() => toggle(part.key)}
              front={<Front label={part.label} earned={earned} max={part.max} index={i} />}
              back={<Back label={part.label} lines={mine} />}
            />
          </li>
        );
      })}
    </ul>
  );
}
