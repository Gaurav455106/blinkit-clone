// "How students are judged": the marking scheme for trainers and admins.
// A weight bar for the four parts (click one to open it), the open part's
// lines with their marks, and the old scoring for runs saved before v2.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section, Tag } from "@/components/sim/primitives";
import { SCORING_GUIDE_V2, type GuidePart } from "@/lib/scoringGuide";
import { RUBRICS, SCORE_SCHEMES } from "@/lib/rubrics";
import { cn } from "@/lib/utils";

const PART_COLOR: Record<GuidePart["key"], string> = {
  setup: "bg-sky-700",
  live: "bg-primary",
  eventsRohit: "bg-amber-700",
  results: "bg-violet-700",
};

function WeightBar({ open, onOpen }: { open: GuidePart["key"]; onOpen: (k: GuidePart["key"]) => void }) {
  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Parts of the score">
      {SCORING_GUIDE_V2.map((p) => (
        <button
          key={p.key}
          type="button"
          role="tab"
          aria-selected={open === p.key}
          onClick={() => onOpen(p.key)}
          style={{ flexGrow: p.max }}
          className={cn(
            "sim-lift min-w-0 basis-0 rounded-lg px-3 py-2 text-left text-white transition-opacity",
            PART_COLOR[p.key], open === p.key ? "opacity-100 ring-2 ring-offset-2 ring-foreground/30" : "opacity-75 hover:opacity-95",
          )}
        >
          <span className="sim-num block text-lg font-semibold leading-tight">{p.max}</span>
          <span className="block truncate text-xs">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function PartDetail({ part }: { part: GuidePart }) {
  return (
    <div key={part.key} className="sim-rise space-y-3">
      <p className="text-sm text-muted-foreground">{part.question}</p>
      <ul className="divide-y divide-border rounded-xl bg-secondary/40">
        {part.lines.map((l) => (
          <li key={l.label} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr_1fr] md:gap-6">
            <div className="flex items-start justify-between gap-2 md:block">
              <p className="font-medium text-foreground">{l.label}</p>
              <span className="sim-num mt-0.5 inline-block text-sm font-semibold text-primary">{l.max} marks</span>
            </div>
            <p className="text-sm text-foreground">{l.what}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {l.marks.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OldScoring() {
  const [shown, setShown] = useState(false);
  return (
    <div className="mt-6 border-t border-border pt-4">
      <button type="button" onClick={() => setShown((s) => !s)} aria-expanded={shown} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <ChevronDown className={cn("h-4 w-4 transition-transform", shown && "rotate-180")} aria-hidden />
        Old scoring (runs marked "Old")
      </button>
      {shown && (
        <div className="sim-rise mt-3 grid gap-4 md:grid-cols-2">
          {SCORE_SCHEMES[1].map((cat) => (
            <div key={cat.key} className="rounded-xl bg-secondary/40 px-4 py-3">
              <p className="mb-2 flex justify-between text-sm font-semibold"><span>{cat.label}</span><span className="sim-num">{cat.max}</span></p>
              <ul className="space-y-2">
                {RUBRICS.filter((r) => r.category === cat.key).map((r) => (
                  <li key={r.key} className="text-xs">
                    <p className="flex justify-between gap-2 text-foreground"><span>{r.label}</span><Tag>{r.max}</Tag></p>
                    <p className="text-muted-foreground">{r.tiers.filter((t) => t.reachable !== false).map((t) => `${t.points}: ${t.short}`).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoringGuide() {
  const [open, setOpen] = useState<GuidePart["key"]>("live");
  const part = SCORING_GUIDE_V2.find((p) => p.key === open) ?? SCORING_GUIDE_V2[0];
  return (
    <Section title="How students are judged" description="Out of 100. Click a part to see what earns its marks.">
      <div className="space-y-5">
        <WeightBar open={open} onOpen={setOpen} />
        <PartDetail part={part} />
      </div>
      <OldScoring />
    </Section>
  );
}
