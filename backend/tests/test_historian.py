"""Historian: one physical plant state behind every tag, real UTC time base."""

from datetime import UTC, datetime

import pytest

from app.services.p3.historian import (
    TAG_REGISTRY,
    HistorianTag,
    TimeResolution,
    generate_time_series,
    get_available_tags,
    get_latest_values,
    plant_state,
    power_curve_mw,
)

T = HistorianTag
EPOCH = 29_000_000  # a fixed instant (Unix minutes) for reproducible series


def test_power_curve_matches_the_v236():
    assert power_curve_mw(2.9) == 0.0
    assert power_curve_mw(11.1) == pytest.approx(15.0)
    assert power_curve_mw(20.0) == 15.0
    assert power_curve_mw(31.5) == 0.0


def test_tags_are_physically_consistent_at_every_instant():
    for m in range(EPOCH, EPOCH + 24 * 60, 37):
        s = plant_state(m)
        assert s[T.WTG01_POWER_MW] == pytest.approx(power_curve_mw(s[T.WTG01_WIND_SPEED]))
        # farm export never exceeds 34 x WTG-01 (wakes only take energy away)
        assert s[T.OSS_TOTAL_POWER_MW] <= 34 * s[T.WTG01_POWER_MW] + 1e-6
        # STATCOM inside its rating; utilisation is |Q|/120
        assert abs(s[T.STATCOM_Q_MVAR]) <= 120.0
        assert s[T.STATCOM_UTIL_PCT] == pytest.approx(abs(s[T.STATCOM_Q_MVAR]) / 1.2)
        assert 49.8 < s[T.OSS_FREQUENCY_HZ] < 50.2


def test_export_current_follows_power():
    low = min(range(EPOCH, EPOCH + 1440, 5), key=lambda m: plant_state(m)[T.OSS_TOTAL_POWER_MW])
    high = max(range(EPOCH, EPOCH + 1440, 5), key=lambda m: plant_state(m)[T.OSS_TOTAL_POWER_MW])
    assert plant_state(high)[T.OSS_CURRENT_KA] > plant_state(low)[T.OSS_CURRENT_KA]
    # at zero output the circuit still carries half its charging current (~0.17 kA)
    assert plant_state(low)[T.OSS_CURRENT_KA] >= 0.17


@pytest.mark.parametrize(
    ("hours", "res", "n"),
    [
        (1, TimeResolution.ONE_MINUTE, 61),
        (24, TimeResolution.FIFTEEN_MINUTES, 97),
        (168, TimeResolution.ONE_HOUR, 169),
    ],
)
def test_series_length_and_real_utc_timestamps(hours, res, n):
    ts = generate_time_series(T.OSS_TOTAL_POWER_MW, hours, res, now_epoch_minutes=EPOCH)
    assert len(ts.points) == n
    first = datetime.fromisoformat(ts.points[0].timestamp_iso.replace("Z", "+00:00"))
    last = datetime.fromisoformat(ts.points[-1].timestamp_iso.replace("Z", "+00:00"))
    assert (last - first).total_seconds() == hours * 3600
    assert last <= datetime.fromtimestamp(EPOCH * 60, UTC)


def test_default_window_ends_now_not_in_the_future():
    ts = generate_time_series(T.OSS_FREQUENCY_HZ, 1, TimeResolution.FIVE_MINUTES)
    last = datetime.fromisoformat(ts.points[-1].timestamp_iso.replace("Z", "+00:00"))
    assert 0 <= (datetime.now(UTC) - last).total_seconds() < 6 * 60


def test_values_within_registry_ranges_and_registry_complete():
    assert set(TAG_REGISTRY) == set(HistorianTag)
    assert [t.display_name for t in get_available_tags()] == sorted(
        t.display_name for t in get_available_tags()
    )
    for tag, meta in TAG_REGISTRY.items():
        ts = generate_time_series(tag, 24, TimeResolution.FIFTEEN_MINUTES, now_epoch_minutes=EPOCH)
        assert all(meta.range_min <= p.value <= meta.range_max for p in ts.points)
    assert set(get_latest_values(EPOCH)) == {t.value for t in HistorianTag}


def test_site_wind_drives_the_historian_and_power_follows_the_curve(monkeypatch):
    """Loaded site hub wind (Open-Meteo, as in the control room) replaces the model swing."""
    import asyncio

    from app.services.p2 import pse_live
    from app.services.p3 import historian

    calls: list[str] = []

    async def wind(day: str) -> list[float]:
        calls.append(day)
        return [float(h) for h in range(24)]  # hour h → h m/s: easy to interpolate

    monkeypatch.setattr(pse_live, "site_wind_hub", wind)
    asyncio.run(historian.prefetch_site_wind(1))
    assert calls  # today (and yesterday right after local midnight)

    now = datetime.now(UTC).timestamp() / 60
    m = now - (now % 60) + 30  # half past a whole hour
    local = historian._local(m)
    site = local.hour + 0.5 if local.hour < 23 else 23.0
    gusts = historian.wind_speed(m) - site
    assert historian.wind_source(m) == "open-meteo"
    assert abs(gusts) < 1.3  # only the turbulence terms (Σ amplitudes 1.2 m/s) on top
    u = historian.wind_speed(m)
    state = plant_state(m)
    assert state[T.WTG01_WIND_SPEED] == pytest.approx(u)
    # rule 1 via the official curve
    assert state[T.WTG01_POWER_MW] == pytest.approx(power_curve_mw(u))


def test_unloaded_days_fall_back_to_the_model_wind():
    from app.services.p3 import historian

    assert historian.wind_source(EPOCH) == "model"
    assert 0.0 <= historian.wind_speed(EPOCH) < 25.0


def test_historian_route_reports_its_wind_source():
    from fastapi.testclient import TestClient

    from app.main import app

    r = TestClient(app).get("/api/v1/scada/historian/latest")
    assert r.status_code == 200
    assert r.json()["wind_source"] == "model"  # offline in tests
