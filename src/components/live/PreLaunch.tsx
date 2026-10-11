// ── Before the run starts: the campaigns that will go live on day 1 ──────────

import { Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import type { SavedCampaign } from "@/context/SimContext";
import type { CalendarEntry } from "@/market/calendar";
import { EmptyState, PageHeader, Section, Tag } from "@/components/sim/primitives";
import { CalendarStrip } from "@/components/live/LiveEvents";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS } from "@/components/live/formatLabels";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Props = {
  brandName: string;
  campaigns: readonly SavedCampaign[];
  calendar: readonly CalendarEntry[];
  onNew: () => void;
  onEdit: (c: SavedCampaign) => void;
  onDelete: (id: string) => void;
  onGoLive: () => void;
};

export function PreLaunch({ brandName, campaigns, calendar, onNew, onEdit, onDelete, onGoLive }: Props) {
  const ready = campaigns.filter((c) => !c.isDraft);
  const drafts = campaigns.filter((c) => c.isDraft);
  return (
    <>
      <PageHeader
        eyebrow={`${brandName} · before day 1`}
        title="Set up, then go live"
        description="Build your campaigns in the Blinkit wizard. When you go live, 30 days run one at a time. You can change bids, budgets, hours and states every day, and add campaigns any time."
        actions={
          <>
            <Button data-tour="v2-new-campaign" variant="outline" onClick={onNew}><Plus className="mr-1 h-4 w-4" />New campaign</Button>
            <Button data-tour="v2-go-live" onClick={onGoLive} disabled={ready.length === 0}><Rocket className="mr-1 h-4 w-4" />Go live</Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Section tour="v2-campaign-list" title="Your campaigns" description="These start on day 1. Drafts don't run until you finish them.">
          {campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Start with the format that fits the brief. You can add more later, even mid-run."
              action={<Button onClick={onNew}><Plus className="mr-1 h-4 w-4" />Create your first campaign</Button>}
            />
          ) : (
            <ul className="divide-y divide-border">
              {[...ready, ...drafts].map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {c.name} {c.isDraft && <Tag tone="warn">Draft</Tag>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {FORMAT_LABELS[c.adFormat ?? ""] ?? "Format not set"} · {c.budgetType === "overall" ? `${rupees(c.budget)} total` : `${rupees(c.budget)} a day`} ·{" "}
                      {c.geography === "pan_india" ? "Pan India" : c.cities.join(", ") || "No states"} · {c.keywords.length} keyword{c.keywords.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div data-tour="v2-calendar"><CalendarStrip calendar={calendar} day={0} /></div>
      </div>
    </>
  );
}
