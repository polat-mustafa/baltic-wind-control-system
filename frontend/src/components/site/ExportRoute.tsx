/**
 * Export cable route of the candidate site (POST /api/v1/site/route-check):
 * draw the waypoints and the landfall on the map, or let the backend find the
 * shortest sea route to the grid node. The checked length becomes the export
 * length of the farm (Layout cost, P2 design, construction).
 */

import { Loader2, PenLine, RotateCcw, Route, Waypoints } from "lucide-react";

import { EXPORT_CABLE_GEO } from "../../constants/windFarmLayout";
import type { LonLat } from "../../lib/layout/geometry";
import { checkExportRoute, isCaseStudySite } from "../../lib/site/exportRoute";
import { useModeStore } from "../../store/modeStore";
import { useProjectStore } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import { Button } from "../ui/Button";
import { StatusMark } from "./SiteReport";

export default function ExportRoute() {
  const site = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  const route = useSiteStore((s) => s.route);
  const routeKm = useSiteStore((s) => s.routeKm);
  const check = useSiteStore((s) => s.routeCheck);
  const routing = useSiteStore((s) => s.routing);
  const error = useSiteStore((s) => s.routeError);
  const drawing = useSiteStore((s) => s.routeDrawing);
  const startRoute = useSiteStore((s) => s.startRoute);
  const clearRoute = useSiteStore((s) => s.clearRoute);
  const setRoute = useSiteStore((s) => s.setRoute);
  const own = useModeStore((s) => s.mode === "own");
  const projectOss = useProjectStore((s) => s.oss);
  if (!site || !report) return null;

  const sb510 = isCaseStudySite(site);
  const hasOss = (own && !!projectOss) || sb510;
  const run = () => void checkExportRoute();
  const loadSb510 = () => {
    const way = EXPORT_CABLE_GEO.slice(1).map((p): LonLat => [p.lon, p.lat]);
    setRoute(way);
    run();
  };
  const automatic = () => {
    setRoute(null);
    run();
  };

  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary" data-tour="site-route">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-primary px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Export cable route</h3>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              startRoute();
              // the map is above this panel: bring it into view for the clicks (after the
              // re-render, which would cancel a smooth scroll started now)
              requestAnimationFrame(() =>
                document.querySelector("[data-tour=site-map]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
              );
            }}
            disabled={!!drawing}
          >
            <PenLine size={13} className="mr-1" /> {route ? "Redraw" : "Draw"}
          </Button>
          <Button size="sm" variant="secondary" onClick={automatic} disabled={!!drawing}>
            <Route size={13} className="mr-1" /> Automatic
          </Button>
          {sb510 && (
            <Button size="sm" variant="secondary" onClick={loadSb510} disabled={!!drawing}>
              <Waypoints size={13} className="mr-1" /> SB-510 surveyed route
            </Button>
          )}
          {(route || check || routeKm) && (
            <Button size="sm" variant="ghost" onClick={clearRoute}>
              <RotateCcw size={13} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2 px-3 py-2 text-[12px]">
        {drawing ? (
          <p className="text-text-secondary">
            On the map: click from the site towards the coast, the landfall, then on land. The route starts at the {hasOss ? "offshore substation" : "site edge"} and
            ends at {report.grid_node ?? "the grid node"}.
          </p>
        ) : routing ? (
          <p className="flex items-center gap-1.5 text-text-muted">
            <Loader2 size={13} className="animate-spin" /> Checking the route…
          </p>
        ) : error ? (
          <p className="text-status-alarm">
            Route check failed: {error}{" "}
            <button type="button" className="underline" onClick={run}>
              Retry
            </button>
          </p>
        ) : check ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {[
                ["Length", `${check.total_km.toFixed(1)} km`],
                ["Subsea", `${check.offshore_km.toFixed(1)} km`],
                ["On land", `${check.onshore_km.toFixed(1)} km`],
                ["Route", check.auto ? "automatic" : "drawn"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-border-primary/50 py-0.5">
                  <dt className="text-text-muted">{k}</dt>
                  <dd className="text-right text-text-primary">{v}</dd>
                </div>
              ))}
            </dl>
            <ul className="divide-y divide-border-primary">
              {check.checks.map((c) => (
                <li key={c.id} className="flex gap-2 py-1.5">
                  <StatusMark status={c.status} />
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">{c.title}</div>
                    <div className="text-text-secondary">{c.detail}</div>
                    {c.reference && <div className="mt-0.5 text-xs text-text-muted">{c.reference}</div>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">
              This length is the farm's export cable: Layout cost, the grid design and construction use it.
              {check.auto &&
                " The automatic route keeps out of military areas and munition dumps and avoids Natura 2000 and shipping basins where it can (teaching weights); it does not see existing cables or crossing angles — check them and redraw."}
            </p>
          </>
        ) : routeKm ? (
          <p className="text-text-secondary">
            Checked route: {routeKm.toFixed(1)} km.{" "}
            <button type="button" className="underline" onClick={run}>
              Show the checks
            </button>
          </p>
        ) : (
          <p className="text-text-muted">
            No route yet: the export length is estimated as the straight distance to the grid node + 10 %. Draw the route or take the automatic one.
          </p>
        )}
      </div>
    </section>
  );
}
