import { describe, expect, it } from "vitest";
import { keepWizardOpenOnEscape } from "@/lib/wizardEscape";

describe("keepWizardOpenOnEscape", () => {
  it("stops Escape from closing the wizard sheet", () => {
    const e = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    keepWizardOpenOnEscape(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
