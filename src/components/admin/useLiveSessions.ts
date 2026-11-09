// Loads every live (unfinished) run for the staff "Live now" tab and refreshes
// it on a timer, with a visible error instead of an empty table on failure.

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { LiveSessionRow } from "@/lib/liveSessions";

const REFRESH_MS = 30_000;

export function useLiveSessions() {
  const [rows, setRows] = useState<LiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const reload = useCallback(() => {
    api<LiveSessionRow[]>("GET", "/api/staff", { query: { view: "live" } })
      .then((data) => {
        setError(null);
        setRows(data ?? []);
      })
      .catch((err: unknown) => {
        console.error("[live] run_sessions load failed", err);
        setError(errorMessage(err));
      })
      .finally(() => {
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
