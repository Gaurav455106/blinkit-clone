// Tables on the results page: client goals, campaign performance, crisis decisions.

import { Section, Tag, EmptyState } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import type { SavedCampaign, CrisisResponse } from "@/context/SimContext";
import type { CampaignMetrics } from "@/lib/simResults";
import type { GoalRow } from "@/lib/attemptAnalysis";
import { plainText } from "@/lib/rubrics";
import { formatLabel } from "@/lib/resultsExport";

const fmt = (n: number) => n.toLocaleString("en-IN");
const money = (n: number) => `₹${fmt(Math.round(n))}`;

export function fmtTarget(n: number, unit: string): string {
  if (unit === "imp" || unit === "users") return n >= 100000 ? `${(n / 100000).toFixed(1)}L` : fmt(Math.round(n));
  if (unit === "x") return `${Math.round(n * 100) / 100}x`;
  if (unit === "%") return `${Math.round(n * 10) / 10}%`;
  return `${fmt(Math.round(n))} ${unit}`;
}

const TH = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const TD = "px-3 py-2.5 text-sm";

export function GoalTable({ goals, achievementPct }: { goals: readonly GoalRow[]; achievementPct: number }) {
  if (goals.length === 0) return null;
  return (
    <Section
      title="Client goals"
      description="Each goal from the brief, what you reached, and how close you got. Your average across goals decides the goal points."
      actions={<Tag tone={scoreTone(achievementPct, 100)}><span className="sim-num">Average {achievementPct}%</span></Tag>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr><th className={TH}>Goal</th><th className={`${TH} text-right`}>Target</th><th className={`${TH} text-right`}>You reached</th><th className={`${TH} text-right`}>Reached</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {goals.map((g) => (
              <tr key={g.label} className="hover:bg-secondary/50">
                <td className={TD}>{g.label}</td>
                <td className={`${TD} sim-num text-right text-muted-foreground`}>{fmtTarget(g.goal, g.unit)}</td>
                <td className={`${TD} sim-num text-right font-medium`}>{fmtTarget(g.actual, g.unit)}</td>
                <td className={`${TD} text-right`}><Tag tone={scoreTone(g.pct, 100)}><span className="sim-num">{g.pct}%</span></Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">ROAS means sales per ₹1 of ads. CTR is the share of people who clicked after seeing the ad. CVR is the share of clicks that became add-to-carts.</p>
    </Section>
  );
}

const STATUS_TONE = { strong: "good", average: "warn", failing: "bad" } as const;
const STATUS_TEXT = { strong: "Strong", average: "Average", failing: "Weak" } as const;

export function CampaignTable({ metrics, campaigns }: { metrics: readonly CampaignMetrics[]; campaigns: readonly SavedCampaign[] }) {
  return (
    <Section title="Campaign performance" description="How each campaign did over the 30 days.">
      {metrics.length === 0 ? (
        <EmptyState title="No campaigns to show" description="This run has no launched campaigns." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-border">
              <tr>
                <th className={TH}>Campaign</th><th className={`${TH} text-right`}>Spent / budget</th><th className={`${TH} text-right`}>Impressions</th>
                <th className={`${TH} text-right`}>Clicks (CTR)</th><th className={`${TH} text-right`}>Units</th><th className={`${TH} text-right`}>Revenue</th>
                <th className={`${TH} text-right`}>ROAS</th><th className={TH}>Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics.map((m) => {
                const c = campaigns.find((x) => x.id === m.campaignId);
                return (
                  <tr key={m.campaignId} className="hover:bg-secondary/50">
                    <td className={TD}>
                      <div className="font-medium text-foreground">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{formatLabel(c?.adFormat)}</div>
                    </td>
                    <td className={`${TD} sim-num text-right`}>{money(m.spend)} / {money(c?.budget ?? 0)}</td>
                    <td className={`${TD} sim-num text-right`}>{fmt(m.impressions)}</td>
                    <td className={`${TD} sim-num text-right`}>{fmt(m.clicks)} ({m.ctr.toFixed(2)}%)</td>
                    <td className={`${TD} sim-num text-right`}>{fmt(m.units)}</td>
                    <td className={`${TD} sim-num text-right`}>{money(m.revenue)}</td>
                    <td className={`${TD} sim-num text-right font-medium`}>{m.roas.toFixed(2)}x</td>
                    <td className={TD}><Tag tone={STATUS_TONE[m.status]}>{STATUS_TEXT[m.status]}</Tag></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function CrisisList({ crises }: { crises: readonly CrisisResponse[] }) {
  if (crises.length === 0) return null;
  return (
    <Section title="Crisis decisions" description="What you chose when each crisis came up. The option's score is turned into crisis points (8, 9 and 8).">
      <ul className="divide-y divide-border">
        {crises.map((c) => {
          const share = c.maxScore ? (c.score ?? 0) / c.maxScore : 0;
          const verdict = c.bestChoice ? "This was the best option." : share >= 0.6 ? "A good choice, but not the best one." : "A better option was available.";
          return (
            <li key={c.crisisId} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Crisis {c.crisisNum} on day {c.day}</p>
                <p className="font-medium text-foreground">{plainText(c.title ?? "Crisis")}</p>
                <p className="mt-1 text-sm">You chose: <span className="font-medium">{plainText(c.optionLabel ?? (c.optionKey ?? "").toUpperCase())}</span></p>
                {c.effectLabel && <p className="text-sm text-muted-foreground">What it did: {plainText(c.effectLabel)}</p>}
                <p className="mt-1 text-sm">{verdict}</p>
              </div>
              <Tag tone={c.bestChoice ? "good" : scoreTone(c.score ?? 0, c.maxScore ?? 1)}>
                <span className="sim-num">{c.score ?? 0} / {c.maxScore ?? "?"}</span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
