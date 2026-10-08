/**
 * Site report, permit stage and documents render from a report.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import DocumentsStage from "../../../src/components/site/Documents";
import SiteReport from "../../../src/components/site/SiteReport";
import { PermitStage } from "../../../src/components/site/Stages";
import { CASE_STUDY_SITE, useSiteStore } from "../../../src/store/siteStore";
import { report } from "./fixtures";

beforeEach(() => {
  useSiteStore.setState({ site: CASE_STUDY_SITE, report: report(), done: [], stage: "screening", assessing: false });
});

describe("SiteReport", () => {
  it("shows figures and every check with a status word", () => {
    useSiteStore.setState({ report: report({ shipping: "fail", natura2000: "warn" }) });
    render(<SiteReport />);
    expect(screen.getByText("112.2")).toBeDefined();
    expect(screen.getByText("1 blocking issue")).toBeDefined();
    expect(screen.getByText("Fail")).toBeDefined();
    expect(screen.getByText("Check")).toBeDefined();
    expect(screen.getAllByText("Pass").length).toBe(9);
  });

  it("asks for a site first", () => {
    useSiteStore.setState({ site: null, report: null });
    render(<SiteReport />);
    expect(screen.getByText(/Draw a candidate site/)).toBeDefined();
  });
});

describe("PermitStage", () => {
  it("fast-forwards to the decision and records the stage", () => {
    useSiteStore.setState({ report: report({ shipping: "fail" }) });
    render(<PermitStage />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Fast-forward/ }));
    });
    expect(screen.getByText("Consent refused")).toBeDefined();
    expect(screen.getByText(/Check shipping: detail shipping/)).toBeDefined();
    expect(useSiteStore.getState().done).toContain("permit");
  });

  it("shows the appropriate assessment step next to Natura 2000", () => {
    useSiteStore.setState({ report: report({ natura2000: "warn" }) });
    render(<PermitStage />);
    expect(screen.getByText("Appropriate assessment")).toBeDefined();
  });
});

describe("DocumentsStage", () => {
  it("marks every document as a training specimen", () => {
    render(<DocumentsStage />);
    expect(screen.getAllByText(/TRAINING SPECIMEN — not a legal document/).length).toBe(1);
    expect(screen.getByText(/Environmental impact assessment — non-technical summary/)).toBeDefined();
  });

  it("issues the permit and grid documents only after the procedure", () => {
    render(<DocumentsStage />);
    const permitTab = screen.getByRole("button", { name: /Permit decision/ }) as HTMLButtonElement;
    expect(permitTab.disabled).toBe(true);
    act(() => useSiteStore.setState({ done: ["permit"] }));
    expect(permitTab.disabled).toBe(false);
    fireEvent.click(permitTab);
    expect(screen.getByText("Decision: Consent granted")).toBeDefined();
  });
});
