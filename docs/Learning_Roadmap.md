# Offshore Wind HV Control Engineer — Complete Learning Roadmap

## A Self-Study Curriculum with Trusted Academic & Professional Sources

**Purpose:** Step-by-step learning path to build all knowledge required to code, understand, and explain every component of the 5-project portfolio. Each topic includes what to learn, why it matters, and exactly where to learn it from reliable sources.

**How to use this document:** Follow the phases in order. Each phase builds on the previous one. Within each phase, topics can be studied in parallel. Time estimates assume ~2 hours/day of focused study.

---

## PHASE 0: ENGINEERING FOUNDATIONS (Weeks 1-3)

*Before touching any wind-specific content, ensure these fundamentals are solid.*

### 0.1 Power Systems Fundamentals

**What to learn:** AC circuit theory, phasor analysis, three-phase systems, per-unit system, power factor, real/reactive/apparent power, transformer theory, transmission line models (π-model).

**Why it matters:** Every calculation in P2 (grid integration) relies on these fundamentals. If you don't understand per-unit, you can't read load flow results. If you don't understand reactive power, STATCOM sizing makes no sense.

**Trusted Sources:**

| Resource | Type | Coverage | Access |
|----------|------|----------|--------|
| Glover, Sarma, Overbye — *Power Systems Analysis and Design* (7th Ed.) | Textbook | Chapters 1-6: Complete AC power systems foundation | University library / purchase |
| Kundur — *Power System Stability and Control* | Textbook (classic) | Chapters 1-4: System modeling fundamentals | University library / IEEE Xplore |
| MIT OCW 6.061/6.690 — *Introduction to Electric Power Systems* | Online course (free) | Full semester: AC circuits → power flow | ocw.mit.edu |
| NPTEL — Power System Analysis (IIT Kharagpur) | Video lectures (free) | 40 lectures covering full curriculum | nptel.ac.in / YouTube |
| Pandapower Tutorials | Interactive notebooks | Learn-by-doing power flow tutorials | pandapower.readthedocs.io/en/latest/tutorials.html |

**Key concepts to verify understanding:**
- [ ] Can you explain why a 45 km submarine cable generates reactive power? (Hint: capacitance per km)
- [ ] Can you calculate short-circuit current at a busbar using IEC 60909 method?
- [ ] Can you explain the difference between symmetrical and asymmetrical fault current?
- [ ] Can you explain per-unit system and why we use it?

### 0.2 Python for Engineering

**What to learn:** NumPy (array operations, linear algebra), Pandas (time-series data), Matplotlib/Plotly (visualization), SciPy (optimization, signal processing), xarray (NetCDF climate data).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| *Python for Data Analysis* — Wes McKinney (3rd Ed., 2022) | Book | O'Reilly / purchase |
| Real Python — NumPy Tutorial | Tutorial (free) | realpython.com/numpy-tutorial-python/ |
| Xarray Documentation — Getting Started | Tutorial (free) | docs.xarray.dev/en/stable/getting-started-guide/ |
| SciPy Lecture Notes | Online course (free) | scipy-lectures.org |

### 0.3 Web Development Foundations

**What to learn:** TypeScript basics, React 18 fundamentals (hooks, state management), REST API design, FastAPI basics, WebSocket protocol.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| FastAPI Official Tutorial | Documentation (free) | fastapi.tiangolo.com/tutorial/ |
| React Official Tutorial (new docs) | Documentation (free) | react.dev/learn |
| TypeScript Handbook | Documentation (free) | typescriptlang.org/docs/handbook/ |
| *Designing Data-Intensive Applications* — Martin Kleppmann | Book | O'Reilly — for database/architecture decisions |

---

## PHASE 1: WIND ENERGY FUNDAMENTALS (Weeks 4-7)

### 1.1 Wind Resource Assessment

**What to learn:** Atmospheric boundary layer, wind shear profiles (power law, logarithmic), Weibull distribution fitting, wind rose analysis, long-term correction (MCP methods), measurement uncertainty, ERA5 reanalysis data.

**Trusted Sources:**

| Resource | Type | Coverage | Access |
|----------|------|----------|--------|
| DTU Wind Energy — *Introduction to Wind Energy* (Coursera) | MOOC (free audit) | Complete wind resource curriculum | coursera.org |
| Manwell, McGowan, Rogers — *Wind Energy Explained* (3rd Ed.) | Textbook (definitive) | Chapters 2-3: Wind characteristics & resource | University library / Wiley |
| Burton et al. — *Wind Energy Handbook* (3rd Ed., 2021) | Textbook (reference) | Chapters 1-4: Wind resource, aerodynamics | Wiley |
| ECMWF ERA5 Documentation | Technical docs (free) | Data structure, variables, download API | confluence.ecmwf.int/display/CKB/ERA5 |
| Copernicus Climate Data Store Tutorials | Practical guides (free) | How to download and process ERA5 data | cds.climate.copernicus.eu |
| IEA Wind TCP Task 36 — Forecasting | Reports (free) | State-of-the-art wind energy forecasting | iea-wind.org/task36/ |

**Key academic papers:**

1. **Bastankhah, M. & Porté-Agel, F. (2014).** "A new analytical model for wind-turbine wakes." *Journal of Fluid Mechanics*, 781, 706-730. DOI: 10.1017/jfm.2014.604
   - *Why read this:* The BPA wake model used in PyWake. Understanding the Gaussian deficit model is essential.

2. **Nygaard, N.G. et al. (2020).** "Modelling cluster wakes and wind farm blockage." *Journal of Physics: Conference Series*, 1618. DOI: 10.1088/1742-6596/1618/6/062072
   - *Why read this:* Wind farm blockage is a GAP in v1.0. This paper quantifies the effect.

3. **Barthelmie, R.J. et al. (2009).** "Modelling and measuring flow and wind turbine wakes in large wind farms offshore." *Wind Energy*, 12(5), 431-444. DOI: 10.1002/we.348
   - *Why read this:* Validation of wake models against Horns Rev measurements.

### 1.2 Wake Modelling & Layout Optimization

**What to learn:** Jensen/Park model, Bastankhah-Porté-Agel Gaussian model, Fuga linearized CFD, superposition models (linear sum, max deficit), turbulence models, layout optimization algorithms (genetic algorithm, differential evolution).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| PyWake Documentation (DTU Wind Energy) | Software docs + examples (free) | py-wake.readthedocs.io |
| DTU Wind Energy — *Wake Modelling and Simulation* (YouTube) | Video lectures (free) | DTU YouTube channel |
| TOPFARM Documentation (DTU) | Optimization framework docs (free) | topfarm.pages.windenergy.dtu.dk |
| IEC 61400-12-1:2017 | Standard | Power performance testing methodology |
| *Optimization in Practice with MATLAB* — Messac | Textbook | Differential evolution algorithm details |

**Hands-on exercise:** Download ERA5 data for Polish Baltic Sea region (55.0°N, 16.5°E), calculate Weibull parameters, create wind rose, and run PyWake with BPA model. Compare with Jensen. This directly produces P1 content.

### 1.3 Energy Yield & Financial Analysis

**What to learn:** Gross-to-net energy cascade, availability models (failure rates, MTTR, access constraints), P50/P75/P90 exceedance calculations, LCOE methodology, CfD mechanisms, WACC, sensitivity analysis.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| BVG Associates — *Guide to an Offshore Wind Farm* (2024 update) | Industry report (free) | bvgassociates.com — THE reference for OWF economics |
| IRENA — *Renewable Power Generation Costs 2024* | Report (free) | irena.org/publications |
| IEC 61400-26-1:2019 | Standard | Availability for wind power stations |
| DNV — *Energy Production Assessments* methodology | Technical standard | dnv.com (summary available publicly) |

**Key concept:** The difference between P50 and P90 AEP determines project bankability. Lenders typically require P90 for debt sizing. A 6% combined uncertainty means P90 is ~8% below P50 — for a 500 MW farm, that's ~€12M/year revenue difference.

---

## PHASE 2: HV ELECTRICAL ENGINEERING (Weeks 8-13)

### 2.1 High Voltage Equipment & Insulation

**What to learn:** GIS (gas-insulated switchgear) technology, SF6 properties and alternatives, circuit breaker operating principles (vacuum, SF6 puffer), disconnectors, earthing switches, current/voltage transformers (conventional + NCIT), cable technology (XLPE).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Küchler — *High Voltage Engineering* | Textbook (definitive) | Springer — comprehensive HV reference |
| Ryan — *High Voltage Engineering and Testing* (3rd Ed.) | Textbook | IET Press |
| IEC 62271-100:2021 | Standard | AC circuit breakers — switching capacity, TRV |
| IEC 62271-200:2021 | Standard | AC metal-enclosed switchgear (MV) |
| IEC 62271-203:2022 | Standard | Gas-insulated metal-enclosed switchgear (GIS) |
| Siemens — *HV Power Products* technical papers | White papers (free) | siemens-energy.com (publicly available) |
| Hitachi Energy — *Buyer's Guide* for GIS | Product documentation (free) | hitachienergy.com |

### 2.2 Power System Protection

**What to learn:** Protection philosophy, relay types (overcurrent, distance, differential, directional), time grading, zone coordination, breaker failure relay, auto-reclose, CT/VT requirements for protection, protection coordination studies.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Blackburn & Domin — *Protective Relaying: Principles and Applications* (4th Ed.) | Textbook (definitive) | CRC Press |
| Anderson — *Power System Protection* | Textbook | IEEE Press / Wiley |
| IEC 60255 series | Standards | Protection relay requirements |
| IEC 60909-0:2016 | Standard | Short-circuit current calculation method |
| GE Grid Solutions — *Protection & Automation Application Guide* (PAAG) | Free reference book | Available online — comprehensive practical guide |
| SEL (Schweitzer Engineering Labs) — University Program Resources | Tutorials + videos (free) | selinc.com/solutions/educational/ |

**Key academic paper:**

4. **Jankovic, Z. et al. (2021).** "Protection challenges in offshore wind farm collection systems." *Electric Power Systems Research*, 196. DOI: 10.1016/j.epsr.2021.107261
   - *Why read this:* Specific protection challenges for offshore arrays including directional overcurrent and string protection.

### 2.3 FACTS Devices (STATCOM/SVC)

**What to learn:** Reactive power compensation theory, SVC operating principles (TCR/TSC), STATCOM operating principles (VSC-based), V-I characteristic, dynamic response, offshore application considerations.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Hingorani & Gyugyi — *Understanding FACTS* | Textbook (classic, definitive) | IEEE Press / Wiley |
| Mohan, Undeland, Robbins — *Power Electronics* | Textbook | Wiley — VSC converter fundamentals |
| Acha et al. — *FACTS: Modelling and Simulation in Power Networks* | Textbook | Wiley |
| CIGRE Technical Brochure 144 — *Static Synchronous Compensator* | Technical report | CIGRE (membership or library) |

### 2.4 Grid Codes & Compliance

**What to learn:** ENTSO-E RfG (Requirements for Generators), PSE IRiESP structure, FRT requirements (LVRT + HVRT), frequency response (LFSM-O, LFSM-U, FSM), reactive power capability (P-Q diagram), power quality requirements.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| ENTSO-E — *Network Code on Requirements for Generators (RfG)* | EU Regulation 2016/631 | eur-lex.europa.eu (free, full text) |
| ENTSO-E — *Implementation Guidance Documents for RfG* | Technical guidance (free) | entsoe.eu/network-codes/ |
| PSE — *IRiESP* (full text in Polish + English summary) | Grid code | pse.pl/documents/ |
| Wu et al. (2024) — *Grid Integration of Offshore Wind Power* | NREL Technical Report | nrel.gov/docs/fy24osti/87512.pdf (free) |
| CIGRE WG B4.62 — *Connection of Wind Farms to Weak AC Networks* | Technical brochure | CIGRE |

**Key academic papers:**

5. **Wu, C. et al. (2024).** "Grid Integration of Offshore Wind Power: Standards, Control, Power Quality and Transmission." *IEEE Open Access Journal of Power and Energy*. DOI: 10.1109/OAJPE.2024.3351091
   - *Why read this:* Comprehensive 2024 survey covering ALL grid integration topics. Excellent overview paper.

6. **Ackermann, T. (ed.) — *Wind Power in Power Systems* (2nd Ed.)** Wiley, 2012.
   - *Why read this:* The definitive textbook on wind power grid integration. Covers all aspects from individual turbine to system-wide impact.

### 2.5 Subsea Cable Engineering

**What to learn:** XLPE cable construction, cable rating calculations (IEC 60287), thermal modeling, cable laying and burial, cable protection, dynamic cables (for floating wind), cable testing (HV withstand, PD).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 60287 series | Standard | Current rating of electric cables |
| IEC 60228:2023 | Standard | Conductors of insulated cables |
| IEC 60840:2020 | Standard | Power cables with extruded insulation (30-150 kV) |
| IEC 62067:2022 | Standard | Power cables (150-500 kV) |
| CIGRE TB 610 — *Offshore Generation Cable Connections* | Technical brochure | CIGRE |
| Worzyk — *Submarine Power Cables* (2nd Ed.) | Textbook | Springer — THE submarine cable reference |

---

## PHASE 3: SCADA & INDUSTRIAL AUTOMATION (Weeks 14-18)

### 3.1 IEC 61850 — The Standard

**What to learn:** Data model concept (Physical Device → Logical Device → Logical Node → Data Object → Data Attribute), ACSI services, MMS mapping, GOOSE messaging, Sampled Values (SV), SCL file structure (SSD, ICD, SCD, CID), Edition 2.1 enhancements.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 61850 series (Parts 1-10, plus 7-x and 8-x) | Standards | IEC webstore (purchase) |
| Brand — *The MMS Guide for Substation Communications* | Book | In-house publication — detailed MMS reference |
| Mackiewicz — *Overview of IEC 61850 and Benefits* | Conference paper | IEEE PSPE (freely cited) |
| IEC Academy — *IEC 61850 Foundation Course* | Online course | academy.iec.ch |
| UCA International Users Group — Testing procedures | Technical documents | ucaiug.org |
| libiec61850 Open Source Library | Software (free) | github.com/mz-automation/libiec61850 |
| Hitachi Energy — *IEC 61850 Knowledge Base* | Technical articles (free) | hitachienergy.com |

**Key academic papers:**

7. **Apostolov, A. (2020).** "IEC 61850 Edition 2 and Its Impact on the Interoperability of Protection and Automation Systems." *PAC World Magazine*.
   - *Why read this:* Practical implications of edition changes on real systems.

8. **Kim, D. et al. (2017).** "Communication Architecture for Grid Integration of Cyber Physical Wind Energy Systems." *Applied Sciences*, 7(10), 1034. DOI: 10.3390/app7101034
   - *Why read this:* IEC 61850 applied specifically to wind energy systems.

### 3.2 IEC 60870-5-104 — SCADA Protocol

**What to learn:** Information object structure, ASDU types, cause of transmission, balanced/unbalanced modes, time tagging, redundancy groups, differences from IEC 61850 MMS.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 60870-5-104:2006+AMD1:2016 | Standard | IEC webstore |
| Clarke et al. — *Practical Modern SCADA Protocols* | Textbook | Newnes/Elsevier |
| lib60870 Open Source Library | Software (free) | github.com/mz-automation/lib60870 |

### 3.3 Cybersecurity — IEC 62443

**What to learn:** Zone and conduit model, security levels (SL1-SL4), foundational requirements (FR), system requirements (SR), RBAC implementation, network segmentation, defense in depth, industrial firewall configuration, IDS/IPS for OT networks.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 62443 series (Parts 1-1 through 4-2) | Standards | IEC webstore |
| NIST SP 800-82 Rev. 3 — *Guide to OT Security* | Government guideline (free) | nist.gov/publications |
| ISA/IEC 62443 Cybersecurity Certificate Program | Certification course | isa.org |
| CISA — *ICS-CERT Advisories and Guides* | Security advisories (free) | cisa.gov/ics |
| Knapp & Langill — *Industrial Network Security* (3rd Ed.) | Textbook | Syngress/Elsevier |

### 3.4 HMI Design for Control Rooms

**What to learn:** Situation awareness principles, alarm management (ISA-18.2/IEC 62682), HMI design standards (ISA-101), color coding for safety-critical systems, information density, abnormal situation management.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| ISA-101.01-2015 — *Human Machine Interfaces* | Standard | ISA (purchase) |
| EEMUA 191 — *Alarm Systems* | Industry guide | EEMUA (purchase, widely referenced) |
| ASM Consortium — *Effective Console Operator HMI Design* | Best practice guide | asmconsortium.net |
| Hollifield & Habibi — *The High Performance HMI Handbook* | Book | PAS / practical HMI design reference |

---

## PHASE 4: MACHINE LEARNING FOR ENERGY (Weeks 19-23)

### 4.1 Time-Series Forecasting Fundamentals

**What to learn:** Stationarity, autocorrelation, decomposition, cross-validation for time-series (NEVER shuffle), feature engineering for temporal data, evaluation metrics (RMSE, MAE, MAPE, coverage probability).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Hyndman & Athanasopoulos — *Forecasting: Principles and Practice* (3rd Ed.) | Online textbook (free) | otexts.com/fpp3/ — THE forecasting reference |
| scikit-learn Time Series Split documentation | Software docs (free) | scikit-learn.org |
| Makridakis et al. — *Forecasting: Methods and Applications* | Textbook (classic) | Wiley |

### 4.2 Gradient Boosting (XGBoost)

**What to learn:** Decision tree ensembles, gradient boosting theory, hyperparameter tuning (learning rate, max_depth, n_estimators, regularization), feature importance (gain, cover, SHAP), early stopping.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Chen & Guestrin (2016) — *XGBoost: A Scalable Tree Boosting System* | Original paper | arxiv.org/abs/1603.02754 |
| XGBoost Documentation | Software docs (free) | xgboost.readthedocs.io |
| Lundberg & Lee (2017) — *SHAP Values* | Paper | arxiv.org/abs/1705.07874 |
| SHAP Documentation | Software docs (free) | shap.readthedocs.io |

### 4.3 Deep Learning for Sequences (LSTM, Transformer)

**What to learn:** RNN fundamentals, LSTM architecture (forget/input/output gates), sequence-to-sequence models, attention mechanism, Transformer architecture, Temporal Fusion Transformer (TFT).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Goodfellow, Bengio, Courville — *Deep Learning* | Textbook (free online) | deeplearningbook.org |
| Hochreiter & Schmidhuber (1997) — *Long Short-Term Memory* | Original LSTM paper | doi.org/10.1162/neco.1997.9.8.1735 |
| Lim et al. (2021) — *Temporal Fusion Transformers* | TFT paper | arxiv.org/abs/1912.09363 |
| Stanford CS229 Machine Learning | Online course (free) | cs229.stanford.edu |
| fast.ai Practical Deep Learning | Online course (free) | course.fast.ai |
| TensorFlow Time Series Tutorial | Tutorial (free) | tensorflow.org/tutorials/structured_data/time_series |

### 4.4 Wind Power Forecasting — Domain-Specific

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEA Wind TCP Task 36 — *Forecasting for Wind Power* | Reports (free) | iea-wind.org/task36/ |
| Hong et al. (2020) — *Energy Forecasting: A Review* | Survey paper | DOI: 10.1016/j.apenergy.2019.114131 |
| Zhang et al. (2019) — *Review on probabilistic forecasting of wind power* | Survey paper | DOI: 10.1016/j.rser.2019.05.026 |

**Key academic papers:**

9. **Sweeney, C. et al. (2020).** "The future of forecasting for renewable energy." *WIREs Energy and Environment*, 9(2), e365. DOI: 10.1002/wene.365
   - *Why read this:* Comprehensive review of wind power forecasting methods and future directions.

10. **Lim, B. et al. (2021).** "Temporal Fusion Transformers for interpretable multi-horizon time series forecasting." *International Journal of Forecasting*, 37(4). DOI: 10.1016/j.ijforecast.2021.03.012
    - *Why read this:* State-of-the-art architecture for multi-horizon forecasting with built-in interpretability.

---

## PHASE 5: COMMISSIONING & OPERATIONS (Weeks 24-27)

### 5.1 HV Switching & Safety

**What to learn:** Switching programme methodology, Person in Control authority structure, LOTO procedures, voltage absence proving (VAP), safety distances, arc flash hazard analysis, emergency procedures.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 61936-1:2021 | Standard | Power installations exceeding 1 kV AC — operation |
| GWO (Global Wind Organisation) — HV Module | Certification training | gwo.org — HV safety training |
| HSE (UK) — *Electricity at Work Regulations 1989* | Regulation (free) | hse.gov.uk |
| NFPA 70E — *Standard for Electrical Safety in the Workplace* | Standard | nfpa.org (US reference, principles apply globally) |
| Distribution Code Review Panel — *Safety Rules* | Industry practice | Various utility publications |

### 5.2 Offshore Operations & Logistics

**What to learn:** SOV/CTV vessel operations, weather windows (Hs limits), crew transfer procedures, offshore survival training (GWO BST), maintenance strategies (time-based, condition-based, predictive).

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| GWO — Basic Safety Training (BST) modules | Certification | gwo.org |
| DNV-ST-0145 — *Offshore Substations* | Design standard | dnv.com |
| G+ Global Offshore Wind Health and Safety Organisation | Reports (free) | gplusoffshorewind.com |
| ORE Catapult — O&M research publications | Research reports (free) | ore.catapult.org.uk |

### 5.3 Testing & Commissioning

**What to learn:** FAT (Factory Acceptance Test) procedures, SAT (Site Acceptance Test) procedures, protection relay secondary injection, primary injection, transformer testing (ratio, insulation, DGA), cable testing (HV withstand, PD), SCADA point-to-point verification.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| IEC 62271-100:2021 | Standard | Circuit breaker testing requirements |
| IEC 60076-1:2011 | Standard | Power transformer general requirements |
| IEC 60060-1:2010 | Standard | HV test techniques — general definitions |
| IEC 61850-10:2012 | Standard | Conformance testing for IEC 61850 |
| CIGRE TB 380 — *HVDC Testing* | Technical brochure | CIGRE |
| Omicron Academy — Protection Testing courses | Online courses (some free) | omicronenergy.com |

---

## PHASE 6: ADVANCED TOPICS (Weeks 28-32)

### 6.1 HVDC Transmission

**What to learn:** VSC-HVDC principles, MMC (Modular Multilevel Converter) topology, HVDC control (P-V, P-Q modes), MTDC (multi-terminal DC) systems, DC cable design, HVDC protection, grid-forming HVDC.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Sharifabadi et al. — *Design, Control and Application of Modular Multilevel Converters for HVDC* | Textbook | Wiley / IEEE Press (2016) |
| Iowa State University — HVDC Learning Modules | Online modules (free) | engineering.iastate.edu/~jdm/hvdclearn/ |
| CIGRE TB 604 — *Guide for the Development of Models for HVDC Converters in a HVDC Grid* | Technical brochure | CIGRE |
| Ahmad et al. (2025) — *Overview of VSC-HVDC Systems* | Review paper | DOI: 10.1155/er/8644219 |

**Key academic papers:**

11. **Klein et al. (2025).** "HVDC System Energization via Grid-forming Offshore Wind Turbines." *IET Renewable Power Generation*. DOI: 10.1049/rpg2.70068
    - *Why read this:* Cutting-edge research on black start via GFM wind turbines through HVDC.

12. **Nature Scientific Reports (2025).** "Enhancing stability in renewable energy transmission using multi-terminal HVDC systems with grid-forming controls." DOI: 10.1038/s41598-025-10046-6
    - *Why read this:* GFM vs GFL control comparison for MTHVDC — directly relevant to future offshore wind.

### 6.2 Grid-Forming Inverter Technology

**What to learn:** Grid-following vs grid-forming control, virtual synchronous machine (VSM), droop control, synthetic inertia, frequency support, islanding capability, black start.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| NREL — *Grid-Forming Inverters* research | Reports (free) | nrel.gov — search "grid forming" |
| MIGRATE Project — EU research project | Reports (free) | Massive integration of power electronic devices |
| National Grid ESO (UK) — *GC0137 Grid-Forming Requirements* | Grid code development | nationalgrideso.com |
| Unruh et al. (2020) — *Overview on Grid-Forming Inverter Control Methods* | Survey paper | DOI: 10.3390/en13102589 |

### 6.3 Digital Twin Technology

**What to learn:** Digital twin concept (asset model + data integration + analytics), OPC-UA communication, Unity3D or Three.js visualization, predictive maintenance algorithms, real-time data integration.

**Trusted Sources:**

| Resource | Type | Access |
|----------|------|--------|
| Springer — *Predictive digital twin for offshore wind farms* (2023) | Journal paper (open access) | DOI: 10.1186/s42162-023-00257-4 |
| Tao et al. (2019) — *Digital Twin in Industry* | Survey paper | DOI: 10.1016/j.jmsy.2019.10.001 |
| OPC Foundation — OPC-UA Specification | Standard (free) | opcfoundation.org |
| Three.js Documentation | Software docs (free) | threejs.org |

---

## QUICK REFERENCE: TOP 15 ACADEMIC PAPERS FOR THIS PROJECT

| # | Authors | Title | Year | Journal | Relevance |
|---|---------|-------|------|---------|-----------|
| 1 | Bastankhah & Porté-Agel | New analytical model for wind-turbine wakes | 2014 | J. Fluid Mech. | P1: Wake model |
| 2 | Nygaard et al. | Modelling cluster wakes and wind farm blockage | 2020 | J. Phys.: Conf. Ser. | P1: Blockage |
| 3 | Wu et al. | Grid Integration of Offshore Wind Power | 2024 | IEEE OAJPE | P2: Grid codes |
| 4 | Jankovic et al. | Protection challenges in OWF collection systems | 2021 | EPSR | P2: Protection |
| 5 | Kim et al. | Communication Architecture for CPS Wind Systems | 2017 | Applied Sciences | P3: IEC 61850 |
| 6 | Apostolov | IEC 61850 Edition 2 Impact | 2020 | PAC World | P3: Standard update |
| 7 | Lim et al. | Temporal Fusion Transformers | 2021 | Int. J. Forecasting | P4: Forecasting |
| 8 | Chen & Guestrin | XGBoost: Scalable Tree Boosting | 2016 | KDD | P4: ML model |
| 9 | Sweeney et al. | Future of forecasting for renewable energy | 2020 | WIREs E&E | P4: Survey |
| 10 | Hong et al. | Energy forecasting review | 2020 | Applied Energy | P4: Methods |
| 11 | Klein et al. | HVDC Energization via GFM Wind Turbines | 2025 | IET RPG | Advanced: HVDC |
| 12 | Ahmad et al. | VSC-HVDC Systems Overview | 2025 | IJER | Advanced: HVDC |
| 13 | Hingorani & Gyugyi | Understanding FACTS | 2000 | IEEE Press (Book) | P2: STATCOM |
| 14 | Kundur | Power System Stability and Control | 1994 | McGraw-Hill (Book) | Foundation |
| 15 | Ackermann (ed.) | Wind Power in Power Systems | 2012 | Wiley (Book) | All projects |

---

## CERTIFICATION ROADMAP (Parallel Track)

| Timeline | Certification | Provider | Cost Estimate | Priority |
|----------|--------------|----------|--------------|----------|
| Month 1-2 | GWO Basic Safety Training (BST) | Authorized GWO center | ~€2,000 | **Critical** (required for offshore access) |
| Month 3-4 | GWO HV Module | Authorized GWO center | ~€1,500 | **Critical** |
| Month 5-8 | IEC 62443 Cybersecurity Fundamentals | ISA / IEC Academy | ~€1,200 | High |
| Month 6-12 | NEBOSH General Certificate | NEBOSH | ~€1,500 | Medium |
| Month 8-12 | DIgSILENT PowerFactory User Training | DIgSILENT GmbH | ~€2,500 | Medium |
| Month 12-18 | Omicron Protection Testing Certificate | Omicron Academy | ~€2,000 | Medium |

---

## ONLINE COMMUNITIES & STAYING CURRENT

| Community | Platform | Why Join |
|-----------|----------|----------|
| r/windpower, r/energy | Reddit | General discussion, news |
| Offshore Wind Power (LinkedIn Group) | LinkedIn | Industry networking, job postings |
| IEC 61850 (LinkedIn Group) | LinkedIn | Technical discussion on standard |
| PyWake GitHub Discussions | GitHub | Technical support from DTU |
| Pandapower GitHub Discussions | GitHub | Power system modeling community |
| WindEurope Annual Event | Conference | THE European offshore wind conference |
| Offshore Wind Journal | Publication | offshorewindjournal.com |
| 4C Offshore | Database | Market intelligence and project tracking |
| GWEC — Global Wind Report | Annual report | gwec.net — global market statistics |

---

*This learning roadmap covers approximately 32 weeks of self-study at ~2 hours/day. Combined with concurrent coding of the 5-project portfolio, the total timeline to completion is approximately 6-9 months. Each phase builds on the previous one, creating a compound learning effect where theoretical knowledge is immediately applied in code.*

*Version 2.0 — February 2026*
