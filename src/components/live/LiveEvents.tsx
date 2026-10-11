// ── Market events on the live dashboard (SPEC §2, §5, §6) ─────────────────────
// The alert that stopped the clock, the feed of everything raised so far, the
// brand's calendar, and Rohit's commitments. Presentational only.

import { AlertTriangle, CalendarDays, Handshake } from "lucide-react";
import type { EventActivation } from "@/market/events";
import type { CalendarEntry } from "@/market/calendar";
import type { CommitmentResult } from "@/market/rohit";
import { Section, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";

type AlertCardProps = {
  alert: EventActivation;
  onDismiss: () => void;
};

/** The one alert that paused the clock. The student reads it, then carries on. */
export function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const days = alert.decisionWindowDays;
  return (
    <section
      role="alert"
      aria-label={`Alert: ${alert.alert.headline}`}
      className="mb-6 rounded-2xl border-2 border-sim-warn bg-card p-5 shadow-[0_12px_40px_-24px_hsl(24_30%_20%/0.5)]"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sim-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">The clock is stopped</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{alert.alert.headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{alert.alert.detail}</p>
          <p className="mt-3 text-sm text-foreground">
            You have <span className="font-semibold">{days} day{days > 1 ? "s" : ""}</span> to respond. Changes you make now start tomorrow.
            <span className="ml-2"><Tag>{alert.alert.report.label}</Tag></span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onDismiss}>Got it, carry on</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const isOpen = (a: EventActivation, day: number) => day < a.raisedAfterDay + a.decisionWindowDays;

/** Every event raised so far, newest first. */
export function EventsFeed({ activations, day }: { activations: readonly EventActivation[]; day: number }) {
  const shown = activations.slice().sort((a, b) => b.raisedAfterDay - a.raisedAfterDay || b.stake - a.stake);
  return (
    <Section title="Market news" description="What changed in the market. Some of these stop the clock; the rest are here for you to check.">
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. News appears here as the days run.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => (
            <li key={a.key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">After day {a.raisedAfterDay}: {a.alert.headline}</p>
                <Tag tone={day <= a.endDay && day + 1 >= a.startDay ? "warn" : "neutral"}>
                  {day + 1 < a.startDay ? `Starts day ${a.startDay}` : day < a.endDay ? `Until day ${a.endDay}` : "Over"}
                </Tag>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.alert.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.alert.report.label}{isOpen(a, day) ? ` · ${a.raisedAfterDay + a.decisionWindowDays - day} day(s) left to respond` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** The brand's calendar (shown in the brief too), with what's coming up. */
export function CalendarStrip({ calendar, day }: { calendar: readonly CalendarEntry[]; day: number }) {
  if (calendar.length === 0) return null;
  return (
    <Section title="Calendar" description="Planned dates you can prepare for. Surprises are not listed here.">
      <ul className="space-y-2">
        {calendar.map((e) => {
          const status = day >= e.toDay ? "Over" : day + 1 >= e.fromDay ? "Now" : `In ${e.fromDay - day - 1} day(s)`;
          return (
            <li key={`${e.id}-${e.fromDay}`} className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {e.title} <span className="font-normal text-muted-foreground">(day {e.fromDay}{e.toDay !== e.fromDay ? `–${e.toDay}` : ""})</span>
                </p>
                <p className="text-xs text-muted-foreground">{e.effect}</p>
              </div>
              <Tag tone={status === "Now" ? "warn" : "neutral"}>{status}</Tag>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const STATUS_TONE = { pending: "neutral", kept: "good", broken: "bad" } as const;
const STATUS_TEXT = { pending: "Due", kept: "Kept", broken: "Broken" } as const;

/** What the student promised Rohit, and how it's going (SPEC §6 "Promises are tracked"). */
export function CommitmentsPanel({ results, relationship }: { results: readonly CommitmentResult[]; relationship: number }) {
  return (
    <Section
      title="Promises to Rohit"
      description={`Relationship with Rohit: ${Math.round(relationship)} of 100. Keeping promises raises it; breaking them lowers it.`}
    >
      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promises yet.</p>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.commitment.id} className="flex items-start gap-3">
              <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-foreground">
                {r.commitment.text} <span className="text-muted-foreground">(by day {r.commitment.dueDay})</span>
              </p>
              <Tag tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status]}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
