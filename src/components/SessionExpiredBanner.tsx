// Shown when the server says the sign-in has ended (or never happened on this
// browser). Work in progress stays on this browser; relaunching from the hub
// signs the same student in again and saving resumes.

import { useEffect, useState } from "react";
import { HUB_URL } from "@/lib/masterAccess";
import { SESSION_EXPIRED_EVENT } from "@/lib/api";

export function SessionExpiredBanner() {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const show = () => setIsExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, show);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, show);
  }, []);

  if (!isExpired) return null;

  return (
    <div role="alert" className="sim-ui fixed inset-x-0 top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          <span className="font-semibold">Your sign-in has ended, so your progress isn&apos;t being saved.</span>{" "}
          Your work is still on this browser. Launch the simulation again from the Kraftshala Hub to keep saving.
        </p>
        <div className="flex items-center gap-2">
          <a href={HUB_URL} className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-800">
            Open Kraftshala Hub
          </a>
          <button type="button" onClick={() => setIsExpired(false)} className="rounded-md px-2 py-1.5 text-xs hover:bg-amber-100">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
