import { describe, expect, it } from "vitest";
import { staffAccess } from "../staffAccess";
import type { SessionInfo } from "../session";

const session = (role: SessionInfo["role"], via: SessionInfo["via"] = "hub"): SessionInfo => ({
  email: "a@kraftshala.com", name: "A", batch: "B1", role, via,
});

describe("staffAccess", () => {
  it("lets an admin into admin and trainer pages", () => {
    expect(staffAccess(session("admin"), ["admin"], false)).toBe("allow");
    expect(staffAccess(session("admin"), ["trainer", "admin"], false)).toBe("allow");
  });

  it("lets a trainer into trainer pages but not admin pages", () => {
    expect(staffAccess(session("trainer"), ["trainer", "admin"], false)).toBe("allow");
    expect(staffAccess(session("trainer"), ["admin"], false)).toBe("home");
  });

  it("sends a signed-in student home", () => {
    expect(staffAccess(session("student"), ["trainer", "admin"], false)).toBe("home");
  });

  it("sends someone with no sign-in to the hub", () => {
    expect(staffAccess(null, ["admin"], false)).toBe("hub");
  });

  it("sends a staff browser with no sign-in to the master key page", () => {
    expect(staffAccess(null, ["admin"], true)).toBe("login");
  });
});
