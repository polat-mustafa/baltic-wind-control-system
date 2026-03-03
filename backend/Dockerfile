FROM python:3.13-slim AS base

# Prevent Python from writing bytecode and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (leverages Docker layer caching)
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy Alembic configuration and migrations
COPY alembic.ini .
COPY alembic/ alembic/

# Copy application code
COPY app/ app/

# Copy and prepare entrypoint
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Run as non-root user (IEC 62443 security best practice)
RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
