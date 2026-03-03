#!/bin/bash
# Baltic Wind HV Control Platform — Docker entrypoint
#
# Runs Alembic migrations before starting the application server.
# This ensures tables exist before uvicorn accepts requests.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application server..."
# --timeout-keep-alive 300: Allow long-running ML training requests (P4 ensemble ~120s)
# --workers 2: Prevent single-worker blocking during CPU-bound operations
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --timeout-keep-alive 300 \
    --workers 2
