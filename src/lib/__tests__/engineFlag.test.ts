import { describe, it, expect, beforeEach } from "vitest";
import { engineVersion } from "@/lib/engineFlag";

describe("engine flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("defaults to v1 so live batches keep their scoring", () => {
    expect(engineVersion()).toBe("v1");
  });

  it("?engine=v2 switches this browser to v2 and remembers it", () => {
    window.history.replaceState({}, "", "/brief?engine=v2");
    expect(engineVersion()).toBe("v2");
    window.history.replaceState({}, "", "/brief");
    expect(engineVersion()).toBe("v2");
  });

  it("?engine=v1 switches back", () => {
    window.localStorage.setItem("sim_engine", "v2");
    window.history.replaceState({}, "", "/?engine=v1");
    expect(engineVersion()).toBe("v1");
  });
});
