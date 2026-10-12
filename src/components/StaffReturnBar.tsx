// Shown to an admin or trainer while they play in the student view: one tap
// back to their console. Real students never see it.

import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { leaveStudentView, staffReturnRole, STAFF_HOME } from "@/lib/staffView";

const LABEL = { admin: "admin", trainer: "trainer view" } as const;

export function StaffReturnBar() {
  const nav = useNavigate();
  useLocation(); // re-check the role on every page change
  const role = staffReturnRole();
  if (!role) return null;

  const goBack = () => {
    const back = leaveStudentView();
    if (back) nav(STAFF_HOME[back]);
  };

  return (
    <div className="sim-ui pointer-events-none fixed bottom-4 left-4 z-50">
      <div className="sim-rise pointer-events-auto flex items-center gap-2 rounded-full bg-foreground py-1 pl-3 pr-1 text-xs text-background shadow-lg">
        <span className="font-medium">Student view</span>
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2.5 py-1 font-medium hover:bg-background/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to {LABEL[role]}
        </button>
      </div>
    </div>
  );
}
