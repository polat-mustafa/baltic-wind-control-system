# The Man Who Steered the Wind — Progress Tracker

## ⚡ RESUME POINT (read this first in every new session)

| Field | Value |
|-------|-------|
| **Last completed chapter** | Chapter 25: Frequency Response and Synthetic Inertia (`part-06-talking-to-the-grid/ch-25-frequency-response.md`) |
| **Last completed file** | `part-06-talking-to-the-grid/ch-25-frequency-response.md` |
| **Next chapter to write** | Chapter 26: Protection Coordination (`part-06-talking-to-the-grid/ch-26-protection-coordination.md`) |
| **Kaan's location** | OSS control room, Week 8 (late evening — PSE frequency event resolved, 49.99 Hz and climbing to 50.00 Hz) |
| **Kaan's emotional state** | Watched the PSE frequency event live: Łagisza B trip (1,100 MW, eastern Poland), synthetic inertia burst from 34 rotors (12 MW in first second — trivial in 300 GW CE grid, significant in low-inertia future), LFSM-U ramp, frequency nadir 49.67 Hz, recovery over 17 minutes. Piotr Zawadzki (PSE duty operator) confirmed event closed. Key insight: the CE area's aggregate spinning mass rebuilt 50 Hz "one watt at a time across a continent" without any coordination or communication. Anders's framing: "The requirement is written for 2032, not tonight." Bridge to Ch 26: "Tomorrow, Sigrid wants to walk you through the protection relay that was watching tonight — the one we just tested without testing it." |
| **Last narrative sentence** | "'You want to understand what it took to make sure it did not trip.' He looked at the frequency display, now reading 49.99." |
| **Total words written** | ~169,000 (preface + how-to-read + Ch 1-25) |
| **Total chapters complete** | 25 / 48 |
| **Session count** | 26 |
| **Last session date** | 2026-03-25 |
| **Master plan location** | `.claude/plans/sequential-booping-pumpkin.md` |

---

## Narrative Continuity Tracker

This section tracks Kaan's journey chapter by chapter, so narrative continuity survives across sessions.

| Ch | Kaan's Location | Key Characters | Emotional Beat | Story Time |
|----|----------------|----------------|---------------|------------|
| 1 | CTV, waiting for weather | Kaan, CTV Captain | Nervous anticipation, curiosity about wind history | Day 1, morning |
| 2 | CTV, still waiting (storm) | Kaan, tablet reading | Growing fascination with millwrights | Day 1, afternoon |
| 3 | CTV, approaching platform | Kaan, Senior Engineer (mentor) | Excitement as turbines appear on horizon | Day 1, evening |
| 4 | SOV common room, evening | Kaan, Electrical Engineer colleague | "War of Currents" story over coffee — electricity primer | Day 1, night |
| 5 | Turbine base, first visit | Kaan, Turbine Technician | Awe at blade size — 115 meters, understanding lift | Day 2, morning |
| 6 | Inside nacelle, 150m up | Kaan, Turbine Technician | Vertigo + fascination with drivetrain | Day 2, afternoon |
| 7 | SOV, reviewing specs | Kaan, mentor | Understanding why turbines grew — economics + physics | Day 2, evening |
| 8 | Met mast platform | Kaan, Resource Assessment Lead | Feeling the wind's power directly, ABL lesson | Day 3 |
| 9 | SOV data room | Kaan, Data Analyst | First encounter with ERA5, Weibull — data as currency | Day 4 |
| 10 | SOV, watching wake patterns | Kaan, mentor | Understanding why some turbines produce less — visible wakes | Day 5 |
| 11 | SOV engineering office, dual monitors | Kaan, Signe Vestergaard (Danish layout optimiser) | 150M EUR hinges on positions; algorithms find good but never provably best; "the number the bank cares about" | Day 6 |
| 12 | SOV, financial review | Kaan, Project Finance Lead | The P90 revelation — uncertainty = money | Week 2 |
| 13 | Foundation installation site | Kaan, Marine Engineer | Watching a monopile being driven — physical awe | Week 3 |
| 14 | Cable-lay vessel visit | Kaan, Cable Engineer | Understanding the invisible highway under the sea | Week 3 |
| 15 | Jack-up vessel observation | Kaan, Installation Manager | Weather window anxiety — Hs limits, logistics | Week 3 |
| 16 | OSS (offshore substation) | Kaan, Electrical Engineer | "Before you touch anything, understand AC" | Week 4 |
| 17 | OSS GIS hall + transformer bay | Kaan, Stefan Bauer (German GIS engineer, Siemens Energy) | GIS hall revealed — not the forest of insulators expected but compact grey cylinders. Every rating points to a consequence chain. "The oil sampling valve is more important than any relay." | Week 4 |
| 18 | Control room, load flow screen | Kaan, mentor | Where does 510 MW actually go? | Week 5 |
| 19 | OSS relay testing room → corridor toward STATCOM door | Kaan, Sigrid Lund (Norwegian protection engineer) | 1965 Northeast Blackout as chapter hook. IEC 60909-0, Fortescue, converter fault current. "Protection engineering is not a calculation you run once. It is a system you maintain." | Week 5 |
| 20 | STATCOM room | Kaan, Johan Carlsson (Swedish, Hitachi Energy, Västerås) | Ferranti effect in real time — Bus 3 climbs as turbines feather. 85.5 MVAR cable charging. 1.047 pu uncompensated. STATCOM vs SVC: 18 MVAR vs 2.7 MVAR at V=0.15 pu. Live 122 MVAR step test: 18 ms. "The cable does not sleep." | Week 6 |
| 21 | OSS control room | Kaan, Ingrid Sørensen (Danish power quality specialist) | Harmonic spectrum on the analyser — comb of peaks. VSC odd non-triplen harmonics, cable-transformer resonance at h≈11 amplifies 0.9%→0.98%, THD=1.30% (passes IEC 3.0% limit), Pst=0.007 (passes EN 50160 limit of 1.0). "Clean enough, by agreement." Part V closes — bridges to Ch 22 (grid codes, the contract). | Week 6 |
| 22 | OSS control room (TSO coordination call) | Kaan, Anders | Sat in on Anders's PSE Warsaw call. 2006 European blackout (Norwegian Pearl, Ems River, 17 seconds, 10M homes). Three-level hierarchy (NC RfG → IRiESP → Grid Connection Agreement). Type D classification (≥75 MW or ≥110 kV). Reactive capability ±170 MVAR vs ±164 MVAR required (pf=0.95). LFSM-O + LFSM-U (PSE mandatory). Five of six Type D requirements verified; FRT → Ch 23. | Week 7 |
| 23 | OSS control room, ANDES FRT simulation | Kaan, Anders | ANDES simulation: voltage drops to 0.05 pu for 140 ms. Reactive current leaps to 1.0 pu in 5 ms; active power to zero. DC link yellow trace rises, chopper activates at ~1,180 V. Farm dissipates 64 MJ as heat in turbine nacelles. Active power recovers to 449 MW at t+1.0 s (89.8%). Realisation: the PPC coordinates all 34 turbines. E.ON Netz 2003 Ergänzungsregeln as first FRT mandate. September 23, 2003 Swedish/Danish blackout as risk scenario motivation. | Week 7 |
| 24 | OSS control room (PPC desk) → frequency event in the evening | Kaan, Rafael Díaz (PPC systems engineer, ex-REE Madrid / CECRE 2006–2010) | Learned 4 active power modes, pro-rata dispatch, reactive Q coordination. CECRE story: 53.7% Spanish demand from wind on 8 Nov 2009 — proof that dispatch control makes 50%+ penetration possible. Evening: PSE frequency alert 49.82 Hz (1,100 MW thermal trip, eastern Poland). Synthetic inertia visible before LFSM-U response moved 10 MW. "Chapter 25." | Week 8 |
| 25 | OSS control room (live PSE frequency event) | Kaan, Anders, Piotr Zawadzki (PSE duty operator, Warsaw — voice on radio) | Watched Łagisza B trip (1,100 MW) live: synthetic inertia burst (12 MW, instant), LFSM-U ramp (slow), nadir 49.67 Hz, recovery over 17 minutes. CE vs GB comparison (RoCoF 0.013 vs 0.41 Hz/s). Anders: "The requirement is written for 2032, not tonight." Bridge: Sigrid's protection relay that "watched" the event. | Week 8 |
| 26 | OSS, relay room | Kaan, Protection Engineer | "Selectivity saves millions — wrong trip costs millions" | Week 9 |
| 27 | Control room, SSO alarm | Kaan, Stability Engineer | Converter-cable resonance scare | Week 9 |
| 28 | SCADA engineering WS | Kaan, SCADA Engineer | IEC 61850 — "it's not a protocol, it's a data model" | Week 10 |
| 29 | OSS, process bus | Kaan, SCADA Engineer | GOOSE message travels faster than his blink | Week 10 |
| 30 | OSS, comms room | Kaan, Network Engineer | "If this switch fails, the protection fails" | Week 11 |
| 31 | Security review meeting | Kaan, Cybersecurity Lead | Stuxnet story — the real-world consequences | Week 11 |
| 32 | PtW terminal | Kaan, Safety Officer | "You cannot skip steps. The software won't let you." | Week 12 |
| 33 | Data analytics lab | Kaan, Data Scientist | "Garbage in, garbage out" — data cleaning revelation | Month 4 |
| 34 | Training session | Kaan, ML Engineer | Decision trees explained with wind data | Month 4 |
| 35 | Training session | Kaan, ML Engineer | LSTM gates — "the network remembers what matters" | Month 5 |
| 36 | Training session | Kaan, ML Engineer | TFT attention — "the model shows you where it looks" | Month 5 |
| 37 | Control room, ramp event | Kaan, Grid Operator | Real ramp event — ensemble forecast saved the day | Month 6 |
| 38 | OSS, FAT documentation | Kaan, Commissioning Lead | Reading 200 pages of test results — boring but critical | Month 8 |
| 39 | OSS, energisation day | Kaan, PiC (Person in Control) | THE climactic chapter — 30 switching steps | Month 9 |
| 40 | OSS, PiC desk | Kaan as PiC | The weight of command — GO/NO-GO decisions | Month 9 |
| 41 | OSS, emergency drill | Kaan, Safety Officer | The dark scenarios — arc flash, SF6, man overboard | Month 9 |
| 42 | TSO compliance meeting | Kaan, Compliance Engineer | EON → ION → FON — the final exam | Month 10 |
| 43 | SOV, 6 months later | Kaan, O&M Manager | Routine operations — weather windows, CTV, SOV | Month 12 |
| 44 | Financial review meeting | Kaan, Project Finance Lead | LCOE, CfD — why the turbines exist at all | Month 12 |
| 45 | Digital twin dashboard | Kaan, Digital Twin Engineer | Health scores, anomaly alerts — predictive maintenance | Month 14 |
| 46 | Environmental survey vessel | Kaan, Marine Biologist | Reef effect, bird surveys, decommissioning plans | Month 18 |
| 47 | Conference presentation | Kaan, alone on stage | Looking forward — HVDC, floating, hydrogen | Year 2 |
| 48 | OSS observation deck | Kaan, alone | 34 turning rotors — reflection on the journey | Year 2 |

---

## Chapter Progress

**Last updated:** 2026-03-25
**Total chapters:** 48
**Completed:** 25 / 48
**Word count:** ~169,000 / ~280,000

### Status Legend
- `[ ]` Not started (stub only)
- `[~]` In progress (partially written)
- `[x]` First draft complete
- `[R]` Reviewed and polished

### Front Matter
- `[ ]` Title page (`front-matter/title.md`)
- `[ ]` Dedication (`front-matter/dedication.md`)
- `[x]` Preface: "Why This Book Exists" (`front-matter/preface.md`)
- `[x]` How to Read This Book (`front-matter/how-to-read.md`)
- `[ ]` Acknowledgements (`front-matter/acknowledgements.md`)
- `[ ]` List of Abbreviations & Symbols (`front-matter/abbreviations.md`)

### Part I: The Wind Before Machines (~55 pages)
- `[x]` Ch 1: Fire, Water, Wind: The First Energy Sources
- `[x]` Ch 2: The Millwrights: Holland, England, and the Birth of Mechanical Power
- `[x]` Ch 3: From Poul la Cour to MOD-2: Electricity from Wind
- `[x]` Ch 4: The War of Currents

### Part II: The Anatomy of a Wind Turbine (~45 pages)
- `[x]` Ch 5: How an Airfoil Makes a Turbine Spin
- `[x]` Ch 6: Inside the Nacelle
- `[x]` Ch 7: Scaling Up: From 100 kW to 15 MW

### Part III: Understanding the Wind (~65 pages)
- `[x]` Ch 8: The Atmosphere Is an Engine
- `[x]` Ch 9: Measuring and Modelling the Wind
- `[x]` Ch 10: Wake Effects
- `[x]` Ch 11: Layout Optimization
- `[x]` Ch 12: How Much Energy? AEP, Uncertainty, and the P90

### Part IV: Building in the Sea (~45 pages)
- `[x]` Ch 13: Foundations: Monopile, Jacket, and Floating
- `[x]` Ch 14: Submarine Cables — 45 Kilometres Under the Sea
- `[x]` Ch 15: Installation

### Part V: The Invisible Highway — Electrical Engineering (~80 pages)
- `[x]` Ch 16: AC Fundamentals
- `[x]` Ch 17: Cables, Transformers, and Equipment
- `[x]` Ch 18: Load Flow
- `[x]` Ch 19: Short-Circuit Analysis
- `[x]` Ch 20: The Ferranti Effect and the STATCOM Decision
- `[x]` Ch 21: Harmonics, Flicker, and Power Quality

### Part VI: Talking to the Grid (~85 pages)
- `[x]` Ch 22: Grid Codes
- `[x]` Ch 23: Fault Ride-Through
- `[x]` Ch 24: The Power Plant Controller
- `[x]` Ch 25: Frequency Response and Synthetic Inertia
- `[ ]` Ch 26: Protection Coordination
- `[ ]` Ch 27: Sub-Synchronous Oscillations and Converter Stability

### Part VII: The Machine That Watches Itself — SCADA (~70 pages)
- `[ ]` Ch 28: IEC 61850
- `[ ]` Ch 29: GOOSE, MMS, and Sampled Values
- `[ ]` Ch 30: Network Redundancy
- `[ ]` Ch 31: Cybersecurity
- `[ ]` Ch 32: The Permit-to-Work

### Part VIII: Teaching Machines to Predict the Wind (~65 pages)
- `[ ]` Ch 33: Data Quality
- `[ ]` Ch 34: XGBoost
- `[ ]` Ch 35: LSTM
- `[ ]` Ch 36: The Temporal Fusion Transformer
- `[ ]` Ch 37: Ensemble, Ramp Detection, and the Art of Being Useful

### Part IX: First Light — Commissioning (~60 pages)
- `[ ]` Ch 38: Before the Power Flows: FAT and SAT
- `[ ]` Ch 39: The Switching Programme
- `[ ]` Ch 40: The Person in Control
- `[ ]` Ch 41: LOTO, Emergency Response
- `[ ]` Ch 42: Grid Code Compliance Testing

### Part X: The Life of a Wind Farm (~55 pages)
- `[ ]` Ch 43: Operations & Maintenance
- `[ ]` Ch 44: The Economics
- `[ ]` Ch 45: Digital Twins and Condition Monitoring
- `[ ]` Ch 46: Environmental Impact and Decommissioning

### Part XI: What Comes Next (~25 pages)
- `[ ]` Ch 47: The Horizon
- `[ ]` Ch 48: The Man Who Steered the Wind

### Back Matter
- `[ ]` Appendix A: Standards Reference Matrix
- `[ ]` Appendix B: Key Formulas Reference
- `[ ]` Appendix C: Glossary
- `[ ]` Appendix D: Computation Engines
- `[ ]` Bibliography
- `[ ]` Index

---

## Priority Chapters (write first to establish patterns)
1. **Ch 1** — sets narrative voice and historical research depth
2. **Ch 20** — sets formula presentation style (Ferranti + STATCOM)
3. **Ch 39** — the climactic operational chapter (switching programme)
4. **Ch 12** — the business case (AEP + P90)
5. **Ch 28** — the most misunderstood topic (IEC 61850)

---

## Forgotten Topics Queue

Topics discovered during writing that need to be added or expanded:

| Topic | Discovered In | Should Go In | Status |
|-------|--------------|-------------|--------|
| (none yet) | — | — | — |

---

## Style Decisions Log

| Decision | Rationale | Date |
|----------|----------|------|
| Narrative sections in italics | Distinguishes story from technical content; skippable | 2026-03-17 |
| Per-chapter footnotes, not endnotes | Easier reference while reading | 2026-03-17 |
| Generic "500 MW" reference case | Keeps book standalone from Baltic Wind project | 2026-03-17 |
| Protagonist name: Kaan | Turkish-origin — authentic to Baltic workforce, relatable | 2026-03-17 |
| Three reading paths (narrative / technical / full) | Serves widest audience | 2026-03-17 |
| No AI mention in text | Would be repulsive to readers; natural voice only | 2026-03-17 |
| American English, no exclamation marks in technical sections | Sincere tone, reserve emotion for narrative | 2026-03-17 |
| Auto-audit on startup | Every "continue ebook" reads last chapter + runs quality checklist before showing briefing | 2026-03-18 |

---

## Page Formatting Notes

- Target: ~600 words per page (print equivalent)
- Formula display: LaTeX (`$$...$$` for display, `$...$` for inline)
- Code blocks: Used ONLY for data formats (SCL XML, GOOSE PDU), never for programming
- Tables: Markdown pipe tables, max 6 columns for readability
- Blockquotes: Reserved for standards quotations, key definitions, and image placeholders
- Chapter files: One file per chapter, no splitting

---

## Session Log

| Session | Date | Chapters Written | Words Added | Key Decisions |
|---------|------|-----------------|-------------|---------------|
| 1 | 2026-03-17 | Scaffolding only | ~2,500 | Created 48 stubs, preface, how-to-read, SKILL.md, skills.md. Established voice, template, citation rules. |
| 2 | 2026-03-17 | Ch 1 complete | ~6,000 | Ch 1 first draft: 6 sections, 3 formulas, 18 citations, 3 image placeholders. Narrative voice established. Worked example (Nashtifan vs V236). Updated SKILL.md with startup protocol and context restoration. |
| 3 | 2026-03-18 | Ch 2 complete | ~6,000 | Ch 2 first draft: 5 sections, 1 formula, 25 citations, 3 image placeholders. Dutch drainage (Beemster, Kinderdijk), Zaanstreek industrial district, fantail as negative feedback, Oliver Evans automated mill. Worked example: pumping capacity calculation. |
| 4 | 2026-03-18 | Ch 3 complete | ~6,500 | Ch 3 first draft: 5 sections, 2 formulas (tip speed ratio, capacity factor), 39 citations, 5 image placeholders. Blyth (1887), Brush (1888), Poul la Cour (1891-1908), Jacobs Wind Electric (1920s-1950s), Smith-Putnam (1941-1945), Gedser/Juul (1957), NASA MOD-0/1/2 (1975-1982), California Wind Rush (1981-1986). Introduced Anders (mentor) and Elif (electrical engineer). Worked example: capacity factor Gedser → modern (9,146 Gedser turbines = one 500 MW farm). |
| 5 | 2026-03-18 | Ch 4 complete | ~7,000 | Ch 4 first draft: 7 sections, 5 formulas (Faraday's law, P_loss=I²R, R=ρL/A, transformer ratio, 3-phase current), 33 citations, 4 image placeholders. Faraday (1831), Edison/Pearl Street (1882), ZBD transformer (1884-85), Tesla patents (1888), Harold Brown electrocutions, Kemmler execution (1890), Chicago World's Fair (1893), Niagara Falls (1895-96), Ferranti/Deptford (1889-91), Ferranti effect, HVDC comeback. Elif narrates the War of Currents story. Worked example: DC 110V vs AC 220kV losses for 500 MW over 45 km. Part I complete. |
| 6 | 2026-03-18 | Ch 5 complete | ~7,000 | Ch 5 first draft: 6 sections, 6 formulas (lift/drag forces, Kutta-Joukowski, Betz derivation with Cp=4a(1-a)², velocity triangle/flow angle, tip speed ratio), 18 citations, 5 image placeholders. Cayley (1799 silver disc), Lilienthal (1889), Kutta (1902), Joukowski (1906), Bernoulli (1738), Lanchester (1915), Betz (1920), Glauert (1935 BEM). DU/NACA/FFA/NREL airfoil families. Introduced Morten (turbine technician). Worked example: power extraction at 10 m/s and rated for 236m rotor, farm-level scaling. Fun fact: blade tips at 374 km/h. Part II begins. |
| 7 | 2026-03-18 | Ch 6 complete | ~6,500 | Ch 6 first draft: 6 sections, 5 formulas (T=P/ω torque, rotor/generator torque calculations, DFIG slip, cos³ yaw misalignment, drivetrain efficiency chain), 19 citations, 4 image placeholders. Three drivetrain philosophies (high-speed geared, direct-drive, medium-speed). Enercon E-40 (1993, first DD), Growian (1983, 400-hour failure), Smith-Putnam (1941, first variable-pitch). V236 medium-speed 3-stage all-planetary (ZF, ~48:1, 400 rpm PMSG). DFIG vs PMSG, rare earth geopolitics (30 vs 160-200 kg REE/MW). Pitch system (electric, ultracapacitor backup, IEC 61400-1 dual brake requirement). Yaw system (10 motors, ±720-1080° cable twist, cos³ loss). Condition monitoring (vibration, oil particles, temperature). Worked example: 15 MW → 14.18 MW grid (η=0.945) + yaw loss comparison. Nacelle heavier than a 747 (630 vs 413 tonnes). |
| 8 | 2026-03-18 | Ch 7 complete | ~6,500 | Ch 7 first draft: 5 sections, 5 formulas (P=½ρACpv³ scaling, m∝D^α blade mass, specific power SP=P/A, capacity factor CF=AEP/(P×8760), time-based availability), 16 citations, 5 image placeholders. Square-cube law (Galileo 1638), beating the cube (α=2.1-2.5 vs theoretical 3.0). Carbon fibre spar caps (Vestas V90 2004, CFRP 3× specific stiffness of GFRP). Leading-edge erosion (1-5% AEP loss, tip speeds >100 m/s, IEA Wind Task 46 classification). Lightning protection (IEC 61400-24:2019, LPL I-IV, receptor-down conductor system, 200 kA peak, continuing current). Power curve (IEC 61400-12-1:2017, bin method, Regions 1-3, storm-riding to 31 m/s). Specific power decline (393→223 W/m² US onshore, V80 398 vs V236 343 W/m²). Reliability (IEC 61400-26-1, 95-97% availability, Carroll et al. 2016 failure costs). Worked example: V80→V236 scaling (8.7× area, 7.5× power, 10.3× AEP, 86% fewer foundations). Part II complete — bridges to Part III (Understanding the Wind). |
| 9 | 2026-03-18 | Ch 8 complete | ~7,000 | Ch 8 first draft: 6 sections, 6 formulas (Coriolis parameter f=2Ωsin(φ), log wind profile u(z)=(u*/κ)ln(z/z₀), power law u(z)=u_ref(z/z_ref)^α, turbulence intensity TI=σ_u/ū, Obukhov length L, stability-corrected log law), 20 citations, 5 image placeholders. Earth's heat engine (TSI 1361 W/m², 1-2% → wind). Hadley (1735, forgotten for a century, confused with brother). Ferrel (1856, three-cell model). Coriolis (1835, waterwheels not weather). Prandtl (1904, 10-minute Heidelberg talk). Ekman (1902, Nansen's icebergs). ABL structure (surface layer, Ekman layer, free atmosphere). Marine ABL 300-800m, damped diurnal cycle. Wind shear: log law z₀=0.0002m offshore, power law α=0.14 IEC NWP / α=0.11 EWS. Charnock relation. TI: IEC classes A/B/C, offshore 5-8%, wake-added 12-18%. Monin-Obukhov 1954, Businger-Kansas 1971. Introduced Maja Kowalska (Polish Resource Assessment Lead, Kestrel meter). Worked example: 9.0 m/s at 10m → 11.3 (log law) vs 13.1 (power law) at 150m, power density 2-3× amplification. Part III begins — bridges to Ch 9 (data, measurement, ERA5). |
| 10 | 2026-03-18 | Ch 9 complete | ~7,000 | Ch 9 first draft: 5 sections, 6 formulas (Doppler velocity v_r=Δfλ/2, Weibull PDF, mean wind speed v̄=AΓ(1+1/k), power density E/A=½ρA³Γ(1+3/k), sector energy E(θ)∝f(θ)v̄(θ)³, AEP=8760ΣP(vi)pi), 20 citations, 5 image placeholders. Cup anemometer: Robinson (1846, 4-cup, wrong 1/3 speed claim), Patterson (1926, 3-cup), Brevoort & Joiner (1935). Overspeeding bias 0.1-0.5 m/s. IEC 61400-12-1:2017 Class 1.7A. Sonic anemometers. LiDAR: ZephIR CW (QinetiQ/DTU 2003), Windcube pulsed (Leosphere/Vaisala). Floating LiDAR (Carbon Trust OWA). ERA5: ECMWF, 31 km, 137 levels, hourly, 1940-present, ~24M obs/day, predecessors ERA-15/40/Interim. Weibull: Waloddi Weibull (1887-1979), 1939 paper, 1951 ASME "7 examples" paper, ASME Gold Medal 1972. Justus et al. 1978 → wind. k=2.0-2.5 offshore. Energy pattern factor 1.82 for k=2.1. Wind rose vs energy rose (cubic amplification by sector). MCP: linear regression + variance ratio, ERA5 as reference, reduces uncertainty ±5-8% → ±2-4%. Maja continues as lead character. Worked example: k=2.1, A=11.5, mean 10.2 m/s → single turbine 73.5 GWh/yr (CF 55.9%) → 34 turbines 2,499 GWh/yr gross → 450M EUR wake loss hook. Bridges to Ch 10 (Wake Effects). |
| 11 | 2026-03-18 | Ch 10 complete | ~8,200 | Ch 10 first draft: 7 sections, 6 formulas (wake radius r_w=r₀+k_w·x, Jensen velocity U_w, Gaussian deficit ΔU/U∞=C(x)exp(-r²/2σ²), wake width σ/D=k*x/D+ε, Katić RSS superposition, Frandsen effective turbulence I_eff + I_+ approximation), 22 citations, 5 image placeholders. Wake physics: actuator disc → velocity deficit → turbulent recovery. Jensen/Park model (N.O. Jensen, Risø-M-2411, 1983) — top-hat profile, k_w=0.04 offshore/0.075 onshore. Bastankhah & Porté-Agel (2014) Gaussian model — self-similar profile, k*=0.03 offshore. Katić-Højstrup-Jensen (EWEC Rome 1986) RSS superposition. Deep array effect: 15-25% velocity deficit in interior. Frandsen (Risø-R-1188, 2007) wake-added turbulence → IEC 61400-1 Ed.3 effective turbulence. Horns Rev I: 80 × V80 2 MW, Dec 2002, 7D spacing, 10-12% farm losses, 30-40% row-aligned at row 8. Famous photo by Christian Steiness (Vattenfall, 12 Feb 2008). Lillgrund: 48 × SWT-2.3-93, 2007, 3.3D spacing, 23-28% farm losses — cautionary extreme. Wake steering: Fleming et al. 2019 NREL field test, 14% downstream gain, 4% pair gain, 1-3% farm AEP. FLORIS model. Anders returns as lead character (Day 5 morning, observation deck). Worked example: Jensen model 5-turbine row at 7D + farm-level 10% loss = 450M EUR over 30 years + 90M EUR value of 2pp improvement. Bridges to Ch 11 (Layout Optimization). |
| 12 | 2026-03-18 | Ch 11 complete | ~7,000 | Ch 11 first draft: 7 sections, 5 formulas (AEP summation over directions/speeds/turbines, LCOE = (CAPEX×FCR+OPEX)/AEP, minimum Euclidean spacing constraint d_ij≥d_min, gradient ascent update x^(t+1)=x^(t)+α∇AEP), 20 citations, 4 image placeholders. WFLOP history: Mosetti-Poloni-Diviacco (1994, 10×10 grid GA, 1,400+ citations), Grady-Hussaini-Abdullah (2005, benchmark established). Metaheuristics: GA, PSO, SA, ACO. Gradient revolution: Thomas & Ning (BYU 2017, smooth FLORIS gradients), TOPFARM/DTU (algorithmic differentiation, OpenMDAO). Hybrid approach (GA exploration + gradient refinement). Regular grid legacy: Horns Rev 8×10 at 7D, Nysted 10.5D×5.8D. Staggered vs regular: 2-3pp wake loss reduction. Constraint landscape: lease boundary, environmental (EU Habitats/Birds Directives), navigational (IMO), archaeological (100K Baltic shipwrecks), geotechnical (UXO), cable routing (5-10% CAPEX). Polish offshore wind act (2020). Commercial tools: WindPRO (EMD 1996), openWind (UL Solutions, 70% top developers), TOPFARM (DTU open-source), FLORIS (NREL). Introduced Signe Vestergaard (Danish layout optimiser, early forties, sharp-featured, reading glasses, dual monitors). Worked example: 3 layouts compared — regular grid (11.2% loss), staggered (9.1%), optimised (7.8%) → 150.9M EUR net benefit of optimisation vs grid, 73:1 return on cable investment. Bridges to Ch 12 (AEP, Uncertainty, P90). |
| 13 | 2026-03-18 | Ch 12 complete | ~7,000 | Ch 12 first draft: 7 sections, 6 formulas (gross-to-net cascade AEP_net=AEP_gross×∏(1-L_i), time-based availability, energy-based availability, quadrature uncertainty σ_total=√Σσ_i², P-value P_x=μ-z_x·σ, FCR=r(1+r)^n/((1+r)^n-1)), 17 citations, 5 image placeholders. Gross-to-net cascade: 7 loss categories, 15-25% total (IEC 61400-15-1:2025). Blockage effect (Bleeg 2018, 1.9-3.4%). Availability: IEC 61400-26-1/2, time vs energy-based, Scroby Sands 84%, Carroll 2016 (350 turbines, 8-10 failures/yr, 25% major = 95% downtime). Access: CTV Hs≤1.5m, SOV ≤2.5-3.0m. Uncertainty budget: 8 categories, inter-annual variability dominant (3.5-6%), total σ=6-10%. P90 history: Garrad Hassan (1984), oil-and-gas P90 adapted for wind, UK NFFO (1990), US PTC (1992). P50/P75/P90/P99 quantiles. 1-year vs 10-year P90. DSCR 1.30-1.40. LCOE: IRENA 2024 global avg EUR 72/MWh, 62% decline since 2010, CAPEX EUR 2,600-3,200/kW. CfD: UK AR1-AR6 (70% decline AR1→AR3, AR5 zero awards), Hollandse Kust Zuid zero-subsidy (2018), Poland first CfD Dec 2025 (EUR 113-117/MWh). Introduced Helena Voss (finance lead, London, early fifties, silver-streaked hair, reading glasses). Worked example: full 7-step cascade from gross 2,499 GWh → net P50 1,974 GWh (CF 44.2%) → P90 1,807 GWh (91.6% of P50) → LCOE 83.6 EUR/MWh → CfD revenue 5,676M EUR → DSCR 1.74. Part III complete — bridges to Part IV (Building in the Sea, foundations). |
| 14 | 2026-03-18 | Ch 13 complete | ~7,500 | Ch 13 first draft: 8 sections, 6 formulas (mudline overturning moment M_mud, Miner's cumulative fatigue D=Σ(n_i/N_i)≤1/DFF, p-y curve p=p_u·f(y/y_c), scour depth S/D=1.3, 1P/3P frequency f_1P=RPM/60 and f_3P=3×f_1P, simplified natural frequency f_n≈(1/2π)(3.04/L²)√(EI/m)), 24 citations, 5 image placeholders. Part IV opens — Building in the Sea. Monopile history: Vindeby GBS (1991), Horns Rev 1 first monopile (2002, 4m/200t), Arcadis Ost 1 XXL (9.5m/2000t), Thor (2025, 72 piles, 1.1 GW). Fabrication: Sif/EEW, S355-S460 steel, 60-100mm wall, SAW welding, 4-6 weeks/pile. Transition piece: grouted → bolted flange evolution. Installation: IHC S-4000 hydraulic hammer (4,000 kJ), big bubble curtain noise mitigation (10-15 dB reduction), BSH 160 dB limit. Jacket: oil & gas heritage (1947 Gulf of Mexico), Beatrice Demo (2006), Aberdeen Bay suction buckets (2018). GBS: Vindeby (1991), Thornton Bank Phase I (2009, 3,000t concrete). Floating: spar (Hywind Scotland 2017, 30 MW, 54% CF), semi-sub (WindFloat/Kincardine 2021, 50 MW), TLP (pre-commercial). Soil: Polish Baltic glacial till (Weichselian, 10-15 kya), boulders, overconsolidated. p-y method → PISA (Oxford/Ørsted 2020). Scour: 1.3D unprotected, rock armour mandatory. Soft-stiff design: f_n between 1P (0.132 Hz) and 3P (0.395 Hz), target ~0.21 Hz. Introduced Pieter Bakker (Dutch marine foundations engineer, mid-forties, hard hat with stickers, carries soil core). Worked example: 7-step monopile design for 15 MW in 30m — D=10m, t=90mm, L=80m, 1800t, M_ULS=600 MN-m, f_n=0.21 Hz (soft-stiff), scour protection 3500 m³/turbine, total foundation cost EUR 316M (21% of CAPEX). Bridges to Ch 14 (Submarine Cables). |
| 15 | 2026-03-24 | Ch 14 complete | ~7,500 | Ch 14 first draft: 7 sections, 6 formulas (I_rated=P/(√3V), IEC 60287 ampacity master equation, T₄ external thermal resistance, charging current I_c=U₀ωC, reactive power Q_c=ωCV²L, cable losses P_loss=3I²R_ac·L), 22 citations, 5 image placeholders. Cable construction: 9 concentric layers, gutta-percha (1850) to XLPE (1963), lead sheath as water barrier, DTS optical fibres. Brett's Channel cable (1850, fisherman cut it within hours), 1851 armoured success. Array 66 kV vs export 220 kV (33→66 kV transition ~2015). IEC 60287 thermal circuit (T1-T4), soil thermal resistivity (0.7-4.0 K·m/W), drying-out positive feedback. Charging current: 220 kV cable = 2.6 MVAR/km capacitor, 45 km = 116 MVAR/cable → explains 50 MVAR reactor + STATCOM. Bridge to Ch 4 (Ferranti) and Ch 20 (STATCOM). CLVs: EUR 150-250K/day, 7,000-10,000t carousels. Burial: jet trenching 1.0-1.5 m, HDD at landfall (thermal bottleneck). Cable failures: 80% of insurance claims, 46% from installation damage, omega loop repair 40-60 days, EUR 2-30M. Radial vs ring topology economics. Gotland HVDC (1954, ASEA, 20 MW), Viking Link (2023, 765 km). Introduced Nora Henriksen (Norwegian cable engineer, mid-thirties, cable cross-section sample). Worked example: 2 × 220 kV export cables (670 A each, 737 A combined with charging), 7 array strings (tapered 185/500/800 mm²), 150 km total cable, 232 MVAR reactive, EUR 145M cable cost (9.7% CAPEX), EUR 15M lifetime losses. Bridges to Ch 15 (Installation — weather windows, vessel logistics). |
| 16 | 2026-03-24 | Ch 15 complete | ~7,500 | Ch 15 first draft: 7 sections, 6 formulas (preload P≥γf×R_storm, air gap h=η_max+Δh_tide+δ_set+s, weather window W=P(Hs≤h)×P(Vw≤v), crane moment M=W×R, vessel spread cost C=Σ(ri×Di), delay cost C_delay=Σ(ri_idle)), 21 citations, 5 image placeholders. WTIV evolution: Vindeby barges (1991, 11 turbines in 11 days), MPI Resolution (2003, first purpose-built WTIV, £20M→£53M, Mayflower bankrupt), Voltaire (Jan De Nul 2022, 3,000t crane, 130m legs), Orion (DEME 2022, 5,000t DP3, 178m height), Charybdis (2025, first US Jones Act WTIV, 2,200t). Jack-up operations: spudcans, preloading (diagonal pairs, 1.25-1.50× storm), air gap (12-15m), punch-through risk in layered Baltic glacial soils. Construction sequence: 5 overlapping phases over 30 months (export cable → foundations → array cables → turbines → commissioning). Weather windows: blade lift most restrictive (Hs≤1.5m, wind≤10m/s), Baltic seasonal availability 25-68%, installation season April-October. Turbine lift procedure: tower→nacelle→3 blades (24-48h total, one turbine per 3-5 days average). Vessel spread: 8 vessel types, EUR 500K+/day combined, weather downtime EUR 19.4M for 34-turbine campaign. Marshalling ports: Esbjerg, Cuxhaven (EUR 300M expansion), Gdańsk T5 terminal. Introduced Marc Janssens (Belgian installation campaign manager, late forties, worn notebook tracking daily weather/ops). Worked example: 34-turbine installation in one season — 122 productive days of 214, 52 effective turbines capacity, EUR 60.5M turbine spread, EUR 19.4M weather cost, total installation EUR 220-250M (15-17% CAPEX). Part IV capstone: foundations+cables+installation = 45-48% of CAPEX. Part IV complete — bridges to Part V (Electrical Engineering, "Before you touch anything, understand AC"). |
| 17 | 2026-03-24 | Ch 16 complete | ~6,500 | Ch 16 first draft: 5 sections + worked example, 6 display formulas (v(t)=Vpeak·sin(ωt+φ), Vrms=Vpeak/√2, S=VI*=P+jQ, |S|=√(P²+Q²) and pf=cosφ, P₃φ=√3·VL·IL·cosφ, Ibase=Sbase/(√3·Vbase) and Zbase=Vbase²/Sbase), 16 citations, 5 image placeholders. Setting: Kaan's first entry into the OSS — Anders's opening question "what is 220 kV?" establishes the RMS hook. 16.1: sinusoidal AC from rotational geometry (Faraday), 50 Hz vs 60 Hz history (AEG vs Westinghouse), V_rms=V_peak/√2, insulation sized for 311 kV not 220 kV. 16.2: Steinmetz (born Breslau, fled 1888, AIEE paper July 1893, "simple problem of algebra"), phasor notation, j operator, complex power S=VI*, P vs Q distinction, cable reactive power bridge to Ch 20. 16.3: power triangle, pf=cosφ, lagging vs leading, MVA ratings, PSE ±0.225 pu reactive requirement (ENTSO-E NC RfG Type D), "I ♥ REACTIVE POWER" mug motif. 16.4: Dolivo-Dobrovolsky (1862-1919, AEG Frankfurt), Lauffen-Frankfurt 1891 (175 km, 15 kV, 75% efficiency, 24 Aug 1891), Brown/MFO Oerlikon, constant power of 3-phase, √3 factor derivation, star/delta, conductor saving 50%. 16.5: four voltage levels (0.69/66/220/400 kV), per-unit motivation, Sbase=500 MVA, Vbase per zone, derived Ibase/Zbase, transformer disappears in pu, base-change formula. Worked example: P=500 MW, pf=0.95 → S=526.3 MVA, Q=164.3 MVAR, IL=1,381 A → pu base at 220 kV (Ibase=1,312 A, Zbase=96.8 Ω) → cable Z=0.010+j0.044 pu, Ploss=5.4 MW (1.1%) → transformer X=0.28 pu on 500 MVA base. Bridges to Ch 17 (physical equipment: transformers, switchgear, protection relays). |
| 18 | 2026-03-24 | Ch 17 complete | ~6,500 | Ch 17 first draft: 5 sections + worked example, 6 display formulas (pi-model Zπ=(R+jωL)·L and Yπ/2, ampacity I=√(ΔΘ_max/R_ac·T_total), transformer T-equivalent Zeq=(R1+R2')+j(X1+X2'), short-circuit impedance Zsc,pu=Vsc/Vrated, peak fault current î_peak=κ√2·Isc, pi-model Qc=V²·ωCL/2), 11 citations, 5 image placeholders. Introduced Stefan Bauer (German GIS commissioning engineer, Siemens Energy, mid-forties, rubber flashlight, no metal in the GIS hall). 17.1: XLPE pi-model (distributed → lumped), submarine cable C=0.19-0.22 μF/km vs OHL 0.01 μF/km, XLPE history (GE 1963, Japan 1967 commercial). 17.2: IEC 60287 ampacity, Neher-McGrath 1957 AIEE Transactions (thermal circuit analogy: ΔΘ↔ΔV, Q↔I, T↔R), four thermal resistances T1-T4, seabed sediment thermal conductivity 0.5-2.0 W/(m·K) can shift rating 10-15%, cyclic loading (IEC 60853). 17.3: Transformer T-equivalent circuit — leakage reactance, magnetising branch (neglected in power system studies), Zsc,pu=0.12-0.16 pu, vector group Dyn11 for offshore (delta on 66 kV traps zero-sequence, earthed star on 220 kV provides neutral for export protection). 17.4: SF6 GIS — Moissan & Lebeau (1900, Comptes Rendus), electrical properties recognized 1940s, first commercial GIS 1966-1967 (Delle-Alsthom Fluobloc Paris + BBC Zurich), dielectric strength 2.5-3× air at 1 bar, GWP 24,300 (IPCC AR6 2021) vs AR5 23,500 vs AR4 22,800, EU F-Gas Regulation 2024/573, fluorine-free alternatives (g³, PURE AIR, N2/CO2). 17.5: IEC 62271 switchgear ratings — rated voltage 245 kV for 220 kV system (IEC 60038), insulation levels (1050 kV LIWV, 850 kV SIWV), rated current 2000 A, rated Isc 31.5 kA/80 kA peak, breaking time 60-80 ms. Worked example: 500 MW OSS — IL=1380 A (→2000 A GIS), I66=4600 A (→5000 A 66kV bus), preliminary Isc estimate 20-28 kA (→31.5 kA/80 kA), cable pi-model Qc=72 MVAR per half-shunt (144 MVAR total), transformer losses 750 kW (0.3%), GIS hall 160 m² vs AIS 4000 m² (~25× reduction). Closing narrative: transformer oil sampling valve more important than any relay; consequence chains revealed (cable capacitance → STATCOM → rating → pu impedance). Bridges to Ch 18 (Load Flow — trace 500 MW bus by bus). |
| 20 | 2026-03-24 | Ch 19 complete | ~6,000 | Ch 19 first draft: 5 sections + worked example, 6 display formulas (Z_k series assembly, I"k=c·V_n/(√3|Z_k|), κ=1.02+0.98e^(-3R/X), î_p=κ√2·I"k, I"k,SLG=√3·c·V_n/|2Z₁+Z₀|, I_sc,cable=k·S/√t), 6 citations, 4 image placeholders. IEC 60909-0:2016 (second edition, 2016; first 2001) equivalent voltage source method: c-factor 1.10, flat-start assumption, Thevenin network reduction. Fortescue (1876 York Factory Manitoba, Westinghouse East Pittsburgh, AIEE Atlantic City 28 June 1918, 48-page paper). 1965 Northeast Blackout (Sir Adam Beck No. 2, relay Q29BD, stale setting, 30M people dark, 12-min cascade). Symmetrical/asymmetrical fault types; DC offset and κ factor derivation; SLG fault uses Fortescue sequence networks (Z₁+Z₂+Z₀). Type 4 full-converter WTGs: current-limited to 1.0-1.2× rated (vs 5-10× for synch gen); reactive current priority under LVRT; converter dominates at 66 kV, PSE grid dominates at 220 kV. Equipment ratings: Icw (thermal), î_pk (mechanical), Isc (breaking) per IEC 62271-100:2021. IDMT relay curve (TMS·k/((I/Iset)^α-1)) introduced as concept; full treatment Ch 26. Worked example: 5-bus OSS, fault at 220 kV bus → I"k=4.73 kA, î_p=11.70 kA (κ=1.749, X/R=10.1) — margins 8.5× vs GIS ratings. Extension: 66 kV bus → I"k=12.49 kA, î_p=31.55 kA (κ=1.785, WTG 42% of total) — margins 4.0×. Introduced Sigrid Lund (Norwegian protection engineer). Bridges to Ch 20 (Ferranti effect + STATCOM — the locked door finally opens). |
| 19 | 2026-03-24 | Ch 18 complete | ~6,500 | Ch 18 first draft: 6 sections + worked example, 6 display formulas (Y-bus Y_ii=Σy_ij+y_sh and Y_ij=-y_ij, P injection P_i=V_iΣV_j(G_ij·cosθ_ij+B_ij·sinθ_ij), Q injection Q_i=V_iΣV_j(G_ij·sinθ_ij-B_ij·cosθ_ij), Newton-Raphson update J·[Δθ;ΔV/V]=[ΔP;ΔQ], DC approximation P_i≈ΣB'_ij(θ_i-θ_j), branch loss P_loss=G_ij(V_i²+V_j²-2V_iV_jcosθ_ij)), 7 citations, 4 image placeholders. 18.1: Bus types (Slack/PV/PQ) with historical arc: AC network analysers (MIT, GE, Westinghouse, late 1920s onward) → Ward & Hale 1956 (GE, first digital computer load flow, Gauss-Seidel) → Tinney & Hart 1967 (BPA, Newton-Raphson, quadratic convergence, 3-5 vs 50-100 iterations). 18.2: Y-bus construction — diagonal Y_ii sums all connected admittances + shunt, off-diagonal Y_ij = -y_ij. Computed Bus 3 diagonal (export cable + OSS transformer + shunt): Y_33 = 4.91-j28.61 pu. AC power flow equations — transcendental, nonlinear, no closed-form solution, must solve iteratively. 18.3: Newton-Raphson — Tinney/Hart 1967 at BPA, quadratic convergence demonstrated, Jacobian 4-subblock structure (∂P/∂θ, ∂P/∂V, ∂Q/∂θ, ∂Q/∂V), Tinney-Walker sparse ordering also 1967. 18.4: DC approximation — 3 assumptions (|V|=1, θ_ij small, G≈0), reduces to P=B'θ (linear, single solve), basis of ENTSO-E flow-based market coupling, fundamentally blind to reactive power. 18.5: What load flow reveals — Ferranti voltage profile (1.024 pu at OSS under full load, 1.052 at no load → STATCOM sizing), I²R loss formula, reactive power balance: cable charging 160 MVAR gross, 124 MVAR net to PSE slack. Worked example: 5-bus system (PSE slack/onshore PQ/OSS 220kV PQ/OSS 66kV PQ/WTG PV) — NR converges in 4 iterations from flat start, Bus 3 at 1.024 pu, total losses 9.8 MW (2%), 124 MVAR absorbed by PSE slack. Reactive balance table. 30-year export cable loss value EUR 64.8M. STATCOM door across corridor as chapter's closing symbol. Bridges to Ch 19 (short-circuit analysis). |
| 23 | 2026-03-24 | Ch 22 complete | ~6,000 | Ch 22 first draft: 6 sections + worked example, 6 display formulas (Q=P·tan(cos⁻¹(pf)), Q_max=P_n·tan(cos⁻¹(pf_min)), Q(V)=Q_ref−k_V·(V−V_ref), ΔP_LFSM-O=−P₀·(f−f₁)/(f_n·σ), ΔP_LFSM-U=+P_avail·(f₂−f)/(f_n·σ), Ṗ_up≤r_up·P_n and Ṗ_down≤r_down·P_n), 6 notes citations, 5 image placeholders. Part VI opens — Talking to the Grid. 22.1: 2006 European blackout (4 Nov 2006, Norwegian Pearl on Ems River, E.ON Netz Landesbergen-Wehrendorf 380 kV line, 22:10:11 CET, 17-second cascade, 10M+ homes, 9+ countries, cause: absent cross-TSO coordination). 22.2: three-level regulatory hierarchy (NC RfG EU 2016/631 in force 17 May 2016 → PSE IRiESP → Grid Connection Agreement). 22.3: Type D classification (≥75 MW Continental Europe or ≥110 kV; this farm 510 MW at 220 kV qualifies on both). 22.4: PQ capability — pf=0.95 at connection point, Q_max=164 MVAR required, ±170 MVAR available (6 MVAR margin); Q(V) droop mode (k_V) introduced. 22.5: LFSM-O (mandatory NC RfG, activates >50.2 Hz, 5% droop) and LFSM-U (PSE mandatory, <49.8 Hz); timescale contrast with synthetic inertia (Ch 25). 22.6: PSE IRiESP specifics — ramp up 10%Pn/min=50 MW/min, ramp down 20%Pn/min=100 MW/min, emergency 2%Pn/s=10 MW/s, setpoint ±5%Pn, ±2 MVAR reactive, PPC mandatory. 22.7 worked example: 5-requirement compliance matrix — voltage range PASS, reactive ±170 MVAR PASS, LFSM-O −60 MW at 50.5 Hz PASS, ramp rates PASS, frequency range PASS (WTG type cert), FRT → Ch 23. Fun fact: the 2006 blackout started with a cruise ship. Character: Anders leads ("Chapter 22 is his"). Bridge to Ch 23: FRT simulation, 200 data points in 150 ms, "half of them will surprise you." |
| 26 | 2026-03-25 | Ch 25 complete | ~6,000 | Ch 25 first draft: 6 sections + worked example, 6 display formulas (W_k=½Jω², H=W_k/S_n, swing equation (2H/fn)·df/dt=(Pm−Pe)/Sn, RoCoF₀=−fn·ΔPL/(2·H_sys·S_sys), ΔP_SI=(2H_SI·Sn/fn)·|df/dt|, ΔE_rotor=H_rotor·Sn·[1−(ω_min/ω₀)²], ΔPL,max=2·H_sys·S_sys·RoCoF_max/fn), 3 notes citations (Kundur 1994, Ofgem/ESO 2019, ENTSO-E 2022), 4 image placeholders. Opening: live PSE frequency event continuation from Ch 24 (Łagisza B trip 1,100 MW, nadir 49.67 Hz, recovery over 17 min). Introduced Piotr Zawadzki (PSE duty operator, Warsaw — voice on radio only). 25.1: H constant — Type 4 converter as "firewall"; rotor's kinetic energy locked behind converter without explicit control. H constant defined (seconds = how long machine could supply rated power from stored KE alone). 25.2: Swing equation → system RoCoF formula; three phases: inertial (0-2s), primary (2-30s), secondary (30s-15min). 25.3: GB 9 August 2019 event — Hornsea One (~737 MW) + Little Barford (~244 MW), RoCoF ~0.41 Hz/s, frequency 48.88 Hz, 1M customers ~45 min, LFDD. Root cause: no individual error — low-inertia system composition. Response: Enhanced Frequency Response + Dynamic Containment, ~£200M/yr. 25.4: Synthetic inertia control — ΔP_SI proportional to df/dt; rotor deceleration range ω_min=0.9ω₀; 503 MJ available from 34 turbines (= fully loaded Shinkansen N700 at 250 km/h). PSE mandatory H_SI≥4.0 s for Type D offshore. 25.5: Droop dead band ±100 mHz (PSE, tighter than NC RfG ±200 mHz); maximum tolerable loss formula; three timescales must all be present. 25.6: RoCoF protection evolution — legacy 0.5 Hz/s trip threshold became harmful in low-inertia grids; NC RfG/PSE withstand 2.0 Hz/s; 500 ms df/dt filter (noise vs response speed tension). Worked example: CE vs GB comparison — CE RoCoF=0.013 Hz/s (time to 49.8 Hz: 15.4 s), GB equivalent=0.41 Hz/s (0.49 s); farm SI contribution 1.1 MW vs 33.5 MW; ΔP_max 168,000 MW vs 4,800 MW. Bridge to Ch 26: "Tomorrow, Sigrid wants to walk you through the protection relay that was watching tonight — the one we just tested without testing it." |
| 25 | 2026-03-25 | Ch 24 complete | ~6,500 | Ch 24 first draft: 7 sections + worked example, 6 display formulas (P_avail=min(Cp·½ρπR²v³, Prated), P_ref,δ=P_avail−ΔP_reserve, |ΔP/Δt|≤r_ramp·Pn, P_i=P_target·P_avail,i/ΣP_avail,j, Q(V)=Q_ref−k_V·(V−V_ref)·Q_max, Q_WTG,i=(Q_cmd−Q_STATCOM)·P_avail,i/ΣP_avail,j), 6 notes citations, 5 image placeholders. 24.1: PPC history — Denmark TF 3.2.5 (2004, first active power setpoint requirement), Spain CECRE (2006–2007, 448 facilities, 23 CGC nodes, 12-s telemetry), NC RfG Article 22 (2016). Nov 2009: 53.7% Spanish demand from wind — proof of concept. 24.2: Three-level hierarchy (TSO → PPC → turbine) with timescales (minutes → seconds → milliseconds). 24.3: Four active power modes (POWER_REFERENCE, DELTA_CONTROL, ABSOLUTE_LIMITATION, RAMP_RATE_CONTROL). PSE ramp asymmetry: 10%/min up, 20%/min down, 2%Pn/s emergency. 24.4: Pro-rata dispatch — equal division fails → proportional allocation P_i=P_target·(P_avail,i/ΣP_avail,j). Self-balancing, fault-tolerant, minimises thermal cycling. 24.5: Reactive Q coordination — STATCOM primary (faster, no P penalty), WTG secondary; curtailment expands Q capacity (Q_avail=√(S²−P²)). 24.6: Seven-state PPC state machine (STOPPED, STARTING, AVAILABLE, RUNNING, DERATED, FAULT, EMERGENCY_STOP). 24.7: PSE compliance summary. Worked example: pro-rata dispatch at 430 MW target (34 turbines, unequal availability), reactive Q allocation. Introduced Rafael Díaz (PPC systems engineer, ex-REE Madrid/CECRE 2006–2010, framed "Por esto" photograph). Closing: live PSE frequency event begins (49.82 Hz, Łagisza B trip), synthetic inertia visible before LFSM-U → "Chapter 25." |
| 24 | 2026-03-25 | Ch 23 complete | ~6,000 | Ch 23 first draft: 6 sections + worked example, 6 display formulas (V_LVRT(t) piecewise 3-case, ΔIq=k·ΔV·In, I_total=√(Id²+Iq²)≤Imax, VDC,new=√(VDC,nom²+2·PMSC·t/CDC), E_chopper=PMSC,avg·t_fault, P(t)=Ppre·min(1,(t−t_clear)/t_rec)), 6 notes citations, 4 image placeholders. 23.1: FRT history — E.ON Netz 2003 Ergänzungsregeln (world first FRT mandate); September 23, 2003 Swedish/Danish blackout (4M people, Oskarshamn Unit 3 loss + Ringhals, 6,350 MW) as risk-scenario motivation (wind did NOT cause the blackout — post-event analysis showed wind tripping would amplify future faults). 23.2: PSE LVRT envelope (0.05 pu for 140 ms, recovery to 0.85 pu at 1,500 ms, 0.90 pu at 3,000 ms). 140 ms clearance time = worst-case backup protection at 220 kV. IEC 61400-21-1:2019 (NOT 2021 — 2021 is a national adoption). 23.3: HVRT 1.25 pu for 100 ms — DC chopper handles both directions of DC link overvoltage. 23.4: Reactive current injection k=2 (deadband 0.10-0.15 pu); at ΔV=0.95 pu: ΔIq=2,493 A=1.90·In — exceeds Imax → Id forced to zero; converter fully loaded by reactive current. Inner current loop: 250 µs sample period, 5 ms response — vs 5-second grid code requirement (5 orders of magnitude margin). 23.5: Type 4 DC chopper physics: MSC continues at 15 MW during fault, GSC cannot export → DC link would rise to 11,883 V without chopper. Chopper holds DC link at 1,150-1,200 V. E_chopper=1.89 MJ per turbine (13.5 MW avg × 0.14 s), 64 MJ farm total. No crowbar in Type 4 (no direct grid-rotor path). Active power recovery: NC RfG ≥90% in 1 s; ramp limiter suspended; aerodynamic constraint ~90 MW/s. 23.6: ANDES simulation narrative — reactive current leaps to 1.0 pu in 5 ms, DC link rises to 1,180 V, chopper duty cycle 40-60% at 3 kHz, active power recovers to 449 MW at t+1.0 s (89.8%, within ±1% tolerance). Worked example: In=1,312 A, ΔIq=2,493 A capped at Imax=1,312 A, Pd=0 MW during deep fault, E_chopper=64.3 MJ farm total. Bridge to Ch 24: PPC block diagram on screen — "STATE: RUNNING / ACTIVE MODE: POWER_REFERENCE / REACTIVE MODE: Q_V_DROOP." |
| 22 | 2026-03-24 | Ch 21 complete | ~6,500 | Ch 21 first draft: 5 sections + worked example, 6 display formulas (Fourier decomposition v(t)=V₀+ΣV_h√2·sin(hωt+φ_h), PWM sidebands h=nN±k, THD_V=√(ΣV_h²)/V₁×100%, resonant harmonic order h_r=√(S_sc/Q_c), long-term flicker P_lt=∛(ΣP_st,i³/N), farm flicker P_st,WF=c(ψk,va)·S_rated/(S_sc)·√N), 6 notes citations, 4 image placeholders. Part V closes — final chapter of the Electrical Engineering part. 21.1: Fourier 1807 memoir blocked by Lagrange → 1822 Théorie analytique de la chaleur. PWM switching at 2 kHz → sidebands at h=39,41,79,81. Triplen cancellation by 3-phase symmetry (free filter). MMC reduces high-order harmonics but leaves odd non-triplen low-order (5,7,11,13). 21.2: THD definition, IEC 61000-3-6:2008 Technical Report (HV planning levels: 2% at h=5, 2% at h=7, 1.5% at h=11, THDU≤3%). Square-root aggregation for uncorrelated sources — 34 turbines contribute √34×per-turbine, not 34×. 21.3: Harmonic impedance scan — |Z(h)| vs h, computed from Y-bus at h×f₁, identifies parallel resonance. 21.4: Cable-transformer resonance h_r=√(S_sc/Q_c) → for 500 MW/140 km/66 kV: h_r=10.5 → amplification at h=11. 0.9% per-turbine emission → 0.98% farm-level at 66 kV bus (4× |Z| amplification vs off-resonance). Mitigation options: passive filter, converter detuning, active filter, or accept+demonstrate. 21.5: Flicker history: arc furnaces 1905+ (Lindenberg), lights in steel towns. IEC 868 (1986), IEC 61000-4-15 (1997). EN 50160:2010 Pst≤1.0 and Plt≤1.0 at 95th percentile over 1 week. 3P tower shadow at 0.45 Hz (well below 8-10 Hz peak sensitivity). Type 4 DC-link decoupling. IEC 61400-21-1:2021 flicker coefficient. Worked example: 500 MW farm, compliance table: V5=0.75% (limit 2.0%), V7=0.40%, V11=0.98% (limit 1.5% — tightest), V13=0.10%, THDU=1.30%, Pst=0.007. 11th harmonic flagged as monitoring point. Introduced Ingrid Sørensen (Danish power quality specialist, late thirties, dark-framed glasses, laminated IEC table on clipboard, "The grid does not care what happens inside this building"). Part V → VI bridge: "That is the grid code. That is the contract. Chapter 22 is Anders's." Closing thought: "Clean enough, by agreement." |
