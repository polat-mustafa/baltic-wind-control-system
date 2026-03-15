FROM python:3.13-slim AS base

# Prevent Python from writing bytecode and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Layer 1: CPU-only PyTorch (separate layer for maximum cache reuse) ──
# The default torch pulls ~5 GB of CUDA/NVIDIA libs we don't need in Docker.
# CPU-only torch is ~200 MB. This layer rarely changes.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch --index-url https://download.pytorch.org/whl/cpu

# ── Layer 2: Remaining Python dependencies ──
# Copies only pyproject.toml first so this layer is cached until deps change.
# torch>=2.2 is already satisfied by the CPU layer above — pip skips it.
COPY pyproject.toml .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install .

# ── Layer 3: Application code (changes most often, cached least) ──
COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/

# Copy and prepare entrypoint
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Run as non-root user (IEC 62443 security best practice)
# --create-home is required: Alembic and ANDES write cache/config to $HOME
RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
