/**
 * Engineer's Library — read-only educational primers covering topics that
 * the Baltic Wind simulation does NOT implement directly, but that any
 * offshore-wind HV control engineer must understand.
 *
 * Each entry uses the same EducationContent schema as the live dashboards,
 * so the EducationPanel component renders them with no special handling.
 */

import type { EducationContent } from "../../../types/education";

import { siteSelectionEducation } from "./siteSelection";
import { foundationDesignEducation } from "./foundationDesign";
import { structuralFatigueEducation } from "./structuralFatigue";
import { cableInstallationEducation } from "./cableInstallation";
import { offshoreSubstationEducation } from "./offshoreSubstation";
import { earthingLightningEducation } from "./earthingLightning";
import { insulationCoordinationEducation } from "./insulationCoordination";
import { hvacVsHvdcEducation } from "./hvacVsHvdc";
import { blackStartEducation } from "./blackStart";
import { offshoreSafetyEducation } from "./offshoreSafety";
import { environmentalImpactEducation } from "./environmentalImpact";
import { decommissioningEducation } from "./decommissioning";
import { projectFinanceEducation } from "./projectFinance";
import { nis2CyberEducation } from "./nis2Cyber";
import { oamLogisticsEducation } from "./oamLogistics";
import { powerCurveTestingEducation } from "./powerCurveTesting";
import { gridCodeComplianceEducation } from "./gridCodeCompliance";

export {
  siteSelectionEducation,
  foundationDesignEducation,
  structuralFatigueEducation,
  cableInstallationEducation,
  offshoreSubstationEducation,
  earthingLightningEducation,
  insulationCoordinationEducation,
  hvacVsHvdcEducation,
  blackStartEducation,
  offshoreSafetyEducation,
  environmentalImpactEducation,
  decommissioningEducation,
  projectFinanceEducation,
  nis2CyberEducation,
  oamLogisticsEducation,
  powerCurveTestingEducation,
  gridCodeComplianceEducation,
};

/**
 * Ordered list used by the EngineerLibraryPage card grid.
 * Order is roughly: site → civil → electrical → ops/finance/cyber.
 */
export const libraryEntries: readonly EducationContent[] = [
  siteSelectionEducation,
  foundationDesignEducation,
  structuralFatigueEducation,
  cableInstallationEducation,
  offshoreSubstationEducation,
  earthingLightningEducation,
  insulationCoordinationEducation,
  hvacVsHvdcEducation,
  gridCodeComplianceEducation,
  blackStartEducation,
  powerCurveTestingEducation,
  offshoreSafetyEducation,
  environmentalImpactEducation,
  decommissioningEducation,
  projectFinanceEducation,
  nis2CyberEducation,
  oamLogisticsEducation,
];
