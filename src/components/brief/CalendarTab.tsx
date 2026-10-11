import { useMemo } from "react";
import type { Scenario } from "@/data/scenarios";
import { Section } from "@/components/sim/primitives";
import { cn } from "@/lib/utils";
import { marketCalendar, calendarEntriesOnDay, weekdayOfDay, RUN_DAYS, type CalendarEntry } from "@/market/calendar";
import { PinButton } from "@/components/brief/PinButton";
import { dayRange } from "@/components/brief/format";
import type { ShoppingHours } from "@/lib/briefData";
import { ShoppingHoursChart } from "@/components/brief/ShoppingHoursChart";

type Props = { scenario: Scenario; hours: ShoppingHours | null };

/** Entries longer than this are listed but not stamped on every grid cell. */
const MAX_STAMPED_DAYS = 7;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const isStamped = (e: CalendarEntry) => e.toDay - e.fromDay + 1 <= MAX_STAMPED_DAYS;

/** Monday-first column for a sim day. */
const columnOf = (day: number) => (weekdayOfDay(day) + 6) % 7;

function MonthGrid({ entries }: { entries: readonly CalendarEntry[] }) {
  const stamped = entries.filter(isStamped);
  const days = Array.from({ length: RUN_DAYS }, (_, i) => i + 1);
  const leading = columnOf(1);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground" aria-hidden>
        {WEEKDAYS.map((d) => <div key={d} className="pb-1">{d}</div>)}
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Days 1 to 30 of the run">
        {Array.from({ length: leading }, (_, i) => <li key={`pad-${i}`} aria-hidden />)}
        {days.map((day) => {
          const today = calendarEntriesOnDay(stamped, day);
          const weekend = columnOf(day) >= 5;
          return (
            <li
              key={day}
              className={cn(
                "flex min-h-[64px] flex-col rounded-lg p-1.5 text-left sm:min-h-[76px] sm:p-2",
                today.length > 0 ? "bg-accent" : weekend ? "bg-secondary" : "bg-secondary/50",
              )}
              aria-label={today.length > 0 ? `Day ${day}: ${today.map((e) => e.title).join(", ")}` : `Day ${day}`}
            >
              <span className="sim-num text-xs font-medium text-muted-foreground">{day}</span>
              {today.map((e) => (
                <span key={e.id} className="mt-auto hidden text-[11px] font-medium leading-tight text-accent-foreground sm:block">{e.title}</span>
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EntryList({ entries }: { entries: readonly CalendarEntry[] }) {
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{dayRange(e.fromDay, e.toDay)}</p>
            <h3 className="mt-0.5 font-semibold text-foreground">{e.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.effect}</p>
            <p className="mt-1 text-xs text-muted-foreground">Affects: {e.categories.join(", ")}</p>
          </div>
          <PinButton note={`${e.title}, ${dayRange(e.fromDay, e.toDay).toLowerCase()}: ${e.effect}`} />
        </li>
      ))}
    </ul>
  );
}

export function CalendarTab({ scenario, hours }: Props) {
  const entries = useMemo(() => marketCalendar(scenario), [scenario]);
  const longRunning = entries.filter((e) => !isStamped(e));
  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <Section title="Market calendar" description="Day 1 is a Monday and the 1st of the month.">
        <MonthGrid entries={entries} />
        {longRunning.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Happens all month, so it is not marked on the grid: {longRunning.map((e) => e.title).join(", ")}.
          </p>
        )}
      </Section>
      <Section title="What's scheduled" description="These dates are known in advance. Other things will happen that nobody can plan for.">
        <EntryList entries={entries} />
      </Section>
    </div>
    {hours && <ShoppingHoursChart hours={hours} />}
    </div>
  );
}
