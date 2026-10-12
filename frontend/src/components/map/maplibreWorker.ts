/**
 * MapLibre 6 loads its tile worker from a URL next to its own module, which Vite
 * does not emit — without this the base map (sea, land, farm outline) stays blank.
 * Import once, for its side effect, before a map is created.
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(workerUrl);
