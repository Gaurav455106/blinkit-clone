// ── Clock, alerts, checkpoints, reports and auction insights (SPEC §2, §7.3) ──

import { useMemo, useState } from "react";
import { Pause, Play, SkipForward, Download, FileSpreadsheet } from "lucide-react";
import type { DayResult, MarketContext } from "@/market/engineTypes";
import type { Moment } from "@/market/moments";
import { ANALYSIS_GUIDE, REPORTS, REPORT_README, buildReportSheets, type ReportInput } from "@/market/reports";
import { INSIGHT_TYPES, type Insight, type InsightType } from "@/market/insights";
import { rivalInsights } from "@/market/aggregate";
import { downloadWorkbook } from "@/lib/excel";
import { Section, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";

export const SPEEDS = [{ label: "Slow (15 s a day)", ms: 15000 }, { label: "Normal (8 s a day)", ms: 8000 }, { label: "Fast (3 s a day)", ms: 3000 }] as const;

type ClockProps = {
  day: number;
  totalDays: number;
  playing: boolean;
  busy: boolean;
  speedMs: number;
  pausedReason: string | null;
  onToggle: () => void;
  onAdvance: () => void;
  onSpeed: (ms: number) => void;
};

export function ClockBar({ day, totalDays, playing, busy, speedMs, pausedReason, onToggle, onAdvance, onSpeed }: ClockProps) {
  const progress = Math.round((day / totalDays) * 100);
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[140px]">
          <p className="text-xs text-muted-foreground">Day</p>
          <p className="sim-num text-xl font-semibold text-foreground">{day} <span className="text-sm font-normal text-muted-foreground">of {totalDays}</span></p>
        </div>
        <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={day} aria-valuemin={0} aria-valuemax={totalDays} aria-label="Run progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <Button size="sm" onClick={onToggle} disabled={day >= totalDays} aria-label={playing ? "Pause the clock" : "Start the clock"}>
          {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{playing ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="outline" onClick={onAdvance} disabled={busy || day >= totalDays}>
          <SkipForward className="mr-1 h-4 w-4" />Next day
        </Button>
        <label className="text-xs text-muted-foreground">
          Speed
          <select className="ml-2 rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground" value={speedMs} onChange={(e) => onSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => <option key={s.ms} value={s.ms}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {pausedReason && <p className="mt-2 text-sm text-sim-warn">{pausedReason}</p>}
    </div>
  );
}

export function AlertsFeed({ moments, day }: { moments: readonly Moment[]; day: number }) {
  const shown = moments.filter((m) => m.day <= day).slice().reverse();
  return (
    <Section title="Alerts" description="Moments where the data says you should act. You have about 3 days for each.">
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts yet. Keep an eye on ROAS and why your ads aren't showing.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => {
            const open = day < m.day + m.window;
            return (
              <li key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Day {m.day}: {m.title}</p>
                  <Tag tone={open ? "warn" : "neutral"}>{open ? `${m.day + m.window - day} days left` : "Closed"}</Tag>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.evidence}</p>
                <p className="mt-1 text-xs text-muted-foreground">Things you could try: {m.levers.map((l) => l.label).join(" · ")}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function downloadReports(input: ReportInput, studentName: string, day: number) {
  downloadWorkbook(`blinkit-reports-${studentName}-day-${day}`, buildReportSheets(input), REPORT_README);
}

/** Why the report matters, shown whenever a workbook is downloaded (Gaurav's request). */
function AnalysisGuide() {
  return (
    <div className="rounded-xl bg-secondary/60 p-4">
      <p className="text-sm font-medium text-foreground">Downloading is step one. Acting on it is what scores.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Real brand managers win by reading the report, finding the worst number and changing something. The first sheet in your file,
        "How to read this", lists what to look for. Here is the short version:
      </p>
      <ol className="mt-3 space-y-2 text-sm">
        {ANALYSIS_GUIDE.slice(0, 6).map((g, i) => (
          <li key={g.question} className="grid gap-1 md:grid-cols-[1.5rem_1fr]">
            <span className="sim-num text-muted-foreground">{i + 1}.</span>
            <span><span className="font-medium text-foreground">{g.question}</span> <span className="text-muted-foreground">Open {g.report}. Bad sign: {g.badSign}. Then: {g.lever}.</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type InsightFormProps = { onLog: (insight: Omit<Insight, "day">) => void };

function InsightForm({ onLog }: InsightFormProps) {
  const [type, setType] = useState<InsightType>("belowBreakEven");
  const [subject, setSubject] = useState("");
  const [evidence, setEvidence] = useState("");
  const [plannedAction, setPlannedAction] = useState("");
  const needsSubject = type !== "noChange";
  const valid = evidence.trim().length >= 8 && plannedAction.trim().length >= 4 && (!needsSubject || subject.trim().length > 0);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onLog({ type, subject: subject.trim(), evidence: evidence.trim(), plannedAction: plannedAction.trim() });
        setSubject(""); setEvidence(""); setPlannedAction("");
      }}
    >
      <label className="text-sm font-medium text-foreground">
        What did you find?
        <select className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as InsightType)}>
          {INSIGHT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-foreground">
        About which keyword, state or product?
        <input className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-2 text-sm" placeholder="e.g. protein bar" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!needsSubject} />
      </label>
      <label className="text-sm font-medium text-foreground md:col-span-2">
        Which report and number shows it?
        <input className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-2 text-sm" placeholder="e.g. R2: ROAS 0.7 but break-even is 6.6" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </label>
      <label className="text-sm font-medium text-foreground md:col-span-2">
        What will you change?
        <input className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-2 text-sm" placeholder="e.g. Pause it and move the money to whey protein" value={plannedAction} onChange={(e) => setPlannedAction(e.target.value)} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" disabled={!valid}>Log this insight</Button>
        {!valid && <span className="ml-3 text-xs text-muted-foreground">Fill in the number you saw and what you'll do.</span>}
      </div>
    </form>
  );
}

type CheckpointProps = {
  day: number;
  reportInput: ReportInput;
  studentName: string;
  insights: readonly Insight[];
  onLog: (insight: Omit<Insight, "day">) => void;
  onContinue: () => void;
};

export function CheckpointPanel({ day, reportInput, studentName, insights, onLog, onContinue }: CheckpointProps) {
  const thisWeek = insights.filter((i) => i.day === day);
  return (
    <Section
      className="border-2 border-sim-highlight"
      title={`Week ${Math.round(day / 7)} check-in: the clock is stopped`}
      description="Download this week's reports, find what's going wrong or right, log at least one insight, then make your changes before you carry on."
      actions={<Button variant="outline" onClick={() => downloadReports(reportInput, studentName, day)}><Download className="mr-1 h-4 w-4" />Download reports (Excel)</Button>}
    >
      <div className="space-y-6">
        <AnalysisGuide />
        <InsightForm onLog={onLog} />
        {thisWeek.length > 0 && (
          <ul className="space-y-2">
            {thisWeek.map((i, n) => (
              <li key={n} className="rounded-md bg-secondary/60 px-3 py-2 text-sm">
                <span className="font-medium">{INSIGHT_TYPES.find((t) => t.type === i.type)?.label}</span>
                {i.subject && <> on <span className="font-medium">{i.subject}</span></>}: {i.evidence}. Plan: {i.plannedAction}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={onContinue} disabled={thisWeek.length === 0}>Carry on to day {day + 1}</Button>
          {thisWeek.length === 0 && <span className="text-xs text-muted-foreground">Log at least one insight first (or pick "No change needed" and say why).</span>}
        </div>
      </div>
    </Section>
  );
}

export function ReportsPanel({ reportInput, studentName, day }: { reportInput: ReportInput; studentName: string; day: number }) {
  const [justDownloaded, setJustDownloaded] = useState(false);
  return (
    <Section
      title="Reports"
      description="Twelve Excel reports, one row per day, ready for pivot tables. Only finished days are included."
      actions={<Button disabled={day === 0} onClick={() => { downloadReports(reportInput, studentName, day); setJustDownloaded(true); }}><FileSpreadsheet className="mr-1 h-4 w-4" />Download all (Excel)</Button>}
    >
      {justDownloaded && <div className="mb-5"><AnalysisGuide /></div>}
      <ul className="grid gap-2 md:grid-cols-2">
        {REPORTS.map((r) => (
          <li key={r.id} className="rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">{r.id} {r.name}</p>
            <p className="text-xs text-muted-foreground">{r.description}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CompetitionPanel({ ctx, results }: { ctx: MarketContext; results: readonly DayResult[] }) {
  const recent = results.slice(-7);
  const terms = useMemo(() => [...new Set(recent.flatMap((r) => r.cells.filter((c) => c.inventory === "keyword").map((c) => c.term)))], [recent]);
  const names = new Map(ctx.market.rivals.map((r) => [r.id, r.name]));
  return (
    <Section title="Who you're up against (last 7 days)" description="Share of voice is your share of all ads seen. Top slot is how often an ad took slot 1. You never see rivals' bids, only what they won.">
      {terms.length === 0 ? <p className="text-sm text-muted-foreground">Appears once your keyword ads run.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Keyword</th><th className="py-2 pr-3 font-medium">Advertiser</th><th className="py-2 pr-3 font-medium">Share of voice</th><th className="py-2 font-medium">Top slot</th></tr></thead>
            <tbody>
              {terms.flatMap((t) => rivalInsights(recent, t).filter((x) => x.rivalId === "you" || names.has(x.rivalId)).map((x) => (
                <tr key={`${t}-${x.rivalId}`} className="border-t border-border">
                  <td className="py-2 pr-3 text-muted-foreground">{t}</td>
                  <td className={`py-2 pr-3 ${x.rivalId === "you" ? "font-semibold text-foreground" : ""}`}>{x.rivalId === "you" ? "You" : names.get(x.rivalId)}</td>
                  <td className="py-2 pr-3">{Math.round(x.sov * 100)}%</td>
                  <td className="py-2">{Math.round(x.topSlotRate * 100)}%</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
