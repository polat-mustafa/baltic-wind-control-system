# Baltic Wind Alpha — Improvement Roadmap

**Version:** 1.0
**Date:** 2026-03-25
**Status:** Planning
**Scope:** 15 new modules to transform 5 isolated projects into an integrated control platform

---

## Current State Assessment

The platform currently has 5 projects (P1–P5) covering wind resource, grid integration,
SCADA, AI forecasting, and commissioning. They work but they are **isolated demos** —
each project runs independently with no real data flow between them.

**Critical gaps:**
- No control logic (interlocks, protection, PLC)
- No industrial protocols (OPC-UA, DNP3)
- No real-time event recording (SOE)
- No power quality analysis (harmonics, flicker)
- No cybersecurity architecture
- No energy storage
- No condition monitoring or O&M planning
- No market/commercial integration
- SCADA is essentially a UI mockup with a state machine

---

## Module Overview (15 Modules)

| # | Module | Category | Priority | Effort | Dependencies |
|---|--------|----------|----------|--------|--------------|
| M01 | Interlock Engine & Bay Controller | SCADA Core | P0 — Critical | 2–3 weeks | None |
| M02 | Sequence of Events (SOE) Recorder | SCADA Core | P0 — Critical | 3–4 days | None |
| M03 | OPC-UA Server | Industrial Comms | P1 — High | 1 week | M01 |
| M04 | Multi-Farm Comparison | Platform | P1 — High | 1–2 weeks | None |
| M05 | Protection Relay Coordination | Protection | P1 — High | 2 weeks | M01 |
| M06 | Power Quality & Harmonics | Grid Code | P2 — Medium | 2 weeks | P2 existing |
| M07 | Cybersecurity (IEC 62443) | Security | P2 — Medium | 2 weeks | M03 |
| M08 | BESS Integration | Control | P2 — Medium | 2 weeks | PPC existing |
| M09 | Alarm Rationalization (EEMUA 191) | SCADA Ops | P2 — Medium | 1 week | M02 |
| M10 | Cable DTS Thermal Monitoring | Asset Mgmt | P3 — Normal | 1 week | P2 existing |
| M11 | Market Integration & Bidding | Commercial | P3 — Normal | 2 weeks | P4 existing |
| M12 | Condition Monitoring System (CMS) | O&M | P1 — High | 2–3 weeks | None |
| M13 | Availability & Reliability (IEC 61400-26) | O&M | P2 — Medium | 1–2 weeks | M12 |
| M14 | Weather Window & O&M Logistics | Operations | P3 — Normal | 1–2 weeks | P1 existing |
| M15 | Communication Network Architecture | Infrastructure | P3 — Normal | 1 week | M03, M07 |

**Total estimated effort: ~22–28 weeks**

---

## Module Detailed Specifications

---

### M01 — Interlock Engine & Bay Controller

**Category:** SCADA Core
**Priority:** P0 — Critical (this is what makes SCADA real)
**Effort:** 2–3 weeks
**Dependencies:** None

#### Why This Matters
A real offshore substation has bay controllers that enforce physical safety rules.
You cannot close a circuit breaker if the earthing switch is engaged. You cannot
open a disconnector under load. These rules prevent equipment destruction and
personnel death. Without interlocks, the SCADA system is a web app, not a control system.

#### What To Build

**Interlock Rules Engine:**
```
Rule 1: CB close BLOCKED if earth switch CLOSED on same bay
Rule 2: Disconnector operation BLOCKED if CB is CLOSED (no break under load)
Rule 3: Earth switch close BLOCKED if disconnector OPEN on source side
Rule 4: CB close BLOCKED if protection relay not ARMED
Rule 5: Parallel CB operations BLOCKED (one at a time per busbar section)
Rule 6: Auto-reclose BLOCKED if manual isolation in effect
Rule 7: Synchrocheck required before closing tie CB (ΔV < 5%, Δf < 0.1 Hz, Δφ < 10°)
```

**Equipment State Model:**
```python
class BayController:
    circuit_breaker: SwitchPosition     # OPEN / CLOSED / TRIPPED / FAILED
    disconnector_bus: SwitchPosition    # OPEN / CLOSED
    disconnector_line: SwitchPosition   # OPEN / CLOSED
    earth_switch: SwitchPosition        # OPEN / CLOSED
    protection_relay: RelayState        # ARMED / TRIPPED / BLOCKED / TEST
    bay_mode: BayMode                   # LOCAL / REMOTE / MAINTENANCE

    def validate_command(self, command: SwitchCommand) -> InterlockResult:
        """Check ALL interlock rules before allowing any operation."""
```

**API Endpoints:**
```
POST   /api/v1/scada/bays/{bay_id}/command      — Execute switch command (interlock-checked)
GET    /api/v1/scada/bays/{bay_id}/state         — Current bay equipment state
GET    /api/v1/scada/bays/{bay_id}/interlocks    — List all interlock rules and current status
POST   /api/v1/scada/interlocks/validate         — Dry-run: check if command would be allowed
```

**Frontend:**
- Bay mimic diagram (XYFlow) with equipment colored by state (ISA-101)
- Click equipment → shows interlock status (green = allowed, red = blocked with reason)
- Command confirmation dialog with interlock validation result

**Standards:** IEC 61850-7-4 (logical nodes: XCBR, XSWI, CSWI), IEC 62271 (switchgear)

---

### M02 — Sequence of Events (SOE) Recorder

**Category:** SCADA Core
**Priority:** P0 — Critical
**Effort:** 3–4 days
**Dependencies:** None

#### Why This Matters
When a fault occurs on an offshore wind farm, the protection engineer reconstructs
what happened by reading the SOE log. Events must be timestamped to millisecond
(ideally microsecond) precision and stored in strict chronological order. Every
protection trip, CB operation, alarm, and operator action must be recorded.

#### What To Build

**Event Types:**
```
PROTECTION_TRIP    — relay operated (which relay, pickup value, trip time)
CB_OPERATION       — circuit breaker open/close (bay, command source, time)
ALARM_RAISED       — new alarm (tag, priority, value, limit)
ALARM_CLEARED      — alarm returned to normal
ALARM_ACKED        — operator acknowledged alarm
OPERATOR_COMMAND   — any manual command (who, what, where)
INTERLOCK_BLOCK    — command rejected by interlock engine
STATE_CHANGE       — equipment state transition
COMMS_LOSS         — communication failure with device
COMMS_RESTORE      — communication restored
```

**Database:**
```sql
CREATE TABLE soe_event (
    id              BIGSERIAL PRIMARY KEY,
    timestamp_utc   TIMESTAMPTZ(6) NOT NULL,     -- microsecond precision
    event_type      VARCHAR(30) NOT NULL,
    source_device   VARCHAR(100) NOT NULL,        -- e.g., "OSS_66kV_Bay01_CB"
    description     TEXT NOT NULL,
    value_before    VARCHAR(50),
    value_after     VARCHAR(50),
    operator_id     UUID REFERENCES users(id),
    severity        VARCHAR(10),                  -- CRITICAL / HIGH / MEDIUM / LOW / INFO
    acknowledged    BOOLEAN DEFAULT FALSE,
    ack_by          UUID REFERENCES users(id),
    ack_at          TIMESTAMPTZ
);

-- TimescaleDB hypertable for fast time-range queries
SELECT create_hypertable('soe_event', 'timestamp_utc');
```

**API Endpoints:**
```
GET    /api/v1/scada/soe                    — Query SOE log (time range, filters)
GET    /api/v1/scada/soe/export             — Export to CSV/PDF for incident reports
POST   /api/v1/scada/soe/{id}/acknowledge   — Operator acknowledges event
GET    /api/v1/scada/soe/stats              — Event counts by type/severity/hour
```

**Frontend:**
- Real-time scrolling SOE table with color-coded severity
- Time-range filter + device filter + event type filter
- One-click incident report export (CSV)
- Timeline visualization (Plotly) for fault analysis

---

### M03 — OPC-UA Server

**Category:** Industrial Communications
**Priority:** P1 — High
**Effort:** 1 week
**Dependencies:** M01 (interlock engine provides real data to expose)

#### Why This Matters
OPC-UA is THE industry standard for SCADA communication. Every modern SCADA system
(ABB, Siemens, GE, Schneider) speaks OPC-UA. Without it, the platform cannot claim
to simulate real industrial communication.

#### What To Build

**OPC-UA Server (using `opcua` / `asyncua` Python library):**
```
opc.tcp://localhost:4840/baltic-wind/

Address Space:
├── Objects/
│   ├── WindFarm/
│   │   ├── TotalPower_MW          (Float, read-only)
│   │   ├── TotalReactivePower_MVAR (Float, read-only)
│   │   ├── WindSpeed_ms           (Float, read-only)
│   │   ├── AmbientTemp_C          (Float, read-only)
│   │   └── FarmStatus             (Enum, read-only)
│   ├── Turbines/
│   │   ├── WTG01/
│   │   │   ├── ActivePower_MW
│   │   │   ├── RotorSpeed_rpm
│   │   │   ├── PitchAngle_deg
│   │   │   ├── NacelleDirection_deg
│   │   │   ├── Status             (Enum)
│   │   │   └── Alarms/
│   │   ├── WTG02/ ...
│   │   └── WTG34/
│   ├── Substation/
│   │   ├── Bay01/ ... Bay08/
│   │   │   ├── CB_Position
│   │   │   ├── Disconnector_Position
│   │   │   ├── EarthSwitch_Position
│   │   │   ├── Current_A
│   │   │   ├── Voltage_kV
│   │   │   └── Protection/
│   │   ├── Transformer_66_220/
│   │   ├── Transformer_220_400/
│   │   └── STATCOM/
│   └── ExportCable/
│       ├── Temperature_C[]         (DTS array, M10)
│       ├── Current_A
│       └── Loading_percent
```

**Features:**
- Browse address space from any OPC-UA client (UaExpert, Prosys)
- Subscribe to value changes (monitored items)
- Historical data access (read from TimescaleDB)
- Authentication: anonymous for read, certificate-based for write
- Method calls: execute switching commands via OPC-UA (goes through interlock engine)

**API Integration:**
- OPC-UA server runs as a background asyncio task inside FastAPI
- Shares data with REST API through same service layer
- WebSocket SCADA push becomes a thin adapter over OPC-UA subscriptions

---

### M04 — Multi-Farm Comparison

**Category:** Platform Enhancement
**Priority:** P1 — High
**Effort:** 1–2 weeks
**Dependencies:** None

#### Why This Matters
The current platform hardcodes a single 34-turbine farm. Real engineers compare
multiple configurations to find the optimal design. Multi-farm support turns
this from a demo into a decision-support tool.

#### What To Build (Forms-Based, NOT Drag & Drop)

**Farm Configuration Parameters:**
```
- Farm name
- Turbine count (10–100)
- Turbine model (V236-15.0 MW, SG 14-236 DD, Haliade-X 13 MW)
- Layout pattern (grid, staggered, optimized)
- Turbine spacing (5D–10D crosswind, 7D–15D downwind)
- Array voltage (33 kV or 66 kV)
- Export cable length (10–100 km)
- Export voltage (132 kV or 220 kV)
- Grid connection voltage (220 kV or 400 kV)
- STATCOM size (0–200 MVAR)
- BESS size (0–200 MW / 0–800 MWh)
```

**Comparison Dashboard:**
```
Side-by-side comparison of 2–4 farm configurations:
- AEP (P50/P75/P90) — bar chart
- Wake losses (%) — per-turbine heatmap
- LCOE (€/MWh) — comparison bar
- Grid losses (MW) — comparison
- Cable loading (%) — comparison
- Voltage profile — overlay plot
- Short-circuit levels — table
- Harmonic distortion — comparison (if M06 built)
- Revenue projection — comparison (if M11 built)
```

**Database Changes:**
```sql
-- Replace single wind_farm with multi-farm support
CREATE TABLE farm_configuration (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    turbine_model   VARCHAR(50) NOT NULL,
    turbine_count   INTEGER NOT NULL CHECK (turbine_count BETWEEN 10 AND 100),
    array_voltage_kv FLOAT NOT NULL,
    export_voltage_kv FLOAT NOT NULL,
    export_length_km FLOAT NOT NULL,
    statcom_mvar    FLOAT DEFAULT 0,
    bess_mw         FLOAT DEFAULT 0,
    bess_mwh        FLOAT DEFAULT 0,
    layout_config   JSONB NOT NULL,            -- turbine positions + spacing
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES users(id)
);
```

**API Endpoints:**
```
POST   /api/v1/farms                          — Create farm configuration
GET    /api/v1/farms                          — List all configurations
GET    /api/v1/farms/{id}                     — Get configuration details
DELETE /api/v1/farms/{id}                     — Delete configuration
POST   /api/v1/farms/compare                  — Run comparison analysis on 2-4 farms
GET    /api/v1/farms/compare/{comparison_id}  — Get comparison results
```

---

### M05 — Protection Relay Coordination

**Category:** Protection Engineering
**Priority:** P1 — High
**Effort:** 2 weeks
**Dependencies:** M01 (interlock engine)

#### Why This Matters
Protection coordination ensures that the relay closest to the fault trips first,
while upstream relays wait as backup. Incorrect coordination causes nuisance
tripping (healthy feeders trip) or protection blindness (faulted feeder stays live).
This is THE core skill of a protection engineer.

#### What To Build

**Protection Relay Types:**
```
1. Distance Protection (IEC 60255)
   - Zone 1: 80% of line impedance, instantaneous (0 ms)
   - Zone 2: 120% of line impedance, 400 ms delay
   - Zone 3: 200% (backup), 1200 ms delay
   - Mho / Quadrilateral characteristic

2. Overcurrent Protection (IEC 60255-151)
   - Standard Inverse (SI):    t = 0.14 × TMS / ((I/Is)^0.02 - 1)
   - Very Inverse (VI):        t = 13.5 × TMS / ((I/Is)^1.0 - 1)
   - Extremely Inverse (EI):   t = 80.0 × TMS / ((I/Is)^2.0 - 1)
   - Definite Time (DT):       t = TMS (constant)

3. Differential Protection
   - Transformer differential (87T): restraint characteristic
   - Cable differential (87L): current comparison
   - Operating region: |Id| > k × |Ir| + threshold

4. Frequency Protection
   - Under-frequency stage 1: 49.0 Hz, 500 ms
   - Under-frequency stage 2: 47.5 Hz, instantaneous
   - Over-frequency: 51.5 Hz, 500 ms
   - df/dt (ROCOF): 1.0 Hz/s, 500 ms
```

**Relay Settings Database:**
```sql
CREATE TABLE protection_relay (
    id              UUID PRIMARY KEY,
    bay_id          UUID REFERENCES bay(id),
    relay_type      VARCHAR(30) NOT NULL,     -- DISTANCE / OVERCURRENT / DIFFERENTIAL / FREQUENCY
    manufacturer    VARCHAR(50),               -- ABB REL670, Siemens 7SA87, SEL-421
    settings        JSONB NOT NULL,           -- zone reaches, TMS, pickup values
    enabled         BOOLEAN DEFAULT TRUE
);
```

**Coordination Study:**
- Input: network topology + relay settings + fault location
- Output: which relays see the fault, in what order, with what time delays
- Visualization: time-current curves (Plotly) with all relays overlaid
- Grading check: minimum 300 ms between successive relay operations

**API Endpoints:**
```
GET    /api/v1/grid/protection/relays                     — List all relays
PUT    /api/v1/grid/protection/relays/{id}/settings       — Update relay settings
POST   /api/v1/grid/protection/coordination-study         — Run coordination analysis
POST   /api/v1/grid/protection/fault-clearance            — Simulate fault + relay response
GET    /api/v1/grid/protection/coordination-chart/{id}    — Get TCC plot data
```

**Frontend:**
- Time-Current Curve (TCC) chart — the signature plot of protection engineering
- Impedance plane diagram (R-X) for distance relays
- Relay settings form with validation against network parameters
- Fault simulation: click on network diagram to place fault, see relay sequence

---

### M06 — Power Quality & Harmonics (IEC 61000)

**Category:** Grid Code Compliance
**Priority:** P2 — Medium
**Effort:** 2 weeks
**Dependencies:** P2 existing (Pandapower network model)

#### Why This Matters
Wind turbine converters inject harmonics into the grid. The 45 km export cable creates
resonance conditions that can amplify specific harmonic orders. PSE requires THD < 8%
at PCC. Failure to meet power quality limits means the farm cannot connect.

#### What To Build

**Harmonic Analysis:**
```
- Individual harmonics: orders 2–50 (focus on 5, 7, 11, 13, 23, 25)
- Voltage THD at PCC: THD_v = sqrt(sum(V_h^2)) / V_1 × 100%
- Current THD at PCC: THD_i = sqrt(sum(I_h^2)) / I_1 × 100%
- IEC 61000-3-6 compatibility levels
- IEEE 519 limits (for reference)
```

**Cable Resonance Study:**
```
- Parallel resonance frequency: f_r = 1 / (2π × sqrt(L × C))
- 45 km, 220 kV XLPE cable: C ≈ 0.18 µF/km → total ~8.1 µF
- With transformer + grid: resonance typically 7th–15th harmonic
- Amplification factor at resonance
- Damping from system resistance
```

**Flicker Analysis (IEC 61000-4-15):**
```
- Short-term flicker: Pst (10-minute)
- Long-term flicker: Plt (2-hour, from 12 × Pst values)
- Wind turbine flicker coefficient: c(ψ_k, v_a) from IEC 61400-21
- Summation: Plt_total = (sum(Plt_i^3))^(1/3)
- PSE limit: Pst < 1.0, Plt < 0.65 at PCC
```

**Filter Design:**
```
- Passive filter: tuned to dominant harmonic (e.g., 5th order)
- C-type filter for broadband damping
- Active filter sizing (kVA rating)
- Filter effectiveness: THD before/after
```

**Frontend:**
- Harmonic spectrum bar chart (Plotly) — magnitude vs harmonic order
- Frequency scan plot — impedance vs frequency showing resonance peaks
- THD gauge — green/amber/red zones against grid code limits
- Before/after filter comparison

---

### M07 — Cybersecurity Module (IEC 62443)

**Category:** OT Security
**Priority:** P2 — Medium
**Effort:** 2 weeks
**Dependencies:** M03 (OPC-UA server)

#### Why This Matters
OT cybersecurity is the fastest-growing specialization in power systems. IEC 62443
is mandatory for new offshore wind substations. Every utility is hiring for this.
The platform currently has RBAC but no security architecture.

#### What To Build

**Purdue Model Visualization (5 levels):**
```
Level 5: Enterprise — corporate network, ERP, email
Level 4: Business — data historians, reporting, market systems
Level 3.5: DMZ — firewall, jump server, data diode
Level 3: Operations — SCADA servers, engineering workstations
Level 2: Control — bay controllers, PLCs, HMIs
Level 1: Field — IEDs, protection relays, RTUs
Level 0: Process — CTs, VTs, switchgear, turbines
```

**Security Zones & Conduits:**
```
Zone 1: Wind Farm Control Network (turbines, array cables)
Zone 2: Offshore Substation Control (bay controllers, protection)
Zone 3: Export System (DTS, cable monitoring)
Zone 4: Onshore SCADA (control center, historian)
Zone 5: Corporate Network (engineering, reporting)

Conduits: defined data flows between zones with:
- Allowed protocols (OPC-UA, IEC 61850 MMS, HTTPS)
- Firewall rules (source zone → destination zone → port → action)
- Encryption requirements (TLS 1.3 minimum)
```

**Attack Simulation (Educational):**
```
Scenario 1: Unauthorized SCADA command → interlock engine blocks → SOE logs
Scenario 2: Man-in-the-middle on OPC-UA → certificate validation fails
Scenario 3: Alarm flooding attack → EEMUA 191 flood detection triggers
Scenario 4: Replay attack on GOOSE frame → timestamp check fails
Scenario 5: Unauthorized firmware upload to IED → access control blocks
```

**Security Event Dashboard:**
- Failed authentication attempts (count, source, trend)
- Blocked commands (by interlock + by access control)
- Network anomaly indicators
- Zone traffic matrix heatmap
- Compliance checklist against IEC 62443-3-3 SL requirements

---

### M08 — BESS Integration (Battery Energy Storage)

**Category:** Advanced Control
**Priority:** P2 — Medium
**Effort:** 2 weeks
**Dependencies:** PPC (existing Power Plant Controller)

#### Why This Matters
No modern wind farm is complete without storage. BESS provides fast frequency
response, smooths ramp events, enables arbitrage, and reduces curtailment.
PSE is increasingly requiring storage capability for new connections.

#### What To Build

**BESS Specification:**
```
Rating:          50 MW / 200 MWh (4-hour duration)
Chemistry:       LiFePO4 (lithium iron phosphate)
C-rate:          0.25C (normal), 1C (emergency frequency response)
Round-trip efficiency: 88%
SOC limits:      10% ≤ SOC ≤ 90% (to preserve cycle life)
Degradation:     ~2% capacity loss per year at 1 cycle/day
Response time:   < 200 ms (frequency response), < 1 s (dispatch)
Connection:      220 kV busbar via dedicated transformer
```

**Operating Modes:**
```
1. FREQUENCY_RESPONSE — Inject/absorb power based on grid frequency deviation
   - Deadband: ±15 mHz
   - Droop: 4%
   - Full power at ±200 mHz

2. RAMP_SMOOTHING — Limit farm output ramp rate
   - Target: < 10% Pn/min (PSE requirement)
   - BESS absorbs/injects to fill the gap

3. ARBITRAGE — Charge low, discharge high
   - Day-ahead price signal from market (M11)
   - Optimize SOC trajectory for revenue

4. CURTAILMENT_REDUCTION — Store excess when grid-constrained
   - TSO curtails farm to 400 MW
   - BESS absorbs remaining 110 MW (up to capacity)

5. BLACK_START — Provide initial power for farm restart
   - Sequential turbine energization from BESS
```

**PPC Integration:**
```
Enhanced dispatch: P_target allocated across WTGs + BESS
- WTGs provide bulk energy
- BESS handles fast transients and ramps
- STATCOM handles reactive power (unchanged)

P_bess = P_target - sum(P_wtg_actual)  (gap-filling mode)
SOC management: if SOC < 20%, reduce BESS dispatch priority
```

**API Endpoints:**
```
GET    /api/v1/grid/bess/status          — SOC, power, temperature, mode
POST   /api/v1/grid/bess/mode            — Set operating mode
POST   /api/v1/grid/bess/simulate        — Run BESS simulation over time horizon
GET    /api/v1/grid/bess/degradation     — Cycle count, capacity fade, SOH
POST   /api/v1/grid/ppc/dispatch         — Enhanced: wind + BESS coordinated dispatch
```

**Frontend:**
- SOC gauge (real-time)
- Power flow diagram showing BESS charge/discharge
- Revenue chart (charge at low price, discharge at high)
- Degradation curve over project lifetime
- Frequency response demonstration (inject plot)

---

### M09 — Alarm Rationalization (EEMUA 191)

**Category:** SCADA Operations
**Priority:** P2 — Medium
**Effort:** 1 week
**Dependencies:** M02 (SOE recorder)

#### Why This Matters
Poor alarm management kills operators. EEMUA 191 says a well-managed system should
have < 10 alarms per 10 minutes in normal operation and < 1 standing alarm per operator.
Most SCADA systems fail this badly. Building alarm rationalization proves you understand
operational excellence, not just engineering.

#### What To Build

**Alarm KPIs (EEMUA 191 benchmarks):**
```
| KPI                     | Overloaded | Acceptable | Robust    | Target   |
|-------------------------|------------|------------|-----------|----------|
| Alarms per 10 min       | > 20       | 6–10       | < 6       | < 6      |
| Standing alarms         | > 10       | 3–5        | < 3       | < 3      |
| % alarms actioned       | < 50%      | 50–80%     | > 80%     | > 90%    |
| Chattering alarms       | > 5%       | 1–5%       | < 1%      | 0%       |
| Stale alarms (> 24h)    | > 10       | 3–5        | < 3       | 0        |
```

**Features:**
```
1. Alarm Flood Detection
   - Threshold: > 10 alarms/minute
   - Action: auto-suppress LOW priority, highlight CRITICAL only
   - SOE records flood start/end

2. Chattering Alarm Detection
   - Definition: alarm cycles ON/OFF > 3 times in 10 minutes
   - Action: auto-shelve with notification to operator
   - Engineering review queue for persistent chatterers

3. Alarm Shelving
   - Operator shelves nuisance alarm with reason + duration
   - Auto-unshelve after timeout (max 24 hours)
   - Full audit trail (who, when, why, duration)

4. Alarm Rationalization Matrix
   - Every alarm has: cause, consequence, operator action, priority, response time
   - Review status: RATIONALIZED / PENDING_REVIEW / NEEDS_UPDATE

5. KPI Dashboard
   - Real-time EEMUA 191 gauges
   - Trend charts: alarms/hour over 24h, 7d, 30d
   - Top 10 most frequent alarms
   - Worst chatterers list
```

**API Endpoints:**
```
GET    /api/v1/scada/alarms/kpi               — Real-time EEMUA 191 KPIs
POST   /api/v1/scada/alarms/{id}/shelve       — Shelve alarm
POST   /api/v1/scada/alarms/{id}/unshelve     — Unshelve alarm
GET    /api/v1/scada/alarms/rationalization    — Alarm rationalization matrix
PUT    /api/v1/scada/alarms/{id}/rationalize   — Update alarm rationalization data
GET    /api/v1/scada/alarms/flood-events       — Historical flood events
GET    /api/v1/scada/alarms/chatterers         — Chattering alarm list
```

---

### M10 — Cable DTS Thermal Monitoring

**Category:** Asset Management
**Priority:** P3 — Normal
**Effort:** 1 week
**Dependencies:** P2 existing (cable model)

#### Why This Matters
The 45 km export cable costs ~€150M. It is the single most expensive and
hardest-to-replace component. Distributed Temperature Sensing (DTS) monitors
temperature along the entire cable length. Hotspots indicate burial depth
problems, thermal bottlenecks, or overloading. Dynamic rating based on
actual temperature can unlock 10–15% more capacity vs static worst-case rating.

#### What To Build

**IEC 60287 Thermal Model:**
```
Conductor temperature: θ_c = θ_amb + (I² × R_ac × T_1) + W_d × T_1 + (I² × R_ac + W_d) × T_2 + ...

Where:
- θ_amb: ambient temperature (seabed ~4°C, landfall ~15°C)
- R_ac: AC resistance (temperature-dependent)
- T_1, T_2, T_3, T_4: thermal resistances (insulation, sheath, serving, soil)
- W_d: dielectric losses
- Burial depth: 1.5m (offshore), 1.2m (onshore) — affects T_4

Hotspot calculation:
- Thermal bottleneck at cable crossing points
- J-tube at OSS (poor heat dissipation, high ambient)
- Landfall transition (soil thermal resistivity changes)
```

**DTS Simulation:**
```
- 45 km cable divided into 100 m segments (450 measurement points)
- Each segment has: temperature, current, loading %, thermal resistance
- Simulation: time-varying load → temperature response (thermal time constant ~hours)
- Hotspot detection: if any segment > 70°C, raise alarm; > 90°C = critical
```

**Dynamic Rating:**
```
- Static rating: 800 A (worst-case soil, summer, full burial)
- Dynamic rating: actual capacity based on real-time temperature
- Example: winter, partial load → dynamic rating 950 A (+19%)
- Seasonal variation: summer (worst) to winter (best)
```

**Frontend:**
- Cable route map with temperature color gradient (blue → green → yellow → red)
- Temperature vs distance plot (Plotly line chart, 450 points)
- Loading % timeline over 24h/7d
- Dynamic rating gauge vs static rating
- Hotspot alert markers on map

---

### M11 — Market Integration & Bidding

**Category:** Commercial Operations
**Priority:** P3 — Normal
**Effort:** 2 weeks
**Dependencies:** P4 existing (forecast), P1 existing (AEP)

#### Why This Matters
A wind farm is a business. The P4 forecast produces MW predictions but nothing
commercial happens with them. Market integration connects physics to money.
This is what makes the difference between "I can simulate a wind farm" and
"I understand how a wind farm makes money."

#### What To Build

**Polish Power Market Model (TGE — Towarowa Giełda Energii):**
```
Day-Ahead Market (RDN):
- Gate closure: 09:30 D-1
- Hourly price blocks
- Farm submits: {hour, volume_mwh, min_price_eur}
- Cleared at marginal price

Intraday Market (IDM):
- Continuous trading, gate closure H-1
- Update bids as forecast improves
- Capture forecast improvement value

Balancing Market:
- Actual ≠ scheduled → imbalance
- Imbalance price: typically 2–3× day-ahead (penalizes deviation)
- Cost = |actual - scheduled| × imbalance_price
```

**Revenue Calculation:**
```
Revenue_day = Σ(hour=1..24) [scheduled_mwh(h) × da_price(h)]
              - Σ(hour=1..24) [|actual(h) - scheduled(h)| × imbalance_price(h)]
              + Σ(hour=1..24) [intraday_correction(h) × id_price(h)]

Annual revenue = Σ(day=1..365) Revenue_day
LCOE cross-check: Revenue / AEP should exceed LCOE for profitability
```

**Bidding Strategy Simulation:**
```
Conservative: bid P75 forecast (less imbalance risk, less revenue)
Moderate:     bid P50 forecast (balanced risk/revenue)
Aggressive:   bid P25 forecast (higher revenue but more imbalance cost)
Optimal:      minimize expected cost using forecast uncertainty + price signal
```

**Frontend:**
- Price chart (day-ahead + intraday + balancing) over time
- Forecast vs actual vs bid overlay chart
- Revenue waterfall: gross → imbalance cost → net
- Strategy comparison: conservative vs moderate vs aggressive
- Monthly/annual revenue summary
- LCOE profitability indicator

---

### M12 — Condition Monitoring System (CMS)

**Category:** O&M (Operations & Maintenance)
**Priority:** P1 — High
**Effort:** 2–3 weeks
**Dependencies:** None

#### Why This Matters
Unplanned turbine failures cost €200k–€500k per event (crane vessel + parts + lost
production). Condition monitoring detects degradation before failure. A single
prevented gearbox failure pays for years of monitoring. This is THE biggest O&M
cost driver and every wind farm has a CMS.

#### What To Build

**Monitored Components per Turbine:**
```
1. Main Bearing
   - Vibration: acceleration RMS (mm/s²), velocity RMS (mm/s)
   - Temperature: bearing housing (°C), trending
   - Fault frequencies: BPFO, BPFI, BSF, FTF (from bearing geometry)

2. Gearbox
   - Vibration: 3 stages (planetary, intermediate, high-speed)
   - Oil particle counter: ISO 4406 cleanliness code (e.g., 16/14/11)
   - Oil temperature: inlet/outlet (ΔT indicates problems)
   - Gear mesh frequencies: teeth × rpm

3. Generator
   - Vibration: drive-end and non-drive-end bearings
   - Winding temperature: per phase
   - Partial discharge: indicates insulation degradation

4. Pitch System
   - Pitch angle vs demand: deviation indicates actuator wear
   - Battery voltage: backup pitch system health
   - Pitch motor current: trending

5. Yaw System
   - Yaw misalignment: nacelle direction vs wind direction
   - Yaw motor current: excessive = bearing wear
   - Yaw brake pad wear: cycle counting
```

**Degradation Model:**
```
Health Index (HI) per component: 0–100%
- HI = 100%: new condition
- HI > 80%: normal (GREEN)
- HI 60–80%: watch (YELLOW) — increase monitoring frequency
- HI 40–60%: alert (AMBER) — plan maintenance
- HI < 40%: alarm (RED) — schedule immediate intervention
- HI < 20%: critical — stop turbine

Degradation rate: dHI/dt estimated from trend (linear/exponential fit)
Remaining Useful Life (RUL): time until HI reaches threshold
```

**API Endpoints:**
```
GET    /api/v1/scada/cms/turbines/{id}/health          — Health indices per component
GET    /api/v1/scada/cms/turbines/{id}/vibration        — Vibration spectra
GET    /api/v1/scada/cms/turbines/{id}/oil-analysis     — Oil quality trends
GET    /api/v1/scada/cms/fleet/overview                 — Farm-wide health summary
GET    /api/v1/scada/cms/alerts                         — Active CMS alerts
POST   /api/v1/scada/cms/turbines/{id}/simulate-fault   — Inject degradation for training
```

**Frontend:**
- Fleet health overview: 34 turbines, color-coded by worst component HI
- Component drill-down: vibration spectrum (Plotly FFT chart)
- Temperature trending: time series with alarm limits
- RUL estimation chart: predicted remaining life per component
- Oil analysis trend: particle count over time

---

### M13 — Availability & Reliability Tracking (IEC 61400-26)

**Category:** O&M Performance
**Priority:** P2 — Medium
**Effort:** 1–2 weeks
**Dependencies:** M12 (CMS provides fault data)

#### Why This Matters
Every wind farm reports availability to the asset owner, lender, and insurer.
IEC 61400-26 defines how to calculate it. Time-based availability of 97%+ is
the contractual target. Energy-based availability accounts for when the turbine
was down relative to how much wind there was.

#### What To Build

**IEC 61400-26 Information Categories:**
```
Category 0:  Information not available
Category 1:  Normal operation (generating)
Category 2:  Performance degraded (derated)
Category 3:  Technical standby (available but no wind)
Category 4:  Out of environmental spec (high wind, icing, lightning)
Category 5:  Requested shutdown (curtailment by TSO)
Category 6:  Out of electrical spec (grid fault, voltage, frequency)
Category 7:  Scheduled maintenance
Category 8:  Planned corrective maintenance
Category 9:  Forced outage — immediate repair needed
Category 10: Suspended (contract/financial reasons)
Category 11: Force majeure
```

**Availability Calculations:**
```
Time-Based Availability (TBA):
  TBA = (Total hours - Downtime hours) / Total hours × 100%
  Target: ≥ 97%

Energy-Based Availability (EBA):
  EBA = Actual Energy / Potential Energy × 100%
  Potential Energy = energy that would have been produced if turbine was running
  More meaningful than TBA (downtime in low wind matters less)

Contractual Availability:
  Excludes: Category 4, 5, 6, 11 (not turbine's fault)
  Includes: Category 7, 8, 9 (maintenance-related downtime)
```

**Reliability Metrics:**
```
MTBF: Mean Time Between Failures (target: > 4000 hours)
MTTR: Mean Time To Repair (target: < 48 hours for major components)
Failure Rate: λ = 1 / MTBF (failures per turbine per year)
Availability from reliability: A = MTBF / (MTBF + MTTR)
```

**Frontend:**
- Farm availability dashboard: monthly TBA and EBA per turbine (heatmap)
- Availability waterfall: what caused losses (maintenance, wind, grid, force majeure)
- Pareto chart: top 5 causes of downtime
- MTBF/MTTR trend over time
- Contractual availability tracker with target line

---

### M14 — Weather Window & O&M Logistics

**Category:** Operations Planning
**Priority:** P3 — Normal
**Effort:** 1–2 weeks
**Dependencies:** P1 existing (met-ocean data)

#### Why This Matters
Offshore maintenance can only happen when weather allows safe vessel access.
A turbine might fail today but the first access window could be 5 days away.
Understanding weather windows is critical for O&M cost estimation and maintenance planning.

#### What To Build

**Vessel Access Limits:**
```
| Vessel Type | Hs Limit | Wind Limit | Transfer Method |
|-------------|----------|------------|-----------------|
| CTV (Crew Transfer Vessel) | 1.5 m | 20 kn | Fender push-on |
| SOV (Service Operation Vessel) | 2.5 m | 25 kn | Walk-to-work gangway |
| Jack-up barge | 2.0 m | 15 kn | Elevated platform |
| Helicopter | N/A | 40 kn | Hoist/winch |
```

**Weather Window Analysis:**
```
- Input: ERA5 / met-ocean hindcast (Hs, wind speed, wave period)
- Calculate: accessible hours per month per vessel type
- Output:
  - Monthly access probability (%)
  - Average weather window duration (hours)
  - Average waiting time before access (hours)
  - Seasonal pattern: summer ~80% access, winter ~40% access
```

**Maintenance Scheduling:**
```
- Failure occurs → check weather forecast → find next access window
- Schedule repair based on:
  - Component criticality (generator > pitch motor > sensor)
  - Vessel requirement (major = jack-up, minor = CTV)
  - Available weather window duration vs repair duration
  - Crew availability
- Calculate: expected delay = f(failure_month, repair_duration, vessel_type)
```

**O&M Cost Model:**
```
Annual O&M cost components:
- Planned maintenance: ~€15/MWh (scheduled, weather-flexible)
- Unplanned maintenance: ~€10/MWh (failure-driven, weather-constrained)
- Vessel costs: CTV €3k/day, SOV €50k/day, Jack-up €150k/day
- Lost production during downtime: f(wind speed during outage) × price
- Total O&M: ~€25–35/MWh for Baltic offshore
```

**Frontend:**
- Monthly weather window calendar (heatmap: green = accessible, red = no access)
- Access probability chart by vessel type and month
- Maintenance schedule Gantt chart
- O&M cost breakdown waterfall
- Waiting time distribution histogram

---

### M15 — Communication Network Architecture

**Category:** Infrastructure
**Priority:** P3 — Normal
**Effort:** 1 week
**Dependencies:** M03 (OPC-UA), M07 (cybersecurity zones)

#### Why This Matters
The communication network connects all offshore equipment to the onshore control
center. A fiber break can isolate the entire offshore substation. Understanding
network topology, redundancy, and latency budgets is essential for designing
reliable control systems.

#### What To Build

**Network Topology:**
```
Offshore Substation:
├── Control Network (IEC 61850 station bus)
│   ├── Bay controllers (Ethernet, 100 Mbps)
│   ├── Protection relays (GOOSE: < 4 ms)
│   ├── SCADA gateway (OPC-UA server)
│   └── Engineering workstation (local HMI)
├── Process Bus (IEC 61850-9-2 Sampled Values)
│   ├── Merging units (4800 samples/s per CT/VT)
│   └── Dedicated fiber ring
├── Wind Farm Network
│   ├── Turbine controllers (fiber ring, daisy-chain)
│   ├── 34 turbines × 2 fibers = 68 fiber connections
│   └── Bandwidth: ~10 Mbps per turbine
└── Export Communication
    ├── Fiber optic in export cable (48 fibers typical)
    ├── Main path: MPLS ring via fiber
    ├── Backup path: 4G/5G or satellite
    └── Latency budget: < 100 ms to onshore SCADA

Onshore Control Center:
├── SCADA servers (redundant pair)
├── Historian (TimescaleDB)
├── Engineering workstation
├── Firewall / DMZ
└── Corporate network gateway
```

**Redundancy Analysis:**
```
- Single point of failure identification
- Ring topology: any single fiber break → traffic reroutes
- Dual-homed SCADA servers: active-standby failover
- Communication loss simulation: what happens when link drops?
- Degraded mode operation: local control at OSS if comms lost
```

**Latency Budget:**
```
| Signal Path | Requirement | Protocol |
|-------------|-------------|----------|
| GOOSE trip (relay → CB) | < 4 ms | IEC 61850 GOOSE (L2 multicast) |
| SCADA command (onshore → OSS) | < 500 ms | OPC-UA over TCP/IP |
| SCADA telemetry (OSS → onshore) | < 1 s | OPC-UA subscription |
| Turbine SCADA (WTG → OSS) | < 2 s | OPC-UA or Modbus TCP |
| Video feed (OSS camera) | < 3 s | RTSP over IP |
| File transfer (SOE export) | best effort | SFTP |
```

**Frontend:**
- Network topology diagram (XYFlow) — nodes = devices, edges = fiber/copper
- Color-coded link status: green = OK, amber = degraded, red = down
- Latency monitoring: measured vs budget per link
- Redundancy status: primary/backup path indicators
- Communication loss simulation: click to "break" a link, see what goes offline

---

## Implementation Phases

### Phase A: SCADA Foundation (Weeks 1–4)
```
M01 — Interlock engine + bay controller     [2–3 weeks]
M02 — SOE recorder                          [3–4 days]
→ Milestone: SCADA has real control logic and event recording
```

### Phase B: Industrial Credibility (Weeks 5–8)
```
M03 — OPC-UA server                         [1 week]
M05 — Protection relay coordination         [2 weeks]
M09 — Alarm rationalization (EEMUA 191)     [1 week]
→ Milestone: Platform speaks industrial protocols with real protection engineering
```

### Phase C: Operations & Monitoring (Weeks 9–13)
```
M12 — Condition monitoring system            [2–3 weeks]
M04 — Multi-farm comparison                  [1–2 weeks]
→ Milestone: Farm-level O&M intelligence + multi-configuration support
```

### Phase D: Grid Code & Storage (Weeks 14–17)
```
M06 — Power quality & harmonics              [2 weeks]
M08 — BESS integration                       [2 weeks]
→ Milestone: Complete grid code compliance + energy storage
```

### Phase E: Commercial & Security (Weeks 18–21)
```
M07 — Cybersecurity (IEC 62443)              [2 weeks]
M11 — Market integration                     [2 weeks]
→ Milestone: Full commercial picture + security architecture
```

### Phase F: Advanced Operations (Weeks 22–26)
```
M13 — Availability tracking (IEC 61400-26)   [1–2 weeks]
M14 — Weather window & O&M logistics         [1–2 weeks]
M10 — Cable DTS thermal monitoring           [1 week]
M15 — Communication network architecture     [1 week]
→ Milestone: Complete integrated control platform
```

---

## Integration Map

After all 15 modules, the data flow becomes:

```
WIND BLOWS
  → P1 measures wind resource
    → P4 forecasts power (1–48h ahead)
      → M11 bids into day-ahead market
        → PPC dispatches WTGs + M08 BESS
          → M01 interlocks validate switching
            → M02 SOE records all events
              → M03 OPC-UA exposes to SCADA
                → M09 manages alarms (EEMUA 191)

FAULT OCCURS
  → M05 protection relay trips
    → M01 interlock blocks unsafe re-close
      → M02 SOE records trip sequence
        → M09 raises alarm, tracks flood
          → M07 logs security context
            → M12 CMS checks if fault was predictable
              → M13 updates availability metrics
                → M14 schedules repair based on weather window

CABLE HEATS UP
  → M10 DTS detects hotspot
    → M09 raises alarm
      → Dynamic rating reduces capacity
        → PPC curtails farm output
          → M11 adjusts market bids
            → M08 BESS compensates short-term

GRID CODE CHECK
  → M06 measures harmonics at PCC
    → THD < 8%? → compliant
    → Resonance detected? → filter design
      → P2 validates voltage limits
        → PPC adjusts reactive dispatch
```

---

## Success Criteria

When all 15 modules are complete, the platform should be able to:

1. **Simulate a complete day of operations** — wind → power → market → revenue
2. **Handle a fault scenario end-to-end** — fault → protection → SOE → alarm → repair
3. **Prove grid code compliance** — FRT, harmonics, frequency response, voltage
4. **Demonstrate safety systems** — interlocks, LOTO, PtW, emergency stop
5. **Show commercial awareness** — bidding, imbalance cost, LCOE, O&M cost
6. **Present security posture** — zones, conduits, access control, attack detection
7. **Track asset health** — CMS, availability, cable thermal, degradation
8. **Support multi-farm comparison** — different configurations, side-by-side analysis

**This is no longer 5 projects. This is one integrated offshore wind control platform.**
