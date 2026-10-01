import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

/** Main components in physical order, wind → grid → sea bed. */
export const PART_RAIL: { id: TurbinePartId; label: string }[] = [
  { id: "blades", label: "Blades" },
  { id: "hub", label: "Hub & pitch" },
  { id: "bearing", label: "Main bearing" },
  { id: "gearbox", label: "Gearbox" },
  { id: "generator", label: "Generator" },
  { id: "converter", label: "Converter" },
  { id: "transformer", label: "Transformer" },
  { id: "cooler", label: "CoolerTop" },
  { id: "nacelle", label: "Nacelle" },
  { id: "yaw", label: "Yaw system" },
  { id: "tower", label: "Tower" },
  { id: "foundation", label: "Foundation" },
];
