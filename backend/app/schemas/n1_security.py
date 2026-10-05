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


# ── ANDES RMS dynamics ────────────────────────────────────────────


class DynamicsRequest(BaseModel):
    event: Literal["frequency", "fault"] = "frequency"
    load_trip_mw: float = Field(
        default=3_000.0, ge=500.0, le=4_000.0, description="Area load lost at t = 1 s [MW]"
    )
    retained_voltage_pu: float = Field(
        default=0.05, ge=0.05, le=0.8, description="POC voltage during the 150 ms fault [p.u.]"
    )


class DynamicsPoint(BaseModel):
    t: float = Field(description="Time [s]")
    f_hz: float = Field(description="Frequency at the POC [Hz]")
    v_poc: float = Field(description="POC voltage [p.u.]")
    p_mw: float = Field(description="Plant active power [MW]")
    q_mvar: float = Field(description="Plant reactive power, + generating [MVAR]")
    iq_pu: float = Field(description="Reactive current, + capacitive [p.u. of plant rating]")
    p_expected_mw: float | None = Field(
        default=None, description="Static LFSM-O characteristic of the measured frequency [MW]"
    )


class DynamicsResponse(BaseModel):
    event: Literal["frequency", "fault"]
    p0_mw: float
    series: list[DynamicsPoint]
    # frequency event
    load_trip_mw: float | None = None
    f_max_hz: float | None = None
    f_final_hz: float | None = None
    p_min_mw: float | None = None
    dp_final_mw: float | None = None
    dp_expected_final_mw: float | None = None
    response_delay_s: float | None = None
    # fault event
    retained_voltage_pu: float | None = None
    iq_max_pu: float | None = None
    p_recovery_s: float | None = None
    recovery_limit_s: float | None = None
    stayed_connected: bool | None = None
