# Realistic Wind Farm Simulation Enhancement Plan

## Current State Assessment

### Turbine Layout: GOOD (Already Realistic)
The current layout is **already well-designed** — 6 strings × 5-6 turbines = 34 total:
- Strings run N-S, spaced E-W across the farm area
- 6D streamwise spacing (~1,416m between turbines in a string)
- 8D crosswind spacing (~1,888m between strings)
- This matches real offshore wind farm design practice

**Minor improvement needed**: Add slight staggering/offset between alternate strings. Currently all strings share the same lat values — real farms offset alternate rows by ~0.5D to further reduce systematic wake interference.

### What's Missing for Realism
The Leaflet map shows a static dark ocean — no wind flow, no waves, no weather context. Turbines spin but the environment feels lifeless compared to tools like QBlade, SIMIS/Ashes, or monitoring dashboards like Windy.com.

---

## Phase 1: Wind Particle Overlay (Windy.com Style)
**Impact: HIGH | Effort: MEDIUM | Zero new dependencies**

### What
Animated wind particles flowing across the map showing wind direction and speed — like Windy.com or earth.nullschool.net. Particles flow from the current wind direction, speed correlates to particle velocity, color indicates wind speed intensity.

### Implementation
1. Create a **custom Leaflet canvas overlay** using `L.Canvas` extension
2. Spawn ~300 particles across the visible map bounds
3. Each particle moves in the wind direction at proportional speed
4. Particle color scale: `#60a5fa` (light breeze) → `#06b6d4` (moderate) → `#f0f0f0` (strong) → `#fbbf24` (near cut-out)
5. Particles fade out and respawn at random positions for natural flow
6. Reads wind speed/direction from existing `landingStore` (already has this data)

### Files
- **NEW**: `frontend/src/components/landing/WindParticleOverlay.tsx`
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx` (mount overlay)
- **EDIT**: `frontend/src/index.css` (canvas z-index)

### Performance
- HTML5 Canvas (not SVG) — handles 500+ particles at 60fps
- `requestAnimationFrame` loop with delta-time interpolation
- Particle count scales with zoom level
- Particles only render within visible map bounds

---

## Phase 2: Wake Effect Visualization
**Impact: HIGH | Effort: MEDIUM | Educational Value: VERY HIGH**

### What
Show wake deficit cones/gradients behind each turbine based on current wind direction. This is the **#1 educational differentiator** — students SEE why turbine spacing and layout matter.

### Implementation
1. Render translucent wake cones as Leaflet polygon overlays
2. Each turbine casts a wake cone in the downwind direction
3. Cone geometry uses **Jensen/Park wake model**: width = D + 2·k·x
4. Color: semi-transparent gradient from red/orange (high deficit) to transparent
5. Downstream turbines in wake zones show a "-X%" wake loss badge
6. Recalculate only when wind direction changes (debounced 500ms)

### Wake Math (Jensen Model — ~20 lines)
```
deficit = (1 - sqrt(1 - Ct)) / (1 + k·x/r)²
Ct ≈ 0.8 (thrust coefficient at rated)
k ≈ 0.04 (offshore wake decay constant)
D = 236m (rotor diameter)
```

### Files
- **NEW**: `frontend/src/components/landing/WakeEffectLayer.tsx`
- **NEW**: `frontend/src/utils/wakeModel.ts` (Jensen wake math)
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx`

---

## Phase 3: Ocean Wave Animation (CSS-only)
**Impact: MEDIUM-HIGH | Effort: LOW | Zero new dependencies**

### What
Subtle animated wave texture on the ocean to break the flat dark background. NOT full WebGL — just enough visual texture to feel like real sea.

### Implementation
- Overlay a semi-transparent SVG pattern layer on the map
- 2-3 layered sine waves with different periods, amplitudes, opacity
- Waves move slowly in the prevailing wave direction (derived from wind)
- Wave intensity scales with wind speed (calm = subtle ripples, strong = visible swells)
- Pure CSS `@keyframes` animation — no JS computation

### Files
- **NEW**: `frontend/src/components/landing/OceanWaveOverlay.tsx`
- **EDIT**: `frontend/src/index.css` (wave keyframes)
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx`

---

## Phase 4: Turbine Layout Micro-Improvements
**Impact: MEDIUM | Effort: LOW | Quick wins**

### Changes
1. **Stagger alternate strings** — offset strings 2, 4, 6 by ~700m south. Real farms do this to reduce systematic wake alignment
2. **Yaw rotation** — rotate turbine nacelle SVG icons to face into the wind direction (currently all face up regardless of wind). Read wind direction from store, apply CSS `transform: rotate()`
3. **Foundation visibility at high zoom** — at zoom ≥ 14, show monopile circle outline around turbine base
4. **Nacelle operating glow** — operating turbines emit a subtle green/cyan pulse from nacelle (shows active generation)

### Files
- **EDIT**: `frontend/src/constants/windFarmLayout.ts` (stagger lat coordinates)
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx` (yaw rotation, zoom-dependent detail)

---

## Phase 5: Environmental Data Layers
**Impact: MEDIUM | Effort: MEDIUM | Professional SCADA features**

### Features
1. **Sea state indicator** — Beaufort scale badge + significant wave height (Hs) in compass area or KPI ribbon
2. **Bathymetry contours on Leaflet** — depth lines already exist in `windFarmLayout.ts` (20m, 30m, 40m, 50m isobaths) but only used in legacy SVG map. Port to Leaflet Polylines with depth labels
3. **Day/night tint** — subtle overlay tint based on simulated time (blue night / warm day)
4. **Weather summary** — temperature, visibility, cloud cover, wave height/period in a compact panel

### Files
- **NEW**: `frontend/src/components/landing/BathymetryLayer.tsx`
- **NEW**: `frontend/src/components/landing/SeaStateIndicator.tsx`
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx`
- **EDIT**: `frontend/src/store/landingStore.ts` (add sea state data to simulation)

---

## Phase 6: Layer Toggle Control Panel
**Impact: MEDIUM | Effort: LOW**

### What
A floating panel (like Google Maps "layers" button) to toggle visibility of each data layer:
- [x] Wind particles
- [x] Wake effects
- [x] Ocean waves
- [x] Bathymetry contours
- [x] Array cables (66 kV)
- [x] Exclusion zone boundary
- [x] Turbine labels
- [x] Sea state overlay

### Files
- **NEW**: `frontend/src/components/landing/LayerControlPanel.tsx`
- **EDIT**: `frontend/src/store/landingStore.ts` (layer visibility state)
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx`

---

## Phase 7: Enhanced Turbine Detail (Zoom-Dependent)
**Impact: MEDIUM | Effort: MEDIUM-HIGH | Educational Value: HIGH**

### What
Progressive detail at higher zoom levels:
- **Zoom 11-12** (default): Current turbine icons with spinning blades
- **Zoom 13**: Add power output label below each turbine, show nacelle orientation
- **Zoom 14+**: Show foundation outline, blade pitch angle visualization, tower sway animation (subtle oscillation proportional to wind speed)

### Files
- **EDIT**: `frontend/src/components/landing/LeafletWindFarmMap.tsx` (zoom listener)
- **NEW**: `frontend/src/components/landing/TurbineDetailIcon.tsx`

---

## Implementation Priority

| # | Phase | Impact | Effort | Why This Order? |
|---|-------|--------|--------|-----------------|
| 1 | Wind Particles | HIGH | M | Biggest visual impact — makes map feel alive instantly |
| 2 | Wake Effects | HIGH | M | Core educational value, unique differentiator |
| 3 | Layout Tweaks | MED | LOW | Quick wins, improves realism with minimal code |
| 4 | Ocean Waves | MED+ | LOW | Adds atmosphere, CSS-only is fast to implement |
| 5 | Layer Toggle | MED | LOW | Needed before adding more layers |
| 6 | Environmental | MED | M | Professional SCADA polish |
| 7 | Turbine Detail | MED | M-H | Progressive disclosure, advanced polish |

---

## Dependencies & Libraries

**Zero new npm packages required.** Everything builds on existing stack:

| Feature | Technology | Notes |
|---------|-----------|-------|
| Wind particles | Custom `L.Canvas` overlay + `requestAnimationFrame` | Pure canvas, no library |
| Wake model | Custom TypeScript utility | Jensen model is ~20 lines |
| Ocean waves | CSS `@keyframes` + SVG `<pattern>` | Pure CSS animation |
| Bathymetry | Leaflet `Polyline` (already available) | Data already exists |
| Layer toggle | Existing Radix UI components | Already installed |
| Sea state | Zustand store extension | Already installed |

---

## Research Sources & Inspiration

### Tools Studied
- **QBlade** (qblade.org) — Real-time 3D aero-hydro-elastic simulation, wake field visualization with velocity cut-planes, ParaView integration, modeshape animation
- **SIMIS/Ashes** (simis.io) — Foundation fatigue monitoring, marine growth impact, real-time sensor data with pause/resume
- **Typhoon HIL** — Three-stage energy conversion, controller-in-the-loop testing, grid fault injection

### Visual Benchmarks
- **Windy.com** — Wind particle animation using bilinear interpolation on canvas, color-coded by speed
- **earth.nullschool.net** — Multi-layer atmospheric data, ocean currents, dark theme (#000005), golden accents
- **4C Offshore Global Map** — Toggleable layers (vessels, infrastructure, wind resource), drill-down capability

### Technical References
- **Vestas V236-15.0 MW**: 236m rotor, 115.5m blades, ~280m tip height, 3/12.5/31 m/s cut-in/rated/cut-out
- **IEC 61400**: 3-5D streamwise, 4-8D lateral spacing standard practice
- **leaflet-velocity** / **ih-leaflet-velocity-ts**: TypeScript Leaflet plugin for particle-based wind/current animation (studied but custom implementation preferred for tighter integration)

---

## Future Ideas (Post-Implementation)

- Wake-steered yaw control visualization (active wake management)
- Historical wind rose overlay (past 24h patterns)
- Prediction uncertainty bands from P4 forecasting
- Vessel/AIS traffic overlay
- Performance heatmap (spatial power density)
- 3D turbine model at maximum zoom (Three.js, only if demanded)
