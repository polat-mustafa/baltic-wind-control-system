#!/bin/bash
# Baltic Wind HV Control Platform — Docker entrypoint
#
# Runs Alembic migrations before starting the application server.
# This ensures tables exist before uvicorn accepts requests.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application server..."
# --timeout-keep-alive 120: Max idle time (seconds) before closing a keep-alive connection.
#   This does NOT control request processing time — uvicorn has no request timeout.
#   P4 ensemble training uses async background tasks, so no single request blocks long.
# --workers 2: Prevent single-worker blocking during CPU-bound operations
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --timeout-keep-alive 120 \
    --workers 2
