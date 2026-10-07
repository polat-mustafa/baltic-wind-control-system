import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRIVACY_NOTE, SaveOnline } from "../../../src/components/project/SaveOnline";
import { useProjectSync } from "../../../src/store/projectSync";

describe("SaveOnline", () => {
  beforeEach(() => useProjectSync.getState().detach());

  it("offers to save online with the privacy note", () => {
    const saveOnline = vi.fn(async () => {});
    useProjectSync.setState({ saveOnline });
    render(<SaveOnline />);
    const button = screen.getByRole("button", { name: /save online/i });
    expect(button.getAttribute("title")).toBe(PRIVACY_NOTE);
    fireEvent.click(button);
    expect(saveOnline).toHaveBeenCalled();
  });

  it("shows the save state, the link and the conflict choices", () => {
    useProjectSync.setState({ id: "abc", revision: 3, sync: "conflict", error: "Changed elsewhere (revision 4)" });
    render(<SaveOnline />);
    expect(screen.getByRole("status").textContent).toMatch(/changed elsewhere/i);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /load saved copy/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /keep mine/i })).toBeTruthy();
    expect(screen.getByText(/12 months/)).toBeTruthy();
  });
});
