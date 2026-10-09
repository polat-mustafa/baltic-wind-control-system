"""First energisation replayed frame by frame (services/p5/energisation_trace.py).

Hand checks (SB-510, 108 km, see test_energisation): the cable charged from shore
with its OSS end open draws I_c ≈ 819 A at 1 pu (≈ 101 % of 825 A at the sending
end), the open end rises by the Ferranti factor to ≈ 1.04 pu; once the STATCOM
holds the OSS busbar the end is at 1.00 pu; section A ends at the PPC limit of
circuit 1 (≈ 210 MW) with the cable inside its rating.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.services.p2.network_model import SB510
from app.services.p5.energisation import circuit1_limit_mw
from app.services.p5.energisation_trace import energisation_trace
from app.services.p5.switching_programme import StepType, create_oss_energisation_programme

FRAMES = energisation_trace()


def _oss_pu(i: int) -> float | None:
    bus = FRAMES[i].snapshot.bus("OSS220")
    return bus.vm_pu if bus else None


def test_one_frame_per_switching_step_after_the_as_built_frame():
    switching = [
        s for s in create_oss_energisation_programme("x").steps if s.step_type == StepType.SWITCHING
    ]
    assert len(FRAMES) == len(switching) + 1
    assert [f.step_id for f in FRAMES[1:]] == [s.step_id for s in switching]
    assert FRAMES[0].snapshot.generation_mw == 0
    assert _oss_pu(0) is None  # the grid side is live as built; the OSS is not
    assert FRAMES[0].snapshot.cable_i_send_a is None


def test_cable_charging_from_shore_then_statcom_and_section_a():
    shore = next(i for i, f in enumerate(FRAMES) if f.snapshot.cable_i_send_a)
    # charged from shore, OSS end open: ~ the full charging current at the sending end
    assert 800 <= FRAMES[shore].snapshot.cable_i_send_a <= 850  # type: ignore[operator]
    assert FRAMES[shore].snapshot.poc_q_mvar > 100  # cable Q net of the onshore reactor, into PSE
    oss_live = next(i for i, f in enumerate(FRAMES) if _oss_pu(i) is not None)
    assert 1.02 <= _oss_pu(oss_live) <= 1.06  # type: ignore[operator]  # Ferranti rise
    last = FRAMES[-1].snapshot
    assert abs(_oss_pu(len(FRAMES) - 1) - 1.0) < 0.01  # type: ignore[operator]  # STATCOM
    assert abs(last.generation_mw - circuit1_limit_mw(SB510)) < 2
    assert last.cable_i_send_a is not None and last.cable_i_send_a < 825


def test_endpoint_returns_the_frames():
    r = TestClient(app).get("/api/v1/commissioning/energisation-trace")
    assert r.status_code == 200
    body = r.json()
    assert body["cable_rating_a"] == 825
    assert len(body["frames"]) == len(FRAMES)
    assert body["frames"][0]["step_id"] == "0"
    assert {e["equipment_id"] for e in body["equipment"]} == set(body["frames"][-1]["states"])
