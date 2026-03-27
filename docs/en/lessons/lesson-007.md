# Lesson 007 — HV Grid Integration: Pandapower Steady State Model

!!! abstract "Course Navigation"
:material-arrow-left: **Previous:** [Lesson 006 — Layout Optimization, Blocking & AEP Cascade](lesson-006.md) | **Next:** [Lesson 008 — Dynamic Grid Compatibility: ANDES, FRT, Frequency, SSO & Converter](lesson-008.md) :material-arrow-right:

**Phase:** P2 | **Language:** English | **Progress:** 8 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-24
> **Phase:** P2 (HV Grid Integration)
> **Roadmap sections:** [Phase 2 — Section 2.1 Electrical Network Model, Section 2.2 Load Flow, Section 2.3 Short-Circuit, Section 2.4 Reactive Compensation]
> **Language:** English
> **Previous lesson:** Lesson 006
> **last_commit_hash:** 0a571666d8c2a7e2e62689f3b54d6b1e90d830a4

---

## What You Will Learn

- Pi-model physics and IEC 60287 parameters of submarine XLPE cables
- Mathematical basis of the Newton-Raphson load flow solver
- IEC 60909 short circuit calculation methodology (Ik'', ip, Sk'')
- Ferranti effect and why STATCOM reactive power compensation is necessary
- Verify compliance with PSE IRiESP voltage limits (0.95–1.05 pu)

---

## Part 1: Cable Pi-Model — From Physics to Code

### Real Life Problem

Think of a garden hose. The longer the hose, the lower the water pressure at the end (resistance losses). But there is another difference in electrical cables: the cable's insulation material (XLPE) acts like a small capacitor. Our 45 km long 220 kV subsea cable produces ~130 MVAR reactive power at no load — equivalent to the reactive power consumed by a small city.

### What the Standards Say

**IEC 60287** calculates cable current carrying capacity and electrical parameters (R, X, C). **IEC 60228** standardizes conductor cross-sections (500, 630, 800, 1000 mm²). In offshore wind farms, cable grading is used: turbines far from the OSS use cable with small cross-section (less current), turbines close to OSS use cable with large cross-section (more cumulative current).

### Mathematics

The Pi-model approximates the distributed parameter transmission line with three lumped elements:

```
    R + jX
 ──┤├────┤├────┤├──
 │        │
 ═ jB/2   jB/2 ═
 │        │
 ─────────────────
```

For each cable segment:
- **R** [Ω/km]: Conductor resistance (inversely proportional to cross-sectional area)
- **X** [Ω/km]: Inductive reactance (magnetic field)
- **C** [nF/km]: Capacitance per phase (XLPE dielectric)

Reactive power generation (Rule 7 — always positive):

$$Q_{kablo} = \omega \times C \times V^2 \times L$$

For our 220 kV export cable:$$Q = 2\pi \times 50 \times 190 \times 10^{-9} \times (220000)^2 \times 45 \approx 130 \text{ MVAR}$$

### What We Built

**File:** `backend/app/services/p2/network_model.py`

Cable parameters are defined by dataclass `CableSpec`:

```python
@dataclass(frozen=True)
class CableSpec:
  cross_section_mm2: float
  r_ohm_per_km: float
  x_ohm_per_km: float
  c_nf_per_km: float
  max_i_ka: float

# 66 kV dizi kabloları — OSS'ye uzaklığa göre derecelendirilmiş
ARRAY_CABLE_500 = CableSpec(500, 0.0366, 0.110, 200, 0.715) # Uzak
ARRAY_CABLE_630 = CableSpec(630, 0.0283, 0.105, 215, 0.818) # Orta
ARRAY_CABLE_800 = CableSpec(800, 0.0221, 0.100, 230, 0.900) # Yakın
```

The cable grading function selects cross-section based on position in the string:

```python
def _get_cable_grade(position_in_string: int, string_length: int) -> CableSpec:
  normalised = position_in_string / max(string_length - 1, 1)
  if normalised < 0.4:
    return ARRAY_CABLE_500  # uzak — en az akım
  elif normalised < 0.7:
    return ARRAY_CABLE_630  # orta
  else:
    return ARRAY_CABLE_800  # OSS'ye yakın — en fazla kümülatif akım
```

### Why is it important?

> **Why** don't we make all array cables the same cross-section?
> Using the same cross section would be simple but inefficient. Turbines far from the OSS carry only 1 turbine current (131 A), but the cable closest to the OSS carries 5 turbine currents (655 A). Putting 800 mm² everywhere is unnecessary cost — 500 mm² can already carry 715 A. Cable grading can reduce a project's cable cost by 15-25%.

---

## Part 2: Network Topology — 38 Busbars, 35 Cables, 2 Transformers

### Real Life Problem

Think of a city's power grid: there are many transformers and cables on the way from the power plant to the factory. Each changes the voltage level and creates loss. Our offshore wind farm is the same: three voltage levels from 66 kV to 400 kV, different equipment on each.

### What We Built

The `build_network()` function creates the 38-bar Pandapower network:

| Element | Number | Explanation |
| -------- | ------ | ---------- |
| **Guys** | 38 | 1× PSE 400kV + 1× Onshore 220kV + 1× OSS 220kV + 1× OSS 66kV + 34× WTG 66kV |
| **Cables** | 35 | 34× array (66 kV, rated) + 1× export (220 kV, 45 km) |
| **Trafolar** | 2 | 66/220 kV Dyn11 (OSS) + 220/400 kV YNyn0 (onshore) |
| **Generators** | 35 | 34× WTG (15 MW) + 1× STATCOM (Q kontrol) |
| **Shunt reactor** | 1 | 50 MVAR (US 220 kV) |
| **External network** | 1 | PSE 400 kV, Ssc = 10 GVA |

**String düzeni:** 6 string × 5 WTG + 1 string × 4 WTG = 34 WTG

---

## Part 3: Load Flow — Voltage Verification with Newton-Raphson

### Physics

Newton-Raphson charge flow solves the force balance equations:

$$P_i = V_i \sum_j V_j (G_{ij} \cos\theta_{ij} + B_{ij} \sin\theta_{ij})$$
$$Q_i = V_i \sum_j V_j (G_{ij} \sin\theta_{ij} - B_{ij} \cos\theta_{ij})$$

The Jacobian matrix is ​​updated at each iteration:

$$\begin{bmatrix} \Delta P \\ \Delta Q \end{bmatrix} = \begin{bmatrix} \frac{\partial P}{\partial \theta} & \frac{\partial P}{\partial V} \\ \frac{\partial Q}{\partial \theta} & \frac{\partial Q}{\partial V} \end{bmatrix} \begin{bmatrix} \Delta \theta \\ \Delta V \end{bmatrix}$$

Convergence criterion: $\|\Delta P, \Delta Q\| < 10^{-8}$ MVA

### Scenarios

**PSE IRiESP** requires voltage compatibility in four operating scenarios:

| Scenario | Production | Aim |
| --------- | -------- | ------ |
| **Full load** | 510 MW (34 × 15 MW) | Cable thermal limits |
| **Part load** | 255 MW (%50) | Normal operating voltages |
| **Empty load** | 0 MW | Ferranti voltage rise |
| **N-1** | 450 MW (String 7 disabled) | Redundancy margins |

### Results

All four scenarios converge and meet voltage limits of 0.95–1.05 pu (with STATCOM auto-dispatch):

- **Full load:** Losses ~1-3% (5-15 MW), voltage compatible
- **Part load:** Lower losses, voltage compatible
- **No load:** Minimum loss (transformer iron losses only), Ferranti effect compensated
- **N-1:** 450 MW, redundancy verified

### Code Review

STATCOM auto-dispatch reduces the voltage to 1.0 pu on the OSS 220 kV bus:

```python
def auto_statcom_dispatch(net, target_vm_pu=1.0, tolerance_pu=0.01):
  for _ in range(max_iterations):
    pp.runpp(net, algorithm="nr")
    v_oss = net.res_bus.at[oss_bus_idx, "vm_pu"]
    deviation = target_vm_pu - v_oss
    if abs(deviation) <= tolerance_pu:
      break
    # Oransal ayarlama: ~5000 MVAR/pu kazanç
    current_q += deviation * 5000.0
    # STATCOM ratingi ile sınırla (±120 MVAR)
    current_q = max(-120, min(120, current_q))
```

---

## Part 4: Short Circuit — IEC 60909

### Physics

IEC 60909 calculates the initial symmetric short circuit current in the busbar:

$$I_k'' = \frac{c \times V_n}{\sqrt{3} \times Z_k}$$

- **c** = voltage factor (max: 1.1, min: 1.0 — IEC 60909 Table 1)
- **V_n** = nominal gerilim [V]
- **Z_k** = equivalent short-circuit impedance [Ω] seen from the fault point

Peak current (DC component):$$i_p = \kappa \times \sqrt{2} \times I_k''$$

Short circuit power:$$S_k'' = \sqrt{3} \times V_n \times I_k'' \quad [\text{MVA}]$$

### What the Standards Say

**IEC 62271-100** defines breaker capacities:

| Voltage Level | Cutter Capacity |
| ------------------ | ------------------- |
| 66 kV | 25 kA |
| 220 kV | 40 kA |
| 400 kV | 50 kA |

### What We Built

**Engineering Rule 3:** IEC 60909 calculations are made with Pandapower's built-in function `calc_sc()` — custom implementation PROHIBITED.

```python
sc.calc_sc(net, fault="3ph", case="max", ip=True)
```

Results: All busbar currents are below breaker capacities → breakers are adequate.

---

## Chapter 5: STATCOM Sizing — Ferranti Effect and Compensation

### Physics — Ferranti Effect

The voltage at the receiving end of an unloaded or lightly loaded cable is higher than the sending end:

$$V_{alıcı} \approx \frac{V_{gönderici}}{\cos(\beta L)}$$

Ferranti rise in our 45 km, 220 kV cable is around ~2-5%. This can exceed voltage limits without compensation.

### Compensation Strategy

1. **Shunt reactor (50 MVAR):** Constant inductive load absorbs part of cable Q
2. **STATCOM (±120 MVAR):** Dynamic compensation generates/absorbs Q according to voltage

**Why STATCOM and not SVC?**
- Full Q capacity at low voltage (critical during FRT)
- Faster response (< 1 cycle vs 2-3 cycles)
- Smaller space on offshore platform
- No harmonic filter required (PWM switching)

### Verification Results

| Metric | Value |
| -------- | ------- |
| Cable Q (220 kV, 45 km) | ~130 MVAR |
| shunt reactor | 50 MVAR |
| STATCOM rating | ±120 MVAR |
| Ferranti rise (without compensation) | > 1.0 pu |
| Compensated V_max | ≤ 1.05 pu ✓ |

---

## Test Summary

| Test File | Number of tests | Conclusion |
| ------------- | ------------- | ------- |
| `test_network_model.py` | 21 | ✓ All passed |
| `test_load_flow.py` | 20 | ✓ All passed |
| `test_short_circuit.py` | 13 | ✓ All passed |
| `test_statcom.py` | 14 | ✓ All passed |
| **Total** | **68** | **✓ 68/68** |

---

## Interview Questions

### Question 1: Ferranti Effect
**"Your 45 km 220 kV submarine export cable operates at empty load. Why does the voltage at the OSS bus rise above the nominal value and how do you prevent this?"**

*Hint: Cable capacitance, reactive power generation, shunt reactor + STATCOM compensation*

### Question 2: Cable Rating
**"Why do you use different cross-sections (500/630/800 mm²) in 66 kV array cables? What is the disadvantage of making them all 800 mm²?"**

*Hint: Current cumulation, cost optimization, thermal limits*

### Soru 3: IEC 60909
**"What does the voltage factor c_max = 1.1 in IEC 60909 mean and why is max case used in breaker sizing?"**

*Hint: Operating voltage tolerance, worst case fault current, safety margin*

---

## Simple Explanation

Today we built the electrical grid of our wind farm on the computer — the entire system from 34 turbines connected to the land by subsea cable and then to the national grid. We verified that electricity was flowing at the correct voltage in four different situations (full power, half power, idle, one line faulty). We calculated what would happen in the event of a short circuit and showed that the protection equipment is sufficient. Finally, we controlled the voltage rise (Ferranti effect) created by the long submarine cable with STATCOM and the reactor.

## Technical Description

In the P2A session, a 66/220/400 kV full-scale grid model was created with Pandapower. In the 38-bar, 35-wire (pi-model, IEC 60287 parameters), 2-transformer (Dyn11 + YNyn0) network, Newton-Raphson load flow converged in 4 scenarios (full, partial, no-load, N-1) and PSE IRiESP voltage limits (0.95–1.05 pu) were met with STATCOM auto-dispatch. IEC 60909 short circuit analysis (3-phase, c_max=1.1, c_min=1.0) gave Ik'' values ​​below the breaker capacities in all busbars. STATCOM sizing eliminated the Ferranti voltage rise by compensating the ~130 MVAR capacitive Q generation of the 45 km export cable with a 50 MVAR shunt reactor + ±120 MVAR STATCOM. 68 unit tests passed 100%.
