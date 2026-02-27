---
name: github-push
description: "Commit and push code to GitHub securely. Trigger this skill when the user says: 'GitHub push', 'git push', 'git commit', 'git commit and push', 'push to GitHub', 'commit and push', 'push changes', 'commit changes', or any variation involving committing or pushing code to the remote repository. If the user says 'push and merge', 'commit and merge', 'git push and merge', or any variation including 'merge', enable AUTO-MERGE mode (Phase 8)."
allowed-tools: Bash, Read, Grep, Glob
---

# GitHub Push — Secure Commit & Push Workflow

You are a strict GitHub security gatekeeper for the Baltic Wind HV Control Platform.
This is an open-source educational project — every push is public. Act accordingly.

---

## PHASE 1: RECONNAISSANCE (run all in parallel)

Execute these four commands simultaneously:

1. **Git status** (never use `-uall`):
   ```
   git status
   ```

2. **Full diff** (staged + unstaged):
   ```
   git diff HEAD
   ```

3. **Recent commit history** (for message style):
   ```
   git log --oneline -10
   ```

4. **Current branch and remote tracking**:
   ```
   git branch -vv
   ```

---

## PHASE 2: SECURITY AUDIT (MANDATORY — never skip)

### 2.1 Secrets Scanner

Search the ENTIRE diff output for leaked secrets. Block the push if ANY match:

| Pattern | Description | Action |
|---------|-------------|--------|
| `password\s*=\s*['"]` | Hardcoded password (code) | BLOCK |
| `PASSWORD[:=]\s*.+` (not in docker-compose) | Hardcoded password (config) | WARN — ask user |
| `secret\s*=\s*['"]` | Hardcoded secret | BLOCK |
| `api[_-]?key\s*=\s*['"]` | API key in code | BLOCK |
| `token\s*=\s*['"]` | Hardcoded token | BLOCK |
| `AWS_ACCESS_KEY_ID` | AWS credential | BLOCK |
| `AWS_SECRET_ACCESS_KEY` | AWS credential | BLOCK |
| `PRIVATE.KEY` | Private key material | BLOCK |
| `-----BEGIN.*PRIVATE KEY-----` | PEM private key | BLOCK |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI/Anthropic API key | BLOCK |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access token | BLOCK |
| `postgres://.*:.*@` | Database connection string with password | BLOCK |
| `redis://.*:.*@` | Redis connection string with password | BLOCK |

**Allowed exceptions (WARN only, not BLOCK):**
- `docker-compose.yml` with `POSTGRES_PASSWORD: postgres` — local dev default, overridden in production via env vars
- `config.py` with `localhost` defaults — Pydantic Settings overrides these from environment in production
- Vite proxy config with `localhost` target — dev server only, not shipped to production

When a WARN exception applies, still **report it to the user** with the reason it's acceptable. Never silently skip.

### 2.2 Dangerous File Scanner

Check if ANY of these files are staged or about to be committed. Block if found:

| File/Pattern | Reason | Action |
|-------------|--------|--------|
| `.env` | Environment secrets | BLOCK |
| `.env.*` (except `.env.example`) | Environment secrets | BLOCK |
| `*.pem`, `*.key`, `*.p12`, `*.pfx` | Certificates/keys | BLOCK |
| `credentials.json` | Service account keys | BLOCK |
| `*.sqlite`, `*.db` | Database files | BLOCK |
| `id_rsa`, `id_ed25519` | SSH private keys | BLOCK |
| `*.nc` (NetCDF ERA5 data) | Large data files (use .gitignore) | BLOCK |
| `*.grib`, `*.grib2` | Weather data files | BLOCK |
| `node_modules/` | Dependencies (use .gitignore) | BLOCK |
| `__pycache__/` | Python cache (use .gitignore) | BLOCK |
| `.venv/`, `venv/` | Virtual environment | BLOCK |
| Files > 10 MB | GitHub soft limit | WARN |

### 2.3 Code Quality Checks

Scan the diff for common issues:

| Check | Pattern | Action |
|-------|---------|--------|
| Debug statements | `console.log`, `print(`, `debugger`, `breakpoint()` | WARN — ask user |
| TODO/FIXME | `TODO`, `FIXME`, `HACK`, `XXX` | WARN — inform user |
| Disabled tests | `@pytest.mark.skip`, `xit(`, `xdescribe(` | WARN — ask user |
| Hardcoded localhost | `localhost:`, `127.0.0.1:` | WARN — ask user |

---

## PHASE 3: SECURITY VERDICT

### If ANY BLOCK found:
```
SECURITY AUDIT FAILED

[List each blocked item with file path and line number]

These items MUST be resolved before pushing to the public repository.
Recommended actions:
- Move secrets to .env (which is in .gitignore)
- Add large data files to .gitignore
- Remove cached/generated files from staging

I will NOT proceed with the push until all BLOCK items are resolved.
```
**Do NOT proceed. Stop here. Help the user fix the issues.**

### If only WARN items found:
Present EVERY warning to the user in a numbered list with file path, line content, and why it triggered.
**You MUST ask for explicit user confirmation before proceeding.** Do NOT auto-approve WARN items.
If there are 0 BLOCK items and >0 WARN items, say: "N warnings found (0 blockers). Proceed? [list follows]"

### If clean (0 BLOCK, 0 WARN):
Proceed to Phase 3.5.

---

## PHASE 3.5: CI LINT GATE (MANDATORY — never skip)

Run ALL 5 CI lint checks locally BEFORE staging. These match `.github/workflows/ci.yml` exactly.
**If ANY check fails, fix the code BEFORE proceeding. Do NOT push and hope CI passes.**

Run backend checks (sequentially — each must pass before reporting):
```bash
cd backend && ruff check app/ tests/ && ruff format --check app/ tests/ && mypy app/
```

Run frontend checks (sequentially):
```bash
cd frontend && npx tsc --noEmit && npx eslint src/
```

### The 5 checks and common fixes:

| # | Check | Command | Common Failures | Fix |
|---|-------|---------|-----------------|-----|
| 1 | **Ruff lint** | `ruff check app/ tests/` | B904 (raise from), I001 (import sort), F401 (unused import) | `ruff check --fix` auto-fixes most |
| 2 | **Ruff format** | `ruff format --check app/ tests/` | Formatting drift | `ruff format app/ tests/` to auto-fix |
| 3 | **Mypy** | `mypy app/` | Missing type annotations, untyped `dict` returns, missing imports | Add type annotations manually |
| 4 | **TypeScript** | `npx tsc --noEmit` | Type mismatches, missing interface fields | Fix type errors manually |
| 5 | **ESLint** | `npx eslint src/` | React Compiler memoization, exhaustive-deps | Remove manual `useMemo`/`useCallback` (React Compiler handles it) |

### Coding rules to prevent failures:

- **Always** use `from None` or `from exc` when re-raising `HTTPException` inside `except` blocks (B904)
- **Always** use `datetime.UTC` not `timezone.utc` (UP017)
- **Always** annotate return types fully — `dict[str, object]` not `dict` (mypy type-arg)
- **Always** annotate all function parameters — no bare `def foo(bar):` (mypy no-untyped-def)
- **Never** use `useMemo` with unstable deps — let React Compiler handle memoization
- **Always** run `ruff format` after `ruff check --fix` (fix can break formatting)

### Verdict:

| Result | Action |
|--------|--------|
| All 5 pass | Proceed to Phase 4 |
| Any fail | Fix the code, re-run the failing check, confirm it passes, then proceed |

---

## PHASE 4: STAGING

### 4.1 Smart Staging

- **NEVER** use `git add -A` or `git add .` blindly
- Stage files individually by name: `git add file1 file2 file3`
- Group related files logically
- If there are many files, present the list to the user and ask for confirmation before staging

### 4.2 Verify Staging

After staging, run `git status` to confirm exactly what will be committed.
Present the staged files to the user in a clear summary.

---

## PHASE 5: COMMIT MESSAGE

### 5.1 Commit Message Format

Follow the project convention:

```
[SCOPE] Short imperative description (max 72 chars)

- Detail 1: what changed and why
- Detail 2: what changed and why
- Detail 3: what changed and why

Standards: IEC XXXXX (if applicable)
```

**SCOPE values:**
- `[P1]` — Wind Resource & Layout (PyWake, ERA5, AEP)
- `[P2]` — Grid Integration (Pandapower, ANDES, FRT)
- `[P3]` — SCADA & Automation (IEC 61850, GOOSE, PtW)
- `[P4]` — AI Forecasting (XGBoost, LSTM, TFT)
- `[P5]` — Commissioning (Switching, LOTO, SAT)
- `[DOCS]` — Documentation changes
- `[INFRA]` — Docker, CI/CD, config, tooling
- `[FIX]` — Bug fixes
- `[TEST]` — Test additions/changes
- `[REFACTOR]` — Code restructuring (no behavior change)

### 5.2 Message Rules

- First line: imperative mood ("Add X", "Fix Y", "Update Z"), max 72 characters
- Blank line after first line
- Body: bullet points explaining what and why (not how — the diff shows how)
- Reference IEC/IEEE standards if the change implements a standard
- Do NOT add Co-Authored-By or Signed-off-by trailers — commits are authored by the user only
- Use HEREDOC syntax to pass the message to git

---

## PHASE 6: COMMIT & PUSH

### 6.1 Branch Strategy

- If on `main`, create a new branch first: `git checkout -b <scope>/<short-description>`
- Branch naming: `<scope>/<short-kebab-description>` (e.g., `p1/wind-resource-api`, `docs/update-lessons`, `fix/scada-colors`)
- If already on a feature branch, stay on it

### 6.2 Create Commit

```bash
git commit -m "$(cat <<'EOF'
[SCOPE] Short description here

- Detail 1
- Detail 2
EOF
)"
```

### 6.3 Pre-Push Checks

Before pushing, verify:
1. Commit was created successfully (`git log -1` to confirm)
2. Branch is correct (should be pushing to the right branch)
3. Remote is correct (`git remote -v`)

### 6.4 Push

```bash
git push -u origin <branch-name>
```

### 6.5 Create Pull Request

After pushing, create a PR:

```bash
gh pr create --title "[SCOPE] Short description" --body "$(cat <<'EOF'
## Summary
- What changed and why

## Test plan
- [ ] CI passes
EOF
)"
```

### 6.6 Post-Push Verification

After push completes:
1. Run `git status` to confirm clean working tree
2. Run `git log --oneline -3` to show the committed state
3. Present the PR URL to the user

---

## PHASE 7: SUMMARY REPORT

Present a final summary:

```
PUSH COMPLETE

Branch:    main
Commit:    abc1234 — [SCOPE] Description
Files:     X files changed, Y insertions, Z deletions
Security:  All checks passed
Remote:    https://github.com/user/repo/commit/abc1234

[List of files that were committed]
```

---

## PHASE 8: AUTO-MERGE (only if user said "merge")

**This phase ONLY runs when the user's trigger phrase includes "merge"** (e.g., "push and merge", "commit and merge"). If the user only said "push" or "commit", SKIP this phase entirely.

### 8.1 Wait for CI

```bash
gh pr checks <PR-NUMBER> --watch
```

- Wait for ALL required status checks to pass
- Timeout: 5 minutes max — if CI hasn't finished, inform the user and stop

### 8.2 Merge Decision

| CI Result | Action |
|-----------|--------|
| All checks pass | Proceed to merge |
| Any check fails | **STOP** — show the failure, do NOT merge, help user fix |

### 8.3 Squash Merge

```bash
gh pr merge <PR-NUMBER> --squash
```

### 8.4 Update Local Main

```bash
git checkout main && git pull origin main
```

### 8.5 Clean Up

- Delete the local feature branch: `git branch -d <branch-name>`
- Remote branch is auto-deleted by GitHub after merge

### 8.6 Post-Merge Summary

Update the Phase 7 summary to include:

```
MERGE COMPLETE

PR:        #XX — [SCOPE] Description
Merged:    squash into main
CI:        All checks passed
Local:     main updated, feature branch cleaned up
```

---

## SAFETY RULES (ABSOLUTE — never override)

1. **NEVER force push** (`--force`, `-f`) unless the user explicitly says "force push" AND you warn them about the consequences first
2. **NEVER push to main/master with --force** — refuse entirely, explain why
3. **NEVER skip the security audit** — even if the user says "just push it quickly"
4. **NEVER commit files matching .gitignore patterns** — check .gitignore first
5. **NEVER amend a commit that has already been pushed** — create a new commit instead
6. **NEVER use --no-verify** to skip pre-commit hooks unless user explicitly requests it
7. **NEVER modify git config** (user.name, user.email, etc.)
8. **If the security audit finds a BLOCK item, STOP** — do not offer workarounds to bypass the check
9. **Always create NEW commits** — never amend unless the user explicitly says "amend"
10. **If there are no changes to commit, say so** — do not create empty commits
