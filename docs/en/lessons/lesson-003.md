# Lesson 003 — Preliminary Design Decisions: Location, Turbine, Capacity, Area and Grid Integration

!!! abstract "Course Navigation"
:material-arrow-left: **Previous:** [Lesson 002 — Internationalization](lesson-002.md) | **Next:** [Lesson 004 — Database, ERA5 & Weibull](lesson-004.md) :material-arrow-right:

**Phase:** P1 | **Language:** Turkish | **Progress:** 4 / 5 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-24
> **Phase:** P1 (Wind Resource & AEP) — ​​Preliminary Preparation
> **Roadmap sections:** [Section 1.3 Reference Wind Farm Specification, Section 1.4 Industry Context]
> **Language:** Turkish

---

## What You Will Learn

- What physical, economic and regulatory criteria are based on location selection for offshore wind farm projects?
- Why 15 MW class turbines are the industry standard of the 2024-2026 period and their historical development process
- The relationship between wind farm capacity and the number of turbines and the concept of "training scale"
- How the total farm area is determined by turbine spacing calculation
- Physical basis of engineering decision between HVAC and HVDC transmission technologies
- Why integration into the 400 kV national grid necessitates STATCOM, FRT and grid code requirements

---

## Part 1: Why the Baltic Sea?

### A Real Life Problem

The first question to answer before starting an offshore wind farm project is: **where will we build?** This question seems simple at first glance, like “wherever the wind blows”. However, in reality, location selection; It is the intersection of dozens of parameters such as wind resource, water depth, seabed geology, maritime traffic, environmental protection areas, distance to shore, grid connection point and country regulatory framework.

### Physics: Wind Source Comparison

Average wind speeds across European seas vary significantly:

| Deniz | Average Wind Speed ​​(100 m) | Capacity Factor | Feature |
| ------- | ------------------------------- | ------------------- | --------- |
| **North Sea** (UK-NL-DE) | 9.5–11.0 m/s | %48–55 | Highest resource, but deep water and rough wave conditions |
| **Baltic Sea** (PL-SE-DK-FI) | 8.5–10.0 m/s | %42–50 | Good resource, shallow water, calm wave, thriving market |
| **Mediterranean** (GR-IT-FR) | 7.0–8.5 m/s | %30–38 | Deep water, floating technology required |
| **Irish Sea** | 9.0–10.5 m/s | %45–52 | Good resource but limited grid capacity |

In our reference area (55.0°N–55.5°N, 16.5°E–17.5°E) within the Polish Exclusive Economic Zone (EEZ) of the Baltic Sea, the average wind speed at 100 m altitude is in the range **8.8–9.3 m/s** according to ERA5 reanalysis data. Extrapolated to a hub height of 150 m using the power law profile, this value reaches **9.0–9.5 m/s** — meaning a capacity factor of 45–50%.

!!! info "What is ERA5 Reanalysis Data?"
ERA5 is a global atmospheric reanalysis dataset produced by the European Center for Medium-Range Weather Forecasts (ECMWF). It includes wind, temperature, pressure, and many other atmospheric variables on a 0.25° × 0.25° (~25 km) spatial grid at hourly resolution from 1940 to the present. In offshore wind projects, meteorological mast (met-mast) data provides verification specific to the project site, while ERA5 forms the basis of 20+ year long-term statistics.

### Water Depth and Ground Conditions

Water depth directly determines the type of foundation and therefore the capital cost (CAPEX) of the project:

| Water Depth | Foundation Type | Cost Impact |
| ------------- | ------------ | ---------------- |
| 0–30 m | Monopile (single pile) | Lowest cost, proven technology |
| 25–50 m | Monopile or Jacket (lattice structure) | Medium cost, bordering on monopile for 15 MW class |
| 40–60 m | Jacket | Preference for high cost, heavy turbines |
| >60 m | Floating platform | Highest cost at commercial maturity stage |

In our reference area, water depth is in the range of **25–40 m**. This is a range where monopile (XXL monopile, diameter 10–12 m) technology is applicable for 15 MW class turbines. The shallower nature of the Baltic Sea compared to the North Sea significantly reduces foundation costs.

### Wave Conditions

Another advantage of the Baltic Sea is wave height:

| Parameters | North Sea | Baltic Sea |
| ----------- | ------------- | --------------- |
| Significant wave height (Hs, annual average) | 1.5–2.5 m | 0.8–1.5 m |
| 50 year maximum Hs | 12–15 m | 7–9 m |
| Installation window (Hs < 1.5 m) | ~180 days per year | ~220 days per year |

Calmer wave conditions provide a larger weather window for turbine installation operations. This shortens installation time and reduces jack-up ship (installation ship) rental costs.

### Ice Conditions

Sea ice may form in the northern parts of the Baltic Sea (Finland, northern Sweden) during the winter months. However, due to the southern Baltic location of the Polish EEZ, the risk of ice formation is low. However, ice load analysis is a standard requirement under IEC 61400-1 Annex E (environmental conditions). There is no serious ice risk in our reference area.

### Poland's Energy Policy: PEP2040

The Polish Energy Policy 2040 (PEP2040 — Polityka Energetyczna Polski do 2040 roku) has set the following targets for offshore wind energy:

| Aim | Capacity |
| ------- | ---------- |
| 2028 (first wave) | ~3.5 GW |
| 2030 | 5.9 GW |
| 2035 | ~8–9 GW |
| 2040 | 11 GW |

These targets are a central pillar of Poland's coal-to-renewable energy transition strategy. By 2025-2026, construction of the first wave of projects has actually started — creating direct employment demand for offshore wind engineers.

### Why This Location?

Reasons why we chose our reference area (north of Ustka, ~40 km offshore):

1. **Actual project proximity:** Polish offshore wind projects currently under construction are located in this region
2. **ERA5 data quality:** 20+ years of reliable wind data available at 0.25° resolution
3. **Water depth suitability:** 25–40 m, compatible with monopile foundation technology
4. **Distance to shore:** ~40–50 km — in the optimal range for HVAC transmission technology (we will discuss this in detail in Chapter 6)
5. **Grid connection:** The reach of the 400 kV transmission lines of PSE (Polskie Sieci Elektroenergetyczne) on the Baltic coast is reasonable

!!! tip "Engineering Principle: Location Selection is a Multidisciplinary Decision"
Location selection is not based on a single parameter (e.g. wind speed only). Rüzgar kaynağı, su derinliği, zemin koşulları, deniz trafiği, çevresel kısıtlar (kuş göç yolları, deniz memelileri koruma alanları), kıyıya mesafe, şebeke bağlantı kapasitesi ve düzenleyici çerçeve birlikte değerlendirilir. At the intersection of all these parameters, the appropriate area (sweet spot) is determined.

---

## Part 2: Why 15 MW Class Turbine?

### Historical Development of Turbine Size

Offshore wind turbines have experienced dramatic growth over the last 20 years:

| Period | Typical Power | Rotor Diameter | Swept Area | Project Examples |
| ------- | ----------- | ------------ | ---------------- | ----------------- |
| 2005–2010 | 2–3 MW | 80–90 m | ~5,000 m² | First generation offshore projects |
| 2010–2015 | 3.6–6 MW | 120–154 m | ~11,000–18,600 m² | Second generation gearbox turbines |
| 2015–2020 | 6–8 MW | 154–167 m | ~18,600–21,900 m² | Direct drive transition |
| 2020–2023 | 9.5–14 MW | 174–222 m | ~23,800–38,700 m² | Large-scale commercial projects |
| **2024–2026** | **14–15 MW** | **222–236 m** | **~38,700–43,700 m²** | **Current standard — Baltic projects** |
| 2027+ (development) | 16–20+ MW | 252–260 m | ~49,900–53,100 m² | Prototype and pre-series production |

### Physics: Swept Field and Power Relationship

The maximum power that a wind turbine can capture depends on the swept area and the cube of the wind speed, limited by the Betz limit:

$$P = \frac{1}{2} \cdot \rho \cdot A \cdot v^3 \cdot C_p$$

Here:

- $P$ = mechanical force (W)
- $\rho$ = air density (kg/m³) — ~1.225 kg/m³ at sea level
- $A$ = swept area (m²) = $\pi r^2$ = $\pi (D/2)^2$
- $v$ = wind speed (m/s)
- $C_p$ = power quotient — Betz limit $C_{p,max} = 16/27 \approx 0.593$

The practical meaning of this equation is:

1. **If the swept area doubles**, the captureable power doubles (linear relationship)
2. **If the wind speed doubles**, the captureable power increases eightfold (cubic relationship)
3. **If the rotor diameter doubles**, the swept area quadruples ($A \propto D^2$), thus the captureable power quadruples

This physical reality is the primary driving force pushing the industry to make larger rotors.

### Why 15 MW — Why Not 12 or 20?

**Three key reasons why 15 MW class turbines will be the industry standard in 2024-2026:**

**1. Ticari Olgunluk (Technology Readiness Level — TRL)**

It typically takes 5–8 years for a turbine model to go from prototype to mass production. In the 2024-2026 period:

- **12 MW class:** Fully mature, but no longer preferred in new projects (previous generation)
- **14–15 MW class:** In series production, order books, construction — **full commercial maturity**
- **18–20 MW class:** Prototype or pre-series production stage — not yet bankable

In order to provide financing (project finance), the turbine must have "proven technology" status. The 15 MW class has this status as of 2026.

**2. LCOE Optimization (Levelized Cost of Energy)**

LCOE divides the lifetime cost of a project by its lifetime energy production:

$$LCOE = \frac{CAPEX + \sum_{t=1}^{n} \frac{OPEX_t}{(1+r)^t}}{\sum_{t=1}^{n} \frac{AEP_t}{(1+r)^t}}$$

Larger turbines:

- **CAPEX increase:** Single turbine cost increases (~10–15 M€/turbine)
- **Reduction in the number of turbines:** Fewer turbines required for the same capacity → less foundation, less cables
- **AEP increase:** Larger swept area → more energy
- **Maintenance cost reduction:** Fewer turbines = fewer maintenance visits

Net result: LCOE in the 15 MW class is ~8–12% lower than in the 12 MW class. However, the 20 MW class has not yet proven its LCOE advantage due to supply chain and logistics infrastructure (port capacity, installation vessel availability).

**3. Supply Chain and Logistics Compliance**

The blade length of 15 MW class turbines is approximately 115 m. Transporting these blades from the production facility to the port and from the port to the installation site requires special logistics. By 2026:

- Port infrastructure and installation vessels for 115 m wings are available and operational
- There are not yet enough suitable ships and ports for 126–130 m wings (20 MW class)

### Standards: IEC 61400-1 Turbine Classification

IEC 61400-1 classifies turbines according to wind speed and turbulence intensity:

| IEC Class | Reference Wind Speed ​​(V_ref) | Annual Average | Turbulence Class |
| ----------- | ------------------------------- | ----------------- | ------------------ |
| **I-A** | 50 m/s | 10 m/s | High |
| **I-B** | 50 m/s | 10 m/s | Medium |
| II-A | 42.5 m/s | 8.5 m/s | High |
| II-B | 42.5 m/s | 8.5 m/s | Medium |
| III-A | 37.5 m/s | 7.5 m/s | High |

Our reference turbine V236-15.0 MW is certified as **IEC Class I-B**:

- Structural integrity to withstand 50 m/s reference wind speed (10-minute average)
- Medium turbulence intensity (class B) — suitable for offshore conditions
- 31 m/s cut-out speed — the safety system stops the turbine at this speed

Since the average annual wind speed in our reference area in the Baltic Sea is ~9.0–9.5 m/s (at 150 m altitude), a Class I-B turbine is more than sufficient for these conditions.

!!! warning "Common Mistake: Confusing Cut-out Speed"
Cut-out speed (31 m/s) and reference wind speed (50 m/s) are different concepts. Cut-out is the operational stall speed—at which speed the turbine comes to a controlled stop. The reference wind speed is the structural design parameter — it defines the extreme load condition that the turbine must withstand. It is important to know this difference in an interview.

---

## Part 3: Turbine Brand and Model Selection

### V236-15.0 MW Technical Specifications

| Parameters | Value | Explanation |
| ----------- | ------- | ---------- |
| rated power | 15.0 MW | Generator output power |
| rotor diameter | 236 m | One of the largest rotors in the world |
| swept area | 43,742 m² | $\pi \times (236/2)^2$ |
| hub height | 150 m | Total height over tower + foundation |
| wing length | ~115.5 m | Compare with Airbus A380 wingspan (79.75 m) per wing |
| IEC class | I-B | High wind, moderate turbulence |
| Cut-in speed | 3 m/s | The speed at which the turbine starts producing |
| rated speed | 12.5 m/s | Speed ​​at which rated power is reached |
| Cut-out speed | 31 m/s | Safety stop speed |
| Drive type | Semi-direct drive (medium-speed gearbox) | Single stage gearbox + PMG (permanent magnet generator) |
| Ct (at rated speed) | 0.28 | Thrust coefficient — critical in wake modeling |

### Why This Particular Turbine Model?

Please note that this project is a simulation for educational purposes. There are four basic reasons for turbine selection:

**1. Actual Project Applicability**

V236-15.0 MW is used in projects actually built in the Polish Baltic Sea in the period 2025-2026. This ensures that our simulation is a mirror of real industry practice and not an academic exercise.

**2. Publicly Available Technical Data**

In order to perform engineering simulation, power curve, thrust coefficient (Ct curve), dimensional features and operational parameters must be known. The technical specifications of the V236-15.0 MW are published in public documents.

**3. Industry Standard Representation**

The 14–15 MW class is the standard turbine size of the European offshore wind sector in the period 2024-2026. There are two main competitors in this class:

| Parameters | Turbine A (15 MW) | Turbine B (14 MW) |
| ----------- | ------------------- | ------------------- |
| rotor diameter | 236 m | 236 m |
| Drive type | Semi-direct drive | Direct drive |
| hub height | 150 m | ~150 m |
| IEC class | I-B | I-B |

Both turbines have a rotor diameter of 236 m — the same swept area. However, their drive mechanisms are different. V236-15.0 MW was chosen for this project because this is the turbine used in the first large-scale offshore wind project in Poland and being able to say "the same turbine" in interviews is a strong advantage.

**4. Portfolio Value**

In an interview, saying "I used the same turbine in my 510 MW simulation as used in real projects — my calculations are directly applicable" is much more effective than saying "I worked with a generic turbine model."

!!! info "Why Don't We Use Company Names?"
We avoid specific developer company names throughout this lesson. The reason is professional ethics and impartiality. It is a professional approach to justify engineering decisions with technical parameters, not with the company name. The turbine name (V236-15.0) is a product specification and a publicly available technical reference.

---

## Chapter 4: Capacity Calculation — Why 34 Turbines?

### Basic Mathematics

$$N_{türbin} = \frac{P_{farm}}{P_{türbin}} = \frac{510 \text{ MW}}{15.0 \text{ MW}} = 34 \text{ türbin}$$

It's a simple splitting operation, but the engineering decisions behind it are not simple.

### Why 510 MW Total Capacity?

Three constraints are balanced in determining the total capacity:

**1. Training Scale Restriction**

| Number of Turbines | Realism | Computational Load | Educational Value |
| -------------- | ------------- | ----------------- | --------------- |
| < 10 | Low — trace effects are negligible | too low | Low |
| 10–20 | Middle — simplified trace | Low | Medium |
| **30–40** | **High — realistic track interaction** | **Average** | **High** |
| 50–100 | very high | High | same concepts |
| > 100 | Actual project scale | very high | marginal increase |

34 turbines provide sufficient complexity to realistically model wake effects while keeping computational time at reasonable levels.

**2. Scalability**

Our simulation is designed for 34 × 15 MW = 510 MW, but the same code infrastructure can easily scale:

- 76 × 15 MW = 1,140 MW (actual project size)
- 100 × 14 MW = 1,400 MW (alternative project size)
- 200+ turbine farms (next generation megaprojects)

**3. Grid Integration Requirement**

510 MW falls into the **Type D generator** class (≥75 MW) within the scope of ENTSO-E NC RfG (Network Code Requirements for Generators). This means applying the strictest grid code requirements:

- Full Frequency Response Modes (LFSM-O, LFSM-U, FSM)
- Continue Operation During Fault (FRT — Fault Ride-Through)
- Full P-Q capability diagram (reactive power capability)
- Harmonic and flicker limits

These requirements form the basis of the P2 (HV Grid Integration) phase of the project.

### Comparison with Real Projects

| Parameters | Our simulation | Real Projects (typical) |
| ----------- | --------------- | ------------------------ |
| Number of turbines | 34 | 50–150 |
| Total capacity | 510 MW | 700 MW – 1.5 GW |
| Number of offshore transformers | 1 | 1–3 |
| Transmission type | HVAC 220 kV | HVAC veya HVDC |

Our 510 MW is located at the lower end of real projects. However, all engineering concepts (trace modeling, network analysis, SCADA, protection coordination) are based on the same physical principles in 510 MW and 1.5 GW. The difference is in scale, not in concepts.

---

## Part 5: Wind Farm Area Calculation

### Turbine Spacing Physics

If turbines are placed too close to each other, the turbines located downwind will remain in the wake region created by the turbine in front of them. In the trail area:

- **Wind speed decreases** — as the upstream turbine draws kinetic energy
- **Turbulence increases** — due to disturbed flow
- **Power production decreases** — Due to the $P \propto v^3$ relationship, even small speed decreases lead to significant power loss

For example, if the wind speed decreases by 10% in the wake region, power production decreases by 27% ($0.9^3 = 0.729$).

### Standards and Industry Practice

IEC 61400-1 does not specify a minimum range, but industry practice and DTU (Technical University of Denmark) research recommend the following ranges:

| The night | Range (D = rotor diameter) | From where |
| ----- | ------------------------- | ------- |
| **Wind direction (downwind)** | 7D–10D | Wake recovery — most energy recovered after 7D |
| **Crosswind** | 4D–6D | Side track effect is weaker |

Ranges selected in our project:

- **Downwind:** 8D = 8 × 236 m = **1,888 m**
- **Crosswind:** 5D = 5 × 236 m = **1,180 m**

### Field Calculation

Turbine placement is generally done in staggered rows. A typical layout for 34 turbines:

**Step 1: Determine sequence order**

Since the dominant wind direction is WSW (WSW — West-Southwest), the rows are placed perpendicular to this direction.

Possible layout: 6 rows × 5–6 turbines (34 total)

Example layout: 6 + 6 + 6 + 6 + 5 + 5 = 34 turbines

**Step 2: Dimensional calculation**

```
Çapraz rüzgar yönünde (sıra uzunluğu):
 6 türbin × 1,180 m aralık = 5,900 m (en geniş sıra)

Rüzgar yönünde (sıra derinliği):
 6 sıra × 1,888 m aralık = 9,440 m

Dikdörtgen alan:
 5.9 km × 9.4 km ≈ 55.5 km²
```

**Step 3: Add buffer zone**

In real projects the farm boundary requires a minimum buffer zone of 500 m around the outermost turbines (maritime traffic safety, maintenance access):

```
(5.9 + 1.0) km × (9.4 + 1.0) km ≈ 71.8 km²
```

**Step 4: Irregular border correction**

Due to the staggered layout and seabed constraints the actual area will not be rectangular. Typical correction factor ~1.2–1.4:

```
Tahmini toplam alan: ~70–100 km²
```

### Power Density

Power density indicates the installed capacity per unit area:

$$\rho_{güç} = \frac{P_{farm}}{A_{farm}} = \frac{510 \text{ MW}}{~80 \text{ km}^2} \approx 6.4 \text{ MW/km}^2$$

Industry comparison:

| Turbine Class | Typical Power Density | Explanation |
| -------------- | ---------------------- | ---------- |
| 3–4 MW (2010s) | 4–6 MW/km² | Smaller rotor, tighter placement |
| 8–10 MW (2020s) | 5–7 MW/km² | Balanced |
| **14–15 MW (2025+)** | **5–8 MW/km²** | **Big rotor → wider range → similar density** |

An interesting paradox: As turbines get bigger, their power density doesn't change much. From where? Because larger rotor = larger wake area = wider gap requirement. While the power increases proportionally to $D^2$, the required area increases proportionally to $D^2$ — the density remains approximately constant.

!!! tip "Interview Question: Why Do Bigger Turbines Mean Fewer Turbines But Not Smaller Area?"
The answer lies in the above paradox. A 15 MW turbine is ~2 times more powerful than an 8 MW, so ~half the number of turbines are required for the same capacity. However, since the rotor diameter is 40% larger ($236 \text{ m}$ vs $\sim164 \text{ m}$), the gap distances also increase by 40%. The net area gain is not as large as expected. The real gain is the CAPEX and OPEX savings that come from reducing the number of turbines and foundations.

---

## Part 6: HVAC or HVDC?

### Problem: Moving Energy to Shore

We need to deliver 510 MW of electricity produced by 34 turbines to the shore and from there to the national grid via a 40+ km subsea cable. This requires one of the most critical engineering decisions of offshore wind projects: **HVAC (High Voltage Alternating Current) or HVDC (High Voltage Direct Current)**

### Physics: Capacitance Problem of Submarine Cables

Submarine cables have large capacitance due to their structure. A cable is actually a very long capacitor with the structure conductor + insulation + conductor:

$$Q_{kablo} = \omega \cdot C \cdot V^2 \cdot L$$

Here:

- $Q_{kablo}$ = reactive power (VAr) — capacitive reactive power produced by the cable
- $\omega$ = açısal frequency = $2\pi f$ = $2\pi \times 50$ = 314.16 rad/s
- $C$ = cable capacitance (F/km) — typically ~0.17–0.20 µF/km for XLPE 220 kV cable
- $V$ = cable voltage (V)
- $L$ = cable length (km)

This capacitance causes two basic problems:

**1. Charging Current**

Even if the cable carries no power, a charging current flows due to capacitance. This current consumes some of the power carrying capacity of the cable:

$$I_{şarj} = \omega \cdot C \cdot V \cdot L$$

As the cable gets longer, the charging current increases and the active power carrying capacity of the cable decreases. At some point (typically around 80–120 km, depending on voltage level) the charging current consumes the entire carrying capacity of the cable and the active power becomes unbearable.

**2. Ferranti Effect**

When the cable operates at no load or low load, capacitive reactive power generation increases the voltage. This is known as the **Ferranti effect**:

$$V_{alıcı} = V_{gönderici} + I_{kapasitif} \cdot X_{kablo}$$

In a 220 kV system, the voltage rise due to the Ferranti effect may exceed the ±5% band allowed by the grid code (up to 1.08 pu). Therefore, reactive power compensation is mandatory.

### Numerical Analysis for Our Project

220 kV XLPE cable, 45 km length:

```
Kablo kapasitansı: C ≈ 0.19 µF/km (3 fazlı XLPE 220 kV tipik değer)

Reaktif güç üretimi:
 Q = ω × C × V² × L × 3 (3 faz)
 Q = 314.16 × 0.19×10⁻⁶ × (220,000/√3)² × 45 × 3
 Q ≈ 85.5 MVAR

Bu, kablonun yüksüz iken 85.5 MVAR kapasitif reaktif güç ürettiği anlamına gelir.
```

### HVAC vs HVDC Decision Matrix

| Criterion | HVAC (220 kV) | HVDC (±320 kV) |
| -------- | --------------- | ---------------- |
| **Cable losses (45 km)** | ~%2–3 | ~%0.5–1 |
| **Investment cost (CAPEX)** | Low—passive cable | High — converter stations required |
| **Converter cost** | None | ~200–400 M€ (both ends) |
| **Reactive power problem** | Yes — STATCOM required | None — Capacitance is not a problem at DC |
| **Technical complexity** | Low | High—power electronics, cooling |
| **Maintenance complexity** | Low | Medium-High |
| **Reliability (proven)** | very high | High, but less operational experience |
| **Distance limit** | ~80–120 km (depending on voltage) | Unlimited (theoretical) |
| **Multi-terminal connection** | Kolay (AC busbar) | Complex (DC breaker technology is improving) |

### Economic Break-even Point

Cost comparison between HVAC and HVDC breaks down depending on distance:

```
HVAC toplam maliyet = Kablo maliyeti × L + Kompanzasyon ekipmanı
HVDC toplam maliyet = Kablo maliyeti × L + Konvertör istasyonları (sabit maliyet)

HVAC kablo maliyeti > HVDC kablo maliyeti (HVAC 3 fazlı, HVDC bipolar)
HVDC konvertör maliyeti >> HVAC kompanzasyon maliyeti
```

Typical break-even point: **~80 km** (this value varies between 60–120 km depending on years and technology costs)

Since the cable length in our project is **45 km**, it is clearly in the **HVAC optimal zone**.

### Why We Chose HVAC — Summary

1. **45 km distance < 80 km break-even point** → HVAC is economically superior
2. **The main teaching topic of STATCOM control strategy P2** → Ideal platform for teaching HVAC, FACTS (Flexible AC Transmission Systems)
3. **Single offshore transformer station** Sufficient for 510 MW HVAC system → No need for HVDC converter platform
4. **AC grid connection direct** → No additional AC/DC conversion losses required by HVDC
5. **Real Polish projects** use HVAC in this distance range

!!! info "Future Perspective: When is HVDC Required?"
When Poland's offshore wind target reaches 11 GW (2040), many farms will need to be connected to the grid. PSE is developing a north-south HVDC backbone line. This line will enable multiple farms to be connected to the grid via a single HVDC transmission corridor. Moreover, in case of development of sites more than 80 km away, HVDC will be the only option.

---

## Chapter 7: Grid Integration — Connection to 400 kV PSE System

### Transmission Chain

Voltage conversion journey of electricity from the turbine to the national grid:

```
Türbin Jeneratörü (0.69 kV — düşük gerilim)
    ↓ Türbin içi trafo
66 kV Dizi Kabloları (array cables)
    ↓ 34 türbini birbirine bağlar
Offshore Trafo İstasyonu (OSS — 66/220 kV)
    ↓ GIS (Gaz İzoleli Anahtarlama) ile
220 kV Deniz Altı İhraç Kablosu (45 km XLPE)
    ↓
Kıyı Trafo İstasyonu (Onshore — 220/400 kV)
    ↓
400 kV PSE Ulusal Şebekesi
    ↓
Avrupa İnterkonnekte Sistemi (ENTSO-E)
```

Each voltage level is an engineering decision:

- **0.69 kV → 66 kV:** Inside the turbine, each turbine has its own transformer
- **66 kV:** Industry standard for array cables — transition from 33 kV to 66 kV occurred with 15 MW class turbines (larger turbine = higher current = thicker cable or higher voltage)
- **66 kV → 220 kV:** At offshore substation — increases voltage for long distance transmission
- **220 kV → 400 kV:** Onshore — to comply with the PSE national transmission grid

### STATCOM: Why ±120 MVAR?

As we calculated in Chapter 6, 45 km of 220 kV cable produces ~85.5 MVAR of capacitive reactive power. STATCOM (Static Synchronous Compensator) is required to compensate for this reactive power and keep the voltage within the ±5% band.

**STATCOM sizing:**

| Component | Value | Explanation |
| --------- | ------- | ---------- |
| Cable reactive power | +85.5 MVAR (capacitive) | Continuous compensation required |
| N-1 redundancy margin | +34.5 MVAR | Sufficient capacity in the event of a STATCOM module failure |
| **STATCOM nominal** | **±120 MVAR** | Both absorption and injection |
| shunt reactor | 50 MVAR | Continuous base load compensation — reduces STATCOM workload |

**STATCOM vs SVC (Static VAR Compensator) Kararı:**

| Criterion | STATCOM | SVC |
| -------- | --------- | ----- |
| response time | <5 ms | ~50 ms |
| Q capacity at low voltage | full capacity | Q ∝ V² (Q decreases as voltage decreases) |
| physical size | Compact | Big |
| Equipment cost | higher | lower |
| Impact on offshore platform cost | Small platform → save cost | Large platform required |

STATCOM was preferred because:

1. **FRT compliance:** STATCOM provides full reactive current even when voltage drops to 15% during fault — the capacity of the SVC collapses with voltage
2. **Offshore platform savings:** Smaller equipment → smaller platform → estimated savings of ~12 M€
3. **Speed:** <5 ms response time meets PSE IRiESP FRT requirements

### ENTSO-E NC RfG Type D Requirements

The 510 MW capacity is classified as a **Type D** generator under ENTSO-E NC RfG (EU 2016/631) (threshold: ≥75 MW). This is the most stringent set of requirements:

**Frequency Response:**

| Mod | Explanation | Need |
| ----- | ---------- | ------------ |
| LFSM-O | Extreme frequency response | f > 50.2 Hz → reduce power |
| LFSM-U | Low frequency response | f < 49.8 Hz → increase power (if possible) |
| FSM | Frequency sensitive mode | Droop setting ~3–5% |

**Continue Operation During Fault (FRT - Fault Ride-Through):**

Under PSE IRiESP requirements:

- **LVRT (Low Voltage Ride-Through):** Stay connected and inject reactive current for 140 ms even if voltage drops to 15%
- **HVRT (High Voltage Ride-Through):** Stay connected for 20 ms even if voltage rises to 120%

```
Gerilim (pu)
1.20 |-----.
   |   |
1.05 |   |---------------------------------- Normal bant üst sınır
1.00 |   |
0.95 |   |---------------------------------- Normal bant alt sınır
   |   |
0.85 |   |
   |   |
0.15 |-----|
   |   |
0.00 +-----+--+--+--+--+--+--+--> Zaman (ms)
   0  140 500 1000 3000

   LVRT Profili: 0.15 pu, 140 ms → kademeli toparlanma
```

These FRT requirements will be verified by ANDES dynamic simulation in the P2 project. Load flow alone (Pandapower) is not enough — dynamic behavior needs to be simulated.

### Short Circuit Capacity and Protection Coordination

Outdoor grid model at 400 kV PSE connection point:

- **Short circuit capacity:** $S_{sc}$ = 10 GVA
- **Short circuit current:** $I_{sc}$ = $\frac{S_{sc}}{\sqrt{3} \times V}$ = $\frac{10,000}{\sqrt{3} \times 400}$ ≈ **14.4 kA**

This value forms the basis of all protection relay settings (P2) and switching programs (P5). Protection coordination will be carried out according to IEC 60909-0:2016 standard ($c_{max}$ = 1.1, $c_{min}$ = 0.95).

!!! tip "Engineering Principle: Design Decisions Are Chained"
Each design decision triggers the next decision:

**Turbine selection** (15 MW, 236 m rotor) →
**Number of turbines** (34 = 510 MW) →
**İletim tipi** (HVAC, 45 km < 80 km) →
**Cable capacitance** (85.5 MVAR) →
**STATCOM size** (±120 MVAR) →
**FRT fit** (ANDES dynamic simulation)

This chain relationship is called "design basis" in engineering. When you change any link in the chain, you must re-evaluate all subsequent links. In real projects, design basis change is a formal process and requires approval.

---

## Chapter 8: Decision Summary Table

Let's put all our preliminary design decisions into one reference table:

| Decision | Value | Reason | Standard/Reference |
| ------- | ------- | --------- | ------------------- |
| **Women** | Baltic Sea, north of Ustka ~40 km | Actual project proximity, ERA5 data, shallow water | PEP2040, ERA5 |
| **Water depth** | 25–40 m | Monopile foundation technology suitable | geotechnics |
| **Wind source** | 9.0–9.5 m/s (150 m) | ERA5 20-year average | ECMWF ERA5 |
| **Turbine model** | V236-15.0 MW | Used in real Baltic project, commercial mature | IEC 61400-1 I-B |
| **Rotor diameter** | 236 m | Turbine specification | Manufacturer data sheet |
| **Number of turbines** | 34 | 510 MW / 15 MW — training scale | Design decision |
| **Hub height** | 150 m | Turbine specification | Manufacturer data sheet |
| **Cut-in / Nominal / Cut-out** | 3 / 12.5 / 31 m/s | IEC 61400 Class I-B | IEC 61400-1 |
| **Downwind range** | 8D = 1,888 m | Trace recovery optimization | PyWake, DTU |
| **Crosswind range** | 5D = 1,180 m | Sidetrack effect compensation | industry practice |
| **Estimated area** | ~70–100 km² | Spacing + buffer zone | Calculation |
| **Power density** | ~6–7 MW/km² | Within industry standard range | To compare |
| **String voltage** | 66 kV | Industry standard for 15 MW class | industry practice |
| **Export voltage** | 220 kV HVAC | 45 km < 80 km break-even point | CIGRE, IEC 60287 |
| **Export cable** | 45 km undersea + 5 km on land | Distance from field to shore | geographical restriction |
| **Cable reactive power** | ~85.5 MVAR | Q = ωCV²L calculation | IEC 60287-1-1 |
| **STATCOM** | ±120 MVAR | Cable comp. + N-1 redundancy | Sizing calculation |
| **Shunt reactor** | 50 MVAR | Continuous base load compensation | N-1 design |
| **Network connection** | 400 kV PSE | Polish transmission grid | PSE IRiESP |
| **Network code** | NC RfG Tip D + PSE IRiESP | ≥75 MW → most stringent requirements | EU 2016/631 |
| **Short circuit capacity** | 10 GVA | External network model | IEC 60909 |
| **Design life** | 25–30 years | Industry standard | industry practice |

---

## Quiz — Knowledge Check

!!! question "Question 1 (Recall)"
What is the average wind speed at an altitude of 150 m in our reference area in the Baltic Sea?

  ??? success "Reply"
**9.0–9.5 m/s.** This value is obtained by extrapolating the ERA5 100 m data to the 150 m hub height with the power law profile.

!!! question "Question 2 (Recall)"
How many m² is the swept area of ​​the V236-15.0 MW turbine?

  ??? success "Reply"
**43,742 m².** Calculation: $A = \pi \times (236/2)^2 = \pi \times 118^2 = 43,742 \text{ m}^2$. This is approximately the size of 6 football fields.

!!! question "Question 3 (Comprehension)"
If the wind speed in the wake region decreases by 15%, approximately by how much percent will power generation decrease?

  ??? success "Reply"
**About 39%.** Power is proportional to the cube of the wind speed: $P \propto v^3$, hence $0.85^3 = 0.614$, i.e. 38.6% reduction. This shows why even small speed losses lead to serious energy loss.

!!! question "Question 4 (Comprehension)"
Approximately how many km is the minimum cable length we need to use HVDC instead of HVAC?

  ??? success "Reply"
**~80 km** (typical break-even point). Since the cable length in our project is 45 km, HVAC is economically superior. This value varies between 60 and 120 km depending on years and technology costs.

!!! question "Question 5 (Comprehension)"
Why did we set the STATCOM size to ±120 MVAR? Wouldn't 85.5 MVAR cable compensation be enough?

  ??? success "Reply"
**Due to the N-1 redundancy principle.** 85.5 MVAR is for nominal conditions only. ~40% margin has been added to have sufficient compensation capacity even in the event of a STATCOM module failure. Additionally, the STATCOM must have the capacity to both absorb (+) and inject (−) — the inductive reactive power demand of the turbines at full load is also met by the STATCOM.

!!! question "Question 6 (Challenging)"
If the wake losses in a farm of 34 turbines are 12.7% and are reduced to 8.7% with staggered layout optimization, approximately how many GWh will the annual energy gain be at an average wind speed of 9.5 m/s and a capacity factor of 48%?

  ??? success "Reply"
Gross AEP (pre-trace):
$AEP_{brüt} = 510 \text{ MW} \times 8,760 \text{ h} \times 0.48 = 2,145 \text{ GWh}$

Trace loss difference: 12.7% − 8.7% = 4.0%

Annual energy gain: $2,145 \times 0.04 = \sim85.8 \text{ GWh}$

At €72/MWh CfD: $85,800 \times 72 = \sim6.2 \text{ M€/yıl}$ revenue increase. Over a 25-year lifespan, this translates to ~155 M€ in additional revenue — which is why layout optimization is a critical engineering activity.

!!! question "Question 7 (Challenging)"
What is the Ferranti effect and why is it particularly dangerous for long subsea cables?

  ??? success "Reply"
The Ferranti effect is the situation where the voltage at the receiving end of a transmission line or cable is higher than the sending end when operating at no load or light load. The reason is that the capacitive charging current resulting from the high capacitance of the cable creates a voltage drop (actually rise) on the cable impedance.

Subsea cables are particularly sensitive because:
    1. It has 20–40 times higher capacitance than overhead lines (insulation thickness and ground proximity)
    2. Over long distances (45+ km) capacitive reactive power generation becomes very high (85.5 MVAR)
    3. Wind farms carry minimal loads at night or in low winds—exactly the conditions where the Ferranti effect is strongest

Solution: Reactive power compensation with STATCOM + shunt reactor. In our project this will be one of the main topics of P2.

---

## Interview Corner

### Simple Explanation (To Non-Engineers)

Before starting a wind farm project, you need to make many critical decisions — just like land selection, architectural plan and infrastructure connection before building a house. You examine wind conditions, sea depth and waves when determining where to build. When deciding what size wind turbine to use, you are choosing the most suitable and proven option of available technology. When calculating how many turbines to place, you balance both adequate energy production and sufficient distance between turbines. And when deciding how to transport the electricity you produce to cities, you determine whether to use alternating current or direct current based on the distance, through cost-benefit analysis.

### Technical Description (For Interview Panel)

Eight basic engineering decisions were made during the preliminary design phase. The location was chosen off Ustka in the Polish EEZ — based on ERA5 reanalysis data with an average wind speed of 9.0–9.5 m/s at a hub height of 150 m, water depth of 25–40 m (suitable for monopile), and calm wave conditions compared to the North Sea (Hs < 1.5 m annual average). The turbine was selected as the IEC Class I-B certified V236-15.0 MW — 43,742 m² swept area, semi-direct drive propulsion, the fully bankable industry standard for the period 2024-2026. 34 × 15 MW = 510 MW capacity provides education-scale computing efficiency while triggering NC RfG Type D requirements. In the staggered layout with 8D downwind × 5D crosswind spacing (~1,888 m × 1,180 m) the estimated farm area is ~70–100 km² and the power density is ~6–7 MW/km². The transmission system consists of a 66 kV array → 220 kV HVAC export (45 km) → 400 kV PSE grid chain — 45 km distance is below the HVAC/HVDC break-even point (~80 km). The ~85.5 MVAR capacitive reactive power generation of the 220 kV cable is compensated by a ±120 MVAR STATCOM + 50 MVAR shunt reactor — STATCOM was preferred over SVC because full Q capacity is maintained at low voltage (FRT compliance) and its compact structure reduces offshore platform cost. The external grid model with short circuit capacity 10 GVA forms the basis of protection coordination based on IEC 60909.

---

## Recommended Reading

Suggestions from the Learning Roadmap to deepen the topics of this course:

1. **DTU Wind Energy — Introduction to Wind Energy (Coursera)** — Wind physics, Betz limit, swept area relationship
2. **Burton et al. — Wind Energy Handbook, Wiley** — Chapter 1-3: Wind resource, turbine aerodynamics, power curve
3. **CIGRE Technical Brochure 610 — Offshore Generation Cable Connections** — HVAC vs HVDC karar çerçevesi
4. **ENTSO-E NC RfG (EU 2016/631)** — Full regulatory text, Type D requirements
5. **ERA5 Documentation (ECMWF)** — Copernicus Climate Data Store user guide

---

## Links — Where Are These Decisions Going?

| In This Lesson | Related Future Course/Project |
| ----------- | -------------------------- |
| ERA5 wind data → 9.0–9.5 m/s | **Lesson 004 (P1):** Weibull fit and power curve integration |
| V236-15.0MW power curve | **P1:** PyWake trace modeling, AEP calculation |
| 34 door staggered layout | **P1:** Layout optimization, trace loss reduction |
| 85.5 MVAR cable reactive power | **P2:** STATCOM control strategy, Pandapower simulation |
| FRT requirements (15%, 140 ms) | **P2:** ANDES dynamic simulation |
| 66 kV → 220 kV → 400 kV chain | **P2:** Single line diagram, load flow analysis |
| STATCOM ±120 MVAR | **P2:** Reactive power control modes (V-droop, Q-setpoint) |
| IEC 60909, 10 GVA | **P2:** Short circuit calculation, protection coordination |
| NC RfG Tip D | **P3:** SCADA alarm definitions, grid code compliance monitoring |
| Turbine spacing | **P5:** Commissioning sequence, cable-to-turbine energization program |
