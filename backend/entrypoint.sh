#!/bin/bash
# Baltic Wind HV Control Platform — Docker entrypoint
#
# Runs Alembic migrations before starting the application server.
# This ensures tables exist before uvicorn accepts requests.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
