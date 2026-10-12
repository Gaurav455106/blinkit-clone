// The blocks inside an expanded student row: part scores, where points were
// lost, client goals, campaigns, and crisis decisions or costliest mistakes.

import type { ReactNode } from "react";
import { ScoreBar, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { fmtTarget } from "@/components/results/ResultTables";
import {
  attemptCampaigns, attemptCrisisResponses, attemptTotals, attemptVersion, goalRowsOf, gradeLabelOf, type AttemptRow,
} from "@/lib/attemptAnalysis";
import { costliestMistakesOf, topLosses } from "@/lib/attemptDetail";
import { SCORE_SCHEMES } from "@/lib/rubrics";
import { formatLabel } from "@/lib/resultsExport";

const MAX_KEYWORDS_SHOWN = 3;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Block({ title, children, delay = 0 }: { title: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <div className="sim-rise" style={{ ["--sim-delay" as string]: `${delay}ms` }}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;
const card = "rounded-lg bg-card px-3 py-2 text-xs shadow-[0_1px_0_hsl(var(--border))]";

export function PartScores({ row }: { row: AttemptRow }) {
  const totals = attemptTotals(row);
  const cats = SCORE_SCHEMES[attemptVersion(row)];
  return (
    <Block title="Score by part">
      {totals ? (
        <div className="space-y-2.5">
          {cats.map((c) => (
            <div key={c.key}>
              <p className="flex justify-between text-xs text-foreground">
                <span>{c.label}</span>
                <span className="sim-num text-muted-foreground">{Math.round((totals[c.key] ?? 0) * 10) / 10}/{c.max}</span>
              </p>
              <ScoreBar earned={totals[c.key] ?? 0} max={c.max} label={c.label} className="[&>span]:hidden" />
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-right">
              <span className="sim-num text-sm font-semibold">{row.score_total}/100</span>
              <span className="block text-[11px] text-muted-foreground">{gradeLabelOf(row)}</span>
            </span>
          </div>
        </div>
      ) : <Empty>No part scores saved.</Empty>}
    </Block>
  );
}

export function LossesAndGoals({ row }: { row: AttemptRow }) {
  const losses = topLosses(row);
  const goals = goalRowsOf(row);
  return (
    <div className="space-y-5">
      <Block title="Where points were lost" delay={60}>
        {losses.length === 0 && <Empty>{attemptTotals(row) ? "Full marks." : "No scores saved."}</Empty>}
        <ul className="space-y-1.5">
          {losses.map((l) => (
            <li key={l.key} className={`${card} flex items-center justify-between gap-2`} title={l.note}>
              <span className="truncate text-foreground">{l.label}</span>
              <Tag tone="bad"><span className="sim-num">-{l.lost}</span></Tag>
            </li>
          ))}
        </ul>
      </Block>
      {goals.length > 0 && (
        <Block title="Client goals" delay={120}>
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.label} className="text-xs">
                <p className="flex justify-between gap-2">
                  <span className="truncate text-foreground">{g.label}</span>
                  <span className="sim-num shrink-0 text-muted-foreground">{fmtTarget(g.actual, g.unit)} of {fmtTarget(g.goal, g.unit)}</span>
                </p>
                <ScoreBar earned={g.pct} max={100} label={g.label} className="mt-1 [&>span]:hidden" />
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Campaigns({ row }: { row: AttemptRow }) {
  const campaigns = attemptCampaigns(row);
  return (
    <Block title={`Campaigns (${campaigns.length})`} delay={180}>
      {campaigns.length === 0 && <Empty>No campaign data saved.</Empty>}
      <ul className="space-y-1.5">
        {campaigns.map((c) => (
          <li key={c.id || c.name} className={card}>
            <p className="flex justify-between gap-2">
              <span className="truncate font-medium text-foreground">{c.name}</span>
              <span className="sim-num shrink-0 text-muted-foreground">{rupees(c.budget)}</span>
            </p>
            <p className="text-muted-foreground">
              {formatLabel(c.adFormat)}{c.geography ? ` · ${c.geography === "pan_india" ? "Pan India" : c.states.join(", ")}` : ""}
            </p>
            {c.keywords.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.keywords.slice(0, MAX_KEYWORDS_SHOWN).map((kw) => <Tag key={kw}>{kw}</Tag>)}
                {c.keywords.length > MAX_KEYWORDS_SHOWN && <span className="text-muted-foreground">+{c.keywords.length - MAX_KEYWORDS_SHOWN}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Crises({ row }: { row: AttemptRow }) {
  const crises = attemptCrisisResponses(row);
  if (crises.length === 0) return null;
  return (
    <Block title="Crisis decisions" delay={240}>
      <ul className="space-y-1.5">
        {crises.map((cr) => (
          <li key={cr.crisisNum} className={card} title={cr.optionLabel}>
            <p className="flex justify-between gap-2">
              <span className="font-medium text-foreground">Day {cr.day ?? "?"}: option {cr.optionKey.toUpperCase()}</span>
              <Tag tone={scoreTone(cr.earned, cr.max)}><span className="sim-num">{cr.earned}/{cr.max}</span></Tag>
            </p>
            <p className="truncate text-muted-foreground">{cr.optionLabel}</p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Mistakes({ row }: { row: AttemptRow }) {
  const mistakes = costliestMistakesOf(row);
  if (mistakes.length === 0) return null;
  return (
    <Block title="Costliest mistakes" delay={240}>
      <ul className="space-y-1.5">
        {mistakes.map((m) => (
          <li key={m.title} className={card} title={`Did: ${m.what}`}>
            <p className="flex justify-between gap-2">
              <span className="truncate font-medium text-foreground">{m.title}</span>
              <Tag tone="bad"><span className="sim-num">{rupees(m.lost)}</span></Tag>
            </p>
            <p className="truncate text-muted-foreground">Did: {m.what}</p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function PlanAndDecisions({ row }: { row: AttemptRow }) {
  return (
    <div className="space-y-5">
      <Campaigns row={row} />
      <Crises row={row} />
      <Mistakes row={row} />
    </div>
  );
}
