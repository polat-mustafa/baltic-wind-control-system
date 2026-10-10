/**
 * Base-map credits (OpenFreeMap vector tiles of OpenStreetMap data, plus an
 * optional data line). A full line from `sm` up; on a phone a "©" that opens
 * them (native <details>), so the credits never cover map controls.
 */

import { cn } from "../../lib/utils";

const link = "underline";

export default function MapCredits({ data, className }: { data?: string; className?: string }) {
  const credits = (
    <>
      ©{" "}
      <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className={link}>
        OpenFreeMap
      </a>{" "}
      ©{" "}
      <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className={link}>
        OpenMapTiles
      </a>{" "}
      ©{" "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className={link}>
        OpenStreetMap
      </a>{" "}
      contributors{data && ` · Data: ${data}`}
    </>
  );
  return (
    <div className={cn("pointer-events-auto absolute z-10 bg-bg-secondary/80 px-1.5 py-0.5 text-xs text-text-muted", className)}>
      <span className="max-sm:hidden">{credits}</span>
      <details className="sm:hidden">
        <summary className="cursor-pointer list-none px-1" aria-label="Map credits">
          ©
        </summary>
        <span className="block max-w-[16rem]">{credits}</span>
      </details>
    </div>
  );
}
