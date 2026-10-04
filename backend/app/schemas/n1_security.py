"""
Pydantic schemas for the N-1 security study of the export system.

Loadings in % of the branch rating, voltages in p.u., power in MW.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class N1Request(BaseModel):
    generation_fraction: float = Field(
        default=1.0, ge=0.1, le=1.0, description="Available output, fraction of 510 MW"
    )
    grid_ssc_mva: float = Field(
        default=10_000.0, ge=1_000.0, le=50_000.0, description="PSE short-circuit power [MVA]"
    )


class N1State(BaseModel):
    limiting_element: str = Field(description="Most loaded line or transformer")
    loading_pct: float = Field(description="Its loading [%]")
    v_min_pu: float
    v_max_pu: float
    output_mw: float = Field(description="WTG output [MW]")
    export_mw: float = Field(description="Active power into PSE at the POC [MW]")
    statcom_q_mvar: float = Field(description="STATCOM Q, + generating [MVAR]")
    secure: bool = Field(description="No loading > 100 % and voltages in the band")


class N1Contingency(BaseModel):
    id: str
    label: str
    kind: Literal["preventive", "corrective"]
    converged: bool
    immediate: N1State | None = Field(description="Right after the outage, automatic controls only")
    after_action: N1State | None = Field(description="After the corrective runback (if any)")
    lost_mw: float = Field(description="Generation disconnected by the outage itself [MW]")
    runback_mw: float = Field(description="Corrective PPC runback [MW]")
    runback_s: float = Field(description="Runback duration at the assumed ramp [s]")
    secure: bool
    output_scale: float


class N1Response(BaseModel):
    generation_fraction: float
    grid_ssc_mva: float
    base_case: N1State | None
    contingencies: list[N1Contingency]
    n1_secure: bool
    firm_output_mw: float = Field(
        description="Highest output that every contingency survives without runback [MW]"
    )
    runback_mw_per_s: float
    voltage_band_pu: list[float]
