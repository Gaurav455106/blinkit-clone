// ── Student view for staff ────────────────────────────────────────────────────
// An admin or trainer can play the simulation as a test student, then go back
// to their console. The staff role is remembered while they play.

const ROLE_KEY = "sim_role";
const RETURN_KEY = "sim_staff_return";

export type StaffRole = "admin" | "trainer";

const isStaffRole = (v: string | null): v is StaffRole => v === "admin" || v === "trainer";

/** Switches this browser to the student role, remembering which console to return to. */
export function enterStudentView(role: StaffRole): void {
  try {
    localStorage.setItem(RETURN_KEY, role);
    localStorage.setItem(ROLE_KEY, "student");
  } catch (err) {
    console.warn("[staffView] could not save the student view", err);
  }
}

/** The console to go back to, or null when this is not a staff member's student view. */
export function staffReturnRole(): StaffRole | null {
  try {
    if (localStorage.getItem(ROLE_KEY) !== "student") return null;
    const role = localStorage.getItem(RETURN_KEY);
    return isStaffRole(role) ? role : null;
  } catch {
    return null;
  }
}

/** Restores the staff role; returns it, or null when there was nothing to restore. */
export function leaveStudentView(): StaffRole | null {
  const role = staffReturnRole();
  try {
    localStorage.removeItem(RETURN_KEY);
    if (role) localStorage.setItem(ROLE_KEY, role);
  } catch (err) {
    console.warn("[staffView] could not restore the staff role", err);
  }
  return role;
}

/** Forgets any student view, for sign-out and fresh sign-ins. */
export function clearStudentView(): void {
  try { localStorage.removeItem(RETURN_KEY); } catch { /* storage blocked */ }
}

/** The staff role signed in on this browser, or null. */
export function currentStaffRole(): StaffRole | null {
  try {
    const role = localStorage.getItem(ROLE_KEY);
    return isStaffRole(role) ? role : null;
  } catch {
    return null;
  }
}

export const STAFF_HOME: Record<StaffRole, string> = { admin: "/admin", trainer: "/trainer" };
