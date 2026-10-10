import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TutorPanel from "../../../src/components/tutor/TutorPanel";
import * as api from "../../../src/services/tutorApi";

vi.mock("../../../src/services/tutorApi", () => ({
  getProviders: vi.fn(() =>
    Promise.resolve([{ id: "openrouter", title: "OpenRouter", default_model: "openrouter/auto", keys_url: "https://openrouter.ai/keys" }]),
  ),
  getStatus: vi.fn(),
  connect: vi.fn(() => Promise.resolve({ connected: true, provider: "openrouter", provider_title: "OpenRouter", model: "openrouter/auto" })),
  disconnect: vi.fn(),
  openRouterStart: vi.fn(),
  ask: vi.fn(() =>
    Promise.resolve({
      answer: "About 312 Mvar per circuit.",
      model: "m",
      tools: [{ name: "export_cable", arguments: '{"length_km":108}', result: { charging_mvar_per_circuit: 312 } }],
    }),
  ),
}));

const OFF = { connected: false, provider: "", provider_title: "", model: "" };
const ON = { connected: true, provider: "openrouter", provider_title: "OpenRouter", model: "openrouter/auto" };

function renderPanel() {
  render(
    <MemoryRouter initialEntries={["/hv-grid"]}>
      <main>
        <h1>Grid Integration</h1>
        <p>STATCOM ±120 Mvar</p>
      </main>
      <TutorPanel />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open the AI tutor" }));
}

describe("TutorPanel", () => {
  beforeEach(() => {
    vi.mocked(api.getStatus).mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("connects with a key without storing it in the browser", async () => {
    vi.mocked(api.getStatus).mockResolvedValue(OFF);
    renderPanel();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "sk-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(api.connect).toHaveBeenCalledWith("openrouter", "sk-secret", ""));
    expect(await screen.findByText(/OpenRouter · openrouter\/auto/)).toBeDefined();
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain("sk-secret");
  });

  it("asks with the page as context and shows which calculators ran", async () => {
    vi.mocked(api.getStatus).mockResolvedValue(ON);
    renderPanel();
    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "Charging of one cable?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("About 312 Mvar per circuit.")).toBeDefined();
    expect(screen.getByText(/Calculated with: export_cable/)).toBeDefined();
    const [, history, page] = vi.mocked(api.ask).mock.calls[0];
    expect(history).toEqual([]);
    expect(page.route).toBe("/hv-grid");
    expect(page.title).toBe("Grid Integration");
    expect(page.text).toContain("±120 Mvar");
  });
});
