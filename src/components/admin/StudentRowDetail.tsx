// Expanded detail for one student's attempt in the staff tables:
// part scores, campaigns and crisis decisions.

import { ScoreBar, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { attemptCampaigns, attemptCrisisResponses, attemptTotals, attemptVersion, type AttemptRow } from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES } from "@/lib/rubrics";
import { formatLabel } from "@/lib/resultsExport";

const MAX_KEYWORDS_SHOWN = 3;

export function StudentRowDetail({ row }: { row: AttemptRow }) {
  const totals = attemptTotals(row);
  const cats = SCORE_SCHEMES[attemptVersion(row)];
  const campaigns = attemptCampaigns(row);
  const crises = attemptCrisisResponses(row);
  const h = "mb-2 text-xs font-medium text-muted-foreground";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div>
        <p className={h}>Score by part</p>
        {totals ? (
          <div className="space-y-2">
            {cats.map((c) => (
              <div key={c.key}>
                <p className="text-xs text-foreground">{c.label}</p>
                <ScoreBar earned={totals[c.key] ?? 0} max={c.max} label={c.label} />
              </div>
            ))}
            <p className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total</span><span className="sim-num">{row.score_total}/100</span>
            </p>
          </div>
        ) : <p className="text-sm text-muted-foreground">No part scores saved.</p>}
      </div>

      <div>
        <p className={h}>Campaigns ({campaigns.length})</p>
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaign data saved.</p>}
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <li key={c.id || c.name} className="rounded-lg bg-secondary/60 px-3 py-2 text-xs">
              <p className="truncate font-medium text-foreground">{c.name}</p>
              <p className="text-muted-foreground">
                {formatLabel(c.adFormat)}{c.objective ? `, ${c.objective}` : ""}, ₹{c.budget.toLocaleString("en-IN")}
              </p>
              {c.geography && <p className="text-muted-foreground">{c.geography === "pan_india" ? "Pan India" : c.states.join(", ")}</p>}
              {c.keywords.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.keywords.slice(0, MAX_KEYWORDS_SHOWN).map((kw) => <Tag key={kw}>{kw}</Tag>)}
                  {c.keywords.length > MAX_KEYWORDS_SHOWN && <span className="text-muted-foreground">+{c.keywords.length - MAX_KEYWORDS_SHOWN} more</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className={h}>Crisis decisions</p>
        {crises.length === 0 && <p className="text-sm text-muted-foreground">No crisis answers saved.</p>}
        <ul className="space-y-2">
          {crises.map((cr) => (
            <li key={cr.crisisNum} className="rounded-lg bg-secondary/60 px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-foreground">Crisis {cr.crisisNum}{cr.day !== null ? `, day ${cr.day}` : ""}</span>
                <Tag tone={scoreTone(cr.earned, cr.max)}><span className="sim-num">{cr.earned}/{cr.max}</span></Tag>
              </div>
              <p className="mt-0.5 truncate text-muted-foreground" title={cr.optionLabel}>Option {cr.optionKey.toUpperCase()}: {cr.optionLabel}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
