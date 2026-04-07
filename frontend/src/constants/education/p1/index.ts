/**
 * Education content registry — P1 Wind Resource dashboard.
 *
 * Each entry is an EducationContent object that the EducationButton renders
 * inside the EducationPanel drawer. Entries are organised by component so the
 * import in each panel file is a one-liner.
 */

export { weibullEducation } from "./weibull";
export { windRoseEducation } from "./windRose";
export { aepCascadeEducation } from "./aepCascade";
export { wakeLossEducation } from "./wakeLoss";
export { capacityFactorEducation } from "./capacityFactor";
export { lcoeEducation } from "./lcoe";
export { uncertaintyEducation } from "./uncertainty";
export { availabilityHeatmapEducation } from "./availabilityHeatmap";
export { availabilityWaterfallEducation } from "./availabilityWaterfall";
export { weatherWindowEducation } from "./weatherWindow";
export { sensitivityEducation } from "./sensitivity";
export { oamCostEducation } from "./oamCost";
export { farmConfigEducation } from "./farmConfig";
export { farmLayoutMapEducation } from "./farmLayoutMap";
export { layoutComparisonEducation } from "./layoutComparison";
