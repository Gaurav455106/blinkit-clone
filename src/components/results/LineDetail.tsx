// One scored line: points, what was looked at, every level with yours marked,
// why you got it, and what would earn more. Works for v1 and v2 lines.

import { ChevronDown } from "lucide-react";
import { ScoreBar, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { lineGuide, lineTier, plainText, type LineResult, type RubricTier } from "@/lib/rubrics";
import { cn } from "@/lib/utils";

function pointsLabel(t: RubricTier): string {
  return t.minPoints !== undefined && t.minPoints !== t.points ? `${t.minPoints} to ${t.points}` : `${t.points}`;
}

interface LevelListProps {
  tiers: readonly RubricTier[];
  current: RubricTier | null;
  showUnreachable: boolean;
}

function LevelList({ tiers, current, showUnreachable }: LevelListProps) {
  const visible = tiers.filter((t) => showUnreachable || t.reachable !== false || t === current);
  return (
    <ol className="space-y-1.5" aria-label="Scoring levels, highest first">
      {visible.map((t) => {
        const mine = t === current;
        return (
          <li
            key={`${t.points}-${t.minPoints ?? ""}`}
            className={cn(
              "grid grid-cols-[4.5rem_1fr] gap-3 rounded-lg px-3 py-2 text-sm",
              mine ? "bg-accent text-accent-foreground ring-1 ring-primary/30" : "text-muted-foreground",
            )}
            aria-current={mine ? "true" : undefined}
          >
            <span className={cn("sim-num font-medium", mine ? "text-accent-foreground" : "text-foreground")}>
              {pointsLabel(t)} pts
            </span>
            <span>
              {t.condition}
              {mine && <span className="ml-2 align-middle"><Tag tone="good">Your level</Tag></span>}
              {t.reachable === false && <span className="ml-2 text-xs italic">(not given by the current scoring)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface LineDetailProps {
  line: LineResult;
  /** Show levels the current code can never give (trainer views). */
  showUnreachable?: boolean;
  defaultOpen?: boolean;
}

export function LineDetail({ line, showUnreachable = false, defaultOpen }: LineDetailProps) {
  const guide = lineGuide(line);
  const current = lineTier(line);
  const lost = line.max - line.earned;
  const open = defaultOpen ?? lost > 0;
  const tone = scoreTone(line.earned, line.max);
  return (
    <details open={open} className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-4 rounded-xl px-4 py-3 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{line.label}</span>
            {lost > 0
              ? <Tag tone={tone}>Lost {lost} {lost === 1 ? "point" : "points"}</Tag>
              : <Tag tone="good">Full marks</Tag>}
          </div>
          <ScoreBar earned={line.earned} max={line.max} label={`${line.label} score`} className="mt-2 max-w-md" />
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-5 border-t border-border px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4 text-sm">
          {guide.judgedOn && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">What we looked at</h4>
              <p className="mt-1 text-foreground">{guide.judgedOn}</p>
            </div>
          )}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">Why you got this</h4>
            <p className="mt-1 text-foreground">{plainText(line.note) || "No reason was saved for this line."}</p>
          </div>
          {lost > 0 && guide.howToImprove && (
            <div className="rounded-lg bg-sim-highlight/15 px-3 py-2">
              <h4 className="text-xs font-medium text-foreground">To earn more</h4>
              <p className="mt-1 text-foreground">{guide.howToImprove}</p>
            </div>
          )}
        </div>
        {guide.tiers.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">How the points work</h4>
            <LevelList tiers={guide.tiers} current={current} showUnreachable={showUnreachable} />
          </div>
        )}
      </div>
    </details>
  );
}
