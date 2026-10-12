import { describe, it, expect, beforeEach } from "vitest";
import { clearStudentView, currentStaffRole, enterStudentView, leaveStudentView, staffReturnRole } from "@/lib/staffView";

describe("staff student view", () => {
  beforeEach(() => localStorage.clear());

  it("plays as a student and goes back to the same console", () => {
    localStorage.setItem("sim_role", "admin");
    enterStudentView("admin");
    expect(localStorage.getItem("sim_role")).toBe("student");
    expect(staffReturnRole()).toBe("admin");
    expect(leaveStudentView()).toBe("admin");
    expect(localStorage.getItem("sim_role")).toBe("admin");
    expect(staffReturnRole()).toBeNull();
  });

  it("is not a student view for a real student, even with a leftover marker", () => {
    localStorage.setItem("sim_staff_return", "admin");
    expect(staffReturnRole()).toBeNull();
    localStorage.setItem("sim_role", "student");
    clearStudentView();
    expect(staffReturnRole()).toBeNull();
    expect(leaveStudentView()).toBeNull();
    expect(localStorage.getItem("sim_role")).toBe("student");
  });

  it("reads the signed-in staff role", () => {
    localStorage.setItem("sim_role", "trainer");
    expect(currentStaffRole()).toBe("trainer");
    localStorage.setItem("sim_role", "student");
    expect(currentStaffRole()).toBeNull();
  });
});
