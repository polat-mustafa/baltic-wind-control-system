"""
First-energisation switching programme of export circuit 1.

Scope
-----
Circuit 1 = export cable 1 → OSS 220 kV busbar (shunt reactor 1, STATCOM) →
TX-OSS-01 → 66 kV section A → strings 1–3 (18 × 15 MW = 270 MW). The onshore
220 kV busbar is already live (onshore substation commissioned separately);
circuit 2 (cable 2, TX-OSS-02, section B, strings 4–6) stays isolated and
earthed and has its own programme. One circuit can never deliver 510 MW: one
cable is rated 362 MVA and one OSS transformer 300 MVA.

Sequence (60 steps, 6 phases)
-----------------------------
1. Pre-energisation — safety documents cancelled, SAT approved, EON issued by
   PSE (NC RfG Art. 34: protection and control settings agreed), protection in
   service, hold point.
2. Export cable 1 — release locks, remove both cable earths, close the onshore
   busbar disconnector, energise the cable open-ended from shore, verify
   charging current and Ferranti rise, 24 h soak at U0 (IEC 62067's alternative
   after-installation AC test), hold point.
3. OSS 220 kV — remove the busbar earth, close DS/CB, remove the bay earths and
   switch in reactor 1 (80 Mvar) and the STATCOM (voltage control at 1.00 pu).
4. TX-OSS-01 — remove its bay earth, energise from the 220 kV side (inrush; 87T
   restrained by the 2nd harmonic), verify magnetising current, energise 66 kV
   section A, hold point.
5. Strings 1–3 — ION issued (Art. 35: generation allowed), per string: remove
   lock, remove earth, close feeder CB, verify, release the turbines.
6. Rated-output check (cable and transformer loading), declaration.

That is the SB-510 programme. For another farm (``FarmSpec``) the steps follow
its design: the strings of section A (1…⌈n/2⌉) with their turbine counts, the
reactor unit (no reactor steps when the design has none), STATCOM and
transformer ratings, the cable length; the rated-output check uses
``energisation.circuit1_limit_mw``. The programme stores its spec.

Verification steps are evaluated on the steady-state load flow of the live
network (``energisation.network_snapshot``); a value outside the band fails
the step. Voltage acceptance uses a project operating band of 0.95–1.05 pu;
the equipment limits are Um = 245 kV and 72.5 kV (≈ 1.11 / 1.10 pu).

Lifecycle
---------
    CREATED → APPROVED → IN_PROGRESS ⇄ HOLD (hold point; GO completes it)
                             ⇅ SUSPENDED (emergency; GO resumes)
    → COMPLETED | ABORTED (NO-GO or emergency trip)

References: EN 50110-1:2013; IEC 61936-1:2021; IEC 62067:2022 (after-
installation tests); Regulation (EU) 2016/631 (NC RfG) Art. 34–36.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from app.core.exceptions import DomainError, StateTransitionError, ValidationError
from app.services.p2.network_model import (
    OLTC_STEP_PERCENT,
    SB510,
    TRAFO_66_220_I0_PERCENT,
    FarmSpec,
)
from app.services.p5.energisation import (
    V_BAND_PU,
    NetworkSnapshot,
    cable_charging_mvar,
    circuit1_limit_mw,
    ferranti_ratio,
    network_snapshot,
    onshore_tap,
    reactor_energisation,
    section_a_mw,
)
from app.services.p5.equipment_state import (
    EquipmentState,
    InterlockError,
    InvalidTransitionError,
    SwitchingAction,
    ZoneStatus,
    build_initial_state,
    execute_switching_action,
    get_equipment_definition,
)
from app.services.p5.fat import TestCampaignStatus
from app.services.p5.grid_code_testing import NotificationStage
from app.services.p5.loto import (
    LOTOSet,
    LOTOStatus,
    create_loto_set_for_oss,
    point_id_for,
    remove_loto,
)

if TYPE_CHECKING:
    from app.services.p5.grid_code_testing import ComplianceCampaign
    from app.services.p5.sat import SATCampaign

STATCOM_V_TOL_PU = 0.01


def tx1_i0_a(spec: FarmSpec = SB510) -> float:
    """Design magnetising current of TX-OSS-01 at 220 kV [A] (≈ 0.39 A for 300 MVA)."""
    return TRAFO_66_220_I0_PERCENT / 100 * spec.oss_trafo_mva / (3**0.5 * 220.0) * 1e3


TX1_I0_A = tx1_i0_a()


class ProgrammeStatus(StrEnum):
    CREATED = "created"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    HOLD = "hold"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    ABORTED = "aborted"


class StepStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class StepType(StrEnum):
    CHECK = "check"  # confirmed by the responsible person
    GATE = "gate"  # evaluated: SAT / EON / ION status
    ISOLATION = "isolation"  # remove a safety lock
    SWITCHING = "switching"  # operate a device (interlocked)
    VERIFICATION = "verification"  # evaluated on the load flow
    HOLD_POINT = "hold_point"  # PiC GO / NO-GO
    DECLARATION = "declaration"


def strings_label(spec: FarmSpec = SB510) -> str:
    k = spec.section_a_strings
    return "string 1" if k == 1 else f"strings 1–{k}"


def phases(spec: FarmSpec = SB510) -> dict[int, str]:
    return {
        1: "Pre-energisation",
        2: "Export cable 1",
        3: "OSS 220 kV busbar & compensation",
        4: "TX-OSS-01 & 66 kV section A",
        5: strings_label(spec).capitalize(),
        6: "Rated output & hand-over",
    }


PHASES = phases()


@dataclass
class SwitchingStep:
    """One programme step. ``reading`` records what was found when it was executed."""

    step_id: str
    step_number: int
    phase: int
    step_type: StepType
    action: str
    equipment_id: str = ""
    switching_action: SwitchingAction | None = None
    check_id: str = ""  # VERIFICATION: key into CHECKS; GATE: sat / eon / ion
    responsible: str = "PiC"
    pic_confirmation: bool = True
    verification: str = ""
    notes: str = ""
    status: StepStatus = StepStatus.PENDING
    executed_at: datetime | None = None
    executed_by: str = ""
    reading: str = ""


@dataclass(frozen=True)
class AuditRecord:
    record_id: str
    timestamp: datetime
    action: str
    performed_by: str
    step_id: str = ""
    details: str = ""


@dataclass
class SwitchingProgramme:
    """A programme owns its equipment state, isolation locks and campaigns."""

    programme_id: str
    title: str
    pic_name: str
    status: ProgrammeStatus = ProgrammeStatus.CREATED
    steps: list[SwitchingStep] = field(default_factory=list)
    current_step_index: int = 0
    system_state: dict[str, EquipmentState] = field(default_factory=dict)
    loto_set: LOTOSet | None = None
    audit_trail: list[AuditRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    sat_campaign: SATCampaign | None = None
    fat_campaign_id: str | None = None
    compliance_campaign: ComplianceCampaign | None = None
    emergency_log: list[dict[str, object]] = field(default_factory=list)
    spec: FarmSpec = SB510

    def locked(self) -> frozenset[str]:
        return self.loto_set.locked_equipment() if self.loto_set else frozenset()


class ProgrammeError(DomainError):
    """Base exception for switching programme operations."""


class ProgrammeStateError(StateTransitionError):
    """Programme is in the wrong state for the requested operation."""


class StepExecutionError(ValidationError):
    """Step cannot be executed or its check failed."""


class PiCDecisionRequiredError(ProgrammeError):
    """Hold point reached — GO / NO-GO required."""


_TERMINAL = frozenset({ProgrammeStatus.COMPLETED, ProgrammeStatus.ABORTED})


def add_audit(
    programme: SwitchingProgramme, action: str, by: str, step_id: str = "", details: str = ""
) -> None:
    programme.audit_trail.append(
        AuditRecord(str(uuid.uuid4()), datetime.now(UTC), action, by, step_id, details)
    )


# ── Verification checks on the load flow ──────────────────────────


def _band(snap: NetworkSnapshot, zone: str) -> tuple[bool, str]:
    bus = snap.bus(zone)
    if bus is None:
        return False, f"{zone} is not energised"
    lo, hi = V_BAND_PU
    return lo <= bus.vm_pu <= hi, f"{bus.name} {bus.kv:.1f} kV ({bus.vm_pu:.3f} pu)"


Check = Callable[[NetworkSnapshot, dict[str, EquipmentState], FarmSpec], tuple[bool, str]]


def _check_cable_isolated(
    snap: NetworkSnapshot, state: dict[str, EquipmentState], _spec: FarmSpec
) -> tuple[bool, str]:
    oss_open = state["CB-OSS-220-01"] == EquipmentState.OPEN
    oss_dead = snap.zones["OSS220"] == ZoneStatus.DEAD
    ok = snap.zones["CABLE1"] == ZoneStatus.DEAD and (oss_open or oss_dead)
    return ok, (
        f"Cable 1 {snap.zones['CABLE1'].value}; CB-OSS-220-01 {state['CB-OSS-220-01'].value}"
    )


def _check_cable_energised(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], spec: FarmSpec
) -> tuple[bool, str]:
    ok1, onshore = _band(snap, "ONS220")
    ok2, far = _band(snap, "OSS220" if snap.bus("OSS220") else "CABLE1")
    return ok1 and ok2 and snap.cable_i_send_a is not None, (
        f"{onshore}; {far}, rise ×{ferranti_ratio(spec.export_length_km):.4f} (Ferranti); "
        f"charging current {snap.cable_i_send_a:.0f} A; {snap.poc_q_mvar:.0f} Mvar into PSE 400 kV"
    )


def _check_oss220(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], _s: FarmSpec
) -> tuple[bool, str]:
    return _band(snap, "OSS220")


def _check_reactor(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], _s: FarmSpec
) -> tuple[bool, str]:
    ok, v = _band(snap, "OSS220")
    q = snap.reactor_q_mvar
    return ok and q is not None, f"Reactor 1 {q:.1f} Mvar; {v}; {snap.poc_q_mvar:.0f} Mvar into PSE"


def _check_statcom(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], spec: FarmSpec
) -> tuple[bool, str]:
    bus, q = snap.bus("OSS220"), snap.statcom_q_mvar
    if bus is None or q is None:
        return False, "STATCOM not in service"
    ok = abs(bus.vm_pu - 1.0) <= STATCOM_V_TOL_PU and abs(q) < spec.statcom_mvar
    return ok, f"OSS 220 kV {bus.vm_pu:.3f} pu; STATCOM {q:+.1f} Mvar of ±{spec.statcom_mvar:.0f}"


def _check_tx1_no_load(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], spec: FarmSpec
) -> tuple[bool, str]:
    i, i0 = snap.tx1_i_hv_a, tx1_i0_a(spec)
    if i is None:
        return False, "TX-OSS-01 not energised"
    # IEC 60076-1 Table 1: measured no-load current ≤ design value + 30 %
    return i <= 1.3 * i0, f"Magnetising current {i:.2f} A (design i0 {i0:.2f} A, +30 % limit)"


def _check_section_a(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], _s: FarmSpec
) -> tuple[bool, str]:
    return _band(snap, "66A")


def _string_check(n: int) -> Check:
    return lambda snap, _state, _spec: _band(snap, f"STR{n}")


def _check_rated(
    snap: NetworkSnapshot, _: dict[str, EquipmentState], spec: FarmSpec
) -> tuple[bool, str]:
    cable, tx = snap.cable_loading_pct or 0.0, snap.tx1_loading_pct or 0.0
    ok = snap.generation_mw > 0 and cable < 100 and tx < 100
    return ok, (
        f"{snap.generation_mw:.0f} MW generated, {snap.poc_p_mw:.1f} MW at the POC; "
        f"cable 1 {cable:.0f} % of rating, TX-OSS-01 {tx:.0f} % of {spec.oss_trafo_mva:.0f} MVA"
    )


# string_n for every string section A can hold (≤ 150 turbines → ≤ 75 strings on A)
CHECKS: dict[str, Check] = {
    "cable_isolated": _check_cable_isolated,
    "cable_energised": _check_cable_energised,
    "oss220": _check_oss220,
    "reactor": _check_reactor,
    "statcom": _check_statcom,
    "tx1_no_load": _check_tx1_no_load,
    "section_a": _check_section_a,
    "rated": _check_rated,
    **{f"string_{n}": _string_check(n) for n in range(1, 76)},
}


# ── Programme definition ───────────────────────────────────────────


def _defs(spec: FarmSpec = SB510) -> list[tuple[int, dict[str, object]]]:
    def check(
        text: str, verification: str, responsible: str = "PiC", notes: str = ""
    ) -> dict[str, object]:
        return {"type": StepType.CHECK, "action": text, "verification": verification,
                "responsible": responsible, "notes": notes}  # fmt: skip

    def gate(gate_id: str, text: str, notes: str) -> dict[str, object]:
        return {"type": StepType.GATE, "action": text, "check_id": gate_id, "notes": notes,
                "verification": "Evaluated from the campaign status"}  # fmt: skip

    def unlock(eq_id: str) -> dict[str, object]:
        return {"type": StepType.ISOLATION, "equipment_id": eq_id, "responsible": "PiC",
                "action": f"Remove safety lock and danger tag from {eq_id}",
                "verification": "Isolation register updated"}  # fmt: skip

    def switch(eq_id: str, act: SwitchingAction, text: str, notes: str = "") -> dict[str, object]:
        return {"type": StepType.SWITCHING, "equipment_id": eq_id, "switching_action": act,
                "action": text, "notes": notes, "responsible": "SCADA",
                "verification": "Position indication at HMI and on the device"}  # fmt: skip

    def verify(check_id: str, text: str, notes: str = "") -> dict[str, object]:
        return {"type": StepType.VERIFICATION, "check_id": check_id, "action": text,
                "responsible": "SCADA", "notes": notes,
                "verification": "Load-flow reading of the live network"}  # fmt: skip

    def hold(text: str, notes: str = "") -> dict[str, object]:
        return {"type": StepType.HOLD_POINT, "action": text, "notes": notes,
                "verification": "PiC GO / NO-GO"}  # fmt: skip

    def declare(text: str, notes: str = "") -> dict[str, object]:
        return {"type": StepType.DECLARATION, "action": text, "pic_confirm": False, "notes": notes,
                "verification": "Logged"}  # fmt: skip

    open_, close = SwitchingAction.OPEN, SwitchingAction.CLOSE
    tap = onshore_tap(spec)
    oltc = (
        "OLTCs at neutral"
        if tap == 0
        else f"OLTCs pre-set to tap +{tap} (220 kV side {tap * OLTC_STEP_PERCENT:.2f} % lower) "
        "for the cable's charging power"
    )
    steps: list[tuple[int, dict[str, object]]] = [
        (
            1,
            check(
                "All permits-to-work and sanctions-for-test on circuit 1 cancelled; personnel, "
                "portable earths and test equipment withdrawn",
                "Safety-document register",
                notes="EN 50110-1: no work may be in progress on a "
                "section that is about to be energised.",
            ),
        ),
        (1, gate("sat", "SAT campaign of circuit 1 approved", "All site acceptance tests passed.")),
        (
            1,
            gate(
                "eon",
                "EON issued by PSE",
                "NC RfG Art. 34: the EON entitles the owner to energise its internal network "
                "and is issued once protection and control settings at the connection point "
                "are agreed with PSE.",
            ),
        ),
        (
            1,
            check(
                "Protection of circuit 1 in service with the approved settings: 87L export cable "
                "(communication channel healthy), 87B, 87T TX-OSS-01, back-up overcurrent",
                "Relay setting sheets signed; 87L channel status at both ends",
                responsible="Local",
            ),
        ),
        (
            1,
            check(
                f"Onshore 220 kV busbar live from PSE 400 kV via TX-ONS-01/02; {oltc}",
                "Onshore HMI",
                responsible="SCADA",
                notes="Commissioned under the onshore substation programme.",
            ),
        ),
        (
            1,
            check(
                "Communication established: PiC ↔ PSE dispatch ↔ OSS and onshore operators; "
                "SCADA points of circuit 1 verified end-to-end",
                "Communication log; point-to-point test sheet",
            ),
        ),
        (1, hold("Pre-energisation review: GO / NO-GO for energising export cable 1")),
    ]
    # Long cable whose charging power the onshore OLTC cannot absorb: reactor 1 is
    # connected to the dead cable first and energised with it (energisation.reactor_energisation)
    rc = reactor_energisation(spec)
    oss_phase = 2 if rc else 3
    cable_earths = [
        (2, unlock("ES-OSS-220-01")),
        (2, switch("ES-OSS-220-01", open_, "Open earth switch ES-OSS-220-01 (cable 1, OSS end)")),
        (2, unlock("ES-ON-220-01")),
        (2, switch("ES-ON-220-01", open_, "Open earth switch ES-ON-220-01 (cable 1, onshore end)")),
    ]
    oss_bus = [
        (oss_phase, unlock("ES-OSS-220-BB")),
        (
            oss_phase,
            switch("ES-OSS-220-BB", open_, "Open OSS 220 kV busbar earth switch ES-OSS-220-BB"),
        ),
        (oss_phase, unlock("DS-OSS-220-01")),
        (
            oss_phase,
            switch(
                "DS-OSS-220-01",
                close,
                "Close busbar disconnector DS-OSS-220-01 (off-load, CB open)",
            ),
        ),
        (
            oss_phase,
            switch(
                "CB-OSS-220-01",
                close,
                "Close CB-OSS-220-01 — OSS 220 kV busbar connected to the dead cable"
                if rc
                else "Close CB-OSS-220-01 — OSS 220 kV busbar energised",
            ),
        ),
    ]
    reactor = (
        [
            (oss_phase, unlock("ES-SR-01")),
            (
                oss_phase,
                switch("ES-SR-01", open_, "Open shunt reactor 1 bay earth switch ES-SR-01"),
            ),
            (
                oss_phase,
                switch(
                    "CB-SR-01",
                    close,
                    f"Close CB-SR-01 — shunt reactor 1 ({spec.reactor_unit_mvar:.0f} Mvar) "
                    + ("connected to the dead cable" if rc else "in service"),
                    notes="The reactor absorbs most of the cable's charging power.",
                ),
            ),
        ]
        if spec.num_reactors
        else []
    )
    verify_reactor = [
        (oss_phase, verify("reactor", "Verify reactor absorption and busbar voltage")),
    ]
    energise = [
        (2, unlock("DS-ON-220-01")),
        (
            2,
            switch(
                "DS-ON-220-01", close, "Close busbar disconnector DS-ON-220-01 (off-load, CB open)"
            ),
        ),
        (
            2,
            verify(
                "cable_isolated",
                "Verify cable 1, the OSS busbar and reactor 1 are dead and not earthed"
                if rc
                else "Verify cable 1 is not earthed at either end and the OSS end is open",
                notes="Interlock ILK-001 also blocks energising onto an earth.",
            ),
        ),
        (
            2,
            switch(
                "CB-ON-220-01",
                close,
                "Close CB-ON-220-01 — export cable 1 energised from shore"
                + (" with reactor 1 at its far end" if rc else ""),
                notes=(
                    f"Open-ended, the {spec.export_length_km:g} km cable would push "
                    f"{cable_charging_mvar(length_km=spec.export_length_km):.0f} Mvar into the "
                    "onshore busbar — more than the onshore OLTC can offset — so it is "
                    "energised with its reactor."
                )
                if rc
                else "The open-ended cable draws its full charging current; the open end "
                "rises above the sending end (Ferranti).",
            ),
        ),
        (2, verify("cable_energised", "Verify onshore and cable-end voltage, charging current")),
        *(verify_reactor if rc else []),
        (
            2,
            check(
                "Soak: cable 1 energised at no load for 24 h at U0 = 127 kV; monitor partial "
                "discharge and DTS",
                "Soak log",
                notes="IEC 62067 after-installation AC test: 180 kV for 1 h, or U0 for 24 h.",
            ),
        ),
        (
            2,
            hold(
                "Soak complete: GO / NO-GO for the STATCOM"
                if rc
                else "Soak complete: GO / NO-GO for energising the OSS 220 kV busbar"
            ),
        ),
    ]
    if rc:
        steps += cable_earths + oss_bus + reactor + energise
    else:
        steps += cable_earths + energise + oss_bus
        steps += [(3, verify("oss220", "Verify OSS 220 kV busbar voltage"))]
        steps += reactor + (verify_reactor if reactor else [])
    steps += [
        (3, unlock("ES-STC-01")),
        (3, switch("ES-STC-01", open_, "Open STATCOM bay earth switch ES-STC-01")),
        (3, switch("CB-STC-01", close, "Close CB-STC-01 — STATCOM in voltage control, 1.00 pu")),
        (3, verify("statcom", "Verify OSS 220 kV regulated to 1.00 pu within STATCOM range")),
        (4, unlock("ES-TX-OSS-01")),
        (4, switch("ES-TX-OSS-01", open_, "Open TX-OSS-01 HV bay earth switch ES-TX-OSS-01")),
        (
            4,
            switch(
                "CB-TX-OSS-HV",
                close,
                "Close CB-TX-OSS-HV — TX-OSS-01 energised from 220 kV, LV open",
                notes="Magnetising inrush: a transient of several times rated current rich "
                "in 2nd harmonic; 87T is restrained by the 2nd-harmonic ratio (typically "
                "15 %). Not a steady-state quantity, so not in the load flow.",
            ),
        ),
        (4, verify("tx1_no_load", "Verify TX-OSS-01 no-load current; no protection operation")),
        (4, unlock("ES-OSS-66-01")),
        (4, switch("ES-OSS-66-01", open_, "Open 66 kV section A earth switch ES-OSS-66-01")),
        (4, switch("CB-TX-OSS-LV", close, "Close CB-TX-OSS-LV — 66 kV section A energised")),
        (4, verify("section_a", "Verify 66 kV section A voltage")),
        (4, hold("OSS energised: GO / NO-GO for connecting the array")),
        (
            5,
            gate(
                "ion",
                "ION issued by PSE",
                "NC RfG Art. 35: the ION entitles the owner to generate for a limited period "
                "(at most 24 months) while compliance is demonstrated.",
            ),
        ),
    ]
    for n in range(1, spec.section_a_strings + 1):
        es, cb, wtg = f"ES-STR-{n:02d}", f"CB-STR-{n:02d}", f"WTG-GRP-{n:02d}"
        steps += [
            (5, unlock(es)),
            (5, switch(es, open_, f"Open string {n} earth switch {es}")),
            (
                5,
                switch(cb, close, f"Close {cb} — string {n} cable and WTG transformers energised"),
            ),
            (5, verify(f"string_{n}", f"Verify string {n} far-end voltage")),
            (
                5,
                switch(
                    wtg,
                    close,
                    f"Release the {spec.string_layout[n - 1]} turbines of string {n} — start-up "
                    "and synchronisation per the turbine supplier's procedure",
                ),
            ),
        ]
    limit, full = circuit1_limit_mw(spec), section_a_mw(spec)
    rated_note = (
        "Design check with every released turbine at 15 MW; the real output follows the wind."
        if limit >= full
        else f"Section A is {full:.0f} MW but one export circuit carries about "
        f"{limit / 0.9:.0f} MW: the PPC limits the output to {limit:.0f} MW (90 %) until the "
        "other circuits are in service."
    )
    steps += [
        (
            6,
            verify(
                "rated",
                f"Verify cable 1 and TX-OSS-01 loading at rated output ({limit:.0f} MW)",
                notes=rated_note,
            ),
        ),
        (
            6,
            check(
                "No unwanted protection operation; power-quality recording started for the "
                "compliance file",
                "Event recorder; PQ recorder status",
                responsible="Local",
            ),
        ),
        (
            6,
            declare(
                "PiC declares circuit 1 energised and hands it over to operations; circuit 2 "
                "remains isolated and earthed"
            ),
        ),
    ]
    return steps


def create_oss_energisation_programme(pic_name: str, spec: FarmSpec = SB510) -> SwitchingProgramme:
    """New programme in CREATED state, plant in its construction condition."""
    prefix = "SB5" if spec == SB510 else "PRJ"
    programme_id = f"{prefix}-SP-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"
    programme = SwitchingProgramme(
        programme_id=programme_id,
        title=f"Circuit 1 first energisation — export cable 1, TX-OSS-01, {strings_label(spec)}",
        pic_name=pic_name,
        spec=spec,
    )
    programme.system_state = build_initial_state(spec)
    programme.loto_set = create_loto_set_for_oss(programme_id, pic_name, spec)

    seq: dict[int, int] = {}
    for number, (phase, d) in enumerate(_defs(spec), start=1):
        seq[phase] = seq.get(phase, 0) + 1
        programme.steps.append(
            SwitchingStep(
                step_id=f"{phase}.{seq[phase]:02d}",
                step_number=number,
                phase=phase,
                step_type=d["type"],  # type: ignore[arg-type]
                action=str(d["action"]),
                equipment_id=str(d.get("equipment_id", "")),
                switching_action=d.get("switching_action"),  # type: ignore[arg-type]
                check_id=str(d.get("check_id", "")),
                responsible=str(d.get("responsible", "PiC")),
                pic_confirmation=bool(d.get("pic_confirm", True)),
                verification=str(d.get("verification", "")),
                notes=str(d.get("notes", "")),
            )
        )
    add_audit(
        programme,
        "Programme created",
        pic_name,
        details=f"{len(programme.steps)} steps, {len(programme.loto_set.points)} locks applied",
    )
    return programme


# ── Lifecycle ──────────────────────────────────────────────────────


def approve_programme(programme: SwitchingProgramme, approved_by: str) -> None:
    if programme.status != ProgrammeStatus.CREATED:
        raise ProgrammeStateError(
            f"Cannot approve a programme in '{programme.status.value}' state."
        )
    programme.status = ProgrammeStatus.APPROVED
    add_audit(programme, "Programme approved", approved_by)


def start_programme(programme: SwitchingProgramme) -> None:
    if programme.status != ProgrammeStatus.APPROVED:
        raise ProgrammeStateError(f"Cannot start a programme in '{programme.status.value}' state.")
    programme.status = ProgrammeStatus.IN_PROGRESS
    add_audit(programme, "Programme started", programme.pic_name)


def _gate_ok(programme: SwitchingProgramme, gate: str) -> tuple[bool, str]:
    if gate == "sat":
        sat = programme.sat_campaign
        ok = sat is not None and sat.status == TestCampaignStatus.APPROVED
        return ok, f"SAT {sat.status.value}" if sat else "No SAT campaign"
    campaign = programme.compliance_campaign
    if campaign is None:
        return False, "No grid-code compliance campaign"
    stage = campaign.stages[NotificationStage(gate)]
    return stage.approved_at is not None, (
        f"{gate.upper()} issued {stage.approved_at[:10]}"
        if stage.approved_at
        else f"{gate.upper()} not issued"
    )


def _complete(
    programme: SwitchingProgramme, step: SwitchingStep, by: str, reading: str = ""
) -> None:
    step.status = StepStatus.COMPLETED
    step.executed_at = datetime.now(UTC)
    step.executed_by = by
    step.reading = reading
    programme.current_step_index += 1
    add_audit(programme, f"Step completed: {step.action}", by, step.step_id, reading)
    if programme.current_step_index >= len(programme.steps):
        programme.status = ProgrammeStatus.COMPLETED
        add_audit(programme, "Programme completed", programme.pic_name)


def _fail(
    programme: SwitchingProgramme, step: SwitchingStep, by: str, reason: str
) -> StepExecutionError:
    """Leave the step pending (it can be retried once the cause is cleared) and log."""
    step.status = StepStatus.PENDING
    step.reading = reason
    add_audit(programme, f"Step not executed: {step.action}", by, step.step_id, reason)
    return StepExecutionError(f"{step.step_id}: {reason}")


def execute_step(
    programme: SwitchingProgramme,
    step_id: str,
    executed_by: str,
    pic_confirmed: bool = True,
) -> SwitchingStep:
    """Execute the current step. Raises on wrong state/order, a failed check or an interlock."""
    if programme.status != ProgrammeStatus.IN_PROGRESS:
        raise ProgrammeStateError(f"Programme is '{programme.status.value}', not 'in_progress'.")
    step = programme.steps[programme.current_step_index]
    if step.step_id != step_id:
        raise StepExecutionError(f"Current step is {step.step_id}, not {step_id}.")
    if step.pic_confirmation and not pic_confirmed:
        raise StepExecutionError(f"{step_id} requires the Person in Control's confirmation.")

    match step.step_type:
        case StepType.HOLD_POINT:
            step.status = StepStatus.IN_PROGRESS
            programme.status = ProgrammeStatus.HOLD
            add_audit(programme, f"Hold point: {step.action}", executed_by, step_id)
            raise PiCDecisionRequiredError(f"Hold point {step_id} — PiC GO / NO-GO required.")
        case StepType.GATE:
            ok, reading = _gate_ok(programme, step.check_id)
            if not ok:
                raise _fail(programme, step, executed_by, reading)
            _complete(programme, step, executed_by, reading)
        case StepType.ISOLATION:
            loto = programme.loto_set
            point = loto.points.get(point_id_for(step.equipment_id)) if loto else None
            if point is not None and point.status == LOTOStatus.APPLIED:
                remove_loto(loto, point.point_id, executed_by)  # type: ignore[arg-type]
                _complete(
                    programme, step, executed_by, f"{point.point_id} ({point.tag_number}) removed"
                )
            else:
                _complete(programme, step, executed_by, "Lock already removed")
        case StepType.SWITCHING:
            assert step.switching_action is not None
            try:
                result = execute_switching_action(
                    step.equipment_id,
                    step.switching_action,
                    programme.system_state,
                    programme.locked(),
                    programme.spec,
                )
            except (InterlockError, InvalidTransitionError) as exc:
                raise _fail(programme, step, executed_by, str(exc)) from exc
            _complete(
                programme, step, executed_by,
                f"{step.equipment_id}: {result.previous_state.value} → {result.new_state.value}",
            )  # fmt: skip
        case StepType.VERIFICATION:
            snap = network_snapshot(programme.system_state, programme.spec)
            ok, reading = CHECKS[step.check_id](snap, programme.system_state, programme.spec)
            if not ok:
                raise _fail(programme, step, executed_by, f"Check failed — {reading}")
            _complete(programme, step, executed_by, reading)
        case _:
            _complete(programme, step, executed_by)
    return step


# ── PiC decisions and emergencies ──────────────────────────────────


def _require_pic(programme: SwitchingProgramme, pic_name: str) -> None:
    if pic_name != programme.pic_name:
        raise StepExecutionError(f"Only the Person in Control ({programme.pic_name}) may decide.")


def pic_go_decision(programme: SwitchingProgramme, pic_name: str, notes: str = "") -> None:
    """GO: complete the hold point, or resume a suspended programme."""
    _require_pic(programme, pic_name)
    if programme.status == ProgrammeStatus.SUSPENDED:
        programme.status = ProgrammeStatus.IN_PROGRESS
        add_audit(programme, "PiC resumed the programme", pic_name, details=notes)
        return
    if programme.status != ProgrammeStatus.HOLD:
        raise ProgrammeStateError(f"No decision pending: programme is '{programme.status.value}'.")
    programme.status = ProgrammeStatus.IN_PROGRESS
    step = programme.steps[programme.current_step_index]
    _complete(programme, step, pic_name, notes or "GO — all conditions met")


def pic_nogo_decision(programme: SwitchingProgramme, pic_name: str, reason: str) -> None:
    """NO-GO at a hold point: the programme is aborted (plant left as it is)."""
    _require_pic(programme, pic_name)
    if programme.status not in (ProgrammeStatus.HOLD, ProgrammeStatus.SUSPENDED):
        raise ProgrammeStateError(f"No decision pending: programme is '{programme.status.value}'.")
    programme.steps[programme.current_step_index].status = StepStatus.FAILED
    programme.status = ProgrammeStatus.ABORTED
    add_audit(programme, "PiC NO-GO — programme aborted", pic_name, details=reason)


def suspend_programme(programme: SwitchingProgramme, by: str, reason: str) -> None:
    """Stop all switching until the PiC resumes (no plant change)."""
    if programme.status in (ProgrammeStatus.IN_PROGRESS, ProgrammeStatus.APPROVED):
        programme.status = ProgrammeStatus.SUSPENDED
        add_audit(programme, "Programme suspended", by, details=reason)


def emergency_trip(programme: SwitchingProgramme, by: str, reason: str) -> list[str]:
    """Open every closed breaker and turbine group; abort the programme if still running.

    Works in any state — a completed or aborted programme may still leave the
    plant live. Returns the devices that were opened. Breakers have no opening
    interlock; disconnectors and earth switches are not touched (they cannot
    break current).
    """
    opened = []
    for eq_id, pos in programme.system_state.items():
        eq_type = get_equipment_definition(eq_id, programme.spec).equipment_type.value
        if pos == EquipmentState.CLOSED and eq_type in ("circuit_breaker", "wtg_group"):
            programme.system_state[eq_id] = EquipmentState.OPEN
            opened.append(eq_id)
    if programme.status not in _TERMINAL:
        programme.status = ProgrammeStatus.ABORTED
    summary = ", ".join(opened) or "nothing was closed"
    add_audit(programme, "EMERGENCY TRIP", by, details=f"{reason}. Opened: {summary}")
    return opened
