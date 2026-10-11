import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SimPage } from "@/components/sim/primitives";

describe("SimPage", () => {
  // Screen-reader-only labels (sr-only) are position: absolute. Without a
  // positioned ancestor inside the scrolling column they position against the
  // whole document, stretch it past the screen and the window scrolls the app
  // away, leaving a blank area (seen on the brief).
  it("is a positioning container so hidden labels can't stretch the page", () => {
    const { container } = render(<SimPage><span className="sr-only">Pin</span></SimPage>);
    expect(container.querySelector("main")).toHaveClass("relative");
  });
});
