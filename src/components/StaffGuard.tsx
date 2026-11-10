// Opens a Trainer or Admin page only when the SERVER says this browser is
// signed in as staff. Without this, a browser that remembers "admin" from the
// old sign-in showed the Admin page with every list empty, which looked like
// lost data.

import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { HUB_URL, hasMasterAccess } from "@/lib/masterAccess";
import { currentSession, type SessionRole } from "@/lib/session";
import { forgetLocalRole, staffAccess, type StaffAccess } from "@/lib/staffAccess";

type Check = { state: "checking" } | { state: "decided"; access: StaffAccess } | { state: "unreachable" };

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Checking your sign-in">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function StaffGuard({ allowed, children }: { allowed: readonly SessionRole[]; children: ReactNode }) {
  const [check, setCheck] = useState<Check>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    currentSession()
      .then((session) => {
        if (cancelled) return;
        const access = staffAccess(session, allowed, hasMasterAccess());
        if (access === "login" || access === "hub") forgetLocalRole();
        if (access === "hub") window.location.replace(HUB_URL);
        setCheck({ state: "decided", access });
      })
      .catch((err: unknown) => {
        // Server unreachable: show the page; its own requests will show the error.
        console.warn("[staff-guard] session check failed", err);
        if (!cancelled) setCheck({ state: "unreachable" });
      });
    return () => { cancelled = true; };
  }, [allowed]);

  if (check.state === "checking") return <Spinner />;
  if (check.state === "unreachable") return <>{children}</>;

  switch (check.access) {
    case "allow": return <>{children}</>;
    case "home": return <Navigate to="/" replace />;
    case "login": return <Navigate to="/login?master" replace />;
    case "hub": return <Spinner />;
  }
}
