#!/bin/bash
# Baltic Wind HV Control Platform — Session Start Hook
# Installs all backend and frontend dependencies so linters and tests
# work out-of-the-box in Claude Code remote sessions.

set -euo pipefail

# Only run in remote (web/mobile) Claude Code environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Baltic Wind: Session Start Hook ==="

# ── Install gh CLI ─────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "→ Installing GitHub CLI (gh)..."
  if curl -fsSL --connect-timeout 10 https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null; then
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    apt-get update -qq && apt-get install -y gh
    echo "→ gh installed ($(gh --version | head -1))"
  else
    echo "→ gh install skipped (network unavailable — git push still works without it)"
  fi
else
  echo "→ gh already installed ($(gh --version | head -1))"
fi

# ── Backend: Python deps via uv ────────────────────────────────
echo "→ Installing backend Python dependencies..."
cd "${CLAUDE_PROJECT_DIR}/backend"

# Use uv to create venv with Python 3.13 (matches pyproject.toml requires-python)
uv venv --python 3.13 .venv 2>/dev/null || uv venv .venv

# Install all deps including dev extras (UV_HTTP_TIMEOUT for large packages like torch)
UV_HTTP_TIMEOUT=300 uv pip install --python .venv/bin/python -e ".[dev]"

# Persist PYTHONPATH so pytest finds app modules without -e install issues
echo "export PYTHONPATH=\"${CLAUDE_PROJECT_DIR}/backend\"" >> "${CLAUDE_ENV_FILE:-/dev/null}"

# ── Frontend: Node deps via npm ────────────────────────────────
echo "→ Installing frontend Node dependencies..."
cd "${CLAUDE_PROJECT_DIR}/frontend"
npm install

echo "=== Session Start Hook: Complete ==="
