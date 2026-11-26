// "Live now": every student mid-run, where they are, and anyone who finished
// whose score never saved (they need to open their results page again).
//
// LiveSessionsView is the table for a batch someone else picks (the admin
// batch rail); LiveSessionsPanel loads the runs itself and has its own chips.

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, StatTile, Tag } from "@/components/sim/primitives";
import type { AttemptRow } from "@/lib/attemptAnalysis";
import { summariseSessions, timeAgo, type LiveSession, type LiveStatus } from "@/lib/liveSessions";
import { useLiveSessions } from "./useLiveSessions";

export const ALL_BATCHES = "All";

const STATUS_LABEL: Record<LiveStatus, string> = { unsaved: "Finished, score not saved", playing: "Playing", idle: "Idle" };
const STATUS_TONE = { unsaved: "bad", playing: "good", idle: "neutral" } as const;

export interface LiveSessionsViewProps {
  sessions: readonly LiveSession[];
  loading: boolean;
  error: string | null;
  loadedAt: number;
  onRefresh: () => void;
  /** Shown in the description ("in mlp_53_ft"); omit for every batch. */
  batchLabel?: string;
  showBatch?: boolean;
  /** Extra controls beside Refresh (the panel's batch chips). */
  filters?: ReactNode;
}

export function LiveSessionsView({ sessions, loading, error, loadedAt, onRefresh, batchLabel, showBatch = true, filters }: LiveSessionsViewProps) {
  const playing = sessions.filter((s) => s.status === "playing").length;
  const unsaved = sessions.filter((s) => s.status === "unsaved").length;
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const cols = showBatch ? 6 : 5;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Runs in progress" value={sessions.length} />
        <StatTile label="Active in the last 10 min" value={playing} tone={playing ? "good" : "neutral"} />
        <StatTile label="Finished, score not saved" value={unsaved} tone={unsaved ? "bad" : "neutral"} />
      </div>

      {unsaved > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-sim-warn/10 px-4 py-2.5 text-sm text-sim-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Ask these students to open their results page on the same browser. The score saves from there.
        </div>
      )}

      <Section
        title="Live now"
        description={`Each student's latest unfinished run${batchLabel ? ` in ${batchLabel}` : ""}. Updates every 30 seconds.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filters}
            <Button size="sm" variant="outline" className="gap-2" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
        }
      >
        {error && <p role="alert" className="mb-3 text-sm text-destructive">Couldn't load live runs: {error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>Student</th>{showBatch && <th className={th}>Batch</th>}<th className={th}>Brand</th>
                <th className={th}>Where they are</th><th className={th}>Status</th><th className={th}>Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((s) => (
                <tr key={s.email}>
                  <td className="px-3 py-2.5 text-sm">{s.name}<div className="text-xs text-muted-foreground">{s.email}</div></td>
                  {showBatch && <td className="px-3 py-2.5 text-sm">{s.batch}</td>}
                  <td className="px-3 py-2.5 text-sm">{s.brand}</td>
                  <td className="px-3 py-2.5 text-sm">{s.stage}</td>
                  <td className="px-3 py-2.5"><Tag tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Tag></td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">{timeAgo(s.lastSeenAt, loadedAt)}</td>
                </tr>
              ))}
              {sessions.length === 0 && !loading && (
                <tr><td colSpan={cols} className="px-3 py-8 text-center text-sm text-muted-foreground">No runs in progress.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/** Live runs for every batch, summarised against the saved attempts. */
export function useLiveSummary(attempts: readonly AttemptRow[]) {
  const live = useLiveSessions();
  const sessions = useMemo(
    () => summariseSessions(live.rows, attempts, live.loadedAt),
    [live.rows, attempts, live.loadedAt],
  );
  return { ...live, sessions };
}

interface LiveSessionsPanelProps {
  attempts: readonly AttemptRow[];
}

export function LiveSessionsPanel({ attempts }: LiveSessionsPanelProps) {
  const { sessions: all, loading, error, loadedAt, reload } = useLiveSummary(attempts);
  const [activeBatch, setActiveBatch] = useState(ALL_BATCHES);
  const batches = useMemo(() => [ALL_BATCHES, ...Array.from(new Set(all.map((s) => s.batch))).sort()], [all]);
  const sessions = activeBatch === ALL_BATCHES ? all : all.filter((s) => s.batch === activeBatch);

  const chips = (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Filter live runs by batch">
      {batches.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={activeBatch === b}
          onClick={() => setActiveBatch(b)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${activeBatch === b ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
        >{b}</button>
      ))}
    </div>
  );

  return (
    <LiveSessionsView
      sessions={sessions}
      loading={loading}
      error={error}
      loadedAt={loadedAt}
      onRefresh={reload}
      batchLabel={activeBatch === ALL_BATCHES ? undefined : activeBatch}
      filters={chips}
    />
  );
}
