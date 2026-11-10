// Loads every saved attempt (newest first) for the staff pages, with a
// visible error instead of an empty table when the query fails.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage, fetchAllPages } from "@/lib/api";
import type { AttemptRow } from "@/lib/attemptAnalysis";

export function useAllAttempts(limit: number, logTag: string) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAllPages<AttemptRow>("/api/staff", { view: "attempts" }, limit)
      .then((data) => setRows(data ?? []))
      .catch((err: unknown) => {
        const message = errorMessage(err);
        console.error(`[${logTag}] attempts load failed`, err);
        setError(message);
        toast.error(`Couldn't load runs: ${message}`);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [limit, logTag]);

  useEffect(reload, [reload]);
  return { rows, setRows, loading, error, reload };
}
