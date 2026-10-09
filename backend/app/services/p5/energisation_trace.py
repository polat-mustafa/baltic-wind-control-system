"""
First energisation of circuit 1, replayed switching step by switching step.

The Commissioning page plays the first energisation as a sequence: the
single-line diagram changes with each breaker and disconnector the programme
operates, and the traces show what the load flow says after each one — OSS
220 kV voltage, export cable current against its 825 A rating, net reactive
power at the PSE point of connection.

The frames come from the programme itself: a fresh circuit-1 programme for the
farm, its SWITCHING steps applied in order through the same interlocked
``execute_switching_action`` the learner uses, and ``network_snapshot`` solved
after each one. Checks, gates and hold points change nothing electrically, so
they make no frame. Locks are not modelled here: the replay shows the
electrical sequence, the Isolation tab owns the locks.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from app.services.p2.network_model import SB510, FarmSpec
from app.services.p5.energisation import NetworkSnapshot, network_snapshot
from app.services.p5.equipment_state import EquipmentState, execute_switching_action
from app.services.p5.switching_programme import StepType, create_oss_energisation_programme


@dataclass(frozen=True)
class TraceFrame:
    """The plant after one switching step (frame 0: as built, everything dead)."""

    step_id: str
    step_number: int
    phase: int
    action: str
    equipment_id: str
    state: dict[str, EquipmentState]
    snapshot: NetworkSnapshot


@lru_cache(maxsize=8)
def energisation_trace(spec: FarmSpec = SB510) -> tuple[TraceFrame, ...]:
    """One frame per switching step of the circuit-1 programme, in programme order."""
    programme = create_oss_energisation_programme("trace", spec)
    state = dict(programme.system_state)
    frames = [
        TraceFrame(
            "0",
            0,
            0,
            "Plant as built: earthed, nothing live",
            "",
            dict(state),
            network_snapshot(state, spec),
        )
    ]
    for step in programme.steps:
        if step.step_type != StepType.SWITCHING or step.switching_action is None:
            continue
        execute_switching_action(step.equipment_id, step.switching_action, state, frozenset(), spec)
        frames.append(
            TraceFrame(
                step.step_id,
                step.step_number,
                step.phase,
                step.action,
                step.equipment_id,
                dict(state),
                network_snapshot(state, spec),
            )
        )
    return tuple(frames)
