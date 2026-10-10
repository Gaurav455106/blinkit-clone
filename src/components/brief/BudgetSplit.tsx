import type { GoalType } from "@/data/scenarios";
import { RECOMMENDED_CONVERSION } from "@/components/brief/budgetPlan";
import { Section } from "@/components/sim/primitives";
import { cn } from "@/lib/utils";
import { inr } from "@/components/brief/format";

type Props = {
  goalType: GoalType;
  budget: number;
  convPct: number;
  onChange: (pct: number) => void;
};

export function BudgetSplit({ goalType, budget, convPct, onChange }: Props) {
  const rec = RECOMMENDED_CONVERSION[goalType];
  const convAmount = Math.round((budget * convPct) / 100);
  const reachAmount = budget - convAmount;
  const inRange = convPct >= rec.min && convPct <= rec.max;
  const midpoint = Math.round((rec.min + rec.max) / 2 / 5) * 5;
  const hint = inRange
    ? `A sensible split for a ${goalType} brand.`
    : convPct > rec.max ? `A lot on sales ads. ${rec.reason}.` : `Not much on sales ads. ${rec.reason}.`;

  return (
    <Section title="Plan your budget split" description={`Split ${inr(budget)} between ads that sell now (sales) and ads that get the brand seen (reach). You can change this later.`}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label htmlFor="budget-split" className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>More reach</span>
            <span>More sales</span>
          </label>
          <input
            id="budget-split"
            type="range"
            min={0}
            max={100}
            step={5}
            value={convPct}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-valuetext={`${convPct}% sales, ${100 - convPct}% reach`}
            className="mt-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
          <div className="rounded-xl bg-secondary/60 px-4 py-3">
            <dt className="text-xs text-muted-foreground">Sales <span className="sim-num">{convPct}%</span></dt>
            <dd className="sim-num mt-0.5 text-lg font-semibold text-foreground">{inr(convAmount)}</dd>
            <dd className="text-xs text-muted-foreground">Product Booster, Rec Ads</dd>
          </div>
          <div className="rounded-xl bg-secondary/60 px-4 py-3">
            <dt className="text-xs text-muted-foreground">Reach <span className="sim-num">{100 - convPct}%</span></dt>
            <dd className="sim-num mt-0.5 text-lg font-semibold text-foreground">{inr(reachAmount)}</dd>
            <dd className="text-xs text-muted-foreground">Spotlight, Brand Booster, Stories</dd>
          </div>
        </dl>
      </div>
      <p className={cn("mt-4 text-sm", inRange ? "text-sim-good" : "text-sim-warn")}>
        {hint}
        {!inRange && (
          <button type="button" onClick={() => onChange(midpoint)} className="ml-2 font-medium underline underline-offset-2 hover:text-foreground">
            Use {midpoint}% sales
          </button>
        )}
      </p>
    </Section>
  );
}
