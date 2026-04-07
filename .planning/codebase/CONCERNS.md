# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Monolithic router and store hotspots:**
- Status: Confirmed
- Issue: Several backend routers and frontend stores combine transport logic, domain orchestration, data shaping, and UI state mutation in single large files. The largest hotspots are `backend/app/routers/p1.py`, `backend/app/routers/p2.py`, `backend/app/services/p3/iec61850_model.py`, `backend/app/services/p5/switching_programme.py`, `frontend/src/components/landing/LeafletWindFarmMap.tsx`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/landingStore.ts`, and `frontend/src/store/commissioningStore.ts`.
- Files: `backend/app/routers/p1.py`, `backend/app/routers/p2.py`, `backend/app/services/p3/iec61850_model.py`, `backend/app/services/p5/switching_programme.py`, `frontend/src/components/landing/LeafletWindFarmMap.tsx`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/landingStore.ts`, `frontend/src/store/commissioningStore.ts`
- Impact: High merge-conflict risk, slower code review, and hidden coupling between API contracts, simulation rules, and UI behavior.
- Fix approach: Split routing from domain services, and split frontend stores into smaller timer, selector, and mutation modules before adding more behavior.

**Mixed persistence models and deprecated state stores:**
- Status: Confirmed
- Issue: Durable database-backed flows coexist with module-level in-memory stores and a deprecated commissioning store. Mutable state is still held in `_relay_overrides`, `_ensemble_tasks`, and several service-level globals.
- Files: `backend/app/services/p5/programme_store.py`, `backend/app/services/p5/programme_repository.py`, `backend/app/services/p4/task_store.py`, `backend/app/services/p1/farm_comparison.py`, `backend/app/services/p2/bess.py`, `backend/app/services/p3/bay_controller.py`, `backend/app/services/p3/security.py`, `backend/app/services/p5/grid_code_testing.py`, `backend/app/routers/p2_protection.py`, `backend/app/routers/p1_farms.py`
- Impact: Restart data loss, different behavior between single-process development and multi-worker deployment, and hidden state leakage across requests and tests.
- Fix approach: Standardize on repository-backed persistence for mutable state and remove deprecated in-memory stores after explicit migration.

**Tests depend on private module internals:**
- Status: Confirmed
- Issue: Several tests mutate or assert on private globals instead of public behavior. `backend/tests/test_bess.py` writes to `bess_svc._state`, and `backend/tests/test_security.py` imports internal compliance constants as part of the test contract.
- Files: `backend/tests/test_bess.py`, `backend/tests/test_security.py`, `backend/app/services/p2/bess.py`, `backend/app/services/p3/security.py`
- Impact: Refactors become harder because implementation details are treated as stable API.
- Fix approach: Add public reset/test helpers where needed and move assertions to endpoint or service outputs rather than internal constants.

**Developer automation is Unix-centric while contributors also work on Windows:**
- Status: Confirmed
- Issue: Local workflow scripts assume POSIX shell semantics while CI runs only on Linux. `Makefile` uses `source`, `find`, and `rm -rf`, which do not map cleanly to PowerShell.
- Files: `Makefile`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`
- Impact: Local verification can fail for environment reasons that CI does not reproduce, increasing onboarding and debugging cost.
- Fix approach: Provide first-class PowerShell equivalents or documented cross-platform commands for lint, test, and cleanup tasks.

## Known Bugs

**Landing simulation stop contract is broken:**
- Status: Confirmed
- Symptoms: `stopSimulation()` does not clear the module-level interval even though tests and callers treat it as a real stop hook.
- Files: `frontend/src/store/landingStore.ts`, `frontend/tests/store/landingStore.test.ts`
- Trigger: Start the landing simulation, then call `stopSimulation()` or navigate away while the app remains open.
- Workaround: None in code. The store intentionally leaves the timer running for the app lifetime.

**Permit number generation can race under concurrent create requests:**
- Status: Confirmed
- Symptoms: Two concurrent permit-creation requests can calculate the same next sequence and collide on the unique permit number constraint.
- Files: `backend/app/routers/p3/permits.py`, `backend/app/models/ptw.py`
- Trigger: Concurrent `POST` requests to the permit creation flow.
- Workaround: Retry manually after the database rejects the duplicate number. No built-in retry or sequence allocator is present.

**Accepted ensemble jobs can disappear after restart or worker switch:**
- Status: Confirmed
- Symptoms: Polling a previously accepted forecast job can return `404 Task not found`.
- Files: `backend/app/routers/p4/ensemble.py`, `backend/app/services/p4/task_store.py`, `frontend/src/services/forecastApi.ts`
- Trigger: Backend restart, multi-worker deployment, or Redis unavailability during task execution.
- Workaround: Re-submit the ensemble request. The frontend already treats `Task not found` as a recoverable retry case.

## Security Considerations

**Caller-supplied identity on control endpoints:**
- Status: Confirmed
- Risk: Several safety-critical flows trust request-body identity and role fields instead of authenticated server context. Permit transitions, protection updates, switching execution, and emergency stop flows all accept actor identity directly from the caller.
- Files: `backend/app/main.py`, `backend/app/routers/p3/permits.py`, `backend/app/routers/p5/switching.py`, `backend/app/routers/p2_protection.py`, `backend/app/services/p3/rbac.py`
- Current mitigation: Domain-level permission checks exist in `backend/app/services/p3/rbac.py`, but they operate on `request.user_level`, `request.performed_by`, `request.executed_by`, `request.pic_name`, and `request.initiated_by` values supplied by the client.
- Recommendations: Add router-level auth dependencies, derive actor identity from tokens or session context, and treat request-body actor fields as display metadata only after authorization succeeds.

**Security compliance reporting overstates implemented controls:**
- Status: Confirmed
- Risk: The P3 cybersecurity module reports several controls as compliant using evidence strings such as `FastAPI JWT + RBAC (P3 SCADA)`, `OPC-UA client certificates`, and `Daily PostgreSQL dump to immutable S3`, but the repository does not implement corresponding auth, certificate, or backup plumbing in the application layer.
- Files: `backend/app/services/p3/security.py`, `backend/tests/test_security.py`, `backend/app/main.py`
- Current mitigation: None beyond static metadata and tests that assert those metadata flags.
- Recommendations: Split simulated training content from executable control evidence, and require each compliance claim to trace to code, infrastructure config, or external audit artifacts.

**Credential leakage and weak defaults in config and logging:**
- Status: Confirmed
- Risk: Default connection strings include development credentials and Redis connection logging prints the full URL.
- Files: `backend/app/config.py`, `backend/app/core/cache.py`
- Current mitigation: Environment overrides are supported through settings loading.
- Recommendations: Remove credential-bearing defaults, use placeholder DSNs for local docs, and redact secrets before logging connection URLs.

**CORS posture is acceptable for localhost now but risky if browser auth is added later:**
- Status: Inferred risk
- Risk: `allow_credentials=True` with wildcard methods and headers in `backend/app/main.py` is tolerable for current localhost development, but future cookie or session auth could widen the browser attack surface if allowed origins drift.
- Files: `backend/app/main.py`, `backend/app/config.py`
- Current mitigation: Allowed origins are currently limited to localhost values from settings.
- Recommendations: Narrow CORS methods and headers when auth is introduced and add integration tests that lock the expected origin policy.

## Performance Bottlenecks

**Forecast prediction and explainability endpoints retrain models per request:**
- Status: Confirmed
- Problem: `predict-xgboost`, `xgboost-shap`, `predict-lstm`, `lstm-mc-dropout`, `predict-tft`, and `tft-attention` all call `train_xgboost`, `train_lstm`, or `train_tft` inside request handling.
- Files: `backend/app/routers/p4/models.py`, `backend/app/services/p4/xgboost_model.py`, `backend/app/services/p4/lstm_model.py`, `backend/app/services/p4/tft_model.py`
- Cause: Training and inference are coupled inside endpoint-local helper closures instead of reusing trained artifacts.
- Improvement path: Persist trained models by dataset and config hash, cache explainability artifacts separately, and reserve retraining for explicit train endpoints or offline jobs.

**Background forecast jobs are process-local and only partially mirrored to Redis:**
- Status: Confirmed
- Problem: Ensemble jobs run via `asyncio.create_task`, while task state lives first in in-memory `_ensemble_tasks` and Redis writes are best-effort.
- Files: `backend/app/routers/p4/ensemble.py`, `backend/app/services/p4/task_store.py`
- Cause: The worker lifecycle is tied to one API process and Redis failures are swallowed so the in-memory copy becomes authoritative.
- Improvement path: Move long-running work to a durable queue or worker model and make Redis or database persistence authoritative instead of optional.

**Long-lived frontend timers keep stores active indefinitely:**
- Status: Confirmed
- Problem: Landing and SCADA stores maintain module-level intervals and timeouts that outlive component lifecycles.
- Files: `frontend/src/store/landingStore.ts`, `frontend/src/store/scadaStore.ts`, `frontend/src/hooks/usePolling.ts`
- Cause: Timers are owned outside React lifecycle and store stop semantics are inconsistent across modules.
- Improvement path: Centralize timer ownership, clear intervals on last-subscriber unmount, and add lifecycle tests around mount, unmount, and navigation.

**Large live-visualization components are likely to become render hotspots:**
- Status: Inferred risk
- Problem: The biggest frontend views combine large static data structures, SVG or map rendering, and live state updates in single components.
- Files: `frontend/src/components/landing/LeafletWindFarmMap.tsx`, `frontend/src/components/landing/WindFarmMap.tsx`, `frontend/src/components/p3/SubstationSLD.tsx`, `frontend/src/constants/turbinePartEducation.ts`
- Cause: Large render trees and data transforms sit close to frequently changing state.
- Improvement path: Split static geometry and educational data from reactive state, then profile rerender cost before adding more live indicators.

## Fragile Areas

**Commissioning JSONB serialization boundary:**
- Status: Confirmed
- Files: `backend/app/models/programme.py`, `backend/app/services/p5/programme_repository.py`
- Why fragile: The commissioning persistence layer manually serializes and deserializes deeply nested aggregate state into JSONB columns. Small schema changes can break old rows or silently drop fields.
- Safe modification: Change dataclasses, repository serializers, and database shape together. Add explicit round-trip tests before altering nested commissioning models.
- Test coverage: `backend/tests/test_switching_programme.py` exercises the domain aggregate, but no direct tests reference `ProgrammeRepository` persistence methods.

**Cross-store fault synchronization depends on event ordering and long-lived subscriptions:**
- Status: Confirmed
- Files: `frontend/src/store/scadaStore.ts`, `frontend/src/store/landingStore.ts`, `frontend/src/store/faultBus.ts`
- Why fragile: Fault state is mirrored across stores through an event bus while timers continue mutating the same data. Subscription order and cleanup behavior can change visible state without a type error.
- Safe modification: Update both producer and consumer stores in the same change set and verify subscription cleanup during navigation and remount flows.
- Test coverage: `frontend/tests/store/faultBus.test.ts` covers the bus primitive, but not the full SCADA-to-landing synchronization path under live timers.

**Commissioning delete flow bypasses the shared API client:**
- Status: Confirmed
- Files: `frontend/src/store/commissioningStore.ts`, `frontend/src/services/commissioningApi.ts`, `frontend/src/services/apiClient.ts`
- Why fragile: Most commissioning calls use the typed `commissioningApi` wrapper, but `deleteProgramme` issues a raw `fetch`. Future headers, auth, retry, or error normalization added to `apiClient` will not apply consistently.
- Safe modification: Move delete into `frontend/src/services/commissioningApi.ts` and keep the store focused on state transitions.
- Test coverage: `frontend/tests/store/commissioningStore.test.ts` covers store behavior, but not parity with the shared HTTP client contract.

## Scaling Limits

**Single-process mutable state caps horizontal scaling:**
- Status: Confirmed
- Current capacity: Correct behavior assumes one warm API process holding in-memory relay overrides, task status, and simulation state.
- Limit: Multiple API workers or restarts cause divergent state across `backend/app/routers/p2_protection.py`, `backend/app/services/p4/task_store.py`, and several simulator services.
- Scaling path: Move mutable state behind shared persistence and make stateless API workers the default deployment model.

**P4 forecasting is bounded by API worker CPU and memory:**
- Status: Confirmed
- Current capacity: One request can trigger full XGBoost, LSTM, or TFT training inside the API process, and ensemble training runs for minutes in the background.
- Limit: Concurrent forecast or explainability calls will contend for CPU, memory, and threadpool time in `backend/app/routers/p4/models.py` and `backend/app/routers/p4/ensemble.py`.
- Scaling path: Separate training from inference, queue long-running jobs, and pre-build reusable model artifacts for common scenarios.

## Dependencies at Risk

**Frontend toolchain depends on an optional native binary that can block local verification:**
- Status: Confirmed in the current workspace
- Risk: Local Vite or Vitest startup on Windows can fail when the `@tailwindcss/oxide-win32-x64-msvc` native binary is unavailable, even though Linux CI remains green.
- Impact: Local test and dev startup become unreliable for Windows contributors.
- Migration plan: Pin or repair the native dependency path, document a clean reinstall path, or choose a pure-JS fallback if Windows support is required.

**Workflow validation is Linux-only:**
- Status: Confirmed
- Risk: CI in `.github/workflows/ci.yml` validates Python and Node workflows only on `ubuntu-latest`, while local contributor automation also targets PowerShell and Windows.
- Impact: Windows-specific script and native package failures can ship unnoticed until a contributor hits them locally.
- Migration plan: Add at least one Windows validation job or document unsupported platforms explicitly in `README.md` and contributor tooling.

## Missing Critical Features

**Real authentication and identity propagation:**
- Status: Confirmed gap
- Problem: Safety-critical API operations do not derive actor identity from authenticated server context.
- Blocks: Credible access control for P2 protection settings, P3 permit transitions, and P5 switching actions in anything beyond a trust-all simulator environment.

**Durable job orchestration and persistent mutable simulator state:**
- Status: Confirmed gap
- Problem: Long-running forecast tasks and several mutable simulator domains are still process-local.
- Blocks: Reliable restart behavior, horizontal scaling, and production-grade observability for forecast and control workflows.

**Evidence-backed security compliance accounting:**
- Status: Confirmed gap
- Problem: Security posture reporting is driven by static claim metadata instead of executable controls or traceable audit evidence.
- Blocks: Trustworthy compliance dashboards, external review, and future security hardening work because the current model mixes implemented behavior with narrative claims.

## Test Coverage Gaps

**Commissioning repository round-trip coverage is missing:**
- What's not tested: Direct save, reload, and list behavior for `ProgrammeRepository` and JSONB serialization boundaries.
- Files: `backend/app/services/p5/programme_repository.py`, `backend/app/models/programme.py`, `backend/tests/test_switching_programme.py`
- Risk: Persistence schema drift can break stored programmes without failing the current domain-only test suite.
- Priority: High

**Security tests validate metadata flags rather than auth enforcement:**
- What's not tested: Token or session enforcement on control endpoints, server-derived user identity, and rejection of forged actor fields.
- Files: `backend/tests/test_security.py`, `backend/app/routers/p3/permits.py`, `backend/app/routers/p5/switching.py`, `backend/app/routers/p2_protection.py`
- Risk: Security regressions can go unnoticed because tests pass as long as static compliance metadata stays unchanged.
- Priority: High

**Timer and cross-store lifecycle behavior is not covered end-to-end:**
- What's not tested: Landing and SCADA timer cleanup, navigation-driven remount behavior, and the full SCADA-to-landing fault propagation path.
- Files: `frontend/src/store/landingStore.ts`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/faultBus.ts`, `frontend/tests/store/landingStore.test.ts`, `frontend/tests/store/faultBus.test.ts`
- Risk: Memory leaks, stale subscriptions, and inconsistent live-state rendering can ship without a failing test.
- Priority: High

**Cross-platform contributor workflow is not validated:**
- What's not tested: Windows and PowerShell install, lint, and test flows for the repo's documented developer workflow.
- Files: `Makefile`, `.github/workflows/ci.yml`, `frontend/vite.config.ts`
- Risk: Local environment failures can block contributors even when Linux CI is healthy.
- Priority: Medium

---

*Concerns audit: 2026-04-01*
