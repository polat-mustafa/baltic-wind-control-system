"""Shelving is time-limited (EEMUA 191 §4.4, ISA-18.2 §11): an expired shelve is lifted
before any alarm read and logged as UNSHELVED by SYSTEM."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.alarm import Alarm, AlarmEvent
from app.services.p3.alarm_manager import list_alarms


async def _run() -> tuple[list[bool], list[str]]:
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Alarm.metadata.create_all(c, [Alarm.__table__, AlarmEvent.__table__])
        )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(UTC)
    async with factory() as db:
        for tag, until in (
            ("EXPIRED", now - timedelta(minutes=1)),
            ("STILL", now + timedelta(hours=8)),
        ):
            db.add(
                Alarm(
                    tag=tag,
                    display_name=tag,
                    priority="HIGH",
                    source_device="WTG-01",
                    state="ACTIVE",
                    shelved=True,
                    shelved_until=until,
                    shelve_reason="test",
                )
            )
        await db.commit()
        alarms = await list_alarms(db)
        events = list((await db.execute(select(AlarmEvent))).scalars())
    await engine.dispose()
    return [a.shelved for a in sorted(alarms, key=lambda a: a.tag)], [
        f"{e.alarm_tag}:{e.transition}:{e.operator_id}" for e in events
    ]


def test_expired_shelve_is_lifted_and_logged():
    shelved, events = asyncio.run(_run())
    assert shelved == [False, True]  # EXPIRED lifted, STILL keeps its shelve
    assert events == ["EXPIRED:UNSHELVED:SYSTEM (shelve expired)"]
