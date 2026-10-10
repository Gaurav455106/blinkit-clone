// The numbers behind one of Rohit's lines (SPEC §6: "every Rohit line shows
// the data behind it"), so a student can check him instead of trusting him.

import { cn } from "@/lib/utils";
import type { Tone } from "@/components/sim/tone";

export interface ChipData {
  label: string;
  value: string;
  tone: Tone;
}

const VALUE_TONE: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-sim-good",
  warn: "text-sim-warn",
  bad: "text-sim-bad",
};

type Props = {
  chips: readonly ChipData[];
  caption?: string;
  className?: string;
};

export function DataChips({ chips, caption, className }: Props) {
  if (chips.length === 0) return null;
  return (
    <div className={cn("mt-3", className)}>
      {caption && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{caption}</p>}
      <ul className="flex flex-wrap gap-1.5" aria-label={caption ?? "Data behind this"}>
        {chips.map((chip) => (
          <li
            key={`${chip.label}|${chip.value}`}
            className="flex min-w-0 max-w-full flex-col rounded-lg bg-background px-2.5 py-1.5 shadow-[inset_0_0_0_1px_hsl(var(--border))]"
          >
            <span className="text-[11px] leading-tight text-muted-foreground">{chip.label}</span>
            <span className={cn("sim-num text-sm font-semibold leading-snug", VALUE_TONE[chip.tone])}>{chip.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
