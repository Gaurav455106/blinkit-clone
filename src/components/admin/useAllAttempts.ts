// Loads every saved attempt (newest first) for the staff pages, with a
// visible error instead of an empty table when the query fails.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AttemptRow } from "@/lib/attemptAnalysis";

export function useAllAttempts(limit: number, logTag: string) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    supabase.from("attempts").select("*").order("created_at", { ascending: false }).limit(limit)
      .then(({ data, error: err }) => {
        if (err) {
          console.error(`[${logTag}] attempts load failed`, err);
          setError(err.message);
          toast.error(`Couldn't load runs: ${err.message}`);
        }
        setRows((data ?? []) as unknown as AttemptRow[]);
        setLoading(false);
      });
  }, [limit, logTag]);

  useEffect(reload, [reload]);
  return { rows, setRows, loading, error, reload };
}
