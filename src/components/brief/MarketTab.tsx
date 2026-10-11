import { activeStoresFor, CITY_STORE_COUNT, type Scenario } from "@/data/scenarios";
import { Section, Tag } from "@/components/sim/primitives";
import type { BriefRival, StateDemandRow } from "@/lib/briefData";
import { RIVAL_POSITIONING } from "@/components/brief/copy";
import { PinButton } from "@/components/brief/PinButton";
import { inr, pct } from "@/components/brief/format";

type Props = {
  scenario: Scenario;
  rivals: readonly BriefRival[];
  states: readonly StateDemandRow[];
};

const OSA_HEALTHY = 70;
const OSA_PARTIAL = 30;

function osaTone(osa: number) {
  return osa >= OSA_HEALTHY ? "good" as const : osa >= OSA_PARTIAL ? "warn" as const : "bad" as const;
}

function RivalRow({ rival }: { rival: BriefRival }) {
  const positioning = RIVAL_POSITIONING[rival.id] ?? "";
  return (
    <li className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{rival.name}</h3>
          <Tag tone={rival.archetype === "leader" ? "neutral" : "warn"}>{rival.archetypeLabel}</Tag>
        </div>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{positioning}</p>
        {rival.keyTerms.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Their ads show on: <span className="text-foreground">{rival.keyTerms.join(", ")}</span>
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-1">
        <div>
          <dt className="text-xs text-muted-foreground">Their average price vs yours</dt>
          <dd className="sim-num font-medium text-foreground">
            {inr(rival.price)} <span className="font-normal text-muted-foreground">vs {inr(rival.priceVsYou.skuPrice)}</span>
          </dd>
          <dd className="text-xs text-muted-foreground">{rival.priceVsYou.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ad share last month</dt>
          <dd className="sim-num font-medium text-foreground">{rival.lastMonthSovPct}%</dd>
        </div>
      </dl>
      <PinButton note={`${rival.name} (${rival.archetypeLabel.toLowerCase()}): ${inr(rival.price)}, ${rival.lastMonthSovPct}% ad share, ads on ${rival.keyTerms.join(", ")}`} className="justify-self-end" />
    </li>
  );
}

function DemandBar({ share, max }: { share: number; max: number }) {
  const width = max > 0 ? (share / max) * 100 : 0;
  return (
    <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-sm" aria-hidden>
      <div className="h-full rounded-r-[4px] bg-primary/70" style={{ width: `${width}%` }} />
    </div>
  );
}

function StateTable({ states }: { states: readonly StateDemandRow[] }) {
  const max = Math.max(0, ...states.map((s) => s.demandShare));
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Demand share and stock by stocked state</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">State</th>
            <th scope="col" className="py-2 pr-4 font-medium">Share of all searches in India</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">On the shelf</th>
            <th scope="col" className="py-2 text-right font-medium">Stores with stock</th>
          </tr>
        </thead>
        <tbody>
          {states.map((s) => (
            <tr key={s.state} className="border-b border-border/60 last:border-0 hover:bg-secondary/40" title={`${s.state}: ${pct(s.demandShare, 1)} of searches, on the shelf in ${s.osa}% of stores`}>
              <td className="py-3 pr-4 font-medium text-foreground">{s.state}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <span className="sim-num w-12 text-foreground">{pct(s.demandShare, 1)}</span>
                  <DemandBar share={s.demandShare} max={max} />
                </div>
              </td>
              <td className="py-3 pr-4 text-right"><Tag tone={osaTone(s.osa)}>{s.osa}%</Tag></td>
              <td className="sim-num py-3 text-right text-muted-foreground">
                {activeStoresFor(s.state, s.osa)} of {CITY_STORE_COUNT[s.state]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketTab({ scenario, rivals, states }: Props) {
  const coverage = states.reduce((sum, s) => sum + s.demandShare, 0);
  return (
    <div className="space-y-6">
      <Section
        title="Rivals"
        description="We compare each rival's average price with your product closest in price. Ad share is how often their ad showed, out of all ad spots. You can't see their bids: neither can anyone on the real platform."
      >
        {rivals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rival data for this brand.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rivals.map((r) => <RivalRow key={r.id} rival={r} />)}
          </ul>
        )}
      </Section>

      <Section
        title="Where your shoppers are"
        description={`How many searches each state had last month, and how much stock you have today. Your ${states.length} states with stock get ${pct(coverage)} of all ${scenario.profile.category.toLowerCase()} searches in India.`}
        actions={<PinButton note={`States with stock get ${pct(coverage)} of all searches: ${states.map((s) => s.state).join(", ")}`} />}
      >
        {states.length === 0 ? (
          <p className="text-sm text-muted-foreground">No state has stock in this scenario.</p>
        ) : (
          <StateTable states={states} />
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          “On the shelf” (OSA) is the share of Blinkit's local stores in that state that have your product right now.
        </p>
        <p className="mt-4 max-w-[75ch] text-sm leading-relaxed text-foreground">
          Your ads only run where you have stock. So choosing Pan India costs nothing extra: no money is spent in states
          with no stock. If stock later arrives in a new state, a Pan India campaign starts showing there by itself.
          Keep an eye on stock in the states above, because ads stop when a state sells out.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Which state sells best isn't known yet. You'll find out from live results.</p>
      </Section>
    </div>
  );
}
