/**
 * The three nacelle drawings. Coordinates are sheet units (1200 × 720);
 * all live numbers come from the landing simulation and the backend nacelle
 * subsystem model, never from constants in this file:
 *
 *   E-01  single-line diagram (IEC 60617): direct-drive PMSG (4.77 kV) → full
 *         converter → breaker → step-up transformer (→ 66 kV) → tower-base 66 kV switchgear with the
 *         in/out string feeders; auxiliary 400 V board below.
 *         Currents at unity power factor: I = P / (√3·U).
 *   M-01  drivetrain: rotor, two main bearings, hollow main shaft, rotor brake,
 *         direct-drive PMSG (no gearbox, f_e = 100·n/60); yaw system. T = P / ω.
 *   P-01  hydraulics & cooling P&ID (ISA-5.1): HPU, accumulator, pitch /
 *         rotor-brake / yaw-brake circuits; water-glycol loop (no gear oil).
 */

import type { NacelleSubsystemsResponse } from "../../../../services/nacelleSubsystemsApi";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import type { TurbineData } from "../../../../types/landing";
import { CONVERTER_GRID_KV, type PowerChain } from "../../../../utils/landingPhysics";
import { REFERENCE_TURBINE } from "../../../../utils/turbineCurves";
import {
  Accumulator, Battery, Bearing, BrakeCaliper, Breaker, Bubble, CableEnd, Capacitor, CheckValve, Converter, CT,
  Cylinder, Disconnector, EarthSwitch, Filter, Generator, HeatExchanger, Label, Motor, OffSheet,
  ProportionalValve, Pump, Reading, Relay, ReliefValve, Sym, Tank, Transformer, VT,
} from "./symbols";
import { Legend, Sheet, Wire } from "./sheet";

export interface SheetProps {
  turbine: TurbineData;
  chain: PowerChain;
  nacelle?: NacelleSubsystemsResponse;
  selected: TurbinePartId | null;
  onSelect: (p: TurbinePartId) => void;
  /** Neighbours on the 66 kV string and the power each feeder carries. */
  string: { outerId: string | null; innerId: string; outerMW: number; innerMW: number; outerCount: number };
  yawErrDeg: number;
  windFromDeg: number;
}

const kA = (mw: number, kv: number) => mw / (Math.sqrt(3) * kv); // kA at unity pf
const f2 = (x: number) => x.toFixed(2);

// ── E-01 single-line ─────────────────────────────────────────────────

export function ElectricalSheet({ turbine, chain, selected, onSelect, string, nacelle }: SheetProps) {
  const online = turbine.status === "operating" || turbine.status === "curtailed";
  const p = turbine.powerOutputMW;
  const flow = online && p > 0.05;
  const sel = { selected, onSelect };
  return (
    <Sheet title="Single-line diagram" subtitle={`${turbine.id} · generator to 66 kV string`} dwg="SB5-WTG-E-001" sheet="1 / 3" standard="IEC 60617 · IEC 81346">
      {/* location frames */}
      <rect x={56} y={120} width={636} height={262} rx={4} fill="none" stroke="currentColor" strokeDasharray="10 4" strokeWidth={1} strokeOpacity={0.6} />
      <text x={64} y={136} fontSize={11} fontWeight={800} fill="currentColor" fillOpacity={0.75}>+NACELLE</text>
      <rect x={760} y={120} width={300} height={262} rx={4} fill="none" stroke="currentColor" strokeDasharray="10 4" strokeWidth={1} strokeOpacity={0.6} />
      <text x={768} y={136} fontSize={11} fontWeight={800} fill="currentColor" fillOpacity={0.75}>+TOWER BASE · 66 kV switchgear</text>

      {/* main power path */}
      <Wire d="M 138 250 L 214 250" kind="lv" flow={flow} />
      <Wire d="M 266 250 L 334 250" kind="dc" />
      <Wire d="M 386 250 L 598 250" kind="lv" flow={flow} />
      <Wire d="M 642 250 L 693 250" kind="mv" flow={flow} />
      <Wire d="M 737 250 L 790 250" kind="mv" flow={flow} />
      <text x={668} y={272} fontSize={9.5} fontWeight={700} fill="currentColor" fillOpacity={0.7} textAnchor="middle">tower cable</text>

      <Sym x={110} y={250} part="generator" {...sel} title="Direct-drive permanent-magnet synchronous generator (200 poles, 4.77 kV)">
        <Generator />
      </Sym>
      <Label x={110} y={205} tag="-G1" text="PMSG · 4.77 kV" />
      <Reading x={62} y={290} lines={[`${f2(chain.generator.outMW)} MW`, `${chain.generatorRpm.toFixed(2)} rpm · ${chain.generatorHz.toFixed(1)} Hz`]} />
      <g transform="translate(176 250)"><CT /></g>
      <Label x={176} y={234} tag="-T11" />

      <Sym x={240} y={250} part="converter" {...sel} title="Full-power converter, generator side (rectifier)" box={[-34, -34, 160, 68]}>
        <Converter from="~" to="=" />
        <g transform="translate(120 0)"><Converter from="=" to="~" /></g>
      </Sym>
      <Label x={300} y={205} tag="-U1" text="full converter AC/DC/AC" />
      <Wire d="M 300 250 L 300 276" kind="dc" />
      <g transform="translate(300 282)"><Capacitor /></g>
      <Wire d="M 300 286 L 300 302" kind="dc" />
      <Label x={300} y={318} tag="-C1" text="DC link" />
      <Reading x={236} y={330} lines={[`${f2(chain.converter.outMW)} MW out`, `η ${(100 * (chain.converter.outMW / Math.max(chain.generator.outMW, 1e-6))).toFixed(1)} %`]} />

      <Sym x={450} y={250} part="converter" {...sel} title="LV circuit breaker">
        <Breaker closed={online} />
      </Sym>
      <Label x={450} y={228} tag="-Q1" text={online ? "closed" : "open"} />
      <Reading x={404} y={272} lines={[`I ${f2(kA(chain.converter.outMW, CONVERTER_GRID_KV))} kA`, `@ ${CONVERTER_GRID_KV} kV, pf 1`]} />
      <g transform="translate(512 250)"><CT /></g>
      <g transform="translate(540 250)"><VT /></g>
      <Label x={540} y={308} tag="-T12" text="VT" />

      <Sym x={620} y={250} part="transformer" {...sel} title="Step-up transformer">
        <Transformer />
      </Sym>
      <Label x={620} y={205} tag="-T1" text={`${CONVERTER_GRID_KV} / 66 kV Dyn11`} />
      <Reading x={572} y={290} lines={[`${f2(p)} MW`, `I ${(kA(p, 66) * 1000).toFixed(0)} A @ 66 kV`]} />

      <Sym x={715} y={250} part="transformer" {...sel} title="66 kV transformer feeder circuit breaker">
        <Breaker closed={online} />
      </Sym>
      <Label x={715} y={228} tag="-Q2" text="CB" />
      <g transform="translate(772 250)"><EarthSwitch /></g>
      <Label x={772} y={300} tag="-Q8" />

      {/* busbar + two string feeders */}
      <Wire d="M 790 170 L 790 330" kind="mv" />
      <Wire d="M 790 180 L 1000 180" kind="mv" flow={string.outerMW > 0.05} />
      <Wire d="M 790 320 L 1000 320" kind="mv" flow={string.innerMW > 0.05} />
      <g transform="translate(840 180)"><Disconnector /></g>
      <g transform="translate(840 320)"><Disconnector /></g>
      <Label x={840} y={165} tag="-Q11" text="LBS" />
      <Label x={840} y={305} tag="-Q12" text="LBS" />
      <g transform="translate(884 180)"><EarthSwitch /></g>
      <g transform="translate(884 320)"><EarthSwitch /></g>
      <g transform="translate(930 180)"><CT /></g>
      <g transform="translate(930 320)"><CT /></g>
      <g transform="translate(1008 180)"><CableEnd /></g>
      <g transform="translate(1008 320)"><CableEnd /></g>
      <Label x={1022} y={172} anchor="start" tag="-W1" text={string.outerId ? `to ${string.outerId}` : "spare"} />
      <Label x={1022} y={312} anchor="start" tag="-W2" text={`to ${string.innerId}`} />
      <Reading x={944} y={196} lines={[`${(kA(string.outerMW, 66) * 1000).toFixed(0)} A`, `${string.outerCount} WTG out`]} />
      <Reading x={944} y={336} lines={[`${(kA(string.innerMW, 66) * 1000).toFixed(0)} A`, `${f2(string.innerMW)} MW`]} />

      {/* protection + control */}
      <g transform="translate(715 352)"><Relay codes="50/51 50N 27/59 81" /></g>
      <Label x={715} y={390} tag="-F1" text="feeder protection" />
      <Wire d="M 715 338 L 715 262" kind="signal" />
      <Sym x={300} y={160} part="control_cabinet" {...sel} title="Turbine / converter controller" box={[-60, -16, 120, 32]}>
        <Relay codes="-A1 converter ctrl" w={120} />
      </Sym>
      <Wire d="M 250 174 L 250 224" kind="data" />
      <Wire d="M 350 174 L 350 224" kind="data" />
      <Wire d="M 360 160 L 700 160 L 700 104 L 1160 104" kind="data" arrow />
      <text x={1158} y={97} fontSize={10.5} fontWeight={700} textAnchor="end" fill="currentColor">to park controller (PPC) · IEC 61850 over fibre</text>

      {/* auxiliary supply */}
      <Wire d="M 480 250 L 480 400" kind="lv" />
      <g transform="translate(480 330) rotate(90)"><Breaker closed /></g>
      <Label x={496} y={334} anchor="start" tag="-Q3" />
      <g transform="translate(480 420) rotate(90)"><Transformer /></g>
      <Label x={508} y={424} anchor="start" tag="-T2" text="aux → 400 V" />
      <Wire d="M 480 452 L 480 480 M 150 480 L 720 480" kind="lv" />
      {(
        [
          [170, "yaw_brake", "-M11…14", "yaw drives"],
          [270, "hpu", "-M21", "HPU pump"],
          [370, "coolant_skid", "-M31…33", "cooling"],
          [470, "fire_suppression", "-E41", "HVAC / heat"],
        ] as const
      ).map(([x, part, tag, text]) => (
        <g key={tag}>
          <Wire d={`M ${x} 480 L ${x} 512`} kind="lv" />
          <Sym x={x} y={526} part={part} {...sel} box={[-18, -18, 36, 36]}>
            <Motor />
          </Sym>
          <Label x={x} y={558} tag={tag} />
          <Label x={x} y={572} text={text} />
        </g>
      ))}
      <Wire d="M 590 480 L 590 510" kind="lv" />
      <Sym x={590} y={516} part="ups" {...sel} title="UPS battery" box={[-18, -10, 36, 36]}>
        <Battery />
      </Sym>
      <Label x={590} y={558} tag="-G2" text="UPS" />
      <Reading x={610} y={506} lines={[`SoC ${nacelle ? nacelle.ups.battery_soc_pct.toFixed(0) : "—"} %`, `${nacelle ? nacelle.ups.backup_time_min.toFixed(0) : "—"} min`]} />
      <Legend kinds={["mv", "lv", "dc", "signal", "data"]} x={790} y={430} />
    </Sheet>
  );
}

// ── M-01 drivetrain ──────────────────────────────────────────────────

export function DrivetrainSheet({ turbine, chain, selected, onSelect, nacelle, yawErrDeg, windFromDeg }: SheetProps) {
  const sel = { selected, onSelect };
  const rpm = turbine.rotorSpeedRpm;
  const stopped = rpm < 0.2;
  return (
    <Sheet title="Drivetrain & yaw" subtitle={`${turbine.id} · mechanical power path · direct drive`} dwg="SB5-WTG-M-001" sheet="2 / 3" standard="ISO 3952 · IEC 61400-1">
      {/* shaft line: hub → main shaft → generator rotor, one speed (no gearbox) */}
      <Wire d="M 146 280 L 520 280" kind="shaft" />
      <Sym x={110} y={280} part="hub" {...sel} title="Rotor hub with 3 pitch systems" box={[-44, -100, 88, 200]}>
        {[90, 210, 330].map((a) => (
          <line key={a} x1={0} y1={0} x2={92 * Math.cos((a * Math.PI) / 180)} y2={-92 * Math.sin((a * Math.PI) / 180)}
            stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
        ))}
        <circle r={32} fill="var(--color-bg-primary)" stroke="currentColor" strokeWidth={1.6} />
        <text y={-6} textAnchor="middle" fontSize={10} fontWeight={800} fill="currentColor">3 × pitch</text>
        <text y={8} textAnchor="middle" fontSize={10} fontWeight={700} fill="currentColor">{turbine.pitchAngleDeg.toFixed(1)}°</text>
      </Sym>
      <Label x={110} y={400} tag="-rotor" text={`Ø ${REFERENCE_TURBINE.rotorDiameterM.toFixed(0)} m`} />
      <Sym x={200} y={280} part="bearing" {...sel} title="Upwind main bearing — tapered double outer-ring (locating)">
        <Bearing />
      </Sym>
      <Label x={200} y={240} tag="-MB1" text="TDO" />
      <Sym x={285} y={280} part="bearing" {...sel} title="Downwind main bearing — spherical roller (non-locating), 1.2 m aft">
        <Bearing />
      </Sym>
      <Label x={285} y={240} tag="-MB2" text="SRB" />
      <Reading x={186} y={318} lines={[`${turbine.bearingTempC.toFixed(0)} °C`, `${turbine.vibrationMmS.toFixed(1)} mm/s`]} />
      <Sym x={350} y={280} part="shaft" {...sel} title="Hollow main shaft (Ø 6 m, 2.2 m) around the stationary turret" box={[-30, -20, 60, 40]}>
        <rect x={-28} y={-6} width={56} height={12} fill="transparent" />
      </Sym>
      <Reading x={316} y={170} lines={["main shaft", `${rpm.toFixed(2)} rpm`, `${(chain.rotorTorqueKNm / 1000).toFixed(1)} MN·m`]} />
      <Sym x={440} y={280} part="brake" {...sel} title="Rotor brake / lock on the generator rotor disc">
        <BrakeCaliper applied={stopped} />
      </Sym>
      <Label x={440} y={330} tag="-BR" text={stopped ? "applied" : "released"} />

      {/* direct-drive generator: outer rotor on the shaft, stator on the turret */}
      <Sym x={640} y={280} part="generator" {...sel} title="Direct-drive PMSG — 200 poles, outer rotor, air gap r 5.08 m" box={[-120, -86, 240, 172]}>
        <rect x={-116} y={-80} width={232} height={160} rx={6} fill="url(#dwg-hatch)" stroke="currentColor" strokeWidth={1.2} strokeDasharray="8 4" />
        <Generator />
      </Sym>
      <Label x={640} y={185} tag="-G1" text="direct-drive PMSG · 200 poles · no gearbox" />
      <Reading x={530} y={380} lines={[`n = ${rpm.toFixed(2)} rpm (rotor speed)`, `f_e = 100·n/60 = ${chain.generatorHz.toFixed(1)} Hz`, `loss ${f2(chain.generator.lossMW)} MW heat`]} />
      <g transform="translate(790 280)"><OffSheet text="E-01 / B1" /></g>
      <Reading x={760} y={318} lines={[`${f2(chain.generator.outMW)} MW el.`]} />

      {/* yaw system */}
      <Sym x={300} y={540} part="yaw" {...sel} title="Yaw bearing with drives and brakes" box={[-100, -80, 200, 160]}>
        <circle r={62} fill="none" stroke="currentColor" strokeWidth={4} />
        <circle r={50} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" />
        {Array.from({ length: 4 }, (_, i) => {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          return (
            <g key={i} transform={`translate(${80 * Math.cos(a)} ${80 * Math.sin(a)})`}>
              <Motor r={9} />
            </g>
          );
        })}
        <g transform={`rotate(${turbine.nacellePositionDeg})`}>
          <path d="M 0 -44 L 7 -30 L -7 -30 Z" fill="var(--color-accent)" />
        </g>
      </Sym>
      <Label x={300} y={640} tag="-MDL" text="2-row ball yaw bearing · drives (symbolic count)" />
      <Sym x={470} y={540} part="yaw_brake" {...sel} title="Yaw brake calipers">
        <BrakeCaliper applied={Math.abs(yawErrDeg) < 3} />
      </Sym>
      <Label x={470} y={594} tag="-BY" text="yaw brakes" />
      <Reading x={540} y={500} lines={[
        `heading ${turbine.nacellePositionDeg.toFixed(0)}°`,
        `wind from ${windFromDeg.toFixed(0)}°`,
        `yaw error ${yawErrDeg >= 0 ? "+" : ""}${yawErrDeg.toFixed(0)}°`,
        `cable twist ${nacelle ? nacelle.cable_twist.twist_turns.toFixed(2) : "—"} turns`,
      ]} tone={Math.abs(yawErrDeg) > 45 ? "var(--color-status-warning)" : "var(--color-accent)"} />
      <Legend kinds={["shaft"]} x={790} y={430} />
      <text x={790} y={480} fontSize={10.5} fontWeight={600} fill="currentColor">T = P / ω · one shaft speed (direct drive):</text>
      <text x={790} y={495} fontSize={10.5} fontWeight={600} fill="currentColor">generator n = rotor n, f_e = pole pairs · n / 60</text>
    </Sheet>
  );
}

// ── P-01 hydraulics & cooling ────────────────────────────────────────

export function HydraulicSheet({ turbine, selected, onSelect, nacelle }: SheetProps) {
  const sel = { selected, onSelect };
  const hpu = nacelle?.hpu;
  const cool = nacelle?.cooling;
  const running = hpu?.pump_running ?? true;
  const fmt = (v: number | undefined, d = 0) => (v === undefined ? "—" : v.toFixed(d));
  return (
    <Sheet title="Hydraulics & cooling P&ID" subtitle={`${turbine.id} · HPU, brakes and the water-glycol loop (direct drive: no gear oil)`} dwg="SB5-WTG-P-001" sheet="3 / 3" standard="ISA-5.1 · ISO 1219">
      {/* ── hydraulic power unit ── */}
      <text x={60} y={96} fontSize={12} fontWeight={800} fill="currentColor">HYDRAULIC POWER UNIT</text>
      <Wire d="M 140 540 L 140 464" kind="hydRet" />
      <Wire d="M 140 436 L 140 352 M 140 328 L 140 312 M 140 288 L 140 200 L 720 200" kind="hyd" flow={running} />
      <Sym x={140} y={560} part="hpu" {...sel} title="Oil reservoir" box={[-50, -30, 100, 60]}>
        <Tank level={0.65} />
      </Sym>
      <Label x={140} y={604} tag="-T" text={`tank · ISO ${hpu?.iso_cleanliness_code ?? "—"}`} />
      <Sym x={140} y={450} part="hpu" {...sel} title="HPU pump" box={[-70, -20, 90, 40]}>
        <Pump running={running} />
        <line x1={-14} y1={0} x2={-36} y2={0} stroke="currentColor" strokeWidth={3} />
        <g transform="translate(-50 0)"><Motor /></g>
      </Sym>
      <Label x={176} y={454} anchor="start" tag="-P1/-M21" text={running ? "running" : "stopped"} />
      <g transform="translate(140 340) rotate(90)"><Filter /></g>
      <Label x={158} y={344} anchor="start" tag="-F1" />
      <g transform="translate(140 300) rotate(-90)"><CheckValve /></g>
      <Label x={158} y={304} anchor="start" tag="-V1" />
      <Sym x={230} y={200} part="hpu" {...sel} title="Bladder accumulator" box={[-16, -50, 32, 52]}>
        <Accumulator charge={(hpu?.accumulator_charge_pct ?? 70) / 100} />
      </Sym>
      <g transform="translate(230 116)"><Bubble letters="PT" num="102" /></g>
      <Wire d="M 245 116 L 262 116" kind="signal" />
      <Reading x={264} y={104} lines={[`${fmt(hpu?.accumulator_pressure_bar)} bar`, `charge ${fmt(hpu?.accumulator_charge_pct)} %`]} />
      <Wire d="M 330 200 L 330 610" kind="hydRet" />
      <g transform="translate(330 250) rotate(90)"><ReliefValve /></g>
      <Label x={346} y={272} anchor="start" tag="-V2" text="relief" />
      <g transform="translate(400 150)"><Bubble letters="PT" num="101" panel alarm={hpu?.alarm} /></g>
      <Wire d="M 400 165 L 400 200" kind="signal" />
      <Reading x={420} y={138} lines={[`${fmt(hpu?.line_pressure_bar)} bar`]} tone={hpu?.alarm ? "var(--color-status-alarm)" : "var(--color-accent)"} />

      {/* consumers */}
      {(
        [
          [480, "hub", "-Y11…13", "×3 pitch (via rotary union)"],
          [600, "brake", "-Y21", "rotor brake"],
          [710, "yaw_brake", "-Y31", "yaw brakes ×4"],
        ] as const
      ).map(([x, part, tag, text]) => (
        <g key={tag}>
          <Wire d={`M ${x} 200 L ${x} 272 M ${x} 308 L ${x} 360`} kind="hyd" flow={running} />
          <g transform={`translate(${x} 290) rotate(90)`}><ProportionalValve /></g>
          <Label x={x + 18} y={294} anchor="start" tag={tag} />
          <Sym x={x} y={392} part={part} {...sel} title={text} box={[-40, -34, 80, 68]}>
            {part === "hub" ? (
              <g transform="rotate(90)"><Cylinder ext={(hpu?.pitch_cylinder_extension_pct ?? 50) / 100} /></g>
            ) : (
              <BrakeCaliper applied={part === "brake" ? turbine.rotorSpeedRpm < 0.2 : true} />
            )}
          </Sym>
          <Label x={x} y={446} text={text} />
          <Wire d={`M ${x + 22} 392 L ${x + 30} 392 L ${x + 30} 610`} kind="hydRet" />
        </g>
      ))}
      <Wire d="M 740 610 L 190 610 L 190 560" kind="hydRet" arrow />
      <g transform="translate(560 480)"><Bubble letters="ZT" num="111" /></g>
      <Label x={580} y={484} anchor="start" text={`pitch ${turbine.pitchAngleDeg.toFixed(1)}°`} />
      <g transform="translate(660 480)"><Bubble letters="PT" num="103" /></g>
      <Label x={680} y={484} anchor="start" text={`brake ${fmt(hpu?.brake_caliper_pressure_bar)} bar`} />

      {/* ── water-glycol loop to the roof cooler ── */}
      <text x={800} y={330} fontSize={12} fontWeight={800} fill="currentColor">WATER-GLYCOL LOOP · generator + converter</text>
      <g transform="translate(830 360)"><Bubble letters="TT" num="201" panel alarm={cool?.winding_temp_alarm} /></g>
      <Reading x={800} y={240} lines={[`winding ${fmt(cool?.winding_temp_c, 1)} °C`, `gen ${fmt(cool?.generator_loss_kw)} kW · conv ${fmt(cool?.converter_loss_kw)} kW`]} tone={cool?.winding_temp_alarm ? "var(--color-status-alarm)" : "var(--color-accent)"} />
      <Reading x={1040} y={240} lines={[`fan ${fmt(cool?.fan_speed_pct)} %`, `${fmt(cool?.cooler_heat_rejection_kw)} kW`]} />
      <Wire d="M 866 400 L 910 400 M 950 400 L 1022 400 M 1054 400 L 1098 400 L 1098 372 M 1098 332 L 1098 320 L 1150 320 L 1150 460 L 830 460 L 830 424" kind="glycol" flow />
      <Sym x={830} y={400} part="generator" {...sel} title="Generator stator jacket" box={[-34, -24, 68, 48]}>
        <rect x={-32} y={-20} width={64} height={40} rx={4} fill="var(--color-bg-primary)" stroke="currentColor" strokeWidth={1.6} />
        <text y={4} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="currentColor">generator</text>
      </Sym>
      <Sym x={930} y={400} part="converter" {...sel} title="Converter cold plates" box={[-24, -24, 48, 48]}>
        <rect x={-22} y={-20} width={44} height={40} rx={4} fill="var(--color-bg-primary)" stroke="currentColor" strokeWidth={1.6} />
        <text y={4} textAnchor="middle" fontSize={10} fontWeight={800} fill="currentColor">conv.</text>
      </Sym>
      <g transform="translate(1038 400)"><Pump /></g>
      <Label x={1038} y={428} tag="-P3" />
      <g transform="translate(1098 352)"><HeatExchanger /></g>
      <Label x={1076} y={356} anchor="end" tag="-E2" text="CoolerTop (roof)" />
      <Wire d="M 960 460 L 960 485" kind="signal" />
      <g transform="translate(960 500)"><Bubble letters="TT" num="301" /></g>
      <Legend kinds={["hyd", "hydRet", "glycol", "signal"]} x={790} y={520} />
    </Sheet>
  );
}
