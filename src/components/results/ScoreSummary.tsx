// Plain-English summary: one short paragraph per part of the score.

import { Section, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import type { CategorySummary } from "@/lib/rubrics";

interface ScoreSummaryProps {
  summaries: readonly CategorySummary[];
  title?: string;
  description?: string;
}

export function ScoreSummary({
  summaries,
  title = "Why you got this score",
  description = "What went well, where you lost points, and what to do first next time.",
}: ScoreSummaryProps) {
  return (
    <Section title={title} description={description}>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        {summaries.map((s) => (
          <article key={s.category} className="border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">{s.label}</h3>
              <Tag tone={scoreTone(s.earned, s.max)}><span className="sim-num">{s.earned} / {s.max}</span></Tag>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{s.paragraph}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
