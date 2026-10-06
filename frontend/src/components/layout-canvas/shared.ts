/** Types and colours shared by the layout page and its (lazy) map. */

export type TurbineStatus = "ok" | "close" | "outside" | "excluded";

export interface TurbineView {
  id: string;
  lon: number;
  lat: number;
  status: TurbineStatus;
  note: string;
}

export const SECTION_COLOR: Record<string, string> = {
  "500": "#0ea5e9",
  "630": "#6366f1",
  "800": "#a855f7",
  over: "#ef4444",
};
