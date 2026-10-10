// Promises made to Rohit and whether they were kept (SPEC §6). Feed it the
// output of checkCommitments() each day.
//
// Usage (live dashboard):
//
//   const results = checkCommitments(commitments, state, history);
//   <Section title="Promises to Rohit">
//     <CommitmentsList results={results} currentDay={state.day} />
//   </Section>

import { cn } from "@/lib/utils";
import { Tag } from "@/components/sim/primitives";
import type { Tone } from "@/components/sim/tone";
import type { CommitmentResult, CommitmentStatus } from "@/market/rohit";

const STATUS: Record<CommitmentStatus, { label: string; tone: Tone }> = {
  pending: { label: "In progress", tone: "neutral" },
  kept: { label: "Kept", tone: "good" },
  broken: { label: "Broken", tone: "bad" },
};

function dueText(result: CommitmentResult, currentDay?: number): string {
  const { dueDay } = result.commitment;
  if (result.status !== "pending" || currentDay === undefined) return `Due day ${dueDay}`;
  const left = dueDay - currentDay;
  return left <= 0 ? `Checked after day ${dueDay}` : `Due day ${dueDay}, ${left} ${left === 1 ? "day" : "days"} left`;
}

function deltaText(result: CommitmentResult): string {
  const { keptDelta, brokenDelta } = result.commitment;
  if (result.status === "kept") return `Relationship +${keptDelta}`;
  if (result.status === "broken") return `Relationship ${brokenDelta}`;
  return `Keep it: +${keptDelta}. Break it: ${brokenDelta}.`;
}

type Props = {
  results: readonly CommitmentResult[];
  currentDay?: number;
  className?: string;
};

export function CommitmentsList({ results, currentDay, className }: Props) {
  if (results.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No promises yet. When you promise Rohit something, it shows up here and gets checked on its due day.
      </p>
    );
  }
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {results.map((r) => (
        <li key={r.commitment.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{r.commitment.text}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dueText(r, currentDay)}. {deltaText(r)}
            </p>
          </div>
          <Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag>
        </li>
      ))}
    </ul>
  );
}
