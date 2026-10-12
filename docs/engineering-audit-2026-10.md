# Engineering audit and plan to 10/10 (October 2026)

An independent review of OffshoreForge's engineering models. Every number below comes
from a script in `backend/scripts/audit/` that anyone can re-run (see
[How to reproduce](#how-to-reproduce)). The checks use references outside the
code under test: NREL's compiled ROSCO controller, Ørsted's published TurbOPark code,
hand calculations to IEC 60909-0, the exact long-line equations, and the official
IEC 61850-6 SCL schema.

## 1. How to trust these results

1. **Re-run them.** Each finding names the script and its output. The scripts are short,
   deterministic and read the app's own functions. They do not re-implement the app.
2. **Check against independent references.** A claim counts as verified only when an
   implementation the project did not write agrees with it: a compiled binary, another
   organisation's code, a hand calculation, or a published schema.
3. **Retracted claims are listed.** Two findings from an earlier, shallower review were
   wrong. Section 2 says which, and shows the evidence that disproved them.
4. **The limits of this audit are stated** in section 7.

Environment: Python 3.13 with the locked dependencies (`uv export --locked`). PyTorch was
not installed (its CPU wheel index was blocked from the audit container), so the LSTM/TFT
tests and the deep forecast models were not run. ROSCO 2.10.6 came from PyPI, and its
inputs from the matching NREL/ROSCO tag.

Test status on this commit: backend **1 417 passed** (two test modules need PyTorch);
frontend typecheck and lint clean, **681 / 681** vitest tests passed. Playwright e2e was not run.

## 2. Retracted claims from the first review

| Earlier claim | What the evidence shows | Script |
|---|---|---|
| "The turbine controller over-speeds and trips on a moderate gust: a controller defect." | **Wrong.** For the same wind inputs, NREL's compiled ROSCO (official IEA-15-240-RWT DISCON.IN, same 1-DOF rotor, same inertia) peaks *higher* than the app on steps and ramps (9.88 vs 9.27 rpm) and the same on the IEC EOG (8.44 vs 8.35 rpm). The app trips because it applies a 9.07 rpm shutdown (ROSCO `SD_MaxGenSpd`); the reference DISCON.IN ships with `SD_Mode = 0`. This is a modelling choice, not a defect. | A1 |
| "TurbOPark is badly off at Horns Rev, so the setup is probably wrong." | **The implementation is right.** A Python port of Ørsted's Matlab reference gives the same row ratios to within 0.0004. The poor fit to a single aligned row (RMSE 0.20) is how the model behaves; Ørsted calibrated it for farm and cluster AEP. The app uses it only for cluster wakes, its intended use. | A2 |

## 3. What is verified and sound

| Area | Check | Result |
|---|---|---|
| IEC 60909 short circuit | Hand calculation (c = 1.10, K_T, Z_Q, cable series Z) | Grid part matches pandapower exactly at 400 / 220 kV; OSS 66 kV within 1.6 % (converter infeed added as phasors vs arithmetically) — A7 |
| Turbine control | Compiled ROSCO, six wind cases | Peak rotor speed within ±0.6 rpm of ROSCO; same EOG response — A1 |
| Cluster-wake model | Ørsted TurbOPark reference port | Max difference 0.0004 — A2 |
| Export cable currents | Exact hyperbolic long-line solution | Shore-end current within 2 A of the lumped model — A3 |
| AEP chain | Rødsand II metered output (already in Evidence) | Bias +1.1 %, monthly R² 0.956 (re-run in this audit) |
| Reactive capability at the PSE POC | App's own `poc_q_capability` | +247 / −205 Mvar against the required +204 / −178.5 Mvar (Q/Pmax +0.40 / −0.35) |
| Harmonic model | Code review | Export cable as an exact distributed π, IEC TR 61000-3-6 planning levels, damped filter sizing |
| Forecasting | Code review | Real data, `TimeSeriesSplit` with a 48 h gap, conformalised quantiles, TSO benchmark |
| Digital twin | Code review | Detector frozen on CARE Farm B and run once on held-out Farm C |

## 4. Confirmed findings

Severity: **H** = changes a design conclusion; **M** = first-order effect left out, or a
result that depends on chance; **L** = wording or consistency.

### F1 (H): the export cable runs at its rating at P_max, and the reactor choice ignores this

- At 510 MW the app's operating point (STATCOM dispatch plus `dispatch_with_reactor_switching`) loads
  each export circuit to **99.1 %** (817 A of 825 A at the OSS end). The exact
  distributed-line solution agrees (A3).
- The switching logic chooses the reactor that relieves the STATCOM most. It does not consider
  cable current. Switching out an **onshore** reactor gives 101.5 %; switching out an
  **OSS** reactor gives **94.8 %** with the STATCOM at −60 Mvar (A4).
- With the dispatch tolerance (±0.01 pu) the same reactor state lands anywhere between
  817 A and 844 A.
- **Fix:** dispatch reactors and the STATCOM against the cable current as well as the
  voltage. Minimise the largest end current subject to the voltage band, either by
  enumerating reactor states (2ⁿ is small) or with pandapower's OPF and line-loading
  constraints.
- **Acceptance:** at 510 MW, with WTG transformers (F2), every export section ≤ 95 %, and a
  regression test.

### F2 (M): WTG step-up transformers, auxiliary load and reactor/STATCOM losses are missing

- `build_network` connects the converters directly to 66 kV.
  `p5/energisation.py` lists the WTG transformers as "not modelled".
- Adding 34 generic units (17 MVA, uk 9 %) at P_max (A4):
  - losses rise from 10.2 to **13.6 MW**;
  - STATCOM output rises by 20 Mvar;
  - export loading rises from 99.1 to **101.1 %**.
- Shunt reactors carry `p_mw = 0`. At an assumed 0.2 % of rated Mvar they lose **1.1–1.4 MW
  continuously**, about 0.4 % of annual energy (A5).
- **Fix:**
  - add WTG transformers to `FarmSpec` and `build_network`, with sourced parameters and a provenance badge;
  - give reactors and the STATCOM loss models;
  - add auxiliary load (cooling, OSS HVAC) as a P/Q load.
- **Acceptance:** a loss breakdown by component in the Grid tab, plus tests.

### F3 (M): the AEP electrical loss is a fixed 2.0 %, not computed

- `aep_calculator.DEFAULT_ELECTRICAL_LOSS = 0.02`, even though P2 can compute losses at every operating point.
- Integrating the app's own load flow over SB-510's output distribution gives **1.76 %**;
  adding reactor losses gives **2.18 %**; WTG transformers (F2) would add more (A5).
- The 2.0 % is close by coincidence, but its composition is wrong and it does not follow the
  design (cable length, number of circuits).
- **Fix:** take the annual electrical loss from P2 losses at the farm's own (waked) power
  distribution. Take availability from the IEC 61400-26 module and the failure rates the
  control room already uses.
- **Acceptance:** the cascade shows these as *computed*, with a source. The Rødsand II
  validation still passes.

### F4 (M): the export cable is a single nominal π in the load flow

- The 54-section model gives **10 % more cable loss** (7.33 vs 6.65 MW) and
  99.5 % instead of 99.1 % loading (A3).
- The harmonic model already uses the exact equivalent π. The load flow should do the same
  (or use N sections).
- **Acceptance:** loss within 1 % of the 54-section result.

### F5 (M): no zero-sequence data, so no earth faults

- `protection_relay.run_coordination_study` rejects `fault_type = "1ph"`, and IEC 60909 is
  run for three-phase faults only.
- Single-phase-to-earth is the most common cable fault. On a 66 kV array its current is set by
  the neutral earthing (earthing transformer and resistor), not by the network.
- **Fix:**
  - add zero-sequence cable data (R0, X0, C0 from the datasheet) and transformer
    vector-group earthing;
  - add a 66 kV earthing transformer with a neutral earthing resistor (NER);
  - run `calc_sc(fault="1ph")`;
  - add 51N/67N earth-fault protection and grading.
- **Acceptance:** a hand calculation of a resistance-earthed 66 kV earth fault,
  I ≈ U/(√3·R_NER), within 2 %.

### F6 (M): the 24 h energisation soak runs the shore-end cable at 101 %

- In switching-programme step 2 (cable 1 live from shore, OSS end open, 24 h soak at U0), the
  app's own snapshot gives **833 A, 101 % of rating** at the shore end (A6).
  `energisation.py` describes this state as lasting "minutes".
- The onshore line reactor compensates **58 %** of the cable's charging. Above 50 %, the
  zero-missing phenomenon on energisation is possible: DC offset, and breaker current zeros
  missed for many cycles (CIGRE TB 556). It needs an EMT / point-on-wave study.
- **Fix:**
  - add a transient thermal check of the soak (IEC 60853 / DTS model), or shorten the soak, or
    give the OSS end a line reactor on the cable side;
  - make the step's verification band fail above 100 % unless it is time-limited;
  - add an EMT energisation case (F9).

### F7 (M): the SCL files do not validate against the IEC 61850-6 schema

- The SSD validates. The ICD has **20** schema errors and the SCD **103** (A8):
  - `LDevice` placed directly under `IED` (missing `AccessPoint` / `Server`);
  - incomplete `DataTypeTemplates` (missing `DOType`);
  - duplicate `SubNetwork` names.
- Real tools (OpenSCD, vendor IED configurators) will reject these files.
- **Fix:**
  - generate schema-valid SCL (Ed. 2, 2007B4);
  - validate in CI with the official XSD (fetched at test time, not committed: IEC copyright);
  - round-trip through OpenSCD.

### F8 (L): wording and consistency

- `p3/opcua_server.py`: "IEC 61400-25 mandates OPC-UA" is incorrect.
  [IEC 61400-25-4:2016](https://webstore.iec.ch/publication/33206) maps to Web Services,
  OPC XML-DA, IEC 61850-8-1 MMS, IEC 60870-5-104 and DNP3; MMS is the most common in wind.
  The same docstring describes "satellite links to offshore substations". OSS
  communication normally runs over the fibre in the export cable; satellite is a backup.
- `p2/andes_dynamics.py` docstring: "2 × 120 MVAR reactors at each end". The code reads the
  current design (2 × 180 Mvar).
- `lifecycle/campaign.py` says "synthetic" weather; `weather.py` replays the real 30-year hindcast.
- GOOSE limit: CLAUDE.md rule 5 says < 4 ms, the code uses ≤ 3 ms (IEC 61850-5 TT6). Pick one
  and cite the class.
- `p3/scl_generator.py` says the files show "the key structural concepts that interviewers
  test". This is a leftover from interview preparation, not the project's academic tone.

### F9 (M): first-order studies a professional design needs but the platform lacks

These are omissions, not errors; each docstring states its scope honestly. They are what
separates a design-grade tool from a teaching one:

| Study | Why it matters for SB-510 | Current state |
|---|---|---|
| EMT: energisation, inrush, zero-missing, TOV, switching overvoltage | 58 % line-reactor compensation; 108 km cable; insulation coordination | not modelled |
| Unbalanced faults and FRT with negative sequence | NC RfG Art. 16(3)(c) asymmetric-fault FRT; most real faults are unbalanced | balanced only |
| FRT with cable capacitance and reactors | 624 Mvar of charging changes the voltage during and after the fault | not in the FRT model (stated) |
| Cable rating per route section (IEC 60287 + IEC 60853 cyclic) | The bottleneck is usually the HDD landfall or J-tube, not the 1 m burial datasheet value; wind load profiles allow a cyclic rating | datasheet 825 A everywhere; DTS calibrated to it |
| Converter harmonic models (Norton) and impedance-based stability | Converter–cable resonance and harmonic instability | positive sequence, no converter impedance (stated) |
| Support structure: natural frequency vs 1P/3P, soil, scour, fatigue | Design-stage go / no-go for 37–51 m jackets | none |
| Turbine loads (DLCs, fatigue) | Feeds structure and O&M | rigid 1-DOF rotor |
| AEP P-values per horizon (1 / 10 / 25 years) and a curtailment loss | Lenders size debt on P90 at 1 and 10 years | lifetime horizon only; no curtailment category |
| Weather-restricted operations with contingency time | DNV-ST-N001: T_R = T_POP + T_C; α depends on T_POP and forecast level | window = T_POP; one α for all operations |
| IEC 60909 converter factor k and minimum-case topology | k is typically 1.1–1.5; min Ik″ for protection with the bus coupler open | k = 1.0; parallel transformers in both cases |

## 5. Comparison with established tools

✓ = present and validated in OffshoreForge; ◐ = present but simplified; ✗ = absent.

| Capability | OffshoreForge | Commercial reference | Open-source reference |
|---|---|---|---|
| Wind climate, long-term | ◐ NEWA + ERA5, no on-site MCP | WindPRO, WindFarmer, Openwind (MCP, lidar, CFD) | — |
| Wake models | ✓ PyWake BPA / Niayifar / NOJ / Zong / TurbOPark; Horns Rev, Lillgrund | same families + eddy viscosity, CFD | PyWake, FLORIS |
| Blockage | ◐ engineering scaling | WindFarmer BEET, CFD | PyWake SelfSimilarity / Rathmann |
| Energy-yield chain | ✓ metered Rødsand II, bias +1.1 % | full IEC 61400-15 framework | — |
| Uncertainty, P-values | ◐ RSS, lifetime horizon | 1 / 10 / 20-year P90 | — |
| Turbine control | ✓ ROSCO-equivalent (A1) | Bladed | ROSCO, OpenFAST |
| Aeroelastic loads | ✗ | Bladed | OpenFAST, HAWC2, QBlade |
| Support structure | ✗ | Sesam, SACS | WISDEM / WEIS, OpenFAST SubDyn |
| Load flow, N-1 | ✓ pandapower NR, OLTC, reactor switching | PowerFactory, PSS/E, ETAP | pandapower, OpenDSS |
| Short circuit | ◐ 3ph / ph-ph; hand-verified (A7) | all fault types | pandapower (1ph with zero-seq.) |
| Harmonics | ◐ distributed cable, planning levels, filter sizing | PowerFactory harmonic LF, Norton converters | — |
| RMS dynamics | ✓ WECC generic in ANDES + own FRT model | PowerFactory, PSS/E vendor models | ANDES |
| EMT | ✗ | PSCAD, EMTP, PowerFactory EMT | DPsim, ParaEMT |
| Cable rating | ◐ datasheet + calibrated DTS | CYMCAP, ELEK Cable HV | CIGRE TB 880 notebooks |
| Protection | ◐ IDMT / distance / 87L / 87B, no earth fault | PowerFactory, CAPE | — |
| Grid code (PSE NC RfG) | ✓ FRT, Q range, LFSM-O/U, EON-ION-FON | consultancy studies | — |
| Installation and decommissioning | ✓ real 30-year Baltic hindcast, α factor | Shoreline, Mermaid | ORBIT |
| O&M | ◐ failure rates in the control room | Shoreline | WOMBAT |
| Forecasting | ✓ real data vs Energinet (TSO) | commercial providers | — |
| IEC 61850 / SCADA | ◐ data model, GOOSE, OPC UA; SCL not schema-valid (F7) | vendor tools | OpenSCD, libiec61850 |
| Condition monitoring | ✓ CARE benchmark, held-out farm | vendor CMS | — |
| Whole lifecycle in one model, teaching | ✓ unique | — | — |

**Position:** no other tool, commercial or open, links the whole lifecycle on one farm with
open methods and measured validation. Within each discipline, the specialist tools go deeper:
loads, structures, EMT, cable rating and earth faults are the largest gaps.

## 6. Plan to 10/10

"10/10" means four things that can be checked:

1. every first-order effect of each lifecycle stage is modelled, or declared out of scope with a reason;
2. every output has an independent check (measured data, hand calculation, reference code or a
   standard's verification case) with a stated tolerance, run in CI;
3. there are no open findings of severity H or M;
4. an external review by domain experts has been carried out.

The last item cannot be self-certified. Effort is in person-weeks (pw).

### Phase A: correctness of existing models (≈ 4 pw)

| # | Work | Acceptance |
|---|---|---|
| A-1 | Thermal-aware reactor and STATCOM dispatch (F1) | export ≤ 95 % at 510 MW with WTG transformers; test |
| A-2 | WTG transformers, auxiliary load, reactor and STATCOM losses in `FarmSpec` (F2) | loss breakdown; Grid tab; tests |
| A-3 | Equivalent-π (or N-section) export cable in the load flow (F4) | within 1 % of 54 sections |
| A-4 | Computed electrical loss and availability in the AEP cascade (F3); P90 at 1 / 10 / 25 years; curtailment loss (PSE redispatch, negative prices) | cascade sources marked *computed*; Rødsand II validation still passes |
| A-5 | Soak thermal check and step bands (F6) | step fails above 100 % unless time-limited |
| A-6 | Schema-valid SCL with XSD validation in CI (F7) | 0 schema errors; OpenSCD opens the SCD |
| A-7 | Text fixes (F8) | — |
| A-8 | IEC 60909 k-factor sensitivity (1.0–1.5) and min case with bus coupler open | breaker duty at k = 1.5 < rating; protection sensitivity at min |

### Phase B: missing first-order engineering (≈ 16–20 pw)

| # | Work | Verification reference |
|---|---|---|
| B-1 | Sequence networks, 66 kV earthing (earthing transformer + NER), 1ph / 2ph-E faults, 51N / 67N protection | hand calculation; pandapower `calc_sc` 1ph documentation cases |
| B-2 | Cable rating per route section: IEC 60287-1-1/-2-1 (subsea, crossing, HDD, J-tube, onshore trefoil), three-core armour losses per CIGRE TB 908, cyclic rating per IEC 60853 on the farm's own hourly output; DTS reuses the same model | [CIGRE TB 880](https://e-cigre.org/publication/880-power-cable-rating-examples-for-calculation-tool-verification) cases within ±1 % (open notebooks: [cbl_CIGRE_TB880](https://github.com/frdmendoza/cbl_CIGRE_TB880)) |
| B-3 | Unbalanced RMS: negative-sequence current injection, asymmetric FRT; FRT network with cable shunt and reactors | symmetrical-component hand calculation; ANDES for the balanced subset |
| B-4 | EMT studies (open source: DPsim or ParaEMT): cable + reactor energisation (zero-missing), transformer inrush, TOV after fault clearance, switching overvoltage → insulation coordination | analytic LC / Ferranti cases; a published cable-energisation benchmark |
| B-5 | Harmonics with converter Norton models and the detailed array; impedance-based stability (passivity / Nyquist) | CIGRE TB 766 methods; analytic resonance checks |
| B-6 | Support structure: jacket / monopile first natural frequency vs 1P (5.0–7.56 rpm → 0.083–0.126 Hz) and 3P bands, soil springs (p-y), scour; extreme Hs₅₀ from the bundled 30-year CMEMS hindcast (EVA) | IEA-15-240-RWT monopile reference values (Gaertner et al. 2020); EVA against published Baltic extremes |
| B-7 | Turbine loads: 2–3 DOF (tower fore-aft, drivetrain) or an OpenFAST-derived DEL surrogate for the main DLCs | OpenFAST IEA-15 reference runs |
| B-8 | DNV-ST-N001 weather windows: T_R = T_POP + T_C, α from the standard's table by T_POP and forecast level | worked examples in DNV-ST-N001 |
| B-9 | O&M cost and availability simulation (WOMBAT-style) feeding availability (A-4) | WOMBAT reference cases |

### Phase C: validation and academic standing (≈ 6 pw, then ongoing)

| # | Work |
|---|---|
| C-1 | Turn every audit script into a `pytest -m validation` test with a tolerance; generate the Evidence page from it (`build_evidence.py` already does part of this). Add A1 (dynamic ROSCO) and A7 (IEC 60909 by hand) to Evidence. |
| C-2 | Cross-tool checks: PyWake vs FLORIS on the SB-510 layout; pandapower vs OpenDSS (load flow); the app turbine vs OpenFAST (rigid vs flexible). |
| C-3 | More measured data: further open offshore SCADA and wake datasets; Baltica 2 once it is on ENTSO-E (already planned); FINO2 mast (owner's to-do). |
| C-4 | A model card per module: assumptions, validity range, validation, known limits; verification, validation and UQ terms as in ASME V&V 10 / 20; twin qualification per DNV-RP-A204. |
| C-5 | Reproducibility: `CITATION.cff`, a Zenodo DOI per release, a SHA-256 manifest of bundled datasets, a versioned validation report (PDF) per release. |
| C-6 | Publication and review: a JOSS software paper, a methods paper (e.g. Wind Energy Science) on the lifecycle-coupled validation, and one external reviewer per discipline (wind resource, power systems, structures, SCADA). |

### Order of work

Recommended order: A-1 → A-2 → A-3 → A-4. These close the one H finding and the design
margin. Then A-6, B-1 and B-2, which have the highest professional value per week. Then
B-4 (EMT) and B-6 (structures), the largest gaps against design-grade tools. Phase C runs
alongside from the start; every fix lands with its validation test.

## 7. Limits of this audit

- **Not run:** the LSTM / TFT models (PyTorch not installable here) and the Playwright e2e and
  visual baselines.
- **Reviewed in code but not checked numerically:** the harmonic resonance frequencies, the
  FRT and PPC simulations, the BESS, market and planning studies, the N-1 runbacks and the
  CARE benchmark scores.
- **ROSCO comparison (A1):** uses ROSCO's 1-DOF rotor. A flexible-structure OpenFAST run can
  differ by a few percent in peak speed.
- **Assumed parameters:** the WTG transformer (A4) and reactor-loss (A5) values are generic
  typical values, marked as assumptions in the scripts. Sourced values should replace them
  in A-2.

## How to reproduce

```bash
cd backend
uv sync --locked                      # or the project's usual environment
pip install rosco==2.10.6 lxml h5py   # A1 (ROSCO), A8 (XSD), PyWake's overlap table (A2)
export PYTHONPATH=.
python scripts/audit/a1_rosco_overspeed.py
python scripts/audit/a2_turbopark_reference.py
python scripts/audit/a3_export_cable.py
python scripts/audit/a4_wtg_transformers.py
python scripts/audit/a5_annual_electrical_loss.py
python scripts/audit/a6_energisation_soak.py
python scripts/audit/a7_short_circuit_hand_calc.py
python scripts/audit/a8_scl_schema.py /path/to/SCL_2007B.xsd   # see the script docstring
```

References for the external checks: [NREL ROSCO](https://github.com/NREL/ROSCO) (tag v2.10.6),
[Ørsted TurbOPark](https://github.com/OrstedRD/TurbOPark),
[OpenSCD](https://github.com/openscd/open-scd) (SCL schema),
Lee & Fields 2021, [Wind Energ. Sci. 6, 311](https://wes.copernicus.org/articles/6/311/2021/) (loss and uncertainty framework).
