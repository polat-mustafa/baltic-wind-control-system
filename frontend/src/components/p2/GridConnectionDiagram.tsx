/**
 * Single-line diagram of the connection, driven by the selected load flow.
 *
 * Turbines → 66 kV array → OSS 66/220 kV → 2 × 108 km export → onshore
 * 220/400 kV → PSE. Dashes flow towards the grid at a speed proportional to
 * the MW in that element (static with reduced motion); every busbar shows its
 * voltage, every branch its MW and loading. Reactors and STATCOM sit on the
 * offshore 220 kV busbar with their MVAR (generating positive).
 */

import { motion, useReducedMotion } from "framer-motion";

import { scenarioLabels } from "../../constants/gridScenarios";
import { useGridStore, useNetwork } from "../../store/gridStore";
import { ScenarioTabs } from "./CableLoadingPanel";

const W = 960;
const H = 210;
const Y = 92;
// busbar x positions: WTG group, OSS 66, OSS 220, Onshore 220, PSE 400
const X = [70, 300, 430, 690, 860];

function Bus({
  x,
  label,
  kv,
  v,
}: {
  x: number;
  label: string;
  kv: string;
  v?: number;
}) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={Y - 34}
        y2={Y + 34}
        stroke="var(--color-text-primary)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <text
        x={x}
        y={Y - 44}
        textAnchor="middle"
        className="fill-text-primary"
        fontSize={13}
        fontWeight={600}
      >
        {label}
      </text>
      <text
        x={x}
        y={Y + 52}
        textAnchor="middle"
        className="fill-text-muted"
        fontSize={11}
      >
        {kv}
      </text>
      {v !== undefined && (
        <text
          x={x}
          y={Y + 67}
          textAnchor="middle"
          className="fill-text-secondary"
          fontSize={12}
          fontFamily="IBM Plex Mono, monospace"
        >
          {v > 0 ? `${v.toFixed(3)} pu` : "de-energised"}
        </text>
      )}
    </g>
  );
}

function Flow({
  x1,
  x2,
  mw,
  label,
  loading,
}: {
  x1: number;
  x2: number;
  mw: number;
  label: string;
  loading?: number;
}) {
  const reduce = useReducedMotion();
  const duration = mw > 1 ? Math.max(0.4, 4 - (mw / 510) * 3.4) : 0; // faster with more power
  return (
    <g>
      <line
        x1={x1}
        x2={x2}
        y1={Y}
        y2={Y}
        stroke="var(--color-border-secondary)"
        strokeWidth={3}
      />
      {mw > 1 && (
        <motion.line
          x1={x1}
          x2={x2}
          y1={Y}
          y2={Y}
          stroke="var(--color-accent)"
          strokeWidth={3}
          strokeDasharray="6 14"
          initial={{ strokeDashoffset: 0 }}
          animate={reduce ? undefined : { strokeDashoffset: -40 }}
          transition={{ duration, repeat: Infinity, ease: "linear" }}
        />
      )}
      <text
        x={(x1 + x2) / 2}
        y={Y - 10}
        textAnchor="middle"
        className="fill-text-secondary"
        fontSize={11}
      >
        {label}
      </text>
      <text
        x={(x1 + x2) / 2}
        y={Y + 20}
        textAnchor="middle"
        className="fill-text-primary"
        fontSize={12}
        fontFamily="IBM Plex Mono, monospace"
      >
        {mw.toFixed(0)} MW
        {loading !== undefined ? ` · ${loading.toFixed(0)} %` : ""}
      </text>
    </g>
  );
}

export default function GridConnectionDiagram() {
  const { loadFlowResults, activeScenario } = useGridStore();
  const n = useNetwork();
  const SCENARIO_LABEL = scenarioLabels(n);
  const r = loadFlowResults?.find((x) => x.scenario === activeScenario);
  if (!r) return null;

  const v = (name: string) => r.buses.find((b) => b.name === name)?.vm_pu;
  const line = (name: string) => r.lines.find((l) => l.name === name);
  const trafo = (name: string) => r.transformers.find((t) => t.name === name);
  const exp = line("Export_220kV");
  const tOss = trafo("Trafo_66_220kV");
  const tOn = trafo("Trafo_220_400kV");
  const oss220 = r.buses.find((b) => b.name === "OSS_220kV");
  const strings = r.lines.filter((l) => /^Array_S\d+_T1$/.test(l.name));
  const arrayMw = strings.reduce((s, l) => s + Math.abs(l.p_from_mw), 0);
  const maxString = Math.max(0, ...strings.map((l) => l.loading_percent));

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-text-primary">
          How {n.total_capacity_mw.toFixed(0)} MW reach the PSE grid
        </h3>
        <ScenarioTabs />
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px] h-auto"
          role="img"
          aria-label={`Single-line diagram, ${SCENARIO_LABEL[activeScenario]}`}
        >
          <Flow
            x1={X[0]}
            x2={X[1]}
            mw={arrayMw}
            label={`${n.num_strings} strings · 66 kV array`}
            loading={maxString}
          />
          <Flow
            x1={X[1]}
            x2={X[2]}
            mw={Math.abs(tOss?.p_hv_mw ?? 0)}
            label={`TX ${n.num_oss_transformers} × ${n.oss_trafo_mva} MVA`}
            loading={tOss?.loading_percent}
          />
          <Flow
            x1={X[2]}
            x2={X[3]}
            mw={Math.abs(exp?.p_from_mw ?? 0)}
            label={`Export ${n.num_export_cables} × ${n.export_length_km} km · 220 kV`}
            loading={exp?.loading_percent}
          />
          <Flow
            x1={X[3]}
            x2={X[4]}
            mw={Math.abs(tOn?.p_hv_mw ?? 0)}
            label={`TX ${n.num_onshore_transformers} × ${n.onshore_trafo_mva} MVA`}
            loading={tOn?.loading_percent}
          />
          <Bus
            x={X[0]}
            label={`${r.total_generation_mw.toFixed(0)} MW`}
            kv={`${n.num_turbines} × 15 MW`}
          />
          <Bus x={X[1]} label="OSS" kv="66 kV" v={v("OSS_66kV")} />
          <Bus x={X[2]} label="OSS" kv="220 kV" v={v("OSS_220kV")} />
          <Bus x={X[3]} label="Onshore" kv="220 kV" v={v("Onshore_220kV")} />
          <Bus x={X[4]} label="PSE" kv="400 kV · POC" v={v("PSE_400kV")} />
          {/* Shunt compensation hanging off OSS 220 kV */}
          <line
            x1={X[2]}
            x2={X[2]}
            y1={Y + 72}
            y2={Y + 90}
            stroke="var(--color-border-secondary)"
            strokeWidth={2}
          />
          <text
            x={X[2]}
            y={Y + 106}
            textAnchor="middle"
            className="fill-text-secondary"
            fontSize={11}
          >
            {n.num_reactors} × {n.reactor_unit_mvar} MVAR reactors + STATCOM {r.statcom_q_mvar >= 0 ? "+" : ""}
            {r.statcom_q_mvar.toFixed(0)} MVAR · net{" "}
            {oss220 ? `${oss220.q_mvar.toFixed(0)}` : "—"} MVAR
          </text>
          <text
            x={X[4]}
            y={Y + 92}
            textAnchor="middle"
            className="fill-text-primary"
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
          >
            {r.poc_p_mw.toFixed(0)} MW · {r.poc_q_mvar >= 0 ? "+" : ""}
            {r.poc_q_mvar.toFixed(0)} MVAR
          </text>
        </svg>
      </div>
      <p className="text-xs text-text-muted">
        {SCENARIO_LABEL[activeScenario]} · losses {r.total_loss_mw.toFixed(2)}{" "}
        MW · reactive power positive = delivered/generated (Rule 4). The export
        cables generate ≈ {n.cable_q_mvar.toFixed(0)} MVAR of charging power at any output — the
        reactors absorb most of it.
      </p>
    </div>
  );
}
