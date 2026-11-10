import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BRAND_PROFILES } from "@/data/scenarios";

// Once the deal with Rohit is agreed, the pitch can't be reopened (back button,
// the brief's continue button or a typed address): it goes on to the campaigns.
const profile = BRAND_PROFILES.find((b) => b.id === "henlo")!;
const sim: Record<string, unknown> = {
  student: { name: "Asha", email: "asha@x.com", batch: "B1" },
  scenario: { seed: "t", profile },
  cmPitch: { pitchScore: 70 },
};

vi.mock("@/context/SimContext", () => ({ useSim: () => sim }));

import CmPitch from "@/pages/CmPitch";

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/cm-pitch"]}>
      <Routes>
        <Route path="/cm-pitch" element={<CmPitch />} />
        <Route path="/simulation" element={<p>Campaigns page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CM pitch after the deal is agreed", () => {
  it("sends the student on to the campaigns instead of reopening the pitch", () => {
    localStorage.setItem("sim_brief_ack", "1");
    renderAt();
    expect(screen.getByText("Campaigns page")).toBeInTheDocument();
  });
});
