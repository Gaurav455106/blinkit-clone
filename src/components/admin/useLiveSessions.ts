// Loads every live (unfinished) run for the staff "Live now" tab and refreshes
// it on a timer, with a visible error instead of an empty table on failure.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LIVE_SESSION_SELECT, type LiveSessionRow } from "@/lib/liveSessions";

const REFRESH_MS = 30_000;
const SESSION_LIMIT = 2000;

export function useLiveSessions() {
  const [rows, setRows] = useState<LiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const reload = useCallback(() => {
    supabase.from("run_sessions").select(LIVE_SESSION_SELECT).order("last_seen_at", { ascending: false }).limit(SESSION_LIMIT)
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[live] run_sessions load failed", err);
          setError(err.message);
        } else {
          setError(null);
          setRows((data ?? []) as unknown as LiveSessionRow[]);
        }
        setLoadedAt(Date.now());
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  return { rows, loading, error, loadedAt, reload };
}
