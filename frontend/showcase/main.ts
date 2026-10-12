/**
 * Showcase page behaviour: the hero simulator, the embedded demo, and the
 * sections generated from the platform's own data (evidence.json from the
 * test suite, plantFacts.json from the backend) so the page never drifts
 * from the code it describes.
 */

import evidence from "../src/data/evidence.json";
import facts from "../src/data/plantFacts.json";
import { chartPosition, farmState, mountWindField } from "./windfield";
import "./style.css";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const nf = (v: number, d = 1) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

// ═════════ HERO: wind, wakes, farm output ═════════

const wind = { dir: 250, speed: 9.5 };
const field = mountWindField($<HTMLCanvasElement>(".hero__field"), { windFromDeg: wind.dir, speedMs: wind.speed }, drawScale);
const dial = $(".dial");
const needle = $(".dial__needle");
const speedInput = $<HTMLInputElement>(".readout__speed input");
const out = (k: string) => $<HTMLOutputElement>(`[data-out="${k}"]`);

const ticks = $(".dial__ticks");
for (let a = 0; a < 360; a += 10) {
  const major = a % 90 === 0;
  const r1 = major ? 44 : 48;
  const rad = (a * Math.PI) / 180;
  ticks.insertAdjacentHTML(
    "beforeend",
    `<line class="${major ? "major" : ""}" x1="${Math.sin(rad) * r1}" y1="${-Math.cos(rad) * r1}" x2="${Math.sin(rad) * 52}" y2="${-Math.cos(rad) * 52}"/>`,
  );
}

let pending = 0;
function update() {
  needle.setAttribute("transform", `rotate(${wind.dir})`);
  dial.setAttribute("aria-valuenow", String(wind.dir));
  dial.setAttribute("aria-valuetext", `${wind.dir} degrees`);
  out("dir").textContent = `${String(wind.dir).padStart(3, "0")}°`;
  out("speed").textContent = `${nf(wind.speed)} m/s`;
  const s = farmState(wind.dir, wind.speed);
  out("power").textContent = `${nf(s.powerMW)} MW`;
  out("loss").textContent = s.freeMW > 0 ? `${nf(s.wakeLossPct)} %` : "parked";
  // the field grid is the expensive part: once per frame however fast the dial spins
  if (!pending)
    pending = requestAnimationFrame(() => {
      pending = 0;
      field.setWind(wind.dir, wind.speed);
    });
}

function setDirFromPointer(e: PointerEvent) {
  const r = dial.getBoundingClientRect();
  const deg = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  wind.dir = Math.round((deg + 360) % 360);
  update();
}
dial.addEventListener("pointerdown", (e) => {
  dial.setPointerCapture(e.pointerId);
  setDirFromPointer(e);
});
dial.addEventListener("pointermove", (e) => {
  if (dial.hasPointerCapture(e.pointerId)) setDirFromPointer(e);
});
dial.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 15 : 5;
  const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  wind.dir = (wind.dir + d + 360) % 360;
  update();
});
speedInput.addEventListener("input", () => {
  wind.speed = Number(speedInput.value);
  update();
});
update();

// cursor probe: chart position and local wind under the pointer
const hero = $(".hero");
const probe = $(".probe");
const canvas = $<HTMLCanvasElement>(".hero__field");
hero.addEventListener("pointermove", (e) => {
  const overUi = (e.target as Element).closest("a, button, .instrument, .hero__copy > *");
  const r = canvas.getBoundingClientRect();
  const p = overUi ? null : field.probe(e.clientX - r.left, e.clientY - r.top);
  if (!p) return probe.classList.remove("on");
  const u = p.ratio * wind.speed;
  probe.innerHTML = `${chartPosition(p.e, p.n)}<br>u = ${nf(u)} m/s · ${p.ratio < 0.995 ? `wake −${nf((1 - p.ratio) * 100, 0)} %` : "free stream"}`;
  probe.style.left = `${e.clientX - hero.getBoundingClientRect().left + 16}px`;
  probe.style.top = `${e.clientY - hero.getBoundingClientRect().top + 16}px`;
  probe.classList.add("on");
});
hero.addEventListener("pointerleave", () => probe.classList.remove("on"));

function drawScale() {
  $(".hero__scale span").style.width = `${2000 / field.metresPerPx()}px`;
}

// ═════════ DEMO FRAME ═════════

const frame = $(".frame");
const iframe = $<HTMLIFrameElement>(".frame iframe");
const demoTabs = [...document.querySelectorAll<HTMLButtonElement>(".frame__tabs button")];

function openDemo(route: string, caption?: string) {
  const src = `./demo/${route}`;
  // Phones: the app inside a page-sized frame is a scroller in a scroller and Back stepped the
  // frame to its blank start page — open it as the page itself instead.
  if (matchMedia("(max-width: 639px)").matches) {
    location.href = src;
    return;
  }
  frame.classList.add("is-live");
  // replace(), not src=: switching screens adds no history entries, so Back leaves the page
  // instead of walking the frame back to about:blank
  if (iframe.dataset.current !== src) {
    iframe.dataset.current = src;
    iframe.contentWindow?.location.replace(new URL(src, location.href).href);
  }
  for (const t of demoTabs) t.setAttribute("aria-selected", String(t.dataset.route === route));
  $(".frame__what").textContent = demoTabs.find((t) => t.dataset.route === route)?.dataset.caption ?? caption ?? "";
  $<HTMLAnchorElement>(".frame__open").href = src;
}
for (const t of demoTabs) t.addEventListener("click", () => openDemo(t.dataset.route ?? ""));
$(".frame__start").addEventListener("click", () => openDemo(demoTabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.route ?? ""));

// ═════════ LIFECYCLE ═════════

const Y0 = -7;
const Y1 = 33;
const pos = (y: number) => `${((y - Y0) / (Y1 - Y0)) * 100}%`;
const PHASES: { name: string; tag: string; from: number; to: number; route: string; what: string }[] = [
  { name: "Site & permits", tag: "develop", from: -7, to: -4, route: "develop", what: "Spatial plan, seabed, Natura 2000, shipping" },
  { name: "Wind & layout", tag: "design · P1", from: -5, to: -3, route: "develop/layout", what: "ERA5, PyWake wakes, P50 / P90 energy" },
  { name: "Grid connection", tag: "design · P2", from: -4, to: -2, route: "hv-grid", what: "Load flow, IEC 60909, reactors, grid code" },
  { name: "Construction", tag: "build", from: -2, to: 0, route: "build", what: "Weather windows, vessels, P10 / P90 dates" },
  { name: "Commissioning", tag: "build · P5", from: -0.6, to: 0.4, route: "commissioning", what: "63 switching steps, interlocks, EON → FON" },
  { name: "SCADA & protection", tag: "operate · P3", from: 0, to: 30, route: "scada", what: "IEC 61850, GOOSE, alarms, permit to work" },
  { name: "Forecasting", tag: "operate · P4", from: 0, to: 30, route: "forecast", what: "XGBoost, LSTM, TFT — day-ahead" },
  { name: "Digital twin", tag: "operate", from: 0, to: 30, route: "digital-twin", what: "Physics residuals catch faults early" },
  { name: "Decommissioning", tag: "remove", from: 30, to: 33, route: "decommission", what: "Removal, recycling, seabed" },
];
const gantt = $(".gantt");
gantt.style.setProperty("--cod", pos(0));
const ruler = $(".gantt__ruler");
for (const y of [-6, -4, -2, 0, 5, 10, 15, 20, 25, 30]) {
  ruler.insertAdjacentHTML("beforeend", `<span class="${y === 0 ? "cod" : ""}" style="left:${pos(y)}">${y === 0 ? "COD" : y > 0 ? `+${y}` : `−${-y}`}</span>`);
}
for (const p of PHASES) {
  const long = p.to - p.from > 10;
  // text after a short bar, inside a long one, before a bar at the far end of the ruler
  const textAt = long
    ? `left:calc(${pos(p.from + 1)})`
    : p.to > 25
      ? `right:calc(100% - ${pos(p.from)} + 4px)`
      : `left:calc(${pos(p.to)} + 4px)`;
  gantt.insertAdjacentHTML(
    "beforeend",
    `<a class="gantt__row" role="listitem" href="./demo/${p.route}" data-route="${p.route}">
      <span class="gantt__label"><b>${p.name}</b><small>${p.tag}</small></span>
      <span class="gantt__track">
        <span class="gantt__bar" style="left:${pos(p.from)};width:calc(${pos(p.to)} - ${pos(p.from)})"></span>
        <span class="gantt__what" style="${textAt}">${p.what}</span>
      </span>
    </a>`,
  );
}
gantt.addEventListener("click", (e) => {
  const row = (e.target as Element).closest<HTMLAnchorElement>(".gantt__row");
  if (!row || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const phase = PHASES.find((p) => p.route === row.dataset.route);
  openDemo(row.dataset.route ?? "", phase && `${phase.name}: ${phase.what}.`);
  $("#demo").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

// ═════════ EVIDENCE ═════════

type Item = (typeof evidence.items)[number];
const byId = new Map(evidence.items.map((i) => [i.id, i]));
const get = (id: string) => byId.get(id) as Item;
const tso = get("p4-energinet-nrmse_pct").value;

const FEATURED: { id: string; area: string; value: (v: number) => string; unit: string; what: string; against: string }[] = [
  {
    id: "p1-aep-roedsand2-bias",
    area: "Energy yield",
    value: (v) => `${v > 0 ? "+" : "−"}${nf(Math.abs(v))}`,
    unit: "%",
    what: "Annual energy of a real wind farm, modelled from weather data through wakes and losses.",
    against: "Metered output of Rødsand II, 207 MW (ENTSO-E)",
  },
  {
    id: "p1-aep-roedsand2-28m-r2",
    area: "Energy yield",
    value: (v) => nf(v, 2),
    unit: "R²",
    what: "28 months in a row, June 2024 – September 2026, month by month.",
    against: "The same farm's metered monthly energy",
  },
  {
    id: "p1-wake-bpa",
    area: "Wakes",
    value: (v) => nf(v, 3),
    unit: "RMSE",
    what: "Power ratio down a row of turbines, the production wake model.",
    against: "Measured SCADA at Horns Rev 1 and Lillgrund",
  },
  {
    id: "dt-care-b-detected",
    area: "Digital twin",
    value: (v) => `${v.toFixed(0)}/6`,
    unit: "faults",
    what: "Real turbine faults flagged before the failure, from physics residuals.",
    against: "CARE to Compare benchmark (Gück et al. 2024)",
  },
  {
    id: "p4-xgboost-nrmse_pct",
    area: "Forecasting",
    value: (v) => nf(v),
    unit: "%",
    what: `Day-ahead error, normalised to capacity — below the TSO's own ${nf(tso)} %.`,
    against: "16 731 measured hours, Danish DK2 zone (Energinet)",
  },
  {
    id: "p2-iec60909-max",
    area: "Grid",
    value: (v) => nf(v, 2),
    unit: "kA",
    what: "Initial short-circuit current at 220 kV, pandapower — equal to the hand calculation within 0.01 %.",
    against: "IEC 60909-0:2016, worked by hand",
  },
];
$(".proof").innerHTML = FEATURED.map((f) => {
  const it = get(f.id);
  return `<article class="proof__cell">
    <span class="proof__area">${f.area}</span>
    <p class="proof__value">${f.value(it.value)}<small>${f.unit}</small></p>
    <p class="proof__what">${f.what}</p>
    <p class="proof__against">${f.against}</p>
  </article>`;
}).join("");

const fmtValue = (it: Item) => {
  const v = it.value;
  const d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3;
  const unit = it.unit === "−" ? "" : ` ${it.unit}`;
  return `${nf(v, d)}${unit}`;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
$(".ledger tbody").innerHTML = evidence.items
  .map(
    (it) => `<tr>
      <td><span class="kind">${esc(it.kind)}</span>${esc(it.claim)}</td>
      <td>${esc(it.against)}</td>
      <td class="num">${fmtValue(it)}<br><small>${esc(it.metric)}</small></td>
      <td>${esc(it.limit)}</td>
    </tr>`,
  )
  .join("");
for (const el of document.querySelectorAll("[data-count=evidence]")) el.textContent = String(evidence.items.length);

// ═════════ CASE: spec + single-line diagram ═════════

const SPEC: [string, string][] = [
  ["Site", "MSP basin <b>PZP_44</b>, Polish EEZ · 55.06° N 16.54° E · 37–51 m · jackets"],
  ["Turbines", `<b>${facts.turbines} × ${facts.turbine_mw} MW = ${facts.capacity_mw} MW</b> · IEA-15-240-RWT, ⌀ ${facts.rotor_diameter_m} m, direct drive`],
  ["Operating", `cut-in ${facts.cut_in_ms} · rated ${nf(facts.rated_ms, 2)} · cut-out ${facts.cut_out_ms} m/s · ${facts.min_rotor_rpm}–${facts.max_rotor_rpm} rpm`],
  ["Array", "66 kV XLPE, 6 strings (6-6-6-6-5-5)"],
  ["Substation", "2 × 300 MVA, 66/220 kV, N-1"],
  ["Export", `<b>2 × 220 kV HVAC, ${facts.export_km} km</b> — 79.3 subsea, 28.7 land — to PSE Krzemienica`],
  ["Reactive", `${facts.reactors} × ${facts.reactor_mvar} Mvar reactors · ±${facts.statcom_mvar} Mvar STATCOM · cables ≈ ${facts.cable_charging_mvar} Mvar`],
  ["Grid code", "ENTSO-E NC RfG Type D · PSE IRiESP"],
  ["Commission", `${facts.programme_steps}-step switching programme, circuit 1`],
];
$(".spec").innerHTML = SPEC.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

const Y = 170;
const tx = (x: number, label: string, sub: string) => `
  <circle class="w" cx="${x - 8}" cy="${Y}" r="13"/><circle class="w" cx="${x + 8}" cy="${Y}" r="13"/>
  <text class="lbl" x="${x}" y="${Y + 36}" text-anchor="middle">${label}</text>
  <text class="sub" x="${x}" y="${Y + 50}" text-anchor="middle">${sub}</text>`;
const reactor = (x: number, label: string) => `
  <line class="w" x1="${x}" y1="${Y}" x2="${x}" y2="${Y + 30}"/>
  <path class="w" d="M${x},${Y + 30} a6,6 0 0 1 0,12 a6,6 0 0 1 0,12 a6,6 0 0 1 0,12"/>
  <line class="w" x1="${x}" y1="${Y + 66}" x2="${x}" y2="${Y + 76}"/>
  ${ground(x, Y + 76)}
  <text class="lbl" x="${x}" y="${Y + 102}" text-anchor="middle">${label}</text>`;
const ground = (x: number, y: number) =>
  `<line class="w" x1="${x - 9}" y1="${y}" x2="${x + 9}" y2="${y}"/><line class="w" x1="${x - 6}" y1="${y + 4}" x2="${x + 6}" y2="${y + 4}"/><line class="w" x1="${x - 3}" y1="${y + 8}" x2="${x + 3}" y2="${y + 8}"/>`;
const bus = (x: number, y1: number, y2: number, label: string) =>
  `<line class="bus" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><text class="lbl" x="${x}" y="${y1 - 10}" text-anchor="middle">${label}</text>`;
const wtg = (y: number) => `
  <line class="w" x1="64" y1="${y}" x2="130" y2="${y}"/>
  <circle class="w" cx="50" cy="${y}" r="14"/>
  <path class="w" d="M41,${y} q4.5,-7 9,0 t9,0"/>
  <circle class="tp" cx="50" cy="${y + 14}" r="2.5"/>`;
const LANDFALL = 330 + 360 * (79.3 / 108);
$(".sld svg").insertAdjacentHTML(
  "beforeend",
  `
  <rect class="sea" x="0" y="0" width="${LANDFALL}" height="330"/>
  <text class="zone" x="12" y="318">BALTIC SEA</text>
  <text class="zone" x="${LANDFALL + 10}" y="318">LAND</text>
  <path class="bracket" d="M24,74 v-10 h306 v10"/><text class="zone" x="24" y="56">34 TURBINES · OFFSHORE SUBSTATION</text>
  <path class="bracket" d="M700,74 v-10 h290 v10"/><text class="zone" x="700" y="56">ONSHORE · PSE KRZEMIENICA</text>
  ${wtg(110)}${wtg(150)}${wtg(230)}
  <text class="sub" x="50" y="196" text-anchor="middle">⋮</text>
  <text class="lbl" x="18" y="272">34 × 15 MW</text><text class="sub" x="18" y="286">6 strings</text>
  ${bus(130, 92, 250, "66 kV")}
  <line class="w" x1="130" y1="${Y}" x2="179" y2="${Y}"/>
  ${tx(200, "2 × 300 MVA", "66/220 kV")}
  <line class="w" x1="221" y1="${Y}" x2="270" y2="${Y}"/>
  ${bus(270, 120, 220, "220 kV")}
  <line class="w" x1="270" y1="${Y}" x2="330" y2="${Y}"/>
  ${reactor(300, "180 Mvar")}
  <path class="w" d="M330,${Y - 6} l8,6 l-8,6 z"/>
  <line class="w" x1="338" y1="${Y}" x2="682" y2="${Y}" stroke-width="3"/>
  <path class="w" d="M690,${Y - 6} l-8,6 l8,6 z"/>
  <text class="lbl" x="510" y="${Y - 18}" text-anchor="middle">2 × 220 kV XLPE · ${facts.export_km} km</text>
  <line class="w" x1="${LANDFALL}" y1="${Y - 12}" x2="${LANDFALL}" y2="${Y + 12}"/>
  <text class="sub" x="${(330 + LANDFALL) / 2}" y="${Y + 26}" text-anchor="middle">79.3 km subsea</text>
  <text class="sub" x="${(LANDFALL + 690) / 2}" y="${Y + 26}" text-anchor="middle">28.7 km land</text>
  <text class="sub" x="${LANDFALL}" y="${Y + 46}" text-anchor="middle">landfall</text>
  <line class="w" x1="690" y1="${Y}" x2="720" y2="${Y}"/>
  ${bus(720, 120, 220, "220 kV")}
  ${reactor(745, "180 Mvar")}
  <line class="w" x1="720" y1="${Y}" x2="829" y2="${Y}"/>
  <line class="w" x1="790" y1="${Y}" x2="790" y2="${Y - 34}"/>
  <rect class="w" x="770" y="${Y - 66}" width="40" height="32"/>
  <path class="w" d="M776,${Y - 40} l28,-20"/>
  <text class="lbl" x="790" y="${Y - 74}" text-anchor="middle">STATCOM ±${facts.statcom_mvar} Mvar</text>
  ${tx(850, "2 × 300 MVA", "220/400 kV")}
  <line class="w" x1="871" y1="${Y}" x2="910" y2="${Y}"/>
  ${bus(910, 130, 210, "400 kV")}
  <g transform="translate(-12 0)">
  <line class="w" x1="922" y1="${Y}" x2="945" y2="${Y}"/>
  <rect class="w" x="945" y="${Y - 20}" width="40" height="40"/>
  <path class="w" d="M945,${Y - 8} l12,-12 M945,${Y + 4} l24,-24 M945,${Y + 16} l36,-36 M953,${Y + 20} l32,-32 M965,${Y + 20} l20,-20 M977,${Y + 20} l8,-8"/>
  <text class="lbl" x="965" y="${Y + 38}" text-anchor="middle">PSE</text>
  <text class="sub" x="965" y="${Y + 52}" text-anchor="middle">KSE 400 kV</text>
  </g>
  <line class="flow" x1="64" y1="${Y}" x2="933" y2="${Y}"/>`,
);

// ═════════ CONTACT, REVISION, REVEAL ═════════

const mail = ["pmustafa0", "gmail.com"].join("@");
const mailLink = $<HTMLAnchorElement>("[data-mail]");
mailLink.href = `mailto:${mail}?subject=${encodeURIComponent("OffshoreForge — feedback")}`;
mailLink.title = mail;

$("[data-rev]").textContent = import.meta.env.VITE_REV ?? "dev";

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const el of document.querySelectorAll(".sec__head, .frame, .gantt, .proof, .ledger, .case, .stack, .standards, .run, .author, .feedback")) {
    el.classList.add("reveal");
    io.observe(el);
  }
}
