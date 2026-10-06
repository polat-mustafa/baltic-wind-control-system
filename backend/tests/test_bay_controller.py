"""Bay controller (M01): in-service start state and the 7 bay interlocks."""

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import StateTransitionError
from app.main import app
from app.services.p3 import bay_controller as bc
from app.services.p5.equipment_state import SwitchCommand, SwitchPosition


@pytest.fixture(autouse=True)
def fresh_bays():
    bc._initialise_bays()


def cmd(equipment_id: str, action: str) -> SwitchCommand:
    return SwitchCommand(equipment_id=equipment_id, action=action, operator_id="test")


def test_starts_as_the_running_plant():
    bays = {b.bay_id: b for b in bc.get_all_bays()}
    assert len(bays) == 9
    assert bays["BAY-OSS-66-01"].circuit_breaker == SwitchPosition.CLOSED
    assert bays["BAY-OSS-66-01"].earth_switch == SwitchPosition.OPEN
    assert bays["BAY-OSS-66-08"].circuit_breaker == SwitchPosition.OPEN  # coupler


def test_feeder_isolation_sequence_respects_interlocks():
    bay = "BAY-OSS-66-03"
    # ILK-002 / ILK-003: no earthing or disconnector operation while the CB is closed
    for eq, action in (("ES-STR-03", "earth"), ("DS-LINE-STR-03", "open")):
        assert not bc.validate_command(bay, eq, action).allowed
    bc.execute_command(bay, cmd("CB-STR-03", "open"))
    bc.execute_command(bay, cmd("DS-LINE-STR-03", "open"))
    bc.execute_command(bay, cmd("ES-STR-03", "earth"))
    # ILK-001: the CB cannot close onto the earthed bay
    with pytest.raises(StateTransitionError, match="ILK-001"):
        bc.execute_command(bay, cmd("CB-STR-03", "close"))


def test_coupler_never_parallels_the_transformers():
    with pytest.raises(StateTransitionError, match="ILK-007"):
        bc.execute_command("BAY-OSS-66-08", cmd("CB-TIE-66-01", "close"))
    # TX-OSS-01 lost → section A dead → dead-bus close of the coupler is allowed
    bc.execute_command("BAY-OSS-66-07", cmd("CB-TX-OSS-LV", "open"))
    bc.execute_command("BAY-OSS-66-08", cmd("CB-TIE-66-01", "close"))
    # ...and incomer A may not come back while the coupler is closed
    assert not bc.validate_command("BAY-OSS-66-07", "CB-TX-OSS-LV", "close").allowed


def test_validate_endpoint_accepts_bay_name():
    r = TestClient(app).post(
        "/api/v1/scada/interlocks/validate",
        json={
            "bay_id": "BAY-OSS-66-03",
            "equipment_id": "DS-BUS-STR-03",
            "action": "open",
            "operator_id": "t",
        },
    )
    assert r.status_code == 200
    assert r.json()["blocked_by"] == ["ILK-003"]
