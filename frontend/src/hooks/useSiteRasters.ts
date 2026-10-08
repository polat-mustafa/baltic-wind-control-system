/**
 * Water depth and seabed sediment around a site, from the region pack rasters
 * (EMODnet bathymetry and Geology, GET /api/v1/site/raster), fetched once per outline.
 */

import { useEffect, useMemo, useState } from "react";

import { classSampler, rasterSampler, seabedLookup, type SeabedAt } from "../lib/layout/evaluate";
import type { LonLat } from "../lib/layout/geometry";
import { getRaster, type RasterResponse, type SeabedClass } from "../services/siteApi";

export function useSiteRasters(
  site: LonLat[],
  classes: SeabedClass[] | undefined,
): { depthAt: (p: LonLat) => number | null; seabedAt: SeabedAt } {
  const [depth, setDepth] = useState<RasterResponse | null>(null);
  const [seabed, setSeabed] = useState<RasterResponse | null>(null);
  const siteKey = site.map((q) => q.join(",")).join(";");
  useEffect(() => {
    let live = true;
    const lons = site.map((q) => q[0]);
    const lats = site.map((q) => q[1]);
    const m = 0.05; // ° margin: turbines dragged just outside still get a value
    const bbox: [number, number, number, number] = [Math.min(...lons) - m, Math.min(...lats) - m, Math.max(...lons) + m, Math.max(...lats) + m];
    // A failed raster shows "—" and the checklist says unknown.
    getRaster("bathymetry", bbox).then((r) => live && setDepth(r), () => live && setDepth(null));
    getRaster("seabed", bbox).then((r) => live && setSeabed(r), () => live && setSeabed(null));
    return () => {
      live = false;
    };
  }, [siteKey]); // refetch only when the outline changes
  const depthAt = useMemo(() => rasterSampler(depth), [depth]);
  const seabedAt = useMemo(() => seabedLookup(classSampler(seabed), classes), [seabed, classes]);
  return { depthAt, seabedAt };
}
