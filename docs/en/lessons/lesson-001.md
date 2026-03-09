# Lesson 001 â€” Building the DevOps Foundation for a 510 MW Offshore Wind Simulation Platform

!!! abstract "Lesson Navigation"
    :material-arrow-left: **Previous:** [Lesson 000 â€” Project Planning](lesson-000.md) | **Next:** [Lesson 002 â€” Internationalisation Infrastructure](lesson-002.md) :material-arrow-right:

    **Phase:** P0 | **Language:** English | **Progress:** 2 of 19 | [All Lessons](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Date:** 2026-02-20
> **Commits:** 14 commits (`f250002` â†’ `9fc5c88`)
> **Commit range:** `f2500024193bb88db74d1269612cd7c14fbe0614..9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0`
> **Phase:** P0 (DevOps Foundation)
> **Previous lesson:** None
> **last_commit_hash:** 9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0

---

## What You Will Learn

- How to structure a monorepo for a full-stack industrial simulation platform (FastAPI + React + PostgreSQL + Redis)
- Why a CI/CD pipeline is the very first thing a professional engineering team builds â€” before any domain logic
- How Docker Compose orchestrates multi-service architectures with health checks and dependency ordering
- Why automated security scanning matters for open-source projects, and how to build a secrets scanner
- How Dependabot and pre-commit hooks form a "defense in depth" strategy for code quality

---

## Section 1: Documentation Architecture â€” The Project's Single Source of Truth

### The Real-World Problem

Imagine you arrive at a new offshore wind farm as a commissioning engineer. Before you touch a single switch, you need the *Station Manual* â€” the one document that tells you the voltage levels, the protection relay settings, the cable ratings, and the emergency procedures. Without it, you're guessing. Software projects are the same: without a clear, authoritative set of documents, every developer guesses differently about how the system should work.

### What the Standards Say

Our documentation follows the **IEC 61355** hierarchical document structure â€” see the [document philosophy](index.md#document-philosophy-iec-61355) for details. The core principle: one roadmap to rule them all, with archived versions for traceability.

### What We Built

**Files changed:**
- `CLAUDE.md` â€” The project's "station manual" for the AI assistant: auto-loads references every session
- `docs/Project_Roadmap.md` â€” Consolidated specification (1,646 lines) merging v1 and v2 into one authoritative source
- `docs/SKILL.md` â€” Engineering standards and coding conventions (722 lines)
- `docs/Learning_Roadmap.md` â€” 32-week self-study curriculum
- `docs/archive/Project_Roadmap_v1.md` and `docs/archive/Project_Roadmap_v2.md` â€” Historical versions preserved for traceability
- `.gitignore` â€” Keeps generated files, secrets, and large data out of version control

We had two roadmap documents (v1 and v2) that partially contradicted each other. The v2 document was a "gap analysis" that corrected turbine counts, added dynamic simulation requirements, and updated standards references. Rather than keep two files and force every reader to mentally merge them, we consolidated into a single `Project_Roadmap.md` and archived the originals.

### Why It Matters

> **Why** do we need a single consolidated roadmap instead of separate v1 and v2 documents?
> Because ambiguity kills projects. If one document says 30 turbines and another says 34, a developer implementing the layout optimizer will pick one at random â€” and half the downstream calculations will be wrong. A single source of truth eliminates this class of errors entirely.
>
> **Why** did we archive the old versions instead of deleting them?
> Traceability. In real wind farm projects, every design change is tracked (IEC 61400-1 requires a "design basis" audit trail). Archiving lets us see *why* decisions changed â€” for example, the upgrade from 30 Ã— 17 MW to 34 Ã— 15 MW turbines was driven by educational clarity (more realistic array layout for wake analysis).

### Code Walkthrough

The `CLAUDE.md` session protocol and auto-loaded references are covered in detail in [Lesson 000](lesson-000.md). The key insight: every session starts with the same engineering context, like a control room operator reading the station logbook at shift handover.

The `.gitignore` is equally important â€” it prevents accidental commits of secrets, weather data (ERA5 NetCDF files can be gigabytes), and build artifacts:

```gitignore
# ERA5 weather data (too large for git)
*.nc
*.grib
*.grib2

# Secrets â€” NEVER commit
.env
.env.*
!.env.example
```

These patterns protect us from the most common mistakes in open-source projects: leaking API keys and bloating the repository with binary data.

!!! tip "Key Concept: Single Source of Truth (SSOT)"
    **In plain English:** Instead of having information scattered across five different documents that might disagree with each other, you put it all in one place. If someone asks "how many turbines?" there's exactly one place to look, and it always has the right answer.

    **Analogy:** Think of your phone's contacts app. Imagine if you had three different address books and your friend's number was different in each one. You'd waste time figuring out which is correct. SSOT means one contacts app, one number â€” always right.

    **In this project:** [`docs/Project_Roadmap.md`](../../Project_Roadmap.md) is the SSOT for the entire 510 MW wind farm specification. Every turbine count, cable voltage, and grid code reference lives there. When we code P1's layout optimizer, we'll read the turbine specs from this one document â€” never from the archived v1 or v2.

---

## Section 2: The FastAPI Backend Skeleton â€” Your First Microservice

### The Real-World Problem

Imagine you're building a house. Before you install plumbing or electricity, you pour the foundation and raise the frame. The frame doesn't *do* anything yet â€” it just defines where the walls will be. A backend skeleton is the same: it's the structural frame that all future domain logic (wake models, power flow simulations, forecasting APIs) will attach to.

### What the Standards Say

**IEC 62443 (Industrial communication networks â€” Network and system security)** requires that SCADA and control systems have a clearly defined security architecture from day one â€” not bolted on later. While our `/health` endpoint is simple, the CORS middleware, environment-based configuration, and container isolation we set up now will be the foundation for secure API access when we build the real SCADA interface in P3.

### What We Built

**Files changed:**
- `backend/app/main.py` â€” FastAPI application with health endpoint and CORS middleware
- `backend/app/config.py` â€” Pydantic Settings for environment-based configuration
- `backend/pyproject.toml` â€” Python package definition with all dependencies and tool configs
- `backend/tests/test_health.py` â€” First test: proves the health endpoint works
- `backend/Dockerfile` â€” Container image definition for the backend service

The backend is intentionally minimal. It has exactly one endpoint (`/health`) and one configuration class. But notice what it *already* includes: CORS middleware (needed when React talks to FastAPI), async database driver (asyncpg), and strict type checking (mypy in strict mode). These aren't premature â€” they're the structural steel that everything else bolts onto.

### Why It Matters

> **Why** do we start with a `/health` endpoint instead of jumping straight into wind simulation APIs?
> Because Docker, Kubernetes, and CI pipelines all need a way to ask "is this service alive?" before routing traffic to it. The `/health` endpoint is the heartbeat of the service. Without it, your container orchestrator can't tell a crashed service from a slow one â€” and in a real SCADA system, that distinction is the difference between a controlled shutdown and a blackout.
>
> **Why** do we use Pydantic Settings instead of reading environment variables directly with `os.getenv()`?
> Type safety and validation. `os.getenv("DATABASE_URL")` returns `Optional[str]` â€” you have to check for `None` yourself, cast integers manually, and parse lists by hand. Pydantic Settings does all of this automatically, with clear error messages if a required variable is missing. In an offshore wind control system, a misconfigured database URL should fail loudly at startup, not silently at 3 AM during a storm.

### Code Walkthrough

The configuration module demonstrates the "12-Factor App" principle â€” configuration lives in the environment, not in code:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",           # Load from .env file in development
        env_file_encoding="utf-8",
        case_sensitive=False,       # DATABASE_URL and database_url both work
    )

    # Application
    app_name: str = "Baltic Wind HV Control Platform"
    debug: bool = False

    # Database (PostgreSQL + TimescaleDB)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

settings = Settings()
```

Every field has a default for local development, but in production (Docker Compose, Kubernetes), environment variables override them. The `cors_origins` field is a `list[str]`, and Pydantic parses the JSON string `'["http://localhost:3000"]'` automatically â€” no manual parsing needed.

The health check test is our first "smoke test" â€” it proves the application can start and respond:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_ok():
    """GET /health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

This test runs in CI on every push. If the application can't even start (import error, missing dependency, config crash), this test catches it in seconds rather than in production.

!!! tip "Key Concept: The 12-Factor App â€” Config in the Environment"
    **In plain English:** Never write passwords, database addresses, or API keys directly in your code. Instead, your code reads them from the computer's environment (like environment variables), and you set those values differently on your laptop vs. in production.

    **Analogy:** Think of a master key system in a building. The lock mechanism (code) is the same everywhere, but the key (config) changes depending on who's accessing it. The janitor has a different key than the CEO, but the doors work the same way.

    **In this project:** Our `config.py` uses `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` for development, but Docker Compose overrides it with `postgres:postgres@postgres:5432/balticwind` (note: `postgres` is the Docker service name, not `localhost`). In a real deployment, a secrets manager would inject a proper password.

---

## Section 3: Docker Compose â€” Orchestrating the Control Room

### The Real-World Problem

A wind farm control system doesn't run on a single computer. The SCADA server talks to the historian database, which talks to the time-series store, which talks to the HMI displays. If you start the HMI before the database is ready, it crashes. If the database starts before the network is configured, it can't accept connections. You need an *orchestrator* â€” something that starts services in the right order and checks that each one is healthy before starting the next.

### What the Standards Say

**IEC 62351 (Power systems management and associated information exchange â€” Data and communications security)** emphasizes network segmentation and service isolation for SCADA systems. Docker containers provide process-level isolation â€” each service runs in its own namespace with its own filesystem, and communication happens only through explicitly declared ports. This is a lightweight version of the network zones (DMZ, Control Zone, Field Zone) defined in IEC 62443.

### What We Built

**Files changed:**
- `docker-compose.yml` â€” Four-service stack: PostgreSQL+TimescaleDB, Redis, FastAPI backend, React frontend

The Docker Compose file defines our entire development environment as code. Notice the `healthcheck` blocks and `depends_on` conditions:

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: balticwind
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Why It Matters

> **Why** do we use TimescaleDB instead of plain PostgreSQL?
> Because wind farm data is fundamentally *time-series* data. Every 10 seconds, each of 34 turbines reports power output, wind speed, blade pitch, nacelle yaw, and generator temperature. That's thousands of data points per minute. TimescaleDB extends PostgreSQL with hypertables â€” automatically partitioned tables optimized for time-series inserts and range queries. In P1, when we store ERA5 weather data and simulated power output, TimescaleDB will make queries like "average power output per turbine for the last 24 hours" run 10-100x faster than standard PostgreSQL.
>
> **Why** does the backend `depends_on` use `condition: service_healthy` instead of just `depends_on: [postgres]`?
> Because "container started" is not the same as "service ready." PostgreSQL takes a few seconds to initialize its data directory, run recovery, and start accepting connections. Without `service_healthy`, the backend would try to connect to PostgreSQL immediately, get a "connection refused" error, and crash. The `pg_isready` health check ensures the backend only starts after PostgreSQL is actually accepting queries.

### Code Walkthrough

The health check pattern is worth studying because we'll use it extensively in P3 (SCADA monitoring):

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]  # Run this command inside the container
  interval: 5s    # Check every 5 seconds
  timeout: 5s     # If the check takes >5s, consider it failed
  retries: 5      # After 5 consecutive failures, mark container as unhealthy
```

This is the same pattern used in real industrial systems. Protection relays check circuit breaker status every few hundred milliseconds. If a breaker doesn't respond within the timeout, the relay escalates â€” first an alarm, then a trip command. Our Docker health checks are a simplified version of the same pattern: poll â†’ timeout â†’ retry â†’ escalate.

The health check startup sequence visualized:

```mermaid
sequenceDiagram
    participant DC as Docker Compose
    participant PG as PostgreSQL
    participant RD as Redis
    participant BE as Backend (FastAPI)
    participant FE as Frontend (React)

    DC->>PG: Start container
    DC->>RD: Start container
    loop Every 5s
        DC->>PG: pg_isready -U postgres
        PG-->>DC: not ready
    end
    PG-->>DC: ready (healthy)
    loop Every 5s
        DC->>RD: redis-cli ping
    end
    RD-->>DC: PONG (healthy)
    DC->>BE: Start (depends_on: healthy)
    BE->>PG: Connect asyncpg
    BE->>RD: Connect redis
    BE-->>DC: /health â†’ 200 OK
    DC->>FE: Start (depends_on: backend)
    FE->>BE: API requests
```

!!! tip "Key Concept: Service Orchestration and Health Checks"
    **In plain English:** When you have multiple programs that depend on each other, you need a system that starts them in the right order and makes sure each one is actually working before starting the next one.

    **Analogy:** Think of a restaurant kitchen. The prep cook chops vegetables first, then the line cook starts cooking. The line cook doesn't start frying until the prep is done â€” and the head chef checks that the prep is actually ready, not just that the prep cook has arrived. Docker Compose is the head chef.

    **In this project:** Our FastAPI backend can't function without PostgreSQL and Redis. Docker Compose ensures PostgreSQL is accepting connections (`pg_isready`) and Redis responds to `ping` before the backend starts. When we add P2's Pandapower grid solver, it will follow the same pattern â€” depending on the backend being healthy before running simulations.

---

## Section 4: CI/CD Pipeline and Quality Gates â€” The Automated Inspector

### The Real-World Problem

In an offshore wind farm, every piece of equipment goes through quality inspection before installation. A transformer doesn't leave the factory without a routine test. A cable doesn't get pulled without a megger test. The principle is simple: *catch defects before they reach the field, because fixing them offshore costs 10x more.* CI/CD applies the same principle to code: catch bugs before they reach production.

### What the Standards Say

**IEC 61400-1 (Wind energy generation systems â€” Design requirements)** mandates a formal verification and validation process for wind turbine control software. While our simulation isn't safety-critical, we adopt the same discipline: every code change must pass automated lint checks, type checks, and tests before it can be merged. This is defense in depth â€” multiple independent quality gates, each catching different classes of errors.

### What We Built

**Files changed:**
- `.github/workflows/ci.yml` â€” Four parallel CI jobs: backend lint, backend test, frontend lint, frontend test
- `.github/workflows/docs.yml` â€” Automated MkDocs deployment to GitHub Pages
- `.pre-commit-config.yaml` â€” Local quality gates that run before every commit
- `.editorconfig` â€” Consistent formatting across editors (tab width, line endings, trailing whitespace)
- `Makefile` â€” Universal task runner with 15+ targets for install, lint, test, docker, and docs
- `.github/dependabot.yml` â€” Automated weekly dependency updates for pip, npm, and GitHub Actions

The CI pipeline runs four jobs in parallel on every push and PR:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Backend Lint â”‚   â”‚ Backend Test â”‚   â”‚ Frontend Lintâ”‚   â”‚Frontend Test â”‚
â”‚  ruff check  â”‚   â”‚   pytest     â”‚   â”‚  tsc --noEmitâ”‚   â”‚  vitest run  â”‚
â”‚  ruff format â”‚   â”‚   coverage   â”‚   â”‚  eslint      â”‚   â”‚  coverage    â”‚
â”‚  mypy        â”‚   â”‚              â”‚   â”‚              â”‚   â”‚              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Why It Matters

> **Why** do we separate lint and test into different jobs instead of running them sequentially?
> Parallelism and isolation. If linting fails, you want to know immediately â€” don't wait for a 5-minute test suite to finish first. And if a test fails, you want to know whether it's a logic error (test job) or a style violation (lint job), not debug both at once. In power systems, this is the same principle as having separate protection relays for overcurrent and earth fault â€” each one watches for a specific class of problem.
>
> **Why** do we use pre-commit hooks AND CI?
> Defense in depth. Pre-commit hooks catch issues *before* the commit is created â€” you get instant feedback on your laptop. CI catches issues *after* the push â€” it verifies that the code works in a clean environment (not just on your machine with its specific Python version and installed packages). Together, they form two independent quality gates, just like how a wind turbine has both a mechanical brake and an aerodynamic brake.

### Code Walkthrough

The Makefile deserves attention because it's the developer's daily driver â€” the single entry point for all common tasks:

```makefile
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python code (ruff + mypy)
	cd backend && ruff check app/ tests/
	cd backend && ruff format --check app/ tests/
	cd backend && mypy app/

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Python tests with coverage
	cd backend && pytest --cov=app --cov-report=term-missing tests/
```

Notice the `## ` comments after each target â€” these are self-documenting. Running `make help` prints a formatted list of all available targets. This is a small detail that massively improves developer experience: no one has to read the Makefile to know what commands are available.

The pre-commit configuration chains multiple tools together â€” each one catches a different class of error. If `check-yaml` finds a syntax error in your CI workflow, it blocks the commit *before* you push broken YAML to GitHub.

??? example "Full pre-commit configuration"

    ```yaml
    repos:
      - repo: https://github.com/pre-commit/pre-commit-hooks
        hooks:
          - id: trailing-whitespace        # Catches: invisible formatting errors
          - id: end-of-file-fixer          # Catches: POSIX compliance issues
          - id: check-yaml                 # Catches: broken YAML syntax (CI configs!)
          - id: check-added-large-files    # Catches: accidentally committed binaries
            args: ['--maxkb=1000']         # Block files > 1 MB
          - id: check-merge-conflict       # Catches: forgotten merge conflict markers

      - repo: https://github.com/astral-sh/ruff-pre-commit
        hooks:
          - id: ruff                       # Catches: Python code quality issues
            args: [--fix]                  # Auto-fix what it can
          - id: ruff-format               # Catches: inconsistent formatting
    ```

The defense-in-depth pipeline:

```mermaid
graph LR
    Dev["Developer<br/>writes code"] --> PC["Pre-commit<br/>Hooks"]
    PC -->|"ruff, mypy,<br/>eslint"| Push["git push"]
    Push --> CI["GitHub Actions<br/>CI Pipeline"]
    CI -->|"4 parallel<br/>jobs"| Sec["Security<br/>Audit Skill"]
    Sec -->|"13 secret<br/>patterns"| Merge["Merge to<br/>main"]

    style PC fill:#4a9eff,color:#fff
    style CI fill:#4a9eff,color:#fff
    style Sec fill:#4a9eff,color:#fff
```

!!! tip "Key Concept: Defense in Depth â€” Multiple Independent Quality Gates"
    **In plain English:** Don't rely on just one safety check. Have multiple checks at different stages, each looking for different problems. If one misses something, the next one catches it.

    **Analogy:** Think of airport security. You go through a metal detector (pre-commit hook), then your bag goes through an X-ray scanner (CI pipeline), and a person visually checks your passport (code review). Each layer catches things the others might miss. No single layer is perfect, but together they're very effective.

    **In this project:** A developer writes code â†’ pre-commit hooks check formatting and types locally â†’ CI runs the full test suite in a clean environment â†’ the github-push skill scans for secrets before pushing. Three independent gates, each catching a different class of error. When we build P3's SCADA automation, we'll see the same pattern in protection relay coordination: primary protection, backup protection, and breaker-failure protection.

---

## Section 5: Security Hardening â€” The Push Gatekeeper

### The Real-World Problem

Imagine you're a control room operator, and someone asks you to close a circuit breaker. Before you do, you check: Is the line de-energized? Is the earth switch removed? Is there a valid switching programme? You don't just close the breaker because someone asked â€” you verify conditions first. The github-push skill is the same: it checks for leaked secrets, dangerous files, and code quality issues before allowing code to reach the public repository.

### What the Standards Say

**OWASP Top 10** and **CWE-798 (Use of Hard-Coded Credentials)** identify hardcoded secrets as one of the most common and dangerous vulnerabilities in software. For an open-source project, pushing a database password or API key to a public GitHub repository means it's immediately available to the entire internet. Our security audit is designed to catch these before they leave the developer's machine.

### What We Built

**Files changed:**
- `.claude/skills/github-push/SKILL.md` â€” 7-phase secure push workflow with secrets scanner and dangerous file detection
- Security hardening: Added YAML password patterns, allowed-exceptions list, mandatory user confirmation for WARN items

The github-push skill is a 250-line workflow definition that acts as a security gate. It runs seven phases: reconnaissance (git status, diff, log, branch), security audit (secrets scanner, dangerous file scanner, code quality checks), verdict (BLOCK or WARN), staging (file-by-file, never `git add .`), commit message formatting, push, and summary report.

### Why It Matters

> **Why** do we need an automated secrets scanner when `.gitignore` already prevents committing `.env` files?
> Because `.gitignore` only covers files that are *listed* in it. A developer might hardcode a password directly in Python code (`API_KEY = "sk-abc123..."`), and `.gitignore` won't catch that â€” it's not a dotfile, it's a `.py` file. The secrets scanner uses regex patterns to search the *content* of the diff, catching hardcoded secrets regardless of which file they're in.
>
> **Why** did we add "allowed exceptions" for `docker-compose.yml` defaults instead of just ignoring all WARNs?
> Nuance. A `POSTGRES_PASSWORD: postgres` in docker-compose.yml is a development default that gets overridden by environment variables in production â€” that's fine. But a `POSTGRES_PASSWORD: my_real_production_password` is a genuine leak. By creating an explicit exception list, we document *why* certain patterns are acceptable and still force the developer to acknowledge them. No silent skips â€” the operator always sees the warning, even if it's expected.

### Code Walkthrough

The security audit uses pattern matching to detect different categories of risk:

```markdown
| Pattern | Description | Action |
|---------|-------------|--------|
| `password\s*=\s*['"]` | Hardcoded password (code) | BLOCK |
| `PASSWORD[:=]\s*.+` (not in docker-compose) | Hardcoded password (config) | WARN |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI/Anthropic API key | BLOCK |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access token | BLOCK |
| `-----BEGIN.*PRIVATE KEY-----` | PEM private key | BLOCK |
```

The key distinction between BLOCK and WARN is reversibility. A BLOCK item (leaked API key) cannot be undone â€” once pushed, the key is compromised and must be rotated. A WARN item (development default password) is acceptable but should be acknowledged. This mirrors protection relay philosophy: instantaneous trip for faults (BLOCK) vs. time-delayed alarm for abnormal conditions (WARN).

The hardening commit specifically addressed a real problem encountered during Phase 0: the security scanner was blocking `docker-compose.yml` because it contained `POSTGRES_PASSWORD: postgres`. This is a legitimate development default, not a secret leak. The fix added context-aware exceptions:

```markdown
**Allowed exceptions (WARN only, not BLOCK):**
- `docker-compose.yml` with `POSTGRES_PASSWORD: postgres` â€” local dev default
- `config.py` with `localhost` defaults â€” overridden in production
```

This teaches an important lesson: security tools must be calibrated. Too strict, and developers bypass them. Too lenient, and they miss real problems. The sweet spot is strict-by-default with documented exceptions.

!!! tip "Key Concept: Shift-Left Security â€” Catch Problems Early"
    **In plain English:** Instead of checking for security problems after your code is live on the internet, check for them as early as possible â€” ideally before the code even leaves your computer.

    **Analogy:** It's like spell-checking while you type, not after you've mailed the letter. If you notice a mistake before sending, you just fix it. If you notice after, you have to send a correction, and the recipient already saw the error.

    **In this project:** The github-push skill scans every diff for hardcoded secrets *before* the commit is created. If it finds an API key in the code, it blocks the push entirely. This is critical because our repository is public â€” once a secret is pushed to GitHub, it's in the git history forever (even if you delete the file in the next commit). Prevention is infinitely better than remediation.

---

## Section 6: Automated Dependency Management â€” The Supply Chain Guardian

### The Real-World Problem

A wind turbine has thousands of components from hundreds of suppliers. If a bolt manufacturer discovers a defect in a batch, every turbine using those bolts needs to be inspected. The manufacturer sends a recall notice, and the wind farm operator updates their maintenance schedule. Software dependencies work the same way: when a library publishes a security patch, every project using that library needs to update.

### What the Standards Say

**NIST SP 800-53 (Security and Privacy Controls)** control SA-12 requires organizations to monitor their software supply chain for vulnerabilities and apply patches in a timely manner. Dependabot automates this by scanning `pyproject.toml`, `package.json`, and GitHub Actions workflows weekly and opening pull requests for updates.

### What We Built

**Files changed:**
- `.github/dependabot.yml` â€” Weekly automated checks for pip, npm, and GitHub Actions updates
- Six Dependabot PRs merged: GitHub Actions bumps (checkout v4â†’v6, setup-python v5â†’v6, setup-node v4â†’v6, cache v4â†’v5, upload-artifact v4â†’v6, upload-pages-artifact v3â†’v4)
- Two dependency PRs: eslint-plugin-react-hooks 5.2.0â†’7.0.1, frontend package updates

The Dependabot configuration is elegantly simple â€” 32 lines that protect the entire supply chain:

??? example "Full Dependabot configuration"

    ```yaml
    version: 2
    updates:
      - package-ecosystem: "pip"
        directory: "/backend"
        schedule:
          interval: "weekly"
          day: "monday"
        labels: ["dependencies", "python"]
        commit-message:
          prefix: "[DEPS]"

      - package-ecosystem: "github-actions"
        directory: "/"
        schedule:
          interval: "weekly"
          day: "monday"
        labels: ["dependencies", "ci"]
        commit-message:
          prefix: "[CI]"
    ```

### Why It Matters

> **Why** do we update GitHub Actions versions (checkout v4â†’v6) when the old versions still work?
> Because GitHub Actions run with elevated permissions â€” they have access to your repository secrets, can push code, and can deploy to production. A vulnerability in an action version could compromise your entire CI pipeline. Staying on the latest version ensures you have the latest security patches. In the power systems world, this is equivalent to firmware updates on protection relays â€” the relay still works with old firmware, but known vulnerabilities are fixed in newer versions.
>
> **Why** does Dependabot use different commit prefixes (`[CI]` for actions, `[DEPS]` for packages)?
> Traceability. When you scan the git log, you can instantly see which commits are infrastructure updates vs. dependency updates vs. feature code. This convention maps directly to our commit message standard and makes it easy to generate changelogs, audit dependency changes, and understand the history at a glance.

### Code Walkthrough

Look at the actual Dependabot commits that were merged:

```
f85f6c5 [CI]: Bump actions/upload-pages-artifact from 3 to 4 (#1)
2b5f3a0 [CI]: Bump actions/upload-artifact from 4 to 6 (#2)
c372942 [CI]: Bump actions/setup-node from 4 to 6 (#3)
59d9ebe [CI]: Bump actions/cache from 4 to 5 (#4)
0933057 [CI]: Bump actions/setup-python from 5 to 6 (#5)
376e572 [CI]: Bump actions/checkout from 4 to 6 (#6)
e9966d8 [DEPS]: Bump eslint-plugin-react-hooks from 5.2.0 to 7.0.1 (#7)
d32d82f [DEPS] Update frontend dependencies to latest compatible versions (#12)
```

Each PR was automatically created by Dependabot, reviewed, and merged. The `#1` through `#7` are pull request numbers â€” Dependabot opened them, CI ran against them, and they were merged once tests passed. This is a fully automated supply chain update workflow: detect â†’ propose â†’ test â†’ merge.

!!! tip "Key Concept: Software Supply Chain Security"
    **In plain English:** Your project depends on code written by other people (libraries, frameworks, tools). If any of that code has a security bug, your project inherits that bug. Supply chain security means keeping track of all your dependencies and updating them when fixes are available.

    **Analogy:** Think of a car recall. Your car is fine, but the airbag manufacturer found a defect. You didn't write the airbag code, but you still need to go to the dealer for a fix. Dependabot is like an automatic recall notification system â€” it tells you about the problem and even books the appointment (opens a PR) for you.

    **In this project:** We depend on FastAPI, React, PostgreSQL drivers, and dozens of other packages. Dependabot checks every Monday for new versions, opens PRs with the updates, and our CI pipeline tests them automatically. The six GitHub Actions bumps in our first week demonstrate this working: Dependabot detected v6 was available for actions/checkout, opened PR #6, CI passed, and we merged â€” all without manual intervention.

---

## Connections

**Where these concepts appear next:**

- **Health checks** (Section 3) â†’ P3 SCADA monitoring will expand Docker health patterns into full turbine/substation status monitoring
- **Environment-based config** (Section 2) â†’ P1 will need ERA5 API credentials injected via the same Pydantic Settings mechanism
- **CI quality gates** (Section 4) â†’ P1 wake model tests and P2 power flow validations will run in these exact CI jobs
- **Security scanning** (Section 5) â†’ ERA5 API keys and database credentials in P1+ will be protected by the same secrets scanner
- **Dependabot** (Section 6) â†’ As we add PyWake, Pandapower, and ML libraries, Dependabot will monitor their security updates

---

## The Big Picture

*This lesson's focus: the **DevOps layer** wrapping the application stack.*

```mermaid
graph TB
    subgraph APP["Application Stack"]
        FE["React 19 + TypeScript<br/>Port 3000"]
        BE["FastAPI + Python 3.13<br/>Port 8000 Â· /health âœ“"]
        PG["PostgreSQL 16 + TimescaleDB<br/>Port 5432"]
        RD["Redis 7<br/>Port 6379"]
    end

    subgraph DEVOPS["DevOps Foundation (Built in This Lesson)"]
        Docker["Docker Compose<br/><i>4-service orchestration</i>"]
        CI["GitHub Actions CI<br/><i>4 parallel jobs</i>"]
        PC["Pre-commit Hooks<br/><i>ruff, mypy, eslint</i>"]
        Deps["Dependabot<br/><i>pip + npm + Actions</i>"]
        Sec["Security Audit Skill<br/><i>13 secret patterns</i>"]
        Make["Makefile<br/><i>15+ targets</i>"]
    end

    subgraph FUTURE["Future Modules (P1 â†’ P5)"]
        P15["P1: PyWake Â· P2: Pandapower Â· P3: SCADA Â· P4: ML Â· P5: Commissioning"]
    end

    FE -->|REST API| BE
    BE --> PG
    BE --> RD
    Docker --> APP
    CI --> PC
    CI --> Deps
    CI --> Sec
    Make --> Docker
    FUTURE -.->|"built ON TOP of<br/>this foundation"| DEVOPS
```

---

## Key Takeaways

1. **A single source of truth eliminates ambiguity** â€” one roadmap, one spec, one place to look for turbine counts and voltage levels.
2. **The first line of code should be a health check** â€” before any domain logic, prove the service can start and respond. Docker, Kubernetes, and CI all depend on it.
3. **Configuration belongs in the environment, not in code** â€” Pydantic Settings gives you type-safe, validated config with zero boilerplate.
4. **Docker Compose health checks prevent race conditions** â€” `depends_on: condition: service_healthy` ensures services start in the right order, not just the right sequence.
5. **Defense in depth means multiple independent quality gates** â€” pre-commit hooks catch issues locally, CI catches them in a clean environment, and security scanning catches secrets before they reach the public repository.
6. **Security tools must be calibrated, not just turned on** â€” too strict blocks legitimate code (false positives), too lenient misses real problems. The "allowed exceptions" pattern documents why certain patterns are acceptable.
7. **Automated dependency management is supply chain security** â€” Dependabot monitors, proposes, and tests updates so you don't have to remember to check manually every week.

---

## Quiz â€” Test Your Understanding

### Recall Questions

**Q1:** What four services does our Docker Compose stack define, and what ports do they use?

<details>
<summary>Answer</summary>

The stack defines four services: PostgreSQL with TimescaleDB on port 5432, Redis 7 on port 6379, the FastAPI backend on port 8000, and the React frontend on port 3000. PostgreSQL uses the `timescale/timescaledb:latest-pg16` image, and Redis uses `redis:7-alpine` for a minimal footprint.

</details>

**Q2:** What ruff lint rule categories are enabled in our `pyproject.toml`, and what does each category check?

<details>
<summary>Answer</summary>

Nine categories are enabled: E (pycodestyle errors), W (pycodestyle warnings), F (pyflakes â€” unused imports, undefined names), I (isort â€” import ordering), N (pep8-naming â€” function/class naming conventions), UP (pyupgrade â€” modernize Python syntax), B (flake8-bugbear â€” common bugs and design problems), SIM (flake8-simplify â€” unnecessarily complex code), and RUF (ruff-specific rules). Together, they catch style issues, potential bugs, and opportunities to use modern Python features.

</details>

**Q3:** What is the difference between BLOCK and WARN in the github-push security audit?

<details>
<summary>Answer</summary>

BLOCK items are show-stoppers that prevent the push entirely â€” they indicate irreversible security risks like leaked API keys or private keys that, once pushed to a public repository, are permanently compromised. WARN items are potential concerns that require user acknowledgment but may be acceptable â€” like development default passwords in docker-compose.yml that are overridden by environment variables in production. WARN items are always reported to the user; they are never silently skipped.

</details>

### Understanding Questions

**Q4:** Why does our backend use `condition: service_healthy` in `depends_on` instead of just listing `depends_on: [postgres]`? What failure mode does this prevent?

<details>
<summary>Answer</summary>

Simply listing `depends_on: [postgres]` only ensures the PostgreSQL container has *started*, not that it's *ready to accept connections*. PostgreSQL needs several seconds to initialize its data directory, run WAL recovery, and open its TCP listener. Without the health check condition, the FastAPI backend would attempt to connect during this initialization window, receive a "connection refused" error, and potentially crash before PostgreSQL is ready. The `service_healthy` condition uses `pg_isready` to verify PostgreSQL is actually accepting queries before starting the backend, eliminating this race condition.

</details>

**Q5:** Why do we use both pre-commit hooks and CI pipeline checks? Wouldn't one be sufficient?

<details>
<summary>Answer</summary>

They serve complementary roles in a defense-in-depth strategy. Pre-commit hooks run instantly on the developer's machine, giving immediate feedback before a commit is created â€” this catches formatting issues and type errors in seconds. However, hooks can be bypassed (`--no-verify`), and they run in the developer's local environment which may differ from the CI environment. CI runs in a clean, reproducible environment (Ubuntu with specific Python/Node versions) and cannot be bypassed â€” it's the authoritative quality gate. Together, they ensure fast local feedback AND reliable remote verification, the same way a wind turbine has both a mechanical brake and an aerodynamic brake for redundancy.

</details>

**Q6:** Why did we choose Pydantic Settings for configuration instead of using `os.getenv()` directly or a YAML config file?

<details>
<summary>Answer</summary>

Pydantic Settings provides three key advantages: type safety (automatically converts `"5432"` to an integer, `'["http://localhost"]'` to a list), validation (fails loudly at startup if a required variable is missing or malformed, rather than crashing at runtime), and documentation (the Settings class itself serves as a schema showing all available configuration options with their types and defaults). `os.getenv()` returns `Optional[str]` for everything, requiring manual type conversion and null checks scattered throughout the code. YAML config files are harder to override per-environment and risk being committed with secrets. Pydantic Settings follows the 12-Factor App principle: config in the environment, validated at the boundary.

</details>

### Challenge Question

**Q7:** Our current Docker Compose uses `POSTGRES_PASSWORD: postgres` as a hardcoded development default. Design a configuration strategy that works for three environments: local development (simple, no extra setup), CI/CD (automated, no human interaction), and production (secure, auditable). How would each environment set the database password, and what tools or mechanisms would you use?

<details>
<summary>Answer</summary>

**Local development:** Keep the hardcoded `postgres:postgres` default in docker-compose.yml. This is a convenience for developers â€” they can run `docker compose up` without any extra setup. The security audit explicitly allows this as a WARN exception because it's overridden in other environments.

**CI/CD:** Use GitHub Actions secrets (`${{ secrets.DB_PASSWORD }}`) injected as environment variables into the CI workflow. The password is stored encrypted in GitHub's settings, never appears in logs (GitHub masks it automatically), and is only available to workflows running on the repository. The docker-compose.yml would use variable interpolation: `POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}` â€” defaulting to `postgres` if the variable isn't set (local dev) but using the secret when it is (CI).

**Production:** Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault) that injects credentials at container startup. The Kubernetes deployment would mount the secret as an environment variable via a SecretProviderClass (CSI driver) or a Kubernetes Secret. The password would be rotated automatically by the secrets manager on a schedule, and all access would be logged for auditability. The application reads `DATABASE_URL` from the environment (Pydantic Settings handles this), so no code changes are needed â€” only the deployment configuration differs between environments.

This layered approach follows the principle of least privilege: developers get convenience, CI gets automation, and production gets security â€” all using the same application code with different configuration mechanisms.

</details>

---

## Interview Corner

### Explain It Simply
*"How would you explain DevOps infrastructure for a wind farm simulation to a non-engineer?"*

We're building a computer simulation of a large wind farm in the Baltic Sea â€” 34 huge turbines generating enough electricity for a small city. Before we can write the interesting stuff (how wind flows between turbines, how electricity travels through cables, how to predict tomorrow's power output), we need to set up our workshop.

Think of it like building a house. Before you install the kitchen appliances or hang the curtains, you need the foundation, the framing, the plumbing, and the electrical wiring. That's what we did in this phase. We set up four "rooms" in our digital workshop: a database to store data (like a filing cabinet), a cache for quick access to frequent data (like a whiteboard), a backend server that does the calculations (like the engineer's desk), and a frontend that displays the results (like the control room screens). We also set up an automatic inspector that checks our work every time we make a change â€” making sure we haven't introduced errors or accidentally published passwords. Finally, we added an automatic system that checks whether any of the tools we depend on have been updated, like getting recall notices for car parts.

### Explain It Technically
*"How would you explain the Phase 0 DevOps foundation to a hiring panel?"*

We established a production-grade monorepo infrastructure: FastAPI backend (Python 3.13, Pydantic v2, SQLAlchemy async), React 19 frontend (TypeScript strict, Tailwind v4), and services orchestrated via Docker Compose (PostgreSQL 16 + TimescaleDB, Redis 7).

The CI/CD pipeline implements defense in depth: pre-commit hooks (ruff, mypy, ESLint) for local feedback, GitHub Actions (four parallel jobs with dependency caching) for clean-environment verification, and a custom security audit skill with BLOCK/WARN classification for secrets scanning. Dependabot automates supply chain management across pip, npm, and GitHub Actions ecosystems weekly.

All configuration follows 12-Factor App principles via Pydantic Settings â€” identical application code across environments with only configuration changes. This foundation directly supports P1-P5: TimescaleDB for ERA5 weather data, Redis for simulation caching, and CI for automated validation of wake models and power flow calculations against IEC standards.



