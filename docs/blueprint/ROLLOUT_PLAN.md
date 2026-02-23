# Rollout Plan (Concise, Actionable)

## Entry Criteria (before any live capital)
- [ ] Risk policy configured (daily loss, max position, exposure, spread/slippage, blackout windows)
- [ ] `/panic` and circuit breaker tested in non-prod
- [ ] Audit events visible in dashboard/API
- [ ] Worker heartbeat alerting active
- [ ] Runbooks approved by operators

## Phase 0 — Local + Integration (1–2 days)
Goal: prove command→risk→queue→worker→audit flow.
- Use dry-run workers only.
- Execute scripted scenarios: valid order, blocked order, duplicate command, stale heartbeat.
- Exit when all scenarios deterministic and logged.

## Phase 1 — Demo Accounts (3–5 days)
Goal: validate realistic broker behavior with no live capital.
- Run 2 symbols: XAUUSD, BTCUSD.
- 1 worker/account, minimum 2 demo accounts.
- Daily review: rejects, fill latency, slippage distribution, risk gate hit-rate.
- Exit gates:
  - No unresolved Sev-1/Sev-2 incidents for 72h
  - Panic stop drill < 60s to full halt
  - Backtest protocol completed and archived

## Phase 2 — Live Canary (5–7 days)
Goal: controlled live exposure.
- Allocate small fixed risk budget (e.g., 5–10% of intended production risk).
- Single strategy profile, limited trading window.
- Hard guardrails tightened vs demo.
- Exit gates:
  - Max drawdown under canary threshold
  - No policy bypasses
  - Incident MTTR within runbook target

## Phase 3 — Gradual Scale (ongoing)
Goal: increase capacity safely.
- Increase one axis at a time: accounts OR position sizing OR trading hours.
- Maintain weekly rollback drill.
- Keep a frozen “last-known-good” deployment for immediate revert.

## Rollback Triggers (any phase)
- Breach of daily loss limit
- Repeated unexplained order mismatch
- Risk gate malfunction
- Missing/stale heartbeats beyond threshold

## Rollback Action
1. Trigger `/panic`
2. Freeze new deployments
3. Revert to last-known-good release
4. Start incident runbook
5. Resume only after post-incident approval
