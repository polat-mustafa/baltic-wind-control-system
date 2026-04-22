/**
 * SCL (IEC 61850-6) generator API.
 *
 * Wraps POST /api/v1/scada/scl-generate, the only P3 SCADA endpoint that
 * previously had no UI caller (audit 2026-04-20). Generates SSD, ICD, or
 * SCD configuration XML files for the offshore substation.
 */

import { post } from "./apiClient";

export type SCLFileType = "SSD" | "ICD" | "SCD";

export interface SCLGenerateRequest {
  file_type: SCLFileType;
  device_name?: string | null;
}

export interface SCLFileResponse {
  id: string;
  file_type: string;
  name: string;
  xml_content: string;
  device_name: string | null;
  created_at: string;
}

export function generateSCL(req: SCLGenerateRequest): Promise<SCLFileResponse> {
  return post<SCLFileResponse>("/api/v1/scada/scl-generate", req);
}
