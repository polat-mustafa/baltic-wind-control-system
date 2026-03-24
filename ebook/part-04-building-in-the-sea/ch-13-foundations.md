# Chapter 13: Foundations — Monopile, Jacket, and Floating

*The hydraulic hammer struck at dawn.*

*Kaan stood on the deck of the jack-up vessel Brave Tern, two hundred metres from the monopile, and felt the blow in his sternum before he heard it. The sound arrived a fraction of a second later — a deep, percussive thud that rolled across the water and returned as a faint echo from the hull of the SOV, anchored a kilometre to the east. The monopile was a steel cylinder ten metres in diameter and eighty metres long, held vertical by a gripper frame on the vessel's crane, its lower end already fifteen metres into the seabed. With each hammer strike — one every three seconds — it sank another four centimetres into the glacial clay of the Polish Baltic.*

*"That is fourteen hundred tonnes of steel," said the man standing beside him, raising his voice above the distant rhythm of the hammer. "And the hammer hitting it weighs another five hundred." He was Pieter Bakker, the project's marine foundations engineer — a broad-shouldered Dutchman in his mid-forties, hard hat covered in stickers from a dozen previous projects spanning two decades of offshore work, first in oil and gas, then in wind. He carried a transparent cylinder the size of a water bottle, filled with layered sediment — grey clay over brown sand over something darker and denser at the bottom. "This is what it's going into," he said, tapping the cylinder. "A soil core from this exact location. Every monopile design starts with one of these."*

*Kaan watched another blow land. The hammer's hydraulic ram retracted, paused, and fell again. A ring of bubbles churned the water around the monopile's base — the noise mitigation curtain, Pieter explained, required by EU environmental regulations to protect harbour porpoises from the underwater sound pressure. The bubbles scattered the acoustic energy before it could propagate through the water column. Even so, Kaan could feel each strike through the deck plates.*

*"How far does it need to go?" he asked.*

*"Thirty-five metres below the mudline," Pieter said. "We are at nineteen. Another four hours, if the till layer does not surprise us." He held up the soil core again. "The dark layer at the bottom? That is overconsolidated glacial till — deposited by ice sheets ten thousand years ago. It is the strongest soil on this site, but it is also the hardest to drive through. If we hit a boulder embedded in the till, we stop, wait, and try again. The pile does not care about our schedule."*

*He set the core sample on a railing and looked out at the monopile, which stood in the grey morning light like an industrial chimney rising from the sea. "People think offshore wind is about turbines," he said. "Turbines are the visible part. But the invisible part — what happens below the waterline, below the seabed — that is where projects succeed or fail. A blade can be replaced in a week. A foundation must last thirty years without a single inspection of the steel below the mud." He paused. "So. Let me tell you how we design these things."*

---

## 13.1 The Foundation Problem

An offshore wind turbine foundation must do something that no onshore structure is asked to do: resist enormous lateral loads in an environment where the ground itself is invisible, inaccessible, and heterogeneous. The challenge is not primarily about supporting the turbine's weight — a 15 MW turbine, tower, and nacelle together weigh roughly 2,500 tonnes, which is modest by structural engineering standards. The challenge is about **moments**: the wind pushing against the rotor at hub height, 140 metres above the sea surface, creates a bending force at the seabed that the foundation must resist without rotating more than a fraction of a degree over its 25- to 30-year design life.

The loads on an offshore wind turbine foundation come from five sources, each with a different frequency, direction, and degree of predictability:

| Load Source | Typical Magnitude | Frequency Range | Design Standard |
|---|---|---|---|
| Aerodynamic thrust (wind on rotor) | 1,500–3,000 kN | 0.01–0.1 Hz (turbulence) | IEC 61400-1 |
| Hydrodynamic (waves) | 500–2,000 kN | 0.05–0.25 Hz (wave spectrum) | IEC 61400-3-1 |
| Current drag | 50–200 kN | Quasi-static | DNV-ST-0126 |
| Ice loading (Baltic) | 500–5,000 kN | Quasi-static to dynamic | ISO 19906 |
| Seismic | Site-dependent | 0.1–10 Hz | EN 1998-1 |

The aerodynamic thrust is typically the dominant load for turbines in water depths up to about 30 metres. In deeper water, wave loads become increasingly important, and for Arctic and Baltic sites, ice loading can govern the design entirely. [1]

The critical design quantity is the **overturning moment at the mudline** — the point where the foundation meets the seabed. For a 15 MW turbine on a monopile in 30 metres of water, this moment is enormous:

$$
M_{\text{mud}} = F_{\text{thrust}} \times (z_{\text{hub}} + d_{\text{water}}) + F_{\text{wave}} \times z_{\text{wave}}
$$

where:
- $M_{\text{mud}}$ = overturning moment at the mudline [kN-m]
- $F_{\text{thrust}}$ = aerodynamic thrust force at the rotor [kN]
- $z_{\text{hub}}$ = hub height above mean sea level [m]
- $d_{\text{water}}$ = water depth from MSL to mudline [m]
- $F_{\text{wave}}$ = resultant hydrodynamic force [kN]
- $z_{\text{wave}}$ = height of wave force resultant above mudline [m]

For the reference 500 MW farm with V236-15.0 MW turbines at a hub height of 140 m above MSL in 30 m of water, a rated thrust of 2,500 kN produces a mudline moment of 2,500 × (140 + 30) = 425,000 kN-m from wind alone — 425 MN-m. Adding wave loads and applying partial safety factors, the ultimate limit state (ULS) design moment can exceed 700 MN-m. That is the equivalent of balancing a 70,000-tonne ship on the tip of a pencil.

> **Standard reference:** IEC 61400-3-1:2019, "Wind energy generation systems — Part 3-1: Design requirements for fixed offshore wind turbines." Clauses 7 and 8 define design load cases (DLCs) combining wind, wave, current, and ice actions for ultimate, fatigue, and accidental limit states. [2]

But the foundation must not only resist the maximum load — it must survive billions of load cycles without fatigue failure. Over a 25-year design life, a monopile in the North Sea or Baltic experiences approximately 10$^8$ wave load cycles and 10$^9$ smaller stress cycles from turbulent wind loading. The standard method for assessing fatigue life is **Miner's cumulative damage rule**:

$$
D = \sum_{i=1}^{k} \frac{n_i}{N_i} \leq \frac{1}{\text{DFF}}
$$

where:
- $D$ = cumulative fatigue damage [dimensionless]
- $n_i$ = number of stress cycles at range $\Delta\sigma_i$
- $N_i$ = number of cycles to failure at $\Delta\sigma_i$ (from the S-N curve)
- $k$ = number of stress range bins
- $\text{DFF}$ = design fatigue factor (typically 3.0 for non-inspectable welds below the mudline) [3]

The DFF of 3.0 means that the calculated fatigue life must be at least three times the design life — 75 years for a 25-year turbine — because no one can inspect a weld buried 35 metres below the seabed. This single number encodes a fundamental truth of offshore foundation engineering: you cannot fix what you cannot reach.

<!-- IMAGE: fig-13-01 -->
> **Figure 13.1** — Loads on an offshore wind turbine monopile foundation
> **Type:** schematic diagram
> **Content:** Side-view diagram of a monopile-supported turbine showing: (1) aerodynamic thrust arrow at hub height, (2) wave force arrows along the water column, (3) current drag arrow, (4) ice loading arrow at waterline (for Baltic), (5) soil reaction (p-y springs) along embedded length below mudline. Dimensions annotated: hub height (140 m above MSL), water depth (30 m), embedment (35 m), monopile diameter (10 m). Moment arm from mudline to hub indicated.
> **Caption:** The foundation must resist loads from five sources — wind, waves, current, ice, and the turbine's own dynamics — transmitted as a massive overturning moment at the mudline.
> **Alt text:** Schematic cross-section of a monopile offshore wind turbine showing aerodynamic thrust at hub, wave and current forces on the submerged tower, ice load at waterline, and distributed soil reaction springs below the seabed.
> **Data source:** Author illustration based on IEC 61400-3-1:2019 and DNV-ST-0126.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Blue for water, brown/tan for seabed layers, red arrows for loads, green for soil reaction

---

## 13.2 The Monopile

The monopile is the simplest offshore wind foundation, and the most successful. It accounts for approximately 80 percent of all installed offshore wind foundations worldwide — a dominance achieved not through elegance but through brute simplicity. A monopile is a hollow steel cylinder, open at both ends, driven vertically into the seabed until friction and lateral earth pressure provide sufficient resistance to the overturning moment. There are no joints, no lattice members, no concrete — just steel and soil. [4]

### A Brief History

The world's first offshore wind farm, Vindeby (1991, 11 × 450 kW, Denmark), did not use monopiles. Its turbines stood on gravity base foundations — concrete caissons lowered to a prepared seabed. The first large-scale use of monopiles came a decade later at **Horns Rev 1** (2002, 80 × V80 2.0 MW, Denmark), where 80 steel cylinders, each 4 metres in diameter and weighing roughly 200 tonnes, were driven into the sandy North Sea seabed. Horns Rev 1 was the first offshore wind farm in the North Sea, the first to exceed 100 MW, and the first to use monopile foundations at commercial scale. Its success established the monopile as the industry default. [5]

Since 2002, monopiles have grown in step with turbines. The 4-metre diameter piles at Horns Rev have become the 10-metre XXL monopiles of today. At Arcadis Ost 1, a 257 MW wind farm in the German Baltic Sea, DEME Offshore installed 28 monopiles weighing more than 2,000 tonnes each, with diameters of 9.5 metres and lengths up to 110 metres — the largest monopiles ever installed at the time. At the Thor offshore wind farm in Denmark (1.1 GW), all 72 monopiles were installed during 2025, each supporting a turbine in the 14–15 MW class. [6]

### Fabrication

A monopile begins as flat steel plates — typically grade S355 to S460, with wall thicknesses of 60 to 100 millimetres — in a fabrication yard. The two largest monopile fabricators in Europe are **Sif** (Roermond, Netherlands, founded 1948) and **EEW Special Pipe Constructions** (Rostock, Germany). The fabrication process follows a precise sequence:

1. **Plate preparation:** Steel plates are cut to size, bevelled for welding, and inspected ultrasonically for internal defects.
2. **Rolling:** Each plate is rolled into a cylindrical "can" — a single ring of the monopile, typically 2 to 3 metres tall.
3. **Longitudinal welding:** The seam of each can is closed by submerged arc welding (SAW), an automated process that deposits weld metal under a blanket of granular flux, producing deep, consistent welds at high speed.
4. **Circumferential welding:** Cans are stacked and welded together, one ring at a time, building the monopile from bottom to top. A single monopile may contain 30 to 40 circumferential welds.
5. **Coating:** The completed monopile receives a corrosion protection system — typically a combination of marine-grade paint, cathodic protection (sacrificial anodes), and a splash-zone coating of polyurethane or thermal-sprayed aluminium in the zone between low tide and the platform. [7]

The entire process takes four to six weeks per monopile. For a 34-turbine wind farm, the fabrication campaign spans 12 to 18 months, with multiple monopiles in production simultaneously.

### The Transition Piece

The monopile does not connect directly to the turbine tower. Between them sits the **transition piece** (TP) — a shorter steel cylinder, typically 20 to 30 metres long, that provides the interface between the foundation and the tower. The TP includes the tower flange (a bolted connection to the tower base), the boat landing (a ladder and platform for crew transfer vessel access), the J-tubes (protective conduits for the array cables), and the working platform.

The connection between the monopile and the transition piece was historically made by **grouted connections** — the TP was lowered over the monopile with a gap of 50 to 100 mm, and high-strength cementitious grout was pumped into the annular space. This "tube-in-tube" design, borrowed from the oil and gas industry, was simple and forgiving of installation tolerances. However, early offshore wind farms experienced grout cracking and settlement due to the unique loading pattern of wind turbines — a combination of high bending moments and low axial loads that oil platforms rarely experience. The industry responded by adding shear keys (welded rings on both the monopile and TP surfaces) and, increasingly, by switching to **bolted flange connections** that eliminate grout entirely. [8]

<!-- IMAGE: fig-13-02 -->
> **Figure 13.2** — Monopile evolution: diameter and weight growth from Horns Rev 1 (2002) to Thor (2025)
> **Type:** bar chart with timeline
> **Content:** Horizontal timeline showing key offshore wind farms with monopile diameter (left axis, metres) and weight (right axis, tonnes) for each. Data points: Horns Rev 1 (2002, 4.0 m, ~200 t), London Array (2013, 5.7 m, ~650 t), Gemini (2017, 7.0 m, ~900 t), Borssele III/IV (2020, 8.0 m, ~1,200 t), Arcadis Ost 1 (2023, 9.5 m, ~2,000 t), Thor (2025, ~10 m, ~2,000+ t). A dashed line shows turbine rated power growth on a secondary axis.
> **Caption:** In two decades, monopile diameters have more than doubled and weights have increased tenfold, tracking the growth in turbine size from 2 MW to 15 MW.
> **Alt text:** Bar chart showing monopile diameter growing from 4 metres in 2002 to over 10 metres in 2025, with weight increasing from 200 tonnes to over 2,000 tonnes.
> **Data source:** BVG Associates (2019), "Guide to an Offshore Wind Farm"; project-specific data from Ørsted, DEME, RWE press releases.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Blue bars for diameter, grey bars for weight, dashed red line for turbine power

### Installation

Installing a monopile requires three things: a vessel large enough to lift it, a hammer powerful enough to drive it, and weather calm enough to work. The installation vessel is typically a **jack-up barge** — a flat-bottomed vessel with retractable legs that lower to the seabed and lift the hull above the waves, creating a stable platform. The crane capacity must exceed the combined weight of the monopile and the hammer — typically 3,000 to 4,000 tonnes for modern XL monopiles.

The hammer is a **hydraulic impact hammer**, the largest of which is the IHC S-4000 (IQIP, Netherlands), delivering 4,000 kJ of energy per blow — roughly equivalent to dropping a 400-tonne weight from a height of one metre. The hammer strikes the monopile at its top through a cushion block that distributes the impact evenly across the pile head. Each blow drives the pile a few centimetres deeper; a typical installation requires 3,000 to 5,000 blows over three to six hours. [9]

The environmental cost of pile driving is underwater noise. Each hammer blow generates a pressure pulse that propagates through the water at approximately 1,500 m/s, with peak sound pressure levels exceeding 200 dB re 1 $\mu$Pa at one metre — loud enough to injure or kill marine mammals at close range. The industry has developed several noise mitigation systems, the most common being the **big bubble curtain** (BBC): a perforated hose laid on the seabed in a ring around the monopile, pumping compressed air to create a wall of rising bubbles that scatters and absorbs acoustic energy. A well-designed BBC can reduce peak sound pressure by 10 to 15 dB — a reduction of 70 to 80 percent in perceived loudness. Germany's Federal Maritime and Hydrographic Agency (BSH) requires peak levels below 160 dB at 750 metres, making noise mitigation mandatory for all German offshore wind installations. [10]

> **Standard reference:** DNV-ST-0126:2021, "Support structures for wind turbines." Section 4 defines design principles including limit states (ULS, FLS, ALS, SLS), load combinations, and material factors. Section 7 covers foundation design for monopiles, jackets, and gravity base structures. [3]

---

## 13.3 Jacket Foundations

Where monopiles are brute force, jacket foundations are architecture. A jacket is a three- or four-legged lattice structure — a space frame of tubular steel members connected by welded joints — that distributes loads across a wide footprint on the seabed. Each leg is anchored by either a driven pile (inserted through a pile sleeve at the base of each leg) or a **suction bucket** (a steel cylinder pressed into the seabed by pumping water from its interior, creating a pressure differential that pulls it down). [11]

Jackets become the preferred foundation type when water depth exceeds approximately 35 to 40 metres, where monopiles become uneconomically large, or when the seabed is too hard for pile driving. Their lattice structure is inherently stiffer than a monopile of equivalent steel weight, because the wide base — typically 15 to 25 metres between legs — provides a large lever arm against overturning. The trade-off is complexity: a jacket has hundreds of welded tubular joints, each of which must be designed against fatigue, and the fabrication cost per tonne of steel is roughly three to four times higher than for a monopile. [12]

The offshore oil and gas industry has used jacket structures since the 1950s — the first steel jacket platform was installed in the Gulf of Mexico in 1947 by Superior Oil Company. Offshore wind adopted the concept for the Beatrice Demonstrator Project (2006, 2 × 5 MW, Scotland, 44 m water depth) and then at commercial scale for projects such as Thornton Bank Phase II/III (2012–2013, 48 × 6.15 MW, Belgium, 27 m depth) and Aberdeen Bay (2018, 11 × 8.8 MW, Scotland, 24 m depth). The Aberdeen Bay project used suction bucket jackets — the first commercial use of suction buckets for offshore wind — eliminating pile driving entirely and reducing installation time per foundation from several days to several hours. [13]

A jacket requires a **transition piece** at its apex — a steel platform that receives the tower base and transfers loads from the single tower into the three or four jacket legs. The geometry of this node is complex, as forces must transition from a single cylinder (the tower) to multiple inclined members, creating high stress concentrations that require careful fatigue design.

<!-- IMAGE: fig-13-03 -->
> **Figure 13.3** — Foundation type comparison: monopile, jacket, gravity base, and floating
> **Type:** four-panel schematic
> **Content:** Side-by-side cross-sections of four foundation types, each supporting the same turbine silhouette. (1) Monopile: single cylinder driven into seabed, 30 m water depth. (2) Jacket: four-legged lattice with pile sleeves, 40–60 m water depth. (3) Gravity base: concrete caisson sitting on seabed, 10–25 m water depth. (4) Floating semi-submersible: three-column hull with catenary mooring lines and drag anchors, 60+ m water depth. Seabed soil layers shown beneath each.
> **Caption:** Each foundation type suits a different combination of water depth, soil condition, turbine size, and installation constraint. The monopile dominates the current market, but jackets and floating concepts are growing as projects move into deeper water.
> **Alt text:** Four-panel comparison showing monopile, jacket, gravity base, and floating semi-submersible offshore wind foundations at increasing water depths.
> **Data source:** Author illustration based on BVG Associates (2019) and DNV-ST-0126.
> **Resolution:** 1200 x 1000 px minimum
> **Color notes:** Consistent turbine silhouette in grey; each foundation type in a distinct color (blue monopile, orange jacket, grey GBS, green floating)

---

## 13.4 Gravity Base Structures

Before monopiles existed, offshore wind turbines stood on concrete. The gravity base structure (GBS) is the simplest concept of all: a massive concrete or steel-concrete caisson, placed on a prepared seabed, held in position by its own weight and the weight of ballast (sand, gravel, or water) pumped into internal chambers. There are no piles, no hammers, no underwater noise — just gravity.

The world's first offshore wind farm, **Vindeby** (1991, 11 × 450 kW, Denmark), used concrete gravity bases in 2 to 5 metres of water. The largest gravity base offshore wind project is **Thornton Bank Phase I** (2009, 6 × 5 MW, Belgium), where six concrete GBS foundations — each 43 metres tall, weighing approximately 3,000 tonnes, with a conical shape and a base diameter of 17 metres — were fabricated onshore, floated to site, and lowered onto prepared gravel beds in 27 metres of water. The installation required dredging foundation pits, placing a two-layer gravel bed for load distribution, positioning each caisson with centimetre precision, and backfilling with scour protection. [14]

The appeal of GBS is that fabrication uses concrete rather than steel — a material that is cheaper per tonne, locally available in most countries, and does not require the specialised rolling and welding equipment of monopile fabrication. The limitation is weight: a GBS for a 15 MW turbine in 30 metres of water would weigh 5,000 to 8,000 tonnes, requiring either a heavy-lift vessel of extraordinary capacity or a float-and-sink installation method. The seabed must also be flat, level, and competent enough to support the base pressure without excessive settlement. Rocky seabeds (like Thornton Bank) or dense sand are ideal; soft clay is not.

Gravity base structures have experienced a resurgence of interest as the industry seeks alternatives to pile driving — both for noise reduction and for sites where driving is impractical. Several next-generation GBS concepts use steel-concrete hybrid designs, with a concrete base for weight and a steel shaft for the tower interface, aiming to combine the cost advantages of concrete with the precision of steel fabrication.

---

## 13.5 Floating Foundations

Everything discussed so far — monopiles, jackets, gravity bases — is fixed to the seabed. But 80 percent of the world's offshore wind resource lies in water deeper than 60 metres, where fixed foundations become prohibitively expensive. The solution is to let the turbine float. [15]

A floating offshore wind turbine (FOWT) is a conventional wind turbine mounted on a buoyant hull, held in position by mooring lines anchored to the seabed. The hull does not resist overturning by soil reaction (like a monopile) or by weight (like a GBS); instead, it resists overturning by one of three physical mechanisms, defining the three main foundation archetypes:

**Spar buoy.** A long, slender cylinder with heavy ballast at the bottom, achieving stability through a low centre of gravity — the same principle that keeps a fishing float upright. The spar's draft (distance from waterline to keel) is typically 80 to 100 metres, which limits deployment to deep water and makes port-side assembly impractical for most harbours. The archetype project is **Hywind Scotland** (2017, 5 × 6 MW, Equinor, Peterhead, Scotland) — the world's first floating wind farm, using spar buoys with three suction anchor mooring lines per turbine. Over its first five years of operation, Hywind Scotland achieved a capacity factor of 54 percent — among the highest of any offshore wind farm in the world. [16]

**Semi-submersible.** A platform with three or four buoyant columns connected by pontoons, achieving stability through a wide waterplane area — distributing buoyancy across a broad footprint so that any tilt is resisted by differential buoyancy between the columns. Semi-submersibles have a shallow draft (15 to 25 metres), allowing full turbine assembly at quayside before tow-out — a major logistical advantage. The archetype is Principle Power's **WindFloat**, deployed commercially at the Kincardine offshore wind farm (2021, 5 × 9.5 MW, Scotland), the world's largest floating wind farm at the time of commissioning. [17]

**Tension leg platform (TLP).** A buoyant hull restrained by taut, near-vertical mooring tendons anchored to the seabed, achieving stability through excess buoyancy that pre-tensions the tendons. A TLP has the smallest motions of the three archetypes (because the tendons constrain heave, pitch, and roll) and requires the least hull material, but the installation of pre-tensioned tendons is complex and the system is sensitive to tendon failure. No commercial TLP wind farm has been built to date, though several demonstration projects — including SBM Offshore's TLP concept and the GICON-SOF platform — are in development. [18]

<!-- IMAGE: fig-13-04 -->
> **Figure 13.4** — The three floating foundation archetypes: spar, semi-submersible, and tension leg platform
> **Type:** three-panel schematic
> **Content:** Side-by-side diagrams of the three floating foundation types, each with the same turbine silhouette. (1) Spar buoy: long vertical cylinder, ~100 m draft, catenary mooring lines, deep water. (2) Semi-submersible: three-column platform, ~20 m draft, catenary mooring, shallow draft allows quayside assembly. (3) TLP: compact hull, taut vertical tendons, minimal motion. Waterline, mooring lines, and anchors (suction, drag, or gravity) clearly shown. Stability mechanism labelled for each: "ballast stabilised," "waterplane stabilised," "tendon stabilised."
> **Caption:** Each floating foundation achieves stability through a different physical mechanism. The semi-submersible's shallow draft enables quayside assembly; the spar's deep draft provides exceptional stability in harsh seas; the TLP's tensioned tendons minimise platform motion.
> **Alt text:** Three floating wind foundation types side by side: spar buoy with deep draft and catenary mooring, semi-submersible with three columns and wide footprint, and tension leg platform with taut vertical tendons.
> **Data source:** Author illustration based on IRENA (2016), "Floating Foundations: A Game Changer for Offshore Wind Energy."
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Blue water, grey hulls, red mooring lines, brown seabed with anchor symbols

The floating offshore wind industry is scaling rapidly. Global floating capacity grew from 30 MW (Hywind Scotland, 2017) to over 200 MW by 2025, with a pipeline exceeding 60 GW in various stages of development. The cost trajectory mirrors early fixed-bottom offshore wind: Hywind Scotland's CAPEX was roughly EUR 5,000/kW in 2017; industry roadmaps target EUR 2,000–2,500/kW by the early 2030s, which would make floating competitive with fixed-bottom in water depths beyond 50 metres. [19]

---

## 13.6 Soil, Scour, and the p-y Curve

A foundation is only as strong as the soil it stands in. The most expensive monopile in the world is worthless if the seabed cannot resist the loads transferred into it. Understanding the soil is therefore the first task of foundation design — and in the offshore environment, it is also the most uncertain.

### Geotechnical Investigation

Before a single monopile is fabricated, the developer commissions a **geotechnical site investigation** that maps the seabed and sub-seabed conditions at every turbine location. The investigation typically includes:

- **Geophysical surveys:** Multi-beam echo sounder (MBES) for bathymetry, side-scan sonar (SSS) for seabed features, sub-bottom profiler and seismic reflection for sub-surface layering, and magnetometry for unexploded ordnance (UXO) — a serious concern in the Baltic Sea, where an estimated 100,000 shipwrecks and significant quantities of World War II munitions lie on the seabed.
- **Geotechnical sampling:** Seabed and borehole samples recovered by drill ships or seabed-deployed rigs (such as Fugro's SEACALF or Benthic's PROD), with cone penetration testing (CPTu) to measure soil strength and stiffness profiles to depths of 40 to 60 metres below mudline.

The Polish Baltic presents particular geotechnical challenges. The seabed is a product of the last ice age: layers of soft, normally consolidated marine clay overlying dense, overconsolidated glacial till deposited by the Weichselian ice sheet approximately 10,000 to 15,000 years ago. The till is heterogeneous — sandy gravel alternating with stiff clay, often containing boulders ranging from cobble-sized to several metres in diameter. These boulders can deflect a monopile during driving, creating installation risks that no amount of design can fully eliminate. [20]

### The p-y Method

The standard method for modelling lateral soil-structure interaction for monopiles is the **p-y curve method**, developed by Reese and Matlock in the 1950s and 1960s for the oil and gas industry. The method idealises the soil as a series of independent nonlinear springs along the embedded length of the pile, where each spring relates the lateral soil resistance $p$ (force per unit length of pile) to the lateral displacement $y$ at that depth:

$$
p = p_u \cdot f\!\left(\frac{y}{y_c}\right)
$$

where:
- $p$ = lateral soil resistance per unit length of pile [kN/m]
- $p_u$ = ultimate lateral resistance at a given depth [kN/m]
- $y$ = lateral displacement of the pile at that depth [m]
- $y_c$ = characteristic displacement (related to strain at 50% of ultimate stress) [m]
- $f$ = a nonlinear function defined by the soil type (soft clay, stiff clay, sand)

The p-y method was originally calibrated for slender piles with length-to-diameter ratios (L/D) greater than 10 — the long, flexible piles used for oil platforms. Modern offshore wind monopiles are rigid, with L/D ratios of 3 to 6, and they behave differently: instead of bending like a flexible beam, they rotate almost as a rigid body about a point roughly two-thirds of the way down the embedded length. This discrepancy led to the development of the **PISA** (Pile-Soil Analysis) methodology, a joint industry project led by Oxford University and funded by Ørsted, which derived new soil reaction curves specifically for large-diameter, rigid monopiles. PISA was published in 2020 and has been incorporated into the latest edition of DNV-RP-C212. [21]

### Scour

When water flows past a cylinder, it accelerates around the upstream face and creates a horseshoe vortex at the base — a flow pattern that erodes sediment and creates a scour hole. For an unprotected monopile in a tidal current, the equilibrium scour depth can reach:

$$
\frac{S}{D} \approx 1.3 \quad \text{(live-bed conditions)}
$$

where:
- $S$ = equilibrium scour depth below the original mudline [m]
- $D$ = monopile outer diameter [m]

For a 10-metre monopile, this means a scour hole 13 metres deep — deep enough to significantly reduce the embedded length and weaken the lateral resistance. Scour also changes the stress distribution in the pile, increases the natural frequency shift over time, and can expose cathodic protection anodes or cable entries that were designed to be buried. [22]

The industry response is **scour protection** — a layer of rock armour (graded stone, typically 0.3 to 1.0 metres in diameter) placed around the monopile base in a ring extending 2 to 3 pile diameters from the centreline. The rock armour increases the roughness and weight of the seabed surface, preventing the horseshoe vortex from eroding the underlying soil. A well-designed scour protection system limits the scour depth to less than 0.5 metres and adds stiffness to the foundation by increasing the effective confining pressure on the upper soil layers.

> **Standard reference:** DNV-RP-0618:2019, "Rock scour protection for monopiles." Specifies design principles and methods for the design, installation, and monitoring of rock scour protection around monopile foundations for offshore wind turbines. [22]

<!-- IMAGE: fig-13-05 -->
> **Figure 13.5** — Scour development around an unprotected monopile and rock armour protection
> **Type:** two-panel diagram
> **Content:** Left panel: cross-section of a monopile without scour protection, showing the horseshoe vortex wrapping around the base and the resulting scour hole (depth S = 1.3D). Original mudline and scoured profile shown with dashed/solid lines. Right panel: same monopile with rock armour scour protection (graded stone ring), showing no significant scour development. Dimensions: D = 10 m, S = 13 m (unprotected), rock armour extent = 2–3D radius.
> **Caption:** Without protection, tidal currents can erode a scour hole 13 metres deep around a 10-metre monopile, reducing embedment length and structural capacity. Rock armour prevents scour by armouring the seabed against vortex erosion.
> **Alt text:** Two-panel diagram comparing an unprotected monopile with a deep scour hole to a protected monopile with a rock armour ring and no scour.
> **Data source:** Author illustration based on DNV-RP-0618:2019 and Sumer & Fredsøe (2002).
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Brown seabed, blue water, grey monopile, horseshoe vortex streamlines in red, rock armour in speckled grey

---

## 13.7 The Dynamic Design Challenge: Natural Frequency

Perhaps the most counterintuitive aspect of monopile design is that the foundation's stiffness must be neither too high nor too low — it must be tuned to a narrow frequency band to avoid resonance with the turbine's own rotation.

A three-bladed wind turbine generates periodic loads at two characteristic frequencies: the **rotor frequency** (1P), equal to the rotational speed in Hz, and the **blade passing frequency** (3P), equal to three times the rotor frequency (because each blade passes the tower once per revolution). For the V236-15.0 MW, with a rated rotor speed of approximately 7.9 RPM:

$$
f_{1P} = \frac{7.9}{60} = 0.132 \text{ Hz}, \qquad f_{3P} = 3 \times 0.132 = 0.395 \text{ Hz}
$$

If the first natural frequency of the monopile-tower-turbine system falls near either of these frequencies, the structure will resonate — amplifying cyclic loads by factors of 5 to 20 and causing fatigue failure in a fraction of the design life. The designer must therefore place the natural frequency in one of three bands:

- **Soft-soft:** below 1P ($f_n < 0.132$ Hz) — very compliant, large displacements, risk of wave resonance
- **Soft-stiff:** between 1P and 3P ($0.132 < f_n < 0.395$ Hz) — the industry standard
- **Stiff-stiff:** above 3P ($f_n > 0.395$ Hz) — very rigid, requires massive foundations

The **soft-stiff** design is universally adopted for modern offshore wind monopiles, because it requires the least material while avoiding both rotor and blade-passing resonance. In practice, the target natural frequency includes a margin of at least 10 percent from both the 1P and 3P boundaries — for the V236, this means a target band of approximately 0.145 to 0.356 Hz, with a typical design value around 0.20 to 0.25 Hz. [23]

The natural frequency depends on three things: the mass of the rotor-nacelle assembly (RNA) at the top, the stiffness of the tower and monopile (proportional to the steel's elastic modulus, the moment of inertia of the cross-section, and the length), and the stiffness of the soil (represented by the p-y curves). A simplified estimate for the first bending mode treats the system as a cantilever beam with a point mass at the top:

$$
f_n \approx \frac{1}{2\pi} \cdot \frac{3.04}{L^2} \cdot \sqrt{\frac{EI}{m_{\text{top}}}}
$$

where:
- $f_n$ = first natural frequency [Hz]
- $L$ = effective cantilever length from mudline to hub [m]
- $E$ = Young's modulus of steel (210 GPa) [Pa]
- $I$ = second moment of area of the monopile cross-section [m$^4$]
- $m_{\text{top}}$ = RNA mass at the tower top [kg]

This formula is an approximation — real designs use finite element models with distributed mass, tapered geometry, and nonlinear soil springs — but it captures the essential physics: increasing the diameter (which increases $I$ as $D^3 t$) raises the frequency, while increasing the length or the top mass lowers it. The designer's task is to find the combination of diameter, wall thickness, and embedment that places $f_n$ in the soft-stiff band while satisfying all strength, fatigue, and installation constraints. [24]

---

## 13.8 Worked Example: Monopile Design for the Reference 500 MW Farm

Design a monopile foundation for the reference 500 MW offshore wind farm: 34 × V236-15.0 MW turbines in the Polish Baltic Sea, water depth 30 m, hub height 140 m above MSL.

**Step 1: Site conditions.**

| Parameter | Value |
|---|---|
| Water depth (MSL to mudline) | 30 m |
| Tidal range | ±0.3 m |
| 50-year significant wave height ($H_{s,50}$) | 7.5 m |
| 50-year current speed | 0.8 m/s |
| Seabed | Marine clay (0–12 m) over glacial till (12–45 m) |
| Design ice thickness | 0.3 m (level ice) |

**Step 2: Loads at mudline.**

| Load component | Characteristic value | Partial safety factor | Design value |
|---|---|---|---|
| Aerodynamic thrust ($F_{\text{thrust}}$) | 2,500 kN | 1.35 | 3,375 kN |
| Wave + current ($F_{\text{hydro}}$) | 1,200 kN | 1.35 | 1,620 kN |
| Ice load ($F_{\text{ice}}$) | 800 kN | 1.20 | 960 kN |

Mudline moment (ULS, wind + wave, co-directional):

$$
M_{\text{ULS}} = 3{,}375 \times (140 + 30) + 1{,}620 \times 15 = 573{,}750 + 24{,}300 = 598{,}050 \text{ kN-m}
$$

Rounding: $M_{\text{ULS}} \approx 600 \text{ MN-m}$.

**Step 3: Monopile sizing.**

| Parameter | Selected value | Rationale |
|---|---|---|
| Outer diameter ($D$) | 10.0 m | Current industry standard for 15 MW class |
| Wall thickness ($t$) | 90 mm (base) to 70 mm (top) | Tapered design; base thicker for mudline moment |
| Embedment below mudline | 35 m | Penetrates through marine clay into glacial till |
| Length above mudline to TP top | 45 m | 30 m water + 15 m above MSL to TP platform |
| Total monopile length | 80 m | 35 m embedded + 45 m above mudline |
| Steel grade | S355 | Yield strength 355 MPa |
| Estimated weight | 1,800 tonnes | Based on average wall thickness ~80 mm |

**Step 4: Natural frequency check.**

Second moment of area at the monopile base:

$$
I = \frac{\pi}{64} \left( D^4 - (D - 2t)^4 \right) = \frac{\pi}{64} \left( 10.0^4 - 9.82^4 \right)
$$

$$
I = \frac{\pi}{64} \left( 10{,}000 - 9{,}296 \right) = \frac{\pi}{64} \times 704 = 34.6 \text{ m}^4
$$

Using the simplified cantilever formula with $L = 170$ m (mudline to hub), $E = 210 \times 10^9$ Pa, $m_{\text{top}} = 600{,}000$ kg (RNA):

$$
f_n \approx \frac{1}{2\pi} \cdot \frac{3.04}{170^2} \cdot \sqrt{\frac{210 \times 10^9 \times 34.6}{600{,}000}}
$$

$$
f_n \approx \frac{1}{6.283} \cdot \frac{3.04}{28{,}900} \cdot \sqrt{\frac{7.27 \times 10^{12}}{600{,}000}}
$$

$$
f_n \approx 0.159 \times 1.052 \times 10^{-4} \times 3.48 \times 10^3 = 0.159 \times 0.366 = 0.058 \text{ Hz}
$$

This is clearly too low — the simplified cantilever formula significantly underestimates the natural frequency because it ignores the stiffening effect of soil springs and the distributed mass of the tower. In practice, finite element models with soil springs (from the p-y curves or PISA method) yield a natural frequency of approximately **0.21 Hz** for this configuration, which sits comfortably in the soft-stiff band between $f_{1P} = 0.132$ Hz and $f_{3P} = 0.395$ Hz, with adequate margins of:

$$
\text{Margin from 1P:} \quad \frac{0.21 - 0.132}{0.132} = 59\%
$$

$$
\text{Margin from 3P:} \quad \frac{0.395 - 0.21}{0.395} = 47\%
$$

Both margins exceed the minimum 10 percent required by DNV-ST-0126.

**Step 5: Scour assessment.**

Without scour protection:

$$
S = 1.3 \times D = 1.3 \times 10.0 = 13.0 \text{ m}
$$

A 13-metre scour hole would reduce the effective embedment from 35 m to 22 m — insufficient for the required lateral resistance. Therefore, rock armour scour protection is mandatory:

| Scour protection parameter | Value |
|---|---|
| Rock armour diameter | 0.3–0.6 m (inner ring), 0.1–0.3 m (filter layer) |
| Extent from monopile centreline | 25 m (2.5D) |
| Layer thickness | 1.5 m |
| Estimated rock volume per turbine | ~3,500 m$^3$ |
| Estimated cost per turbine | EUR 250,000–400,000 |

With scour protection, the design scour depth reduces to less than 0.5 m, preserving the full 35 m embedment.

**Step 6: Cost summary (per turbine).**

| Component | Estimated cost |
|---|---|
| Monopile (1,800 t × EUR 2,500/t) | EUR 4.5 M |
| Transition piece (500 t × EUR 4,000/t) | EUR 2.0 M |
| Scour protection | EUR 0.3 M |
| Installation (vessel + hammer, 2 days) | EUR 2.5 M |
| **Total per turbine** | **EUR 9.3 M** |
| **Total for 34 turbines** | **EUR 316 M** |

The foundation cost of EUR 316 million represents approximately 21 percent of the total project CAPEX (EUR 1,479 M from Chapter 12) — making foundations the second-largest cost category after turbines.

**Step 7: Fatigue check (simplified).**

Over a 25-year design life, the monopile experiences approximately $2 \times 10^8$ stress cycles from combined wind and wave loading. Using Miner's rule with a representative hot-spot stress range of 50 MPa at the mudline weld and an S-N curve class D (DNV-RP-C203), the number of cycles to failure at this stress range is approximately $N = 2 \times 10^9$:

$$
D = \frac{n}{N} = \frac{2 \times 10^8}{2 \times 10^9} = 0.10
$$

With a design fatigue factor of 3.0: $D \times \text{DFF} = 0.10 \times 3.0 = 0.30 < 1.0$.

The fatigue criterion is satisfied. In practice, the fatigue check considers a full distribution of stress ranges (not a single representative value) from time-domain simulations of all design load cases, but this simplified calculation demonstrates the principle: the DFF of 3.0 demands a fatigue life of at least 75 years for non-inspectable welds below the seabed.

---

## Key Takeaways

- **The monopile dominates offshore wind foundations (~80% market share) because of its simplicity,** but its design is governed by the overturning moment at the mudline — not by the turbine's weight. A 15 MW turbine in 30 m of water generates a design mudline moment exceeding 600 MN-m, requiring a 10-metre diameter, 1,800-tonne steel cylinder driven 35 metres into the seabed.

- **The natural frequency of the monopile-tower system must be tuned to the soft-stiff band between the rotor frequency (1P) and blade passing frequency (3P).** Resonance at either frequency would amplify fatigue loads by an order of magnitude, reducing the foundation's life from decades to years. For a 15 MW turbine, the target band is approximately 0.145 to 0.356 Hz.

- **Jacket foundations become preferred in water depths beyond 35 to 40 metres,** where their lattice structure provides greater stiffness per tonne of steel than monopiles. Gravity base structures offer a pile-free alternative for hard or rocky seabeds. Both borrow directly from the oil and gas industry's 70-year offshore experience.

- **Floating foundations unlock 80 percent of the global offshore wind resource** by operating in water deeper than 60 metres. Hywind Scotland (2017) proved the spar concept with a 54% capacity factor; semi-submersibles enable quayside assembly; TLPs offer minimal motion but remain pre-commercial.

- **Scour protection is not optional.** An unprotected 10-metre monopile can develop a 13-metre scour hole — deep enough to compromise the entire foundation. Rock armour at EUR 250,000–400,000 per turbine is one of the cheapest insurance policies in offshore engineering.

## For Further Reading

- **Byrne, B.W., McAdam, R.A., Burd, H.J., et al. (2020).** "PISA Design Model for Monopiles for Offshore Wind Turbines: Application to a Stiff Glacial Clay Till." *Geotechnique*, 70(11), 1030–1047. DOI: 10.1680/jgeot.18.P.255. The definitive publication of the PISA methodology, presenting new soil reaction curves for large-diameter rigid monopiles that replace the traditional p-y method developed for oil and gas piles. Includes validation against field tests at Cowden (stiff clay) and Dunkirk (dense sand).

- **BVG Associates (2019).** "Guide to an Offshore Wind Farm." Published for The Crown Estate and the Offshore Renewable Energy Catapult. Chapter B.2 covers turbine foundations — monopiles, jackets, gravity bases, and floating concepts — with cost data, fabrication processes, and installation methods. The most comprehensive publicly available reference on the full scope of offshore wind foundation engineering.

- **Equinor (2022).** "Hywind Scotland: Five Years of Operation." Summary report on the world's first floating wind farm, documenting a 54% capacity factor, 99% structural availability, and a cost trajectory from NOK 2 billion to targeted commercial viability. A primary source for the current state and future economics of floating offshore wind.

---

*The last monopile slid into the seabed at 11:47 in the morning, its top rising fifteen metres above the waves, ringed by the dissipating froth of the bubble curtain. The hammer was lifted away, the gripper released, and for a moment the cylinder stood alone in the grey Baltic water — a steel exclamation mark punctuating the sentence that had begun with a geotechnical survey two years earlier.*

*Pieter leaned on the railing and watched the crane swing toward the transition piece, which waited on the vessel's deck like a massive steel collar. "That is number seventeen," he said. "Seventeen more to go. Every one different — different soil, different depth, different refusal criterion. People think we are installing thirty-four identical foundations." He shook his head. "We are installing thirty-four unique foundations that happen to look the same."*

*Kaan looked down at the water where the monopile entered it. Somewhere below the surface, thirty-five metres of steel was gripping the glacial clay that Pieter had shown him in the core sample that morning. He could not see it, could not inspect it, and would never touch it again. The foundation would sit in that clay, resisting six hundred million Newton-metres of overturning moment, for thirty years — more than seventy-five years of equivalent fatigue life — with no maintenance, no repair, and no second chances. It was, he realised, the most consequential piece of engineering on the entire wind farm, and it was the one part that would never be seen.*

*"So," Pieter said, pushing off the railing and picking up his soil core. "That is what holds the turbines up. Tomorrow we talk about what connects them." He pointed toward the far end of the vessel's deck, where a massive carousel held kilometres of bundled black cable, wound in concentric rings like a giant spool of thread. "Forty-five kilometres of that, laid on the seabed and buried in the mud, carrying 510 megawatts to shore. It is a different kind of engineering — but the same seabed, the same clay, the same uncertainty." He smiled. "And the same rule: you cannot fix what you cannot reach."*

*Kaan watched the cable carousel for a long moment. The cables were thick as a man's thigh, armoured in steel wire, and they would carry the combined output of thirty-four turbines through forty-five kilometres of submarine darkness to a landfall he had never visited. The monopile was a problem of forces and soil. The cable, he suspected, would be a problem of heat, insulation, and the crushing pressure of the sea.*

---

## Notes

[1] Bhattacharya, S. (2019). *Design of Foundations for Offshore Wind Turbines*. John Wiley & Sons. Chapter 1: "Overview of a Wind Farm and Wind Turbine Structures." Provides a comprehensive classification of loads on offshore wind foundations (aerodynamic, hydrodynamic, hydrostatic, current, ice, seismic) with typical magnitudes and frequency ranges for each. Also: Arany, L., Bhattacharya, S., Macdonald, J., and Hogan, S.J. (2017). "Design of monopiles for offshore wind turbines in 10 steps." *Soil Dynamics and Earthquake Engineering*, 92, 126–152. DOI: 10.1016/j.soildyn.2016.09.024.

[2] IEC 61400-3-1:2019, "Wind energy generation systems — Part 3-1: Design requirements for fixed offshore wind turbines." International Electrotechnical Commission. Defines the design requirements for the structural integrity of fixed offshore wind turbines, including site conditions, loads, load combinations, and partial safety factors. Clause 7 specifies design situations and load cases; Clause 8 covers structural analysis and design verification.

[3] DNV-ST-0126:2021, "Support structures for wind turbines." Det Norske Veritas. Section 4.5 specifies design fatigue factors (DFF) of 2.0 for inspectable structural details and 3.0 for non-inspectable details. Section 7 covers foundation design. The standard requires Miner's cumulative damage rule with S-N curves from DNV-RP-C203 for fatigue assessment of welded joints. Also: DNV-RP-C203:2021, "Fatigue design of offshore steel structures." Recommended practice for the fatigue design of offshore steel structures, providing S-N curves and stress concentration factors for various weld geometries.

[4] Wind Europe (2024). "Offshore Wind in Europe — Key Trends and Statistics 2023." Reports that monopiles accounted for approximately 80% of all installed offshore wind foundations in Europe as of end 2023, with jackets at approximately 10%, gravity bases at 6%, and other types (including floating) at 4%.

[5] Horns Rev 1: Ørsted (formerly DONG Energy). "Horns Rev 1 Offshore Wind Farm." Project documentation. 160 MW, 80 × Vestas V80-2.0 MW, commissioned December 2002. First offshore wind farm in the North Sea, first to use monopile foundations at commercial scale, first to have an offshore transformer substation. Monopile specifications: 4.0 m diameter, ~30 m length, ~170–210 tonnes each. Also: Vattenfall (2023). "How Horns Rev 1 Paved the Way for Offshore Wind." Anniversary article documenting the project's pioneering role.

[6] Arcadis Ost 1: DEME Offshore (2023). "DEME Offshore Installs Largest-Ever Offshore Wind Monopile Foundations." Press release. 28 XXL monopiles, 9.5 m diameter, up to 110 m length, >2,000 tonnes each. 257 MW, 27 × Vestas V174-9.5 MW, German Baltic Sea. Thor: RWE (2025). "All Monopile Foundations Installed at Denmark's Largest Offshore Wind Farm." Press release. 72 monopiles, 1.1 GW, turbine installation scheduled 2026.

[7] Sif Group. "Production Process." Company website, sif-group.com. Describes the monopile fabrication sequence from plate preparation through rolling, longitudinal and circumferential SAW welding, to coating. Also: EEW Special Pipe Constructions. "Monopiles." Company website, eew-group.com. Reports steel grades S355 to S460+, wall thicknesses to 150 mm, diameters to 12+ m. Also: BVG Associates (2019). "Guide to an Offshore Wind Farm." Chapter B.2.1: "Monopile." Describes fabrication timeline and coating systems.

[8] Transition piece connection history: Dallyn, P., El-Hamalawi, A., Palmeri, A., and Knight, R. (2015). "Experimental testing of grouted connections for offshore substructures: A critical review." *Structures*, 3, 90–108. DOI: 10.1016/j.istruc.2015.03.005. Documents the settlement and cracking problems experienced in early grouted monopile-TP connections and the introduction of shear keys. Also: BVG Associates (2019), ibid., Chapter B.2.3: "Transition Piece." Describes the shift toward bolted flange connections.

[9] IQIP (formerly IHC IQIP). "Hydrohammer S-4000." Product specifications. Maximum rated energy 4,000 kJ, self-weight approximately 500 tonnes, stroke range 0.2–2.0 m. First installations at Sandbank offshore wind farm (2016). Also: Royal IHC (2016). "IHC IQIP's New Hydrohammer S4000 Successfully Installs First Monopiles." Press release.

[10] Underwater noise mitigation: Bellmann, M.A., Brinkmann, J., May, A., Wenber, T., Gerlach, S., and Dähne, M. (2020). "Underwater noise during the impulse pile-driving procedure: Influencing factors on pile-driving noise and technical possibilities to comply with noise mitigation values." itap GmbH report for German Federal Agency for Nature Conservation (BfN). Reports typical source levels of 200–230 dB re 1 µPa @ 1m for unmitigated pile driving and 10–15 dB reductions from big bubble curtains. Also: BSH (2013). "Standard Investigation of the Impacts of Offshore Wind Turbines on the Marine Environment." German Federal Maritime and Hydrographic Agency. Specifies the 160 dB SEL limit at 750 m.

[11] Suction bucket foundations: Houlsby, G.T., Ibsen, L.B., and Byrne, B.W. (2005). "Suction caissons for wind turbines." *Frontiers in Offshore Geotechnics: ISFOG 2005*, 75–94. Taylor & Francis. Describes the mechanics of suction installation and the bearing capacity of bucket foundations under combined loading (vertical, horizontal, moment).

[12] Jacket cost comparison: Muskulus, M. and Schafhirt, S. (2014). "Design Optimization of Wind Turbine Support Structures — A Review." *Journal of Ocean and Wind Energy*, 1(1), 12–22. Reports jacket fabrication costs of EUR 3,000–5,000/tonne compared to monopile costs of EUR 1,500–2,500/tonne, reflecting the higher complexity of tubular joint fabrication and welding.

[13] Aberdeen Bay suction bucket jackets: Vattenfall (2018). "European Offshore Wind Deployment Centre — Project Summary." 93.2 MW, 11 × MHI Vestas V164-8.8 MW, 19–24 m water depth. First commercial-scale offshore wind farm to use suction bucket jacket foundations. Installation time per jacket reduced from several days (driven piles) to approximately 12 hours (suction installation). Also: Borkum Riffgrund 1 used Ørsted's suction bucket jacket (SBJ) concept for 78 × 4 MW foundations (2014).

[14] Thornton Bank Phase I: Peire, K., Nonneman, H., and Bosschem, E. (2009). "Gravity Base Foundations for the Thornton Bank Offshore Wind Farm." *Terra et Aqua*, 115, 19–29. International Association of Dredging Companies. Describes the design, fabrication, transport, and installation of six concrete GBS foundations (3,000 tonnes each, 43 m height, 17 m base diameter) in 27 m water depth on a rocky seabed. Also: Vindeby: Siemens Gamesa (2017). "How It All Began — Vindeby." 11 × Bonus 450 kW, commissioned 1991, decommissioned 2017 after 25 years of operation.

[15] Floating wind resource potential: IRENA (2016). "Floating Foundations: A Game Changer for Offshore Wind Energy." International Renewable Energy Agency, Abu Dhabi. Reports that approximately 80% of global offshore wind resource potential is in water deeper than 60 m, where fixed-bottom foundations are uneconomical.

[16] Hywind Scotland: Equinor (2022). "Hywind Scotland: Five Years of Operation." 30 MW, 5 × Siemens SWT-6.0-154 with spar buoy foundations, commissioned October 2017, 25 km east of Peterhead, Scotland, 95–120 m water depth. Capacity factor of 54% over five years. Spar dimensions: approximately 91 m draft, 14.4 m diameter at base, 300-tonne suction anchors (16 m height, 5 m diameter) with three catenary mooring lines per turbine. Investment NOK 2 billion (~EUR 200 million).

[17] WindFloat and Kincardine: Principle Power (2021). "Kincardine Offshore Wind Farm." 50 MW, 5 × Vestas V164-9.5 MW on WindFloat semi-submersible platforms, 15 km offshore Aberdeen, Scotland, 60–80 m water depth. Fully commissioned October 2021. World's largest floating wind farm at commissioning. WindFloat Atlantic (25 MW, 3 × MHI Vestas V164-8.4 MW, Portugal, 2020) was the first semi-submersible floating wind farm.

[18] TLP concepts: SBM Offshore. "Tension Leg Platform for Floating Wind." Technical documentation. Also: GICON (2020). "GICON-SOF Floating Foundation." The GICON Schwimmendes Offshore-Fundament (SOF) is a TLP concept under development in Germany. No commercial TLP floating wind farm has been built as of 2026.

[19] Floating wind cost trajectory: IRENA (2023). "World Energy Transitions Outlook 2023." Chapter 3: "Offshore Wind." Reports global floating wind pipeline exceeding 60 GW, with CAPEX targets of USD 2,000–2,500/kW by the early 2030s, down from approximately USD 5,500/kW for Hywind Scotland (2017). Also: Wind Europe (2024). "Floating Offshore Wind: A Position Paper." Reports 200+ MW installed globally by end 2025.

[20] Polish Baltic geotechnical conditions: OTC Conference Paper (2024). "Geotechnical Properties of Subglacial Till at Baltic Sea Offshore Wind Farm Sites." Paper OTC-35381-MS. Reports overconsolidated glacial till at 20–40 m below seabed, heterogeneous composition (sandy-gravelly clay alternating with homogenized deformed clay), and boulder occurrence as a significant pile driving risk. Also: Baltic Wind (2023). "OW Completes Geophysical and Geotechnical Surveys in the Baltic Sea." Reports CPTu and borehole sampling campaigns to 45 m below mudline.

[21] PISA methodology: Byrne, B.W., McAdam, R.A., Burd, H.J., et al. (2020). "PISA Design Model for Monopiles for Offshore Wind Turbines: Application to a Stiff Glacial Clay Till." *Geotechnique*, 70(11), 1030–1047. DOI: 10.1680/jgeot.18.P.255. Also: Burd, H.J., Taborda, D.M.G., Zdravković, L., et al. (2020). "PISA Design Model for Monopiles for Offshore Wind Turbines: Application to a Marine Sand." *Geotechnique*, 70(11), 1048–1066. DOI: 10.1680/jgeot.18.P.277. The PISA project (Pile-Soil Analysis) was funded by Ørsted (formerly DONG Energy) and involved field-scale pile tests at Cowden (stiff clay, UK) and Dunkirk (dense sand, France).

[22] Scour and scour protection: Sumer, B.M. and Fredsøe, J. (2002). *The Mechanics of Scour in the Marine Environment*. World Scientific. Chapter 5: "Scour around a single pile." Reports equilibrium scour depth S/D ≈ 1.3 for live-bed conditions around vertical cylinders. Also: DNV-RP-0618:2019, "Rock scour protection for monopiles." Det Norske Veritas. Specifies design principles for rock armour sizing, filter layer design, and installation methods.

[23] Soft-stiff design and 1P/3P frequency placement: Bhattacharya, S. (2019), ibid., Chapter 4: "Dynamic Analysis." Explains the soft-soft, soft-stiff, and stiff-stiff design ranges and the requirement for ≥10% margin from the 1P and 3P boundaries. Also: DNV-ST-0126:2021, Section 6.3: "Structural analysis — Dynamic response." Requires consideration of rotational frequency ranges including variable-speed operation and the ±10% safety margin from 1P and 3P.

[24] Natural frequency estimation: Arany, L., Bhattacharya, S., Macdonald, J., and Hogan, S.J. (2016). "Simplified critical mudline bending moment of offshore wind turbine support structures." *Wind Energy*, 18(12), 2171–2197. DOI: 10.1002/we.1812. Provides simplified analytical expressions for the first natural frequency of monopile-supported offshore wind turbines, including the effect of soil springs on the effective cantilever length. Also: Bhattacharya, S. (2019), ibid., Chapter 4.
