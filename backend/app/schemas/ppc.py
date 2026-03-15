"""
Pydantic schemas for Power Plant Controller (PPC).

The PPC is the central control entity of the wind farm, sitting between
the TSO (PSE) and the 34 individual WTG converters. It translates TSO
dispatch commands into per-turbine setpoints while respecting grid code
requirements, ramp rate limits, and equipment constraints.

Control Hierarchy
-----------------
PSE (TSO) ↔ IEC 60870-5-104 ↔ PPC ↔ IEC 61400-25 ↔ 34 × WTG converters + STATCOM

Standards
---------
- ENTSO-E NC RfG (EU 2016/631): Type D active/reactive power requirements
- PSE IRiESP: Polish grid code — ramp rates, voltage limits, setpoint accuracy
- IEC 61400-25: Wind power plant communication profiles
- IEC 60870-5-104: Telecontrol companion standard (PPC ↔ TSO)
"""

from enum import StrEnum

from pydantic import BaseModel, Field

# ── PPC Operating State Machine ──────────────────────────────────


class PPCState(StrEnum):
    """PPC operating states per IEC 61400-25 logical node WPPC.

    State transitions follow a deterministic state machine:
      STOPPED → STARTING → AVAILABLE → RUNNING ⇄ DERATED
                                        ↓          ↓
                                      FAULT    EMERGENCY_STOP
                                        ↓          ↓
                                      STOPPED    STOPPED
    """

    STOPPED = "stopped"
    """PPC offline. No dispatch commands accepted."""

    STARTING = "starting"
    """PPC initialising. Watchdog timers and communication checks running."""

    AVAILABLE = "available"
    """PPC ready. WTG communication confirmed, awaiting TSO setpoint."""

    RUNNING = "running"
    """PPC actively controlling. Dispatching setpoints to WTGs."""

    DERATED = "derated"
    """PPC running at reduced capacity. Partial WTG availability or grid constraint."""

    FAULT = "fault"
    """PPC fault detected. Communication loss, watchdog timeout, or control error."""

    EMERGENCY_STOP = "emergency_stop"
    """Emergency shutdown triggered by TSO or protection system."""


# ── Active Power Control Modes ───────────────────────────────────


class ActivePowerMode(StrEnum):
    """Active power control modes available in the PPC.

    These modes determine how the PPC translates TSO commands into
    WTG active power setpoints. Only one mode is active at a time.

    References: ENTSO-E NC RfG Article 15(2)(a-d), PSE IRiESP §4.2
    """

    POWER_REFERENCE = "power_reference"
    """Direct power setpoint from TSO. P_farm = P_ref [MW].
    Most common mode during normal operation.
    PSE accuracy requirement: ±5% of Prated (±25.5 MW for 510 MW farm)."""

    DELTA_CONTROL = "delta_control"
    """Reserve margin mode. P_farm = P_available - delta_mw.
    Maintains headroom for upward frequency response.
    Typical delta: 10-50 MW (2-10% of Prated)."""

    ABSOLUTE_LIMITATION = "absolute_limitation"
    """Hard cap on total farm output. P_farm ≤ P_limit [MW].
    Used during grid congestion or maintenance windows.
    Farm operates at min(P_available, P_limit)."""

    RAMP_RATE_CONTROL = "ramp_rate_control"
    """Gradual power change. Limits dP/dt to specified gradient.
    PSE IRiESP: ramp up ≤ 10% Pn/min, ramp down ≤ 20% Pn/min.
    Emergency: ≥ 2% Pn/s (= 10.2 MW/s for 510 MW farm)."""


# ── Reactive Power Control Modes ─────────────────────────────────


class ReactivePowerMode(StrEnum):
    """Reactive power control modes per ENTSO-E NC RfG Article 21.

    Determines how the PPC manages voltage/reactive power at the PCC
    (Point of Common Coupling = OSS 220 kV bus). Coordinates WTG
    converter Q and STATCOM Q to meet the target.
    """

    VOLTAGE_CONTROL = "voltage_control"
    """Closed-loop PI controller on PCC voltage.
    Target: V_ref (typically 1.0 pu). Deadband: ±0.01 pu.
    Response: < 5 s to 90% of step (ENTSO-E NC RfG Article 21.3d).
    STATCOM provides fast Q, WTGs provide slow Q adjustment."""

    REACTIVE_POWER = "reactive_power"
    """Direct Q setpoint from TSO. Q_farm = Q_ref [MVAR].
    PPC distributes Q across WTGs proportional to available capacity."""

    POWER_FACTOR = "power_factor"
    """Fixed power factor at PCC. cos(φ) = PF_ref.
    Q_ref = P_actual * tan(arccos(PF_ref)).
    Range: 0.90 leading to 0.90 lagging per NC RfG Type D."""

    Q_V_DROOP = "q_v_droop"
    """Q(V) droop characteristic. Reactive power proportional to voltage deviation.
    Q = Q_base + K_qv * (V_pcc - V_ref) [MVAR].
    Slope K_qv: typically 50-200 MVAR/pu.
    Deadband: ±0.02 pu voltage."""


# ── TSO Setpoint Command ─────────────────────────────────────────


class TSOSetpoint(BaseModel):
    """TSO dispatch command received via IEC 60870-5-104.

    This represents a single dispatch instruction from PSE to the PPC.
    In real systems, this arrives as ASDU Type 50 (Set-point command,
    scaled value) or Type 51 (Set-point command, short floating point).
    """

    active_power_mw: float | None = Field(
        None, ge=0.0, le=510.0, description="Active power setpoint [MW]. None = unchanged."
    )
    reactive_power_mvar: float | None = Field(
        None, ge=-120.0, le=120.0, description="Reactive power setpoint [MVAR]. None = unchanged."
    )
    voltage_setpoint_pu: float | None = Field(
        None, ge=0.90, le=1.10, description="PCC voltage setpoint [p.u.]. None = unchanged."
    )
    power_factor: float | None = Field(
        None,
        ge=-1.0,
        le=1.0,
        description="Power factor at PCC. Negative = leading. None = unchanged.",
    )
    delta_reserve_mw: float | None = Field(
        None, ge=0.0, le=100.0, description="Delta reserve margin [MW] for delta control mode."
    )
    absolute_limit_mw: float | None = Field(
        None, ge=0.0, le=510.0, description="Absolute power limitation [MW]."
    )
    ramp_rate_mw_per_min: float | None = Field(
        None,
        ge=0.0,
        le=510.0,
        description="Custom ramp rate [MW/min]. None = use PSE default.",
    )
    emergency_stop: bool = Field(
        False, description="Emergency stop command. Overrides all other setpoints."
    )


# ── Per-Turbine Dispatch ─────────────────────────────────────────


class WTGDispatch(BaseModel):
    """Active power setpoint dispatched to a single WTG by the PPC.

    The PPC uses pro-rata dispatch: each WTG receives power proportional
    to its available capacity relative to total farm available capacity.

    Formula: P_i = P_farm_ref × (P_avail_i / Σ P_avail_j)
    """

    wtg_id: str = Field(description="Turbine ID, e.g. 'WTG_01'")
    available_power_mw: float = Field(description="Available active power from wind [MW]")
    dispatched_power_mw: float = Field(description="Active power setpoint from PPC [MW]")
    dispatched_q_mvar: float = Field(description="Reactive power setpoint from PPC [MVAR]")
    curtailment_mw: float = Field(description="Curtailed power = available - dispatched [MW]")
    is_online: bool = Field(description="True if WTG is online and communicating")


# ── PPC Configuration ────────────────────────────────────────────


class PPCConfig(BaseModel):
    """PPC control parameters. Configurable per grid code requirements.

    Default values are for PSE IRiESP + ENTSO-E NC RfG Type D compliance.

    References
    ----------
    - PSE IRiESP §4.2: Active power ramp rates
    - ENTSO-E NC RfG Article 15(2): Frequency response parameters
    - ENTSO-E NC RfG Article 21: Reactive power and voltage control
    """

    # ── Active Power Control ──────────────────────────────────
    ramp_up_pct_per_min: float = Field(
        10.0,
        ge=0.1,
        le=100.0,
        description="Max ramp-up rate [% Pn/min]. PSE IRiESP: 10%/min = 51 MW/min.",
    )
    ramp_down_pct_per_min: float = Field(
        20.0,
        ge=0.1,
        le=100.0,
        description="Max ramp-down rate [% Pn/min]. PSE IRiESP: 20%/min = 102 MW/min.",
    )
    emergency_ramp_pct_per_s: float = Field(
        2.0,
        ge=0.1,
        le=100.0,
        description="Emergency ramp rate [% Pn/s]. PSE: ≥2%/s = 10.2 MW/s for 510 MW.",
    )
    setpoint_accuracy_pct: float = Field(
        5.0,
        ge=0.1,
        le=20.0,
        description="Setpoint tracking accuracy [% Pn]. PSE: ±5% = ±25.5 MW.",
    )
    setpoint_deadband_mw: float = Field(
        1.0,
        ge=0.0,
        le=10.0,
        description="Deadband below which no dispatch adjustment is made [MW].",
    )

    # ── Reactive Power / Voltage Control ──────────────────────
    voltage_deadband_pu: float = Field(
        0.01,
        ge=0.0,
        le=0.05,
        description="Voltage control deadband [p.u.]. No action within ±deadband.",
    )
    voltage_kp: float = Field(
        50.0,
        ge=1.0,
        le=500.0,
        description="Voltage PI proportional gain [MVAR/pu]. Typical: 50.",
    )
    voltage_ki: float = Field(
        20.0,
        ge=0.1,
        le=200.0,
        description="Voltage PI integral gain [MVAR/(pu·s)]. Typical: 20.",
    )
    q_v_droop_slope_mvar_per_pu: float = Field(
        100.0,
        ge=10.0,
        le=500.0,
        description="Q(V) droop slope [MVAR/pu]. Typical: 100.",
    )
    q_v_droop_deadband_pu: float = Field(
        0.02,
        ge=0.0,
        le=0.05,
        description="Q(V) droop voltage deadband [p.u.].",
    )

    # ── Frequency Response ────────────────────────────────────
    frequency_deadband_hz: float = Field(
        0.2,
        ge=0.0,
        le=0.5,
        description="Frequency response deadband [Hz]. ENTSO-E: ±200 mHz default.",
    )
    droop_pct: float = Field(
        5.0,
        ge=2.0,
        le=12.0,
        description="Frequency droop R [%]. ENTSO-E NC RfG Type D: 2-12%, default 5%.",
    )

    # ── Watchdog & Communication ──────────────────────────────
    heartbeat_interval_s: float = Field(
        1.0,
        ge=0.1,
        le=10.0,
        description="Heartbeat interval to WTGs [s]. Loss triggers fault after 3x timeout.",
    )
    tso_timeout_s: float = Field(
        30.0,
        ge=5.0,
        le=120.0,
        description="TSO communication timeout [s]. Loss → hold last setpoint.",
    )


# ── PPC Simulation Request ───────────────────────────────────────


class PPCSimulationRequest(BaseModel):
    """Request to run a PPC control simulation over a time window.

    Simulates the PPC response to a TSO dispatch command given current
    wind conditions and WTG availability, including ramp rate limiting,
    pro-rata dispatch, and voltage/reactive power control.
    """

    tso_setpoint: TSOSetpoint = Field(description="TSO dispatch command")
    active_power_mode: ActivePowerMode = Field(
        ActivePowerMode.POWER_REFERENCE,
        description="Active power control mode",
    )
    reactive_power_mode: ReactivePowerMode = Field(
        ReactivePowerMode.VOLTAGE_CONTROL,
        description="Reactive power control mode",
    )
    wind_speed_ms: float = Field(12.5, ge=0.0, le=50.0, description="Hub-height wind speed [m/s]")
    available_turbines: int = Field(34, ge=0, le=34, description="Number of online turbines")
    initial_power_mw: float = Field(
        510.0, ge=0.0, le=510.0, description="Current farm output before dispatch [MW]"
    )
    simulation_duration_s: float = Field(
        300.0, ge=10.0, le=3600.0, description="Simulation duration [s]"
    )
    time_step_s: float = Field(1.0, ge=0.1, le=10.0, description="Simulation time step [s]")
    config: PPCConfig = Field(default_factory=PPCConfig, description="PPC configuration parameters")


# ── PPC Time-Series Output ───────────────────────────────────────


class PPCTimePoint(BaseModel):
    """Single time-step output from PPC simulation."""

    time_s: float = Field(description="Simulation time [s]")
    power_setpoint_mw: float = Field(description="PPC power setpoint (after ramp limit) [MW]")
    power_actual_mw: float = Field(description="Actual farm output [MW]")
    available_power_mw: float = Field(description="Total available wind power [MW]")
    curtailment_mw: float = Field(description="Total curtailed power [MW]")
    ramp_rate_mw_per_min: float = Field(description="Instantaneous ramp rate [MW/min]")
    q_setpoint_mvar: float = Field(description="PPC reactive power setpoint [MVAR]")
    q_actual_mvar: float = Field(description="Actual reactive power at PCC [MVAR]")
    voltage_pcc_pu: float = Field(description="PCC voltage magnitude [p.u.]")
    frequency_hz: float = Field(description="System frequency [Hz]")
    ppc_state: PPCState = Field(description="PPC operating state")


# ── PPC Simulation Response ──────────────────────────────────────


class PPCSimulationResponse(BaseModel):
    """Complete PPC simulation result.

    Contains time-series response, per-WTG dispatch table,
    compliance verdicts, and control mode summary.
    """

    model_config = {"from_attributes": True}

    # ── Control Configuration ─────────────────────────────────
    active_power_mode: ActivePowerMode = Field(description="Active power control mode used")
    reactive_power_mode: ReactivePowerMode = Field(description="Reactive power control mode used")
    ppc_state: PPCState = Field(description="Final PPC operating state")

    # ── TSO Command ───────────────────────────────────────────
    tso_power_setpoint_mw: float = Field(description="TSO active power command [MW]")
    tso_q_or_v_setpoint: float = Field(
        description="TSO Q [MVAR] or V [pu] or PF setpoint, depending on mode"
    )

    # ── Farm-Level Results ────────────────────────────────────
    final_power_mw: float = Field(description="Final farm active power output [MW]")
    final_q_mvar: float = Field(description="Final farm reactive power output [MVAR]")
    final_voltage_pu: float = Field(description="Final PCC voltage [p.u.]")
    total_available_mw: float = Field(description="Total available wind power [MW]")
    total_curtailment_mw: float = Field(description="Total curtailed power [MW]")
    ramp_time_s: float = Field(description="Time to reach setpoint within accuracy band [s]")

    # ── Compliance Verdicts ───────────────────────────────────
    setpoint_accuracy_compliant: bool = Field(
        description="Final output within ±5% Pn of setpoint (PSE IRiESP)"
    )
    ramp_rate_compliant: bool = Field(
        description="Ramp rate stayed within PSE limits throughout simulation"
    )
    voltage_compliant: bool = Field(
        description="PCC voltage within 0.95-1.05 pu throughout simulation"
    )
    overall_compliant: bool = Field(description="All compliance checks passed")

    # ── Per-WTG Dispatch Table ────────────────────────────────
    wtg_dispatch: list[WTGDispatch] = Field(
        default_factory=list, description="Final dispatch to each WTG"
    )

    # ── Time-Series ───────────────────────────────────────────
    time_series: list[PPCTimePoint] = Field(
        default_factory=list, description="Time-domain simulation data"
    )


# ── PPC Status (real-time snapshot) ──────────────────────────────


class PPCStatusResponse(BaseModel):
    """Real-time PPC status snapshot.

    Represents the current state of the PPC and all its control loops.
    In a real system, this would be polled every 1-2 seconds by the SCADA HMI.
    """

    model_config = {"from_attributes": True}

    ppc_state: PPCState = Field(description="Current PPC operating state")
    active_power_mode: ActivePowerMode = Field(description="Active P control mode")
    reactive_power_mode: ReactivePowerMode = Field(description="Reactive Q/V control mode")

    # ── Active Power ──────────────────────────────────────────
    power_setpoint_mw: float = Field(description="Current active power setpoint [MW]")
    power_actual_mw: float = Field(description="Current actual active power [MW]")
    available_power_mw: float = Field(description="Total available wind power [MW]")
    curtailment_mw: float = Field(description="Current curtailed power [MW]")
    ramp_rate_mw_per_min: float = Field(description="Current ramp rate [MW/min]")

    # ── Reactive Power / Voltage ──────────────────────────────
    q_setpoint_mvar: float = Field(description="Current Q setpoint [MVAR]")
    q_actual_mvar: float = Field(description="Current actual Q [MVAR]")
    voltage_setpoint_pu: float = Field(description="Voltage setpoint [p.u.]")
    voltage_actual_pu: float = Field(description="Actual PCC voltage [p.u.]")

    # ── Frequency ─────────────────────────────────────────────
    frequency_hz: float = Field(description="System frequency [Hz]")
    frequency_response_active: bool = Field(
        description="True if frequency response is overriding normal dispatch"
    )
    frequency_delta_p_mw: float = Field(
        description="Active power adjustment from frequency response [MW]"
    )

    # ── Turbine Status ────────────────────────────────────────
    turbines_online: int = Field(description="Number of WTGs online and communicating")
    turbines_total: int = Field(34, description="Total WTGs in farm")
    statcom_q_mvar: float = Field(description="STATCOM reactive power output [MVAR]")

    # ── Communication Health ──────────────────────────────────
    tso_comm_ok: bool = Field(description="TSO communication link healthy")
    wtg_comm_ok: bool = Field(description="All WTG communication links healthy")
    last_tso_command_age_s: float = Field(description="Time since last TSO command [s]")
