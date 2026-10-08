/**
 * Ends of the export cable route and the route check call shared by the
 * Site & Permits route panel and the map's Finish button.
 */

import { OSS_GEO } from "../../constants/windFarmLayout";
import { useModeStore } from "../../store/modeStore";
import { useProjectStore } from "../../store/projectStore";
import { CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";
import { centroid, dist, nearestOnBoundary, projection, type LonLat } from "../layout/geometry";

/** A drawn route ends at the grid node unless its last point is already this close [m]. */
const END_SNAP_M = 2000;

const sameRing = (a: LonLat[] | null, b: LonLat[]) => !!a && a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

export const isCaseStudySite = (site: LonLat[] | null) => sameRing(site, CASE_STUDY_SITE);

/** Start and end of the export route: the offshore substation (else the site edge) and the grid node. */
export function routeEnds(site: LonLat[], oss: LonLat | null, way: LonLat[] | null, node: LonLat | null): { start: LonLat; end: LonLat | null } {
  const proj = projection(centroid(site));
  const toward = way?.[0] ?? node ?? centroid(site);
  const start = oss ?? proj.toLonLat(nearestOnBoundary(proj.toXY(toward), site.map(proj.toXY)));
  const last = way?.[way.length - 1];
  const end = node && (!last || dist(proj.toXY(last), proj.toXY(node)) > END_SNAP_M) ? node : null;
  return { start: [Number(start[0].toFixed(5)), Number(start[1].toFixed(5))], end };
}

/** Check the stored route (drawn waypoints, or the automatic one) from the current OSS / site to the grid node. */
export function checkExportRoute(): Promise<void> {
  const s = useSiteStore.getState();
  if (!s.site) return Promise.resolve();
  const projectOss = useModeStore.getState().mode === "own" ? useProjectStore.getState().oss : null;
  const oss: LonLat | null = projectOss ?? (isCaseStudySite(s.site) ? [OSS_GEO.lon, OSS_GEO.lat] : null);
  const node = s.layers?.layers
    .filter((l) => l.role === "grid")
    .flatMap((l) => l.features)
    .find((f) => f.name === s.report?.grid_node);
  const xy = node?.geometry.type === "Point" ? (node.geometry.coordinates as LonLat) : null;
  const { start, end } = routeEnds(s.site, oss, s.route, xy);
  return s.checkRoute(start, end);
}
