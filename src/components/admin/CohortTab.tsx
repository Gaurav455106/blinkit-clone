// Loading and error wrapper for the cohort analysis tab.

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/sim/primitives";

interface CohortTabProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}

export function CohortTab({ loading, error, onRetry, children }: CohortTabProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading runs">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="We couldn't load the runs"
        description={`The database returned an error: ${error}`}
        action={<Button onClick={onRetry} className="gap-2"><RefreshCw className="h-4 w-4" /> Try again</Button>}
      />
    );
  }
  return <>{children}</>;
}
