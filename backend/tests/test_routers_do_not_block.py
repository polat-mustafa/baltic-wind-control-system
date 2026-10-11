"""An ``async def`` route without any ``await`` runs on the event loop: a PyWake or
pandapower call inside it (seconds to a minute) stalls every other request. Compute
routes must be plain ``def`` — FastAPI runs those in its thread pool. Routers that keep
in-memory state (P3 bays/CMS/..., P5 programmes, farm store, relay settings) stay async
on purpose: the event loop serialises their read-modify-write sequences."""

import ast
from pathlib import Path

ROUTERS = Path(__file__).parents[1] / "app" / "routers"
STATEFUL = {"p3", "p5", "p1_farms.py", "p2_protection.py"}


def test_compute_routes_are_not_blocking_coroutines():
    offenders = []
    for f in ROUTERS.rglob("*.py"):
        rel = f.relative_to(ROUTERS).parts
        if rel[0] in STATEFUL:
            continue
        for node in ast.walk(ast.parse(f.read_text(encoding="utf-8"))):
            is_route = isinstance(node, ast.AsyncFunctionDef) and any(
                isinstance(d, ast.Call)
                and isinstance(d.func, ast.Attribute)
                and getattr(d.func.value, "id", None) == "router"
                for d in node.decorator_list
            )
            awaits = any(
                isinstance(x, (ast.Await, ast.AsyncFor, ast.AsyncWith)) for x in ast.walk(node)
            )
            if is_route and not awaits:
                offenders.append(f"{'/'.join(rel)}:{node.lineno} {node.name}")
    assert offenders == []
