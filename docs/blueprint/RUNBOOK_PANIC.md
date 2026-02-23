# Runbook — Panic Stop

Purpose: immediate containment when trading behavior is unsafe or uncertain.

## Trigger Conditions
- Unexpected rapid drawdown
- Suspected strategy malfunction
- Broker/API desync risk
- Operator judgment: "state is untrusted"

## Primary Action (T+0 to T+60s)
1. Execute `/panic` (global)
2. Confirm API state: `panic=true`, new entries blocked
3. Confirm all workers received panic event
4. Announce in ops channel: "PANIC ACTIVE" + timestamp + incident commander

## Verification (T+1 to T+5m)
- [ ] No new entry orders accepted
- [ ] Open positions state captured (symbol, size, pnl)
- [ ] Circuit breaker state recorded
- [ ] Audit event emitted for each step

## Position Handling Policy
- Default: **no new exposure**.
- Existing positions:
  - If policy says flatten: close all in staged batches
  - If policy says hold/hedge: enforce static cap, no adds
- Record rationale for any non-flatten decision.

## Communications
- Internal update every 15 minutes until stabilized.
- Include: exposure, unrealized PnL, remaining risk, next checkpoint.

## Exit Panic (only with approval)
Prerequisites:
- [ ] Root cause identified or bounded
- [ ] Fix validated in safe environment
- [ ] Risk lead + incident commander approval

Recovery steps:
1. Disable panic in control plane
2. Re-enable one account only (canary)
3. Observe for one full decision cycle
4. Gradually restore per rollout plan

## Artifacts to Preserve
- Command timeline
- Risk decisions
- Worker heartbeats
- Broker responses/fill logs
- Operator decision log
