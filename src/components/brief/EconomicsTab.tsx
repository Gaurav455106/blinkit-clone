import type { BrandProfile } from "@/data/scenarios";
import { Section } from "@/components/sim/primitives";
import { skuEconomics, workedExample } from "@/lib/briefData";
import { PinButton } from "@/components/brief/PinButton";
import { inr, pct, roasX } from "@/components/brief/format";

type Props = { profile: BrandProfile };

function SkuTable({ profile }: Props) {
  const rows = skuEconomics(profile);
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Product</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Price (MRP)</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">You keep per unit</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Break-even ROAS</th>
            <th scope="col" className="py-2 pr-4 font-medium">How fast it sells</th>
            <th scope="col" className="py-2"><span className="sr-only">Pin</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
              <td className="py-3 pr-4 font-medium text-foreground">{r.name}</td>
              <td className="py-3 pr-4 text-right">{inr(r.mrp)}</td>
              <td className="py-3 pr-4 text-right">
                {inr(r.margin)} <span className="text-xs text-muted-foreground">({pct(r.marginPct)} of price)</span>
              </td>
              <td className="py-3 pr-4 text-right font-semibold text-foreground">{roasX(r.breakEven)}</td>
              <td className="py-3 pr-4 text-muted-foreground">{r.velocity}</td>
              <td className="py-3 text-right">
                <PinButton note={`${r.name}: break-even ROAS ${roasX(r.breakEven)}, keeps ${inr(r.margin)} per unit`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkedExampleBlock({ profile }: Props) {
  const ex = workedExample(profile);
  const units = ex.unitsToBreakEven.toFixed(1);
  const steps = [
    { label: "You spend on ads", value: inr(ex.adSpend) },
    { label: "Each unit sold leaves you", value: inr(ex.margin) },
    { label: "Units you must sell to earn the ad money back", value: `${inr(ex.adSpend)} ÷ ${inr(ex.margin)} = ${units}` },
    { label: "Sales from those units", value: `${units} × ${inr(ex.mrp)} = ${inr(ex.revenueToBreakEven)}` },
    { label: "Break-even ROAS (sales ÷ ad spend)", value: `${inr(ex.revenueToBreakEven)} ÷ ${inr(ex.adSpend)} = ${roasX(ex.breakEven)}` },
  ];
  return (
    <Section title="Worked example" description={`${ex.skuName}. Short version: price ÷ what you keep, so ${inr(ex.mrp)} ÷ ${inr(ex.margin)}.`}>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="grid grid-cols-[1.5rem_1fr] gap-3 text-sm sm:grid-cols-[1.5rem_1fr_auto]">
            <span className="sim-num text-muted-foreground">{i + 1}</span>
            <span className="text-muted-foreground">{s.label}</span>
            <span className="sim-num col-start-2 font-medium text-foreground sm:col-start-auto sm:text-right">{s.value}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        If this product's ROAS is under {roasX(ex.breakEven)}, its ads lose money. That's true even if the number looks good next to other brands.
      </p>
    </Section>
  );
}

function MaxCpmNote() {
  return (
    <Section title="How much can you pay for ads?">
      <div className="max-w-[72ch] space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          On Blinkit you bid a <strong className="font-semibold text-foreground">CPM</strong>: the price for your ad being shown 1,000 times.
          A bid is only worth it if those 1,000 showings bring in enough sales to cover it at your break-even.
          The highest bid that still does that is your <strong className="font-semibold text-foreground">max profitable CPM</strong>.
        </p>
        <p className="sim-mono rounded-lg bg-secondary/60 px-4 py-3 text-[13px] text-foreground">
          max profitable CPM = 1,000 × CTR × CVR × 0.85 × price ÷ break-even ROAS
        </p>
        <ul className="space-y-1">
          <li><span className="font-medium text-foreground">CTR</span>: out of everyone who sees the ad, the share who tap it.</li>
          <li><span className="font-medium text-foreground">CVR</span>: out of everyone who taps, the share who add it to their cart.</li>
          <li><span className="font-medium text-foreground">0.85</span>: about 85 of every 100 carts actually check out.</li>
        </ul>
        <p>
          You'll see your real CTR and CVR once the run starts. Then compare your answer with the suggested bid range on the platform.
          If the range is higher than your answer, winning the top spot loses money.
        </p>
      </div>
    </Section>
  );
}

export function EconomicsTab({ profile }: Props) {
  return (
    <div className="space-y-6">
      <Section
        title="What each product earns you"
        description="“You keep” is what's left from each sale after Blinkit takes its cut, before you pay for ads."
      >
        <SkuTable profile={profile} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <WorkedExampleBlock profile={profile} />
        <MaxCpmNote />
      </div>
    </div>
  );
}
