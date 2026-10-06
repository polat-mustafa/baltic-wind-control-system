/**
 * Tour content. Every statement here describes what the screen actually
 * shows or a rule the platform enforces (see CLAUDE.md / docs/SKILL.md);
 * targets are `data-tour` attributes on the pages.
 */

import { useDigitalTwinStore } from "../store/digitalTwinStore";
import { useForecastStore } from "../store/forecastStore";
import { useProjectStore } from "../store/projectStore";
import { useGridStore } from "../store/gridStore";
import { useLifecycleStore } from "../store/lifecycleStore";
import { useTurbinePhysicsStore } from "../store/turbinePhysicsStore";
import { useWindResourceStore } from "../store/windResourceStore";
import type { Tour } from "./types";

const exists = (selector: string) => () => () => document.querySelector(selector) !== null;

/** Completes once the element has been dragged at least `minPx` from where it started. */
function moved(target: string, minPx = 24) {
  return () => {
    const el = document.querySelector(`[data-tour="${target}"]`);
    const start = el?.getBoundingClientRect();
    return () => {
      const now = document.querySelector(`[data-tour="${target}"]`)?.getBoundingClientRect();
      if (!start || !now) return false;
      return Math.hypot(now.left - start.left, now.top - start.top) >= minPx;
    };
  };
}

const controlRoom: Tour = {
  id: "control-room",
  title: "Control room",
  summary: "The overview map, live KPIs and a turbine up close.",
  stage: "Start",
  steps: [
    {
      id: "welcome",
      route: "/",
      title: "Welcome to OffshoreForge",
      body:
        "OffshoreForge follows an offshore wind farm through its life: develop, design, build, operate. " +
        "Its case study is SB-510, a 510 MW farm of 34 Vestas V236-15.0 MW turbines in the southern Baltic. " +
        "Move with → and ←, leave with Esc.",
    },
    {
      id: "nav",
      route: "/",
      target: ["nav", "nav-menu"],
      title: "Organised by lifecycle stage",
      body:
        "The sidebar (the menu button on phones) follows the life of a wind farm, from first wind " +
        "measurements to daily operation.",
      points: [
        { label: "Develop", text: "Site selection and permits, wind resource, wakes and energy yield (AEP)." },
        { label: "Design", text: "Grid connection, protection, power quality and turbine physics." },
        { label: "Build & Commission", text: "HV switching programmes, isolation and site acceptance tests." },
        { label: "Operate", text: "Control room, SCADA, forecasting and the digital twin." },
      ],
    },
    {
      id: "kpis",
      route: "/",
      target: "kpi-ribbon",
      title: "Live KPIs",
      body:
        "Farm output, wind, availability, alerts, grid frequency, reactive power and losses, updated on every " +
        "simulation tick. Output is computed from each turbine's power curve and its wake losses.",
      caution:
        "A KPI is only as good as its data. A frozen anemometer or a stale feed looks perfectly normal, " +
        "so check where a number comes from before acting on it.",
    },
    {
      id: "open-turbine",
      route: "/",
      target: "farm-map",
      title: "Open a turbine",
      body: "Each marker is one turbine; colour shows its operating state. Lines are the 66 kV array cables.",
      task: {
        instruction: "Click any turbine on the map.",
        watch: exists('[data-tour="turbine-viewer"]'),
      },
    },
    {
      id: "turbine",
      route: "/",
      target: "turbine-viewer",
      title: "Meet the turbine",
      body:
        "This 3D model is driven by the same simulation as the map: rotor speed and pitch follow the live wind. " +
        "Click a component to read about it, or switch to the engineering drawings.",
      points: [
        { label: "Rotor", text: "Three blades, 236 m diameter. Above rated wind the blades pitch to hold 15 MW." },
        {
          label: "Nacelle",
          text: "Drivetrain, generator and converter. Its sensors reach SCADA as IEC 61400-25 logical nodes (WTUR, WROT…).",
        },
        { label: "Tower & foundation", text: "Steel tower on a monopile; the array cable enters at the base." },
      ],
    },
    {
      id: "panel",
      route: "/",
      target: "equipment-panel",
      title: "Equipment data",
      body:
        "The panel shows the turbine's live operating point and status. The substation, export cable, STATCOM " +
        "and LiDAR on the map open a panel like this too.",
      caution:
        "Colours follow ISA-101: normal is neutral grey and colour appears only when something is abnormal. " +
        "A screen full of colour means a plant in trouble.",
    },
    {
      id: "layers",
      route: "/",
      target: "layer-control",
      title: "Map layers",
      body:
        "Switch overlays on and off: wind flow, wake cones, bathymetry, 500 m safety zones, navigation aids, " +
        "O&M vessels, live AIS traffic and the export cable temperature (DTS).",
    },
    {
      id: "wind-rose",
      route: "/",
      target: "wind-rose",
      title: "Wind rose",
      body:
        "How often the wind blows from each direction, banded by speed; the current direction is highlighted. " +
        "The climatology here is illustrative, with the south-westerly prevailing wind typical of the Baltic.",
      task: { instruction: "Drag the wind rose by its header to move it.", watch: moved("wind-rose") },
    },
    {
      id: "theme",
      target: "theme-toggle",
      title: "Two looks",
      body:
        "Control room is the high-performance HMI palette operators use; Storybook is a lighter palette for " +
        "teaching and presentations. The data is the same.",
    },
    {
      id: "tours",
      target: "tour-button",
      title: "Replay any time",
      body: "Every module has its own short tour. Open this menu to replay one or to continue with the next stage.",
    },
  ],
};

const sitePermits: Tour = {
  id: "site-permits",
  title: "Site & Permits",
  summary: "Find a site on open data and take it through the permit procedure.",
  stage: "Develop",
  steps: [
    {
      id: "header",
      route: "/develop",
      target: "page-header",
      title: "Build a farm from scratch",
      body:
        "Every wind farm starts with a question: where? This page screens the sea on open data, then follows " +
        "your site through surveys, environmental studies and the permit procedure.",
    },
    {
      id: "stages",
      route: "/develop",
      target: "site-stages",
      title: "Five stages",
      body: "Screening, site investigation, environmental studies, consultation and permit, documents. Later stages open once a site is assessed.",
    },
    {
      id: "map",
      route: "/develop",
      target: "site-map",
      title: "Open marine data",
      body:
        "Natura 2000 sites, shipping lanes from the maritime spatial plan, other wind farm areas, military areas and " +
        "the 12 nm limit come from EMODnet, the EEA and Marine Regions. Green cells are where none of them excludes a wind farm.",
      caution: "Green is not a permit: fisheries, radar, aviation and cultural heritage are not in this screening.",
    },
    {
      id: "draw",
      route: "/develop",
      target: "site-draw",
      title: "Draw your site",
      body: "Draw a candidate site by clicking its corners, or load the SB-510 boundary to see how the case study fares.",
      task: {
        instruction: "Draw a site or load the SB-510 boundary.",
        watch: exists('[data-tour="site-report"] li'),
      },
    },
    {
      id: "report",
      route: "/develop",
      target: "site-report",
      title: "The screening report",
      body:
        "Area, indicative capacity, depth and foundation type, distances, and a checklist. A failed check means an " +
        "authority would refuse the site; the permit stage shows you why.",
    },
  ],
};

const layout: Tour = {
  id: "layout",
  title: "Layout",
  summary: "Place turbines, read the wake losses, route the cables, estimate the cost.",
  stage: "Develop",
  steps: [
    {
      id: "header",
      route: "/develop/layout",
      target: "page-header",
      title: "From a site to a wind farm",
      body:
        "The site from Site & Permits becomes a layout: how many turbines, where, and how they are cabled. " +
        "Every choice trades capacity against wake losses and cable cost.",
    },
    {
      id: "grid",
      route: "/develop/layout",
      target: "layout-grid",
      title: "Start from a grid",
      body: "Spacing is set in rotor diameters (D = 236 m). Constraint areas from the open data can be skipped.",
      task: {
        instruction: "Press Fill site (or load the SB-510 layout).",
        watch: () => () => useProjectStore.getState().turbines.length > 0,
      },
    },
    {
      id: "map",
      route: "/develop/layout",
      target: "layout-map",
      title: "Drag turbines",
      body:
        "Drag a turbine or the yellow offshore substation: the wake loss in the tooltip and the cable tree follow. " +
        "Amber means closer than 4 D, red means outside the site or inside a constraint.",
      caution: "A tight layout gains megawatts on paper and loses them in energy: check the wake loss, not only the MW.",
    },
    {
      id: "results",
      route: "/develop/layout",
      target: "layout-results",
      title: "Live results",
      body:
        "Power density, closest pair, a fast wake model and the array cables: strings of up to six 15 MW turbines on 66 kV, " +
        "sized by current.",
    },
    {
      id: "pywake",
      route: "/develop/layout",
      target: "layout-pywake",
      title: "Check with PyWake",
      body: "The backend runs the reference wake model on your exact positions. Use it before you trust an AEP figure.",
    },
    {
      id: "cost",
      route: "/develop/layout",
      target: "layout-cost",
      title: "What does it cost?",
      body: "CAPEX by line and the levelised cost of energy. The unit costs are illustrative teaching defaults; edit them.",
    },
  ],
};

const windResource: Tour = {
  id: "wind-resource",
  title: "Wind resource & energy yield",
  summary: "Weibull statistics, wake losses and annual energy production.",
  stage: "Develop",
  steps: [
    {
      id: "header",
      route: "/wind-resource",
      target: "page-header",
      title: "From wind to energy",
      body:
        "This page turns the site's wind statistics into annual energy production (AEP): a Weibull fit of the " +
        "wind speed, the turbine power curve, and wake losses from a PyWake engineering wake model.",
    },
    {
      id: "tabs",
      route: "/wind-resource",
      target: "page-tabs",
      title: "Three views",
      body:
        "AEP Analysis builds the energy estimate. Farm Comparison sets SB-510 against other wind climates. " +
        "Availability & O&M covers downtime and maintenance (IEC 61400-26).",
    },
    {
      id: "run",
      route: "/wind-resource",
      target: "run-button",
      title: "Run the analysis",
      body: "The backend runs the wake model for all 34 turbines and builds the loss chain.",
      task: {
        instruction: "Press Run Analysis and wait for the results.",
        watch: () => () => useWindResourceStore.getState().analysisRun,
      },
      caution:
        "AEP is never a single number. Report the losses that lead to it (wake, availability, electrical) " +
        "and the uncertainty around it.",
    },
  ],
};

const grid: Tour = {
  id: "grid",
  title: "Grid integration",
  summary: "Load flow, short circuit, fault ride-through and the grid code.",
  stage: "Design",
  steps: [
    {
      id: "header",
      route: "/hv-grid",
      target: "page-header",
      title: "Connecting 510 MW to the grid",
      body:
        "66 kV array strings meet at the offshore substation, two 220 kV cables carry the power ashore and the " +
        "farm connects to the 400 kV transmission grid. The links under the title explain each design choice.",
    },
    {
      id: "tabs",
      route: "/hv-grid",
      target: "page-tabs",
      title: "Studies",
      body:
        "Each tab is one study: load flow and short circuit, the power plant controller, protection, power " +
        "quality, battery storage, cable temperature, the electricity market, N-1 security and export planning.",
    },
    {
      id: "run",
      route: "/hv-grid",
      target: "run-button",
      title: "Run the grid analysis",
      body: "Load flow and short-circuit results come from pandapower; nothing is hard-coded.",
      task: {
        instruction: "Press Run Analysis.",
        watch: () => () => useGridStore.getState().analysisRun,
      },
      caution:
        "Breaker duty uses the maximum short-circuit case: voltage factor c_max = 1.10 for HV and MV networks " +
        "(IEC 60909). A lower factor understates the fault current.",
    },
  ],
};

const turbinePhysics: Tour = {
  id: "turbine-physics",
  title: "Turbine physics",
  summary: "Power coefficient, tip-speed ratio, pitch and yaw.",
  stage: "Design",
  steps: [
    {
      id: "header",
      route: "/turbine-physics",
      target: "page-header",
      title: "Inside the rotor",
      body:
        "How much power a rotor extracts depends on the power coefficient Cp, a function of tip-speed ratio λ " +
        "and blade pitch β. No rotor can exceed the Betz limit, Cp = 16/27 ≈ 0.593.",
    },
    {
      id: "run",
      route: "/turbine-physics",
      target: "run-button",
      title: "Simulate a wind scenario",
      body: "The simulation steps the rotor, drivetrain and controller through time.",
      task: {
        instruction: "Press Run Simulation.",
        watch: () => () => useTurbinePhysicsStore.getState().analysisRun,
      },
      caution:
        "Power is always between 0 and rated: zero below cut-in (3 m/s) and above cut-out, never more than 15 MW. " +
        "A model that reports otherwise is wrong, however good it looks.",
    },
  ],
};

const commissioning: Tour = {
  id: "commissioning",
  title: "HV commissioning",
  summary: "Switching programmes, isolation and acceptance tests.",
  stage: "Build & Commission",
  steps: [
    {
      id: "header",
      route: "/commissioning",
      target: "page-header",
      title: "First energisation",
      body:
        "Before the farm exports power, every HV circuit is energised in a controlled order. A 30-step " +
        "programme takes the offshore substation from isolated to live, followed by site acceptance tests.",
    },
    {
      id: "programme",
      route: "/commissioning",
      target: "create-programme",
      title: "Person in Control",
      body:
        "A switching programme belongs to a named Person in Control (PiC), who authorises each step. " +
        "Enter a name to create one and walk through the steps.",
      caution:
        "Isolation comes before work: lock out and tag the isolation points and prove the circuit dead " +
        "before anyone touches it.",
    },
  ],
};

const scada: Tour = {
  id: "scada",
  title: "SCADA & automation",
  summary: "The operator HMI, IEC 61850 substation automation and alarms.",
  stage: "Operate",
  steps: [
    {
      id: "overview",
      route: "/scada",
      target: "plant-overview",
      title: "Level 1: plant at a glance",
      body:
        "The top banner is the ISA-101 level-1 display: output, reactive power, frequency, voltage, turbines " +
        "online and alarm counts, always visible.",
    },
    {
      id: "areas",
      route: "/scada",
      target: "page-tabs",
      title: "Level 2: areas",
      body:
        "Operations, Equipment, Diagnostics and Engineering. Each area opens level-3 screens: the single-line " +
        "diagram, alarms and permits under Operations, GOOSE and the sequence-of-events recorder under " +
        "Diagnostics, OPC UA and SCL files under Engineering.",
    },
    {
      id: "controls",
      route: "/scada",
      target: "scada-controls",
      title: "Simulation controls",
      body: "Inject a turbine fault, run a GOOSE protection sequence, start auto-simulation or change operator role.",
      task: {
        instruction: "Open the Controls bar.",
        watch: exists('[data-tour="scada-controls"][aria-expanded="true"]'),
      },
      caution:
        "Here GOOSE messages travel over HTTP for teaching. In a real substation GOOSE is Layer-2 Ethernet " +
        "multicast, and a trip message has to arrive within a few milliseconds (IEC 61850-5).",
    },
  ],
};

const forecast: Tour = {
  id: "forecast",
  title: "Power forecasting",
  summary: "Machine-learning forecasts and how to judge them.",
  stage: "Operate",
  steps: [
    {
      id: "header",
      route: "/forecast",
      target: "page-header",
      title: "Forecasting output",
      body:
        "XGBoost, LSTM and Temporal Fusion Transformer models forecast farm output; an ensemble combines them. " +
        "Forecasts feed trading and grid scheduling.",
    },
    {
      id: "tabs",
      route: "/forecast",
      target: "page-tabs",
      title: "Learn while it trains",
      body:
        "Forecast shows the results, Training monitor follows the models as they learn, AI Academy explains " +
        "the methods step by step and Concept map links the ideas.",
    },
    {
      id: "run",
      route: "/forecast",
      target: "run-button",
      title: "Train the models",
      body: "Training runs on the backend and can take a few minutes; the monitor tab shows live progress.",
      task: {
        instruction: "Press Run Forecast to start training (or skip this step).",
        watch: () => () => useForecastStore.getState().analysisRun || useForecastStore.getState().loading,
      },
      caution:
        "Time series are split in time order and never shuffled. Shuffling leaks the future into training " +
        "and makes a model look better than it is. ML output is still clipped to physics (0 ≤ P ≤ P_rated).",
    },
  ],
};

const digitalTwin: Tour = {
  id: "digital-twin",
  title: "Digital twin",
  summary: "Detect, diagnose and predict turbine faults.",
  stage: "Operate",
  steps: [
    {
      id: "header",
      route: "/digital-twin",
      target: "page-header",
      title: "A physics model next to every turbine",
      body:
        "The twin runs a physics model of the V236 at each 10-minute record's measured wind and compares it " +
        "with what the turbine reports. It follows the ISO 13374 chain: detect, diagnose, predict.",
    },
    {
      id: "controls",
      route: "/digital-twin",
      target: "twin-controls",
      title: "Choose a scenario",
      body:
        "Each scenario injects known faults (icing, pitch misalignment, converter derating, gearbox wear, " +
        "anemometer drift) so the twin's answers can be checked against the truth.",
      task: {
        instruction: "Select the 14 d window.",
        watch: () => () => useDigitalTwinStore.getState().durationDays === 14,
      },
    },
    {
      id: "tabs",
      route: "/digital-twin",
      target: "page-tabs",
      title: "Fleet, turbine, model",
      body:
        "Fleet overview ranks all turbines by health. Turbine analysis shows the control charts, the diagnosis " +
        "and remaining useful life. Model & validation scores every injected fault.",
      caution:
        "An alarm is evidence, not a diagnosis. The twin names a fault only when one physical fault model " +
        "explains the data clearly better than the others, and says so when it cannot decide.",
    },
  ],
};

const academy: Tour = {
  id: "academy",
  title: "Academy",
  summary: "Lessons and scored missions along the lifecycle.",
  stage: "Learn",
  steps: [
    {
      id: "header",
      route: "/academy",
      target: "page-header",
      title: "Learn by doing",
      body:
        "Four tracks follow the life of a wind farm: develop, design, build, operate. Each has lessons to read or modules " +
        "to explore, and missions that give you a score out of 100.",
    },
    {
      id: "tracks",
      route: "/academy",
      target: "academy-tracks",
      title: "Lessons",
      body: "A book opens a primer (physics, standards, worked examples); a compass takes you to the module itself. Opened lessons get a tick.",
    },
    {
      id: "missions",
      route: "/academy",
      target: "academy-missions",
      title: "Missions",
      body:
        "Some missions grade your own project (the site you drew, the layout you built), some generate fresh cases " +
        "every time, and the drills run on the live farm map.",
      task: {
        instruction: "Open any mission.",
        watch: () => () => new URLSearchParams(window.location.search).has("mission"),
      },
      caution: "The weights are teaching choices, shown on every mission. A high score means you used the tools well, not that a real design is right.",
    },
    {
      id: "progress",
      route: "/academy",
      target: "academy-progress",
      title: "Your record",
      body: "Progress stays in this browser. The training record prints or exports as JSON; it is not a certificate.",
    },
  ],
};

const construction: Tour = {
  id: "construction",
  title: "Construction",
  summary: "Install the farm in weather windows: vessels, timeline, P50 and P90.",
  stage: "Build & Commission",
  steps: [
    {
      id: "header",
      route: "/build",
      target: "page-header",
      title: "Building at sea",
      body:
        "Every lift, pile and cable pull is a marine operation that needs calm enough sea for its whole duration. " +
        "The campaign is simulated over many synthetic weather years.",
    },
    {
      id: "source",
      route: "/build",
      target: "farm-source",
      title: "Your farm",
      body: "Turbines, strings, cable lengths and foundation type come from your layout; without one, the SB-510 farm is used.",
    },
    {
      id: "inputs",
      route: "/build",
      target: "campaign-inputs",
      title: "Start date and α factor",
      body:
        "DNV-ST-N001 plans weather-restricted operations against α × the operational limit, because forecasts are uncertain. " +
        "A lower α is safer and slower.",
      task: {
        instruction: "Press Simulate the campaign.",
        watch: () => () => useLifecycleStore.getState().results.build != null,
      },
    },
    {
      id: "kpis",
      route: "/build",
      target: ["campaign-kpis", "campaign-inputs"],
      title: "P50 and P90",
      body: "P50: half the weather years finish earlier. P90: nine in ten do. Grid connection dates and contracts are set on P90.",
      caution: "Try a start in October: the same work runs into the Baltic winter and waits weeks for windows.",
    },
    {
      id: "gantt",
      route: "/build",
      target: ["campaign-gantt", "campaign-inputs"],
      title: "Timeline",
      body: "Bars per vessel; the hatched end is waiting on weather. A turbine cannot go up before its foundation, nor a string be energised before its cables.",
    },
    {
      id: "windows",
      route: "/build",
      target: ["campaign-windows", "campaign-inputs"],
      title: "Weather windows",
      body: "The chance that a window long enough for one operation opens, by month. Long operations suffer most from winter.",
    },
  ],
};

const handover: Tour = {
  id: "handover",
  title: "Hand-over",
  summary: "The as-built register and what each operation module takes over.",
  stage: "Build & Commission",
  steps: [
    {
      id: "header",
      route: "/build/handover",
      target: "page-header",
      title: "From project to operation",
      body: "At hand-over the operator receives the farm as built: positions, strings, feeder bays, cables and the open items.",
    },
    {
      id: "modules",
      route: "/build/handover",
      target: "handover-modules",
      title: "Who takes over what",
      body: "Your layout appears on the Control Room map as a layer; Commissioning, SCADA and the Digital Twin say what carries over and what stays on SB-510.",
    },
    {
      id: "energisation",
      route: "/build/handover",
      target: "handover-energisation",
      title: "Energisation order",
      body: "Export cable, OSS, 66 kV busbar, then one feeder bay per string — the same order as the P5 switching programme.",
    },
    {
      id: "register",
      route: "/build/handover",
      target: "handover-register",
      title: "As-built register",
      body: "Print it or export CSV / JSON. It is a training specimen: screening-level positions, not a surveyed record.",
    },
  ],
};

const decommissioning: Tour = {
  id: "decommissioning",
  title: "Decommissioning",
  summary: "Removal options, the removal campaign, material, cost and seabed restoration.",
  stage: "Decommission",
  steps: [
    {
      id: "header",
      route: "/decommission",
      target: "page-header",
      title: "End of life",
      body: "After 25–30 years the farm is removed. The law sets the goal (safe navigation, fishing, environment); the programme sets the details.",
    },
    {
      id: "options",
      route: "/decommission",
      target: "decom-options",
      title: "What comes out",
      body: "Cut piles below the seabed or pull them; recover or leave buried cables and scour rock. Each choice changes vessel time, cost and seabed disturbance.",
    },
    {
      id: "legal",
      route: "/decommission",
      target: "decom-legal",
      title: "Legal frame",
      body: "UNCLOS Art. 60(3) and IMO A.672(16), turned into a decommissioning programme by national law.",
      caution: "This is a summary of the international texts. The binding conditions are in the project's own permits.",
    },
    {
      id: "inventory",
      route: "/decommission",
      target: "decom-inventory",
      title: "Material",
      body: "Most of the mass is steel and is recycled; blades are composite and are the hard part.",
    },
    {
      id: "restoration",
      route: "/decommission",
      target: "decom-restoration",
      title: "Seabed restoration",
      body: "Survey before and after, clear debris, publish what stays, monitor.",
    },
  ],
};

/** All tours in menu order (lifecycle order after the control-room intro). */
export const TOURS: Tour[] = [
  controlRoom,
  sitePermits,
  layout,
  windResource,
  grid,
  turbinePhysics,
  construction,
  commissioning,
  handover,
  scada,
  forecast,
  digitalTwin,
  decommissioning,
  academy,
];

export const tourById = (id: string) => TOURS.find((t) => t.id === id);
