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
- PSE: Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018) — the Polish
  parameter choices (LFSM thresholds, setpoint accuracy, Q dynamics)
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
    PSE Art. 15(2)(a): new setpoint within 15 min, accuracy 2 % of the setpoint."""

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
    The ramp limit is agreed with the TSO; PSE Art. 15(6)(e) requires wind
    modules to be *able* to change output at 90–100 % P_max/min."""


# ── Reactive Power Control Modes ─────────────────────────────────


class ReactivePowerMode(StrEnum):
    """Reactive power control modes per ENTSO-E NC RfG Article 21.

    Determines how the PPC manages voltage/reactive power at the connection
    point (PSE 400 kV). Coordinates WTG converter Q and STATCOM Q.
    """

    VOLTAGE_CONTROL = "voltage_control"
    """Closed-loop PI controller on PCC voltage.
    Slope characteristic Q = Q_max·(V_ref − V)/s, s = 2–7 % (NC RfG Art. 21(3)(d)).
    PSE Art. 21(3)(d)(iv): 90 % of the Q change within 5 s, settled within 60 s."""

    REACTIVE_POWER = "reactive_power"
    """Direct Q setpoint from TSO. Q_farm = Q_ref [MVAR].
    PPC distributes Q across WTGs proportional to available capacity."""

    POWER_FACTOR = "power_factor"
    """Fixed power factor at PCC. cos(φ) = PF_ref.
    Q_ref = P_actual * tan(arccos(PF_ref)), limited to the plant Q range.
    PSE Art. 21(3)(d)(vi): within 5 % of Q_max or 5 MVAR, in ≤ 150 s."""

    Q_V_DROOP = "q_v_droop"
    """Q(V) droop characteristic. Reactive power proportional to voltage deviation.
    Same slope characteristic as voltage control, with a voltage deadband
    (NC RfG allows 0 to ±5 %)."""


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
        description="Ramp limit up [% P_max/min] — plant setting agreed with the TSO "
        "(PSE Art. 15(6)(e): wind modules must be able to ramp 90–100 %/min).",
    )
    ramp_down_pct_per_min: float = Field(
        10.0, ge=0.1, le=100.0, description="Ramp limit down [% P_max/min] — plant setting."
    )
    emergency_ramp_pct_per_s: float = Field(
        2.0, ge=0.1, le=100.0, description="Emergency shutdown ramp [% P_max/s] — plant setting."
    )
    setpoint_accuracy_pct: float = Field(
        2.0,
        ge=0.1,
        le=20.0,
        description="Setpoint accuracy [% of setpoint]. PSE Art. 15(2)(a): 2 % for PPMs.",
    )
    setpoint_deadband_mw: float = Field(
        1.0,
        ge=0.0,
        le=10.0,
        description="Deadband below which no dispatch adjustment is made [MW].",
    )
    p_response_tau_s: float = Field(
        0.5, ge=0.05, le=10.0, description="WTG active power response time constant [s]."
    )

    # ── Reactive Power / Voltage Control ──────────────────────
    voltage_slope_pct: float = Field(
        4.0,
        ge=2.0,
        le=7.0,
        description="Voltage-control slope s [%]: ΔV that moves Q by Q_max. NC RfG: 2–7 %.",
    )
    q_v_droop_deadband_pu: float = Field(
        0.02, ge=0.0, le=0.05, description="Q(V) droop voltage deadband [p.u.]."
    )
    q_response_tau_s: float = Field(
        1.5,
        ge=0.1,
        le=20.0,
        description="Reactive power response time constant [s] (90 % ≈ 2.3 τ; PSE: ≤ 5 s).",
    )

    # ── Frequency Response (PSE defaults) ─────────────────────
    lfsm_o_threshold_hz: float = Field(
        50.2,
        ge=50.2,
        le=50.5,
        description="LFSM-O threshold [Hz]. PSE Art. 13(2)(a): default 50.2.",
    )
    lfsm_u_threshold_hz: float = Field(
        49.8,
        ge=49.5,
        le=49.8,
        description="LFSM-U threshold [Hz]. PSE Art. 15(2)(c): default 49.8.",
    )
    lfsm_droop_pct: float = Field(
        5.0, ge=2.0, le=12.0, description="LFSM-O/U droop [%] on P_max. PSE default 5 %."
    )
    frequency_deadband_hz: float = Field(
        0.2,
        ge=0.0,
        le=0.5,
        description="FSM deadband [Hz] (PSE Art. 15(2)(d): 0–500 mHz, set by the TSO).",
    )
    droop_pct: float = Field(5.0, ge=2.0, le=12.0, description="FSM droop [%]. NC RfG: 2–12 %.")

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
    wind_speed_ms: float = Field(11.1, ge=0.0, le=50.0, description="Hub-height wind speed [m/s]")
    available_turbines: int | None = Field(
        None, ge=0, le=150, description="Online turbines; None = all (capped at the farm's count)"
    )
    initial_power_mw: float = Field(
        510.0, ge=0.0, le=510.0, description="Current farm output before dispatch [MW]"
    )
    simulation_duration_s: float = Field(
        120.0, ge=10.0, le=3600.0, description="Simulation duration [s]"
    )
    time_step_s: float = Field(0.1, ge=0.02, le=10.0, description="Simulation time step [s]")
    setpoint_time_s: float = Field(
        10.0, ge=0.0, le=3600.0, description="When the TSO command arrives [s]"
    )
    frequency_event_hz: float | None = Field(
        None, ge=47.5, le=51.5, description="Grid frequency after a step event [Hz]; None = 50 Hz"
    )
    voltage_step_pu: float | None = Field(
        None, ge=-0.1, le=0.1, description="Step of the grid voltage behind the POC [p.u.]"
    )
    event_time_s: float = Field(
        60.0, ge=0.0, le=3600.0, description="When the grid event occurs [s]"
    )
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
    q_actual_mvar: float = Field(description="Reactive power delivered at the POC [MVAR]")
    voltage_pcc_pu: float = Field(description="POC (PSE 400 kV) voltage magnitude [p.u.]")
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
    ramp_time_s: float = Field(
        description="Time from the TSO command to P within the accuracy band [s] "
        "(from the ramp settings when beyond the simulated window)"
    )

    # ── Compliance Verdicts ───────────────────────────────────
    setpoint_accuracy_compliant: bool = Field(
        description="Setpoint reached within 2 % (of setpoint) inside 15 min — PSE Art. 15(2)(a)"
    )
    ramp_rate_compliant: bool = Field(
        description="Dispatch ramps within the configured limit (frequency response excluded)"
    )
    voltage_compliant: bool = Field(
        description="POC voltage within 0.95–1.05 pu throughout the simulation"
    )
    frequency_response_compliant: bool = Field(
        True, description="ΔP within 2 % P_max of the LFSM/FSM droop value 30 s after the event"
    )
    frequency_response_expected_mw: float = Field(0.0, description="Droop ΔP for the event [MW]")
    frequency_response_actual_mw: float = Field(
        0.0, description="Delivered ΔP 30 s after the event [MW]"
    )
    q_response_90_s: float = Field(
        0.0, description="Time to 90 % of the Q change after a voltage step [s]"
    )
    q_response_compliant: bool = Field(
        True, description="90 % of the Q change within 5 s — PSE Art. 21(3)(d)(iv)"
    )
    q_range_mvar: list[float] = Field(
        default_factory=list, description="Fast reactive range used [min, max] [MVAR]"
    )
    overall_compliant: bool = Field(description="All applicable checks passed")

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
