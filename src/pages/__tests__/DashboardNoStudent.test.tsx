import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// A browser that remembers master access but has no student loaded used to get
// a blank /dashboard: the page called navigate() while rendering, which React
// Router ignores, and then rendered nothing.
const sim: Record<string, unknown> = {
  student: null, scenario: null, runHistory: [], activeRunId: null, reviewRunId: null, campaigns: [],
  newScenario: vi.fn(), enterReview: vi.fn(), exitReview: vi.fn(), clearActiveRun: vi.fn(), clearCampaigns: vi.fn(), resumeRun: vi.fn(),
};

vi.mock("@/context/SimContext", () => ({ useSim: () => sim }));
vi.mock("@/components/BlinkitSidebar", () => ({ BlinkitSidebar: () => <nav aria-label="Blinkit sidebar" /> }));
vi.mock("@/components/tour/useTour", () => ({ useTour: () => undefined }));

import Dashboard from "@/pages/Dashboard";

describe("Dashboard with no student", () => {
  it("goes to the start page instead of showing a blank screen", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<p>Start page</p>} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Start page")).toBeInTheDocument();
  });
});
