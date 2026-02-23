# Architecture Decisions (Execution Blueprint)

Scope: decisions needed to run LuminaMT5 safely in production-like conditions.

## AD-01 — API as Control Plane, Python Worker as Execution Plane
- **Decision:** Keep Fastify API stateless for command intake/risk/audit; execute trades only in Python MT5 workers.
- **Why:** MT5 bindings and broker connectivity are best handled in Python; API remains scalable and easier to secure.
- **Operational rule:** API never places broker orders directly.

## AD-02 — One Worker per MT5 Account
- **Decision:** Isolate execution by account (process-level isolation).
- **Why:** Prevent account-level faults from cascading; enables per-account restart/drain.
- **Operational rule:** Shared strategy logic allowed; shared execution state not allowed.

## AD-03 — Risk Gates in Two Stages (Pre-Trade + Post-Trade)
- **Decision:** Enforce risk before queueing and validate state after fills.
- **Why:** Pre-trade blocks bad intents; post-trade catches drift/slippage/partial-fill effects.
- **Operational rule:** Any failed gate blocks new commands for affected scope.

## AD-04 — Fail-Closed by Default
- **Decision:** On missing market data, stale heartbeat, or policy lookup failure, deny execution.
- **Why:** Safety over availability for trading systems.
- **Operational rule:** Manual override requires explicit incident record and expiry.

## AD-05 — Idempotent Command/Order Lifecycle
- **Decision:** Every command has deterministic idempotency key and terminal status.
- **Why:** Retries and webhook duplicates are expected.
- **Operational rule:** Duplicate command IDs must return existing outcome; never duplicate fills intentionally.

## AD-06 — Circuit Breaker + Global Panic Stop
- **Decision:** Keep independent controls:
  1. circuit breaker (automatic, threshold-based)
  2. panic stop (operator-invoked, immediate)
- **Why:** Covers both algorithmic anomalies and human-detected risk.
- **Operational rule:** Panic stop pauses new entries globally; exits/hedges allowed per policy.

## AD-07 — Append-Only Audit Trail
- **Decision:** Persist command/risk/order/incident events in immutable audit log.
- **Why:** Compliance, postmortems, and operator trust.
- **Operational rule:** No hard deletes for audit rows; corrections are compensating events.

## AD-08 — Progressive Environment Promotion
- **Decision:** Demo-only first, then limited capital live canary, then broader rollout.
- **Why:** Reduce unknowns and protect capital.
- **Operational rule:** Promotion requires explicit checklist sign-off from prior stage.
