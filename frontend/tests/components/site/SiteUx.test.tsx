/**
 * Site & Permits UX: report states (stale / failed / retry), permit outlook,
 * data sources, criterion provenance and the role avatars.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Actor } from "../../../src/components/site/Actors";
import DataSources, { ScreeningDisclaimer } from "../../../src/components/site/DataSources";
import { ACTORS } from "../../../src/components/site/journey";
import SiteReport from "../../../src/components/site/SiteReport";
import SitePermitsPage from "../../../src/pages/SitePermitsPage";
import * as api from "../../../src/services/siteApi";
import { CASE_STUDY_SITE, reportSignature, useSiteStore } from "../../../src/store/siteStore";
import { report } from "./fixtures";

vi.mock("../../../src/services/siteApi");
vi.mock("../../../src/components/site/ScreeningMap", () => ({ default: () => <div>map</div> }));
const mockApi = vi.mocked(api);

const layers = {
  region: { region: "southern-baltic", title: "Polish Baltic", description: "", bbox: [14, 54, 19, 56] },
  layers: [
    {
      id: "msp_energy",
      title: "MSP energy basins",
      role: "msp_energy",
      geometry: "polygon",
      source: "EMODnet Human Activities, MSP",
      license: "CC BY 4.0",
      retrieved: "2026-10-06",
      features: [],
    },
  ],
  missing: [{ role: "bathymetry", effect: "Depth not checked.", source: "", essential: true }],
  complete: false,
  criteria: [
    {
      key: "require_energy_basin",
      label: "Only inside the plan's energy basins",
      unit: "",
      kind: "exclusion",
      default: true,
      provenance: "Polish maritime spatial plan (Dz.U. 2021 poz. 935)",
      note: "Screening simplification.",
    },
  ],
  depth_bands: [],
} as unknown as api.LayersResponse;

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.postAssess.mockResolvedValue(report());
  mockApi.postSuitability.mockResolvedValue({ class_areas: [], reason_areas: [] } as unknown as api.SuitabilityResponse);
  mockApi.getLayers.mockResolvedValue(layers);
  useSiteStore.setState({
    site: CASE_STUDY_SITE,
    report: report(),
    reportFor: reportSignature(CASE_STUDY_SITE, {}),
    criteria: {},
    layers,
    suitability: null,
    stage: "screening",
    done: [],
    assessing: false,
    assessError: null,
    error: null,
  });
});

describe("SiteReport states", () => {
  it("keeps the last good report after a failed update and retries", () => {
    useSiteStore.setState({ assessError: "timeout" });
    render(<SiteReport />);
    expect(screen.getByText(/Update failed \(timeout\)\. Showing the last good report/)).toBeDefined();
    expect(screen.getByText("112.2")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(mockApi.postAssess).toHaveBeenCalledTimes(1);
  });

  it("marks a report computed for other criteria as out of date", () => {
    useSiteStore.setState({ criteria: { exclude_protected: false } });
    render(<SiteReport />);
    expect(screen.getByText(/Out of date/)).toBeDefined();
  });

  it("shows an error with retry when there is no report", () => {
    useSiteStore.setState({ report: null, reportFor: null, assessError: "backend down" });
    render(<SiteReport />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not be assessed: backend down/);
  });

  it("shows the site wind climate and labels the approximation", () => {
    const wind = {
      mean_ms: 9.38,
      weibull_a: 10.6,
      weibull_k: 2.05,
      height_m: 150,
      sector_frequencies: null,
      source: "NEWA",
      license: "CC BY-NC 4.0",
      approximate: false,
    };
    useSiteStore.setState({ report: { ...report(), wind } });
    const { unmount } = render(<SiteReport />);
    expect(screen.getByText("Wind at 150 m")).toBeDefined();
    expect(screen.getByText("9.4")).toBeDefined();
    expect(screen.getByText(/A 10.6 · k 2.05 · NEWA \+ ERA5/)).toBeDefined();
    unmount();
    useSiteStore.setState({ report: { ...report(), wind: { ...wind, approximate: true } } });
    render(<SiteReport />);
    expect(screen.getByText(/approximation — real data not found/)).toBeDefined();
  });

  it("is quiet when the report is current", () => {
    render(<SiteReport />);
    expect(screen.queryByText(/Out of date/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });
});

describe("Screening stage", () => {
  const page = () =>
    render(
      <MemoryRouter>
        <SitePermitsPage />
      </MemoryRouter>,
    );

  it("shows the permit outlook with the failed checks", () => {
    useSiteStore.setState({ report: report({ msp_energy: "fail" }) });
    page();
    expect(screen.getByText(/Permit outlook: Consent refused/)).toBeDefined();
    expect(screen.getByText(/Check msp_energy: detail msp_energy/)).toBeDefined();
    expect(screen.getByText(/a real project could not take this site on to layout/)).toBeDefined();
  });

  it("turns warnings into future permit conditions", () => {
    useSiteStore.setState({ report: report({ owf: "warn" }) });
    page();
    expect(screen.getByText(/Consent granted with conditions/)).toBeDefined();
    expect(screen.getByText(/would become permit conditions/)).toBeDefined();
  });

  it("opens the provenance of a criterion", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Info: Only inside the plan's energy basins" }));
    expect(screen.getByText("Polish maritime spatial plan (Dz.U. 2021 poz. 935)")).toBeDefined();
  });
});

describe("Data sources", () => {
  it("lists source, licence and retrieval date of every layer, and missing ones", () => {
    render(<DataSources />);
    expect(screen.getByText("EMODnet Human Activities, MSP")).toBeDefined();
    expect(screen.getByText("Licence: CC BY 4.0")).toBeDefined();
    expect(screen.getByText("retrieved 2026-10-06")).toBeDefined();
    expect(screen.getByText("Missing: bathymetry")).toBeDefined();
  });

  it("points to the official plan for verification", () => {
    render(<ScreeningDisclaimer />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain("https://sipam.gov.pl/");
    expect(links).toContain("https://eli.gov.pl/eli/DU/2021/935/ogl");
  });
});

describe("Actors", () => {
  it("names the person and the role in text", () => {
    render(<Actor id="official" />);
    expect(screen.getByRole("img", { name: `${ACTORS.official.name}, ${ACTORS.official.role}` })).toBeDefined();
    expect(screen.getByText(ACTORS.official.role)).toBeDefined();
  });

  it("has five people in the cast", () => {
    expect(Object.keys(ACTORS)).toHaveLength(5);
  });
});
