// Shows how Rohit values a deal, line by line: in his counter ("How Rohit worked
// this out") and live on the deal sheet, so the student can balance it before sending.

import type { MarketContext } from "@/market/engineTypes";
import type { DealTerms } from "@/market/deal";
import { dealValue, type DealValue, type ValueLine } from "@/market/dealValueLines";
import { formatRupees as inr } from "@/lib/money";
import { Section, Tag } from "@/components/sim/primitives";

function Lines({ title, lines, total, empty }: { title: string; lines: readonly ValueLine[]; total: number; empty: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
        <span>{title}</span>
        <span className="tabular-nums">{inr(total)}</span>
      </h3>
      {lines.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2.5">
          {lines.map((l) => (
            <li key={l.key} className="border-t border-border pt-2.5 first:border-t-0 first:pt-0">
              <p className="flex items-baseline justify-between gap-3 text-sm text-foreground">
                <span>{l.label}</span>
                <span className="shrink-0 tabular-nums">{inr(l.value)}</span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{l.how}</p>
              {l.change && <p className="mt-1 text-xs font-medium text-sim-warn">{l.change}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Columns({ v }: { v: DealValue }) {
  return (
    <div className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
      <Lines title="What you ask for costs Rohit" lines={v.asks} total={v.asked} empty="You haven't asked for anything." />
      <Lines title="What you offer is worth to him" lines={v.gives} total={v.given} empty="You haven't offered anything." />
    </div>
  );
}

/**
 * Inside Rohit's counter, under his two totals. Closed by default; open when an ask now
 * costs a different amount than on the deal sheet (`sent`), so the change is explained.
 */
export function DealValueWorking({ ctx, terms, sent }: { ctx: MarketContext; terms: DealTerms; sent?: DealTerms }) {
  const v = dealValue(ctx, terms, sent);
  const changed = v.asks.filter((l) => l.change);
  const moved = changed.length > 0;
  const note = changed.every((l) => l.change?.startsWith("Up")) ? "Your asks now cost more than on your deal sheet."
    : changed.every((l) => l.change?.startsWith("Down")) ? "Your asks now cost less than on your deal sheet."
    : "Some asks now cost more, some less, than on your deal sheet.";
  return (
    <details open={moved} className="group mt-3 rounded-xl border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground marker:text-muted-foreground">
        How Rohit worked this out{moved && <span className="ml-2 text-xs font-normal text-sim-warn">{`${note} See why below.`}</span>}
      </summary>
      <div className="mt-3"><Columns v={v} /></div>
    </details>
  );
}

function balanceTag(asked: number, balance: number) {
  if (asked === 0 && balance === 0) return <Tag tone="neutral">Nothing asked or offered</Tag>;
  if (balance < 0) return <Tag tone="warn">{`Short by ${inr(-balance)}: Rohit will counter`}</Tag>;
  if (balance === 0) return <Tag tone="good">Balanced</Tag>;
  return <Tag tone="good">{`Covered: you offer ${inr(balance)} more than you ask`}</Tag>;
}

/** On the deal sheet: the live balance while the student builds the deal. */
export function DealValueSheet({ ctx, terms }: { ctx: MarketContext; terms: DealTerms }) {
  const v = dealValue(ctx, terms);
  const { asked, balance } = v;
  return (
    <Section
      title="How Rohit will value this"
      description="Rohit weighs what your asks cost him against what your offers are worth to him. If your offers come up short, he will counter."
      actions={balanceTag(asked, balance)}
    >
      <Columns v={v} />
    </Section>
  );
}
