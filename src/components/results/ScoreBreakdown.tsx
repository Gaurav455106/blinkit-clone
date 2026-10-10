// "How you were scored": one block per part (category) with every line in it.

import { ScoreBar, Section } from "@/components/sim/primitives";
import { LineDetail } from "@/components/results/LineDetail";
import { SCORE_SCHEMES, type LineResult, type ScoreVersion } from "@/lib/rubrics";

interface ScoreBreakdownProps {
  lines: readonly LineResult[];
  version?: ScoreVersion;
  showUnreachable?: boolean;
  title?: string;
  description?: string;
}

export function ScoreBreakdown({
  lines, version = 1, showUnreachable = false,
  title = "How you were scored",
  description = "Each part of your score, line by line. Open a line to see what we looked at, every level of points, and what would have earned more.",
}: ScoreBreakdownProps) {
  return (
    <Section title={title} description={description}>
      <div className="space-y-8">
        {SCORE_SCHEMES[version].map((cat) => {
          const mine = lines.filter((l) => l.category === cat.key);
          const earned = mine.reduce((s, l) => s + l.earned, 0);
          return (
            <section key={cat.key} aria-labelledby={`cat-${cat.key}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h3 id={`cat-${cat.key}`} className="text-base font-semibold text-foreground">{cat.label}</h3>
                <ScoreBar earned={earned} max={cat.max} label={`${cat.label} total`} className="w-full max-w-xs" />
              </div>
              {mine.length === 0
                ? <p className="text-sm text-muted-foreground">Nothing was scored in this part.</p>
                : <div className="space-y-2">{mine.map((l) => <LineDetail key={l.key} line={l} showUnreachable={showUnreachable} />)}</div>}
            </section>
          );
        })}
      </div>
    </Section>
  );
}
