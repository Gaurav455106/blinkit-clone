import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RohitDock } from "@/components/rohit/RohitDock";
import type { ReplyOption } from "@/market/rohit";

const option = (id: string, label: string): ReplyOption =>
  ({ id, label, cost: "Nothing", effect: { relationshipDelta: 2 } } as unknown as ReplyOption);

const ask = {
  title: "Stock is running low in Delhi",
  line: "Your Delhi stock runs out in two days. What do you want to do?",
  chips: [],
  options: [option("a", "Move budget to Mumbai"), option("b", "Ask for a restock")],
};

function renderDock(chosen: string | null = null) {
  const onClose = vi.fn();
  const onChoose = vi.fn();
  render(<RohitDock ask={ask} day={9} relationship={55} chosenOptionId={chosen} onChoose={onChoose} onClose={onClose} />);
  return { onClose, onChoose };
}

describe("RohitDock", () => {
  it("opens with Rohit's question and focus inside the panel", () => {
    renderDock();
    const panel = screen.getByRole("region", { name: /Rohit: Stock is running low/ });
    expect(panel).toBeInTheDocument();
    expect(panel.parentElement?.contains(document.activeElement)).toBe(true);
  });

  it("hides to a small tab without closing the check-in, and reopens", () => {
    const { onClose } = renderDock();
    fireEvent.click(screen.getByRole("button", { name: /Hide Rohit/ }));
    expect(screen.queryByRole("region", { name: /Rohit:/ })).toBeNull();
    const tab = screen.getByRole("button", { name: /Rohit is waiting/ });
    expect(tab).toHaveTextContent(/clock paused/i);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(tab);
    expect(screen.getByRole("region", { name: /Rohit:/ })).toBeInTheDocument();
  });

  it("Escape hides the panel instead of closing the check-in", () => {
    const { onClose } = renderDock();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: /Rohit is waiting/ })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape pressed inside another dialog (the campaign builder) leaves Rohit open", () => {
    renderDock();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const input = document.createElement("input");
    dialog.appendChild(input);
    document.body.appendChild(dialog);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("region", { name: /Rohit:/ })).toBeInTheDocument();
    dialog.remove();
  });

  it("keeps the student's reply after hiding and reopening", () => {
    renderDock("b");
    fireEvent.click(screen.getByRole("button", { name: /Hide Rohit/ }));
    fireEvent.click(screen.getByRole("button", { name: /Rohit is waiting/ }));
    expect(screen.getByText("Ask for a restock")).toBeInTheDocument();
    expect(screen.queryByText("Move budget to Mumbai")).toBeNull();
  });
});
