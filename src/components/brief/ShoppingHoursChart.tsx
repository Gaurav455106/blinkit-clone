import { Section } from "@/components/sim/primitives";
import { cn } from "@/lib/utils";
import type { ShoppingHours } from "@/lib/briefData";
import { PinButton } from "@/components/brief/PinButton";
import { pct } from "@/components/brief/format";

type Props = { hours: ShoppingHours };

/** Plot height in px for the tallest bar. */
const PLOT_HEIGHT = 120;

/** Share of a day's searches per 3-hour slot, from the category's engine data. */
export function ShoppingHoursChart({ hours }: Props) {
  const max = Math.max(...hours.slots.map((s) => s.share));
  const summary = `Busiest: ${hours.busiest.label} (${pct(hours.busiest.share)} of searches). Shoppers are most likely to buy ${hours.bestConverting.label}. Quiet: ${hours.quiet.map((s) => s.label).join(", ") || "none"}.`;
  return (
    <Section
      title="When shoppers search"
      description="Share of a normal day's searches in each 3-hour block. Busy blocks bring more shoppers, and more rivals too."
      actions={<PinButton note={summary} />}
    >
      <figure>
        <div className="flex items-end gap-1.5" style={{ height: PLOT_HEIGHT + 20 }} aria-hidden>
          {hours.slots.map((s) => {
            const isBusiest = s.slot === hours.busiest.slot;
            return (
              <div key={s.slot} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${s.label}: ${pct(s.share)} of searches`}>
                <span className={cn("sim-num text-[11px]", isBusiest ? "font-semibold text-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100")}>
                  {pct(s.share)}
                </span>
                <div
                  className={cn("w-full max-w-[44px] rounded-t-[4px]", isBusiest ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/55")}
                  style={{ height: Math.max(2, (s.share / max) * PLOT_HEIGHT) }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5" aria-hidden>
          {hours.slots.map((s) => (
            <span key={s.slot} className="flex-1 text-center text-[10px] leading-tight text-muted-foreground">{s.label}</span>
          ))}
        </div>
        <figcaption className="mt-4 text-sm leading-relaxed text-muted-foreground">{summary}</figcaption>
        <table className="sr-only">
          <caption>Share of searches by time of day</caption>
          <thead><tr><th scope="col">Time</th><th scope="col">Share of searches</th></tr></thead>
          <tbody>
            {hours.slots.map((s) => <tr key={s.slot}><td>{s.label}</td><td>{pct(s.share)}</td></tr>)}
          </tbody>
        </table>
      </figure>
    </Section>
  );
}
